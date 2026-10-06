// ═════ تحلیل اهداف کاربران — GET /api/admin/goals-analytics ═════
// آمار جامع ماژول اهداف در سطح کل سامانه (داده‌های غیرحساس)
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, getAdmin } from "@/lib/core/api";
import { recentMonthKeys, monthRange, monthKeyOf, monthLabel } from "@/lib/modules/finance/service";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);

    const now = new Date();
    const months = recentMonthKeys(6);
    const firstMonthStart = monthRange(months[0]).start;

    const [goals, tasksAgg, completedGoals] = await Promise.all([
      db.goal.findMany({
        select: {
          id: true, status: true, category: true, priority: true, progress: true,
          deadline: true, completedAt: true, createdAt: true, updatedAt: true, userId: true,
          user: { select: { id: true, fullName: true, phone: true } },
        },
      }),
      db.task.groupBy({ by: ["status"], _count: { _all: true } }),
      db.goal.findMany({
        where: { status: "completed", completedAt: { gte: firstMonthStart } },
        select: { completedAt: true },
      }),
    ]);

    // ─── وضعیت‌ها ───
    const active = goals.filter((g) => g.status === "active");
    const completed = goals.filter((g) => g.status === "completed");
    const archived = goals.filter((g) => g.status === "archived");
    const completionRate =
      active.length + completed.length > 0
        ? Math.round((completed.length / (active.length + completed.length)) * 100)
        : 0;

    // ─── وظایف ───
    const statusCount = new Map(tasksAgg.map((t) => [t.status, t._count._all]));
    const tasksTotal =
      (statusCount.get("todo") || 0) +
      (statusCount.get("in_progress") || 0) +
      (statusCount.get("done") || 0);

    // ─── دسته‌بندی ───
    const catMap = new Map<string, { count: number; completed: number; progressSum: number }>();
    for (const g of goals) {
      if (g.status === "archived") continue;
      const e = catMap.get(g.category) || { count: 0, completed: 0, progressSum: 0 };
      e.count++;
      if (g.status === "completed") e.completed++;
      e.progressSum += g.progress;
      catMap.set(g.category, e);
    }
    const byCategory = Array.from(catMap.entries())
      .map(([category, e]) => ({
        category,
        count: e.count,
        completed: e.completed,
        avgProgress: Math.round(e.progressSum / e.count),
      }))
      .sort((a, b) => b.count - a.count);

    // ─── اولویت اهداف فعال ───
    const prioMap = new Map<string, number>();
    for (const g of active) prioMap.set(g.priority, (prioMap.get(g.priority) || 0) + 1);
    const byPriority = ["critical", "high", "medium", "low"]
      .map((p) => ({ priority: p, count: prioMap.get(p) || 0 }))
      .filter((p) => p.count > 0);

    // ─── تکمیل ماهانه (۶ ماه جلالی) ───
    const monthCounts = new Map<string, number>(months.map((k) => [k, 0]));
    for (const g of completedGoals) {
      const key = monthKeyOf(g.completedAt as Date);
      if (monthCounts.has(key)) monthCounts.set(key, (monthCounts.get(key) || 0) + 1);
    }
    const completedByMonth = months.map((k) => ({
      monthKey: k,
      label: monthLabel(k),
      count: monthCounts.get(k) || 0,
    }));

    // ─── سنجه‌های کیفی ───
    const staleGoals = active.filter(
      (g) => now.getTime() - g.updatedAt.getTime() > 14 * 86400000
    ).length;
    const dueSoon = active.filter((g) => {
      if (!g.deadline) return false;
      const left = Math.round((new Date(g.deadline).getTime() - now.getTime()) / 86400000);
      return left >= 0 && left <= 7;
    }).length;
    const overdueDeadlines = active.filter((g) => {
      if (!g.deadline) return false;
      return new Date(g.deadline).getTime() < now.getTime();
    }).length;

    // ─── به تفکیک کاربر ───
    interface UserAgg {
      name: string; phone: string; total: number; active: number;
      completed: number; progressSum: number; lastUpdate: Date;
    }
    const userMap = new Map<string, UserAgg>();
    for (const g of goals) {
      if (!g.user) continue;
      const e =
        userMap.get(g.userId) ||
        {
          name: g.user.fullName || "بی‌نام",
          phone: g.user.phone,
          total: 0, active: 0, completed: 0, progressSum: 0,
          lastUpdate: g.updatedAt,
        };
      e.total++;
      if (g.status === "active") {
        e.active++;
        e.progressSum += g.progress;
      }
      if (g.status === "completed") e.completed++;
      if (g.updatedAt > e.lastUpdate) e.lastUpdate = g.updatedAt;
      userMap.set(g.userId, e);
    }
    const perUser = Array.from(userMap.entries())
      .map(([id, e]) => ({
        userId: id,
        name: e.name,
        phone: e.phone,
        total: e.total,
        active: e.active,
        completed: e.completed,
        avgActiveProgress: e.active > 0 ? Math.round(e.progressSum / e.active) : 0,
        lastUpdate: e.lastUpdate,
      }))
      .sort((a, b) => b.total - a.total);

    return ok({
      totals: {
        goalsTotal: goals.length,
        activeCount: active.length,
        completedCount: completed.length,
        archivedCount: archived.length,
        completionRate,
        tasksTotal,
        tasksDone: statusCount.get("done") || 0,
        tasksInProgress: statusCount.get("in_progress") || 0,
        avgActiveProgress:
          active.length > 0 ? Math.round(active.reduce((s, g) => s + g.progress, 0) / active.length) : 0,
        staleGoals,
        dueSoon,
        overdueDeadlines,
      },
      byCategory,
      byPriority,
      completedByMonth,
      perUser,
    });
  } catch (err) {
    console.error("خطای تحلیل اهداف:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
