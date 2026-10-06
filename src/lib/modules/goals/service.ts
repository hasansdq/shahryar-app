// ═════ سرویس اهداف — منطق مشترک (نسخه ۲: تحلیل‌محور) ═════
import { db } from "@/lib/db";
import { monthKeyOf, monthRange, recentMonthKeys, monthLabel } from "@/lib/modules/finance/service";

export const GOAL_CATEGORIES = ["personal", "health", "career", "education", "financial", "family"] as const;
export const GOAL_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;

/**
 * محاسبه مجدد پیشرفت هدف بر اساس وضعیت وظایف.
 * منطق کامل:
 *  - ۱۰۰٪ → تکمیل هدف (status=completed + completedAt)
 *  - افت از ۱۰۰٪ → بازگشت هدف به فعال (رفع باگ قبلی: هدفِ تکمیل‌شده با پیشرفت <۱۰۰ گیر نمی‌کند)
 */
export async function recalcProgress(goalId: string): Promise<number> {
  const [goal, total, done] = await Promise.all([
    db.goal.findUnique({ where: { id: goalId }, select: { status: true } }),
    db.task.count({ where: { goalId } }),
    db.task.count({ where: { goalId, status: "done" } }),
  ]);
  if (!goal) return 0;

  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  const data: { progress: number; status?: string; completedAt?: Date | null } = { progress };
  if (progress === 100) {
    data.status = "completed";
    data.completedAt = new Date();
  } else if (progress < 100 && goal.status === "completed") {
    data.status = "active";
    data.completedAt = null;
  }
  await db.goal.update({ where: { id: goalId }, data });
  return progress;
}

/** روزِ باقیمانده تا مهلت (منفی = گذشته) */
export function daysLeft(deadline: Date | string | null): number | null {
  if (!deadline) return null;
  const d = typeof deadline === "string" ? new Date(deadline) : deadline;
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a - b) / 86400000);
}

export interface GoalStats {
  totals: {
    goalsCount: number; activeCount: number; completedCount: number; archivedCount: number;
    completionRate: number; totalTasks: number; doneTasks: number; inProgressTasks: number;
    avgActiveProgress: number; overdueTasks: number; dueSoonGoals: number; staleGoals: number;
  };
  byCategory: Array<{ category: string; count: number; completed: number; avgProgress: number }>;
  byPriority: Array<{ priority: string; count: number }>;
  completedByMonth: Array<{ monthKey: string; label: string; count: number }>;
  activity: { streak: number; activeDays: number; last30: Array<{ day: string; count: number }>; mostProductiveDay: string | null };
  overdue: Array<{ id: string; title: string; dueDate: string; goalId: string; goalTitle: string; priority: string }>;
  upcoming: Array<{ goalId: string; title: string; deadline: string; daysLeft: number; progress: number; category: string }>;
}

/** چیدمان کامل آمار و تحلیل اهداف کاربر */
export async function buildGoalStats(userId: string): Promise<GoalStats> {
  const now = new Date();
  const sixMonths = recentMonthKeys(6);
  const firstMonth = monthRange(sixMonths[0]).start; // شروع قدیمی‌ترین ماه جلالی
  const days30 = new Date(now.getTime() - 30 * 86400000);

  const [goals, completedGoals, activityLogs] = await Promise.all([
    db.goal.findMany({
      where: { userId },
      include: { tasks: { select: { status: true, dueDate: true, priority: true, goalId: true, id: true, title: true } } },
    }),
    db.goal.findMany({
      where: { userId, status: "completed", completedAt: { gte: firstMonth } },
      select: { completedAt: true },
    }),
    db.activityLog.findMany({
      where: { userId, action: { startsWith: "task." }, createdAt: { gte: days30 } },
      select: { createdAt: true },
    }),
  ]);

  const active = goals.filter((g) => g.status === "active");
  const completed = goals.filter((g) => g.status === "completed");
  const archived = goals.filter((g) => g.status === "archived");

  // ─── وظایف ───
  const allTasks = goals.flatMap((g) => g.tasks.map((t) => ({ ...t, goalTitle: g.title, goalStatus: g.status })));
  const doneTasks = allTasks.filter((t) => t.status === "done").length;
  const inProgressTasks = allTasks.filter((t) => t.status === "in_progress").length;
  const overdue = allTasks
    .filter((t) => t.dueDate && t.dueDate < now && t.status !== "done" && t.goalStatus === "active")
    .sort((a, b) => (a.dueDate!.getTime() ?? 0) - (b.dueDate!.getTime() ?? 0))
    .slice(0, 12)
    .map((t) => ({
      id: t.id, title: t.title,
      dueDate: (t.dueDate as Date).toISOString(),
      goalId: t.goalId, goalTitle: t.goalTitle, priority: t.priority,
    }));

  // ─── دسته‌بندی و اولویت ───
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
    .map(([category, e]) => ({ category, count: e.count, completed: e.completed, avgProgress: Math.round(e.progressSum / e.count) }))
    .sort((a, b) => b.count - a.count);

  const prioMap = new Map<string, number>();
  for (const g of active) prioMap.set(g.priority, (prioMap.get(g.priority) || 0) + 1);
  const byPriority = ["critical", "high", "medium", "low"]
    .map((p) => ({ priority: p, count: prioMap.get(p) || 0 }))
    .filter((p) => p.count > 0);

  // ─── تکمیل در ۶ ماه جلالی اخیر ───
  const monthCounts = new Map<string, number>(sixMonths.map((k) => [k, 0]));
  for (const g of completedGoals) {
    const key = monthKeyOf(g.completedAt as Date);
    if (monthCounts.has(key)) monthCounts.set(key, (monthCounts.get(key) || 0) + 1);
  }
  const completedByMonth = sixMonths.map((k) => ({ monthKey: k, label: monthLabel(k), count: monthCounts.get(k) || 0 }));

  // ─── فعالیت و زنجیره (streak) ───
  const dayMap = new Map<string, number>();
  for (const log of activityLogs) {
    const key = log.createdAt.toISOString().slice(0, 10);
    dayMap.set(key, (dayMap.get(key) || 0) + 1);
  }
  const last30: Array<{ day: string; count: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10);
    last30.push({ day: d, count: dayMap.get(d) || 0 });
  }
  let streak = 0;
  const todayKey = now.toISOString().slice(0, 10);
  const yesterdayKey = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  if (dayMap.has(todayKey) || dayMap.has(yesterdayKey)) {
    let cursor = dayMap.has(todayKey) ? todayKey : yesterdayKey;
    while (dayMap.has(cursor)) {
      streak++;
      const prev = new Date(cursor + "T00:00:00");
      prev.setDate(prev.getDate() - 1);
      cursor = prev.toISOString().slice(0, 10);
    }
  }
  const weekdays = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];
  const weekdayCount = new Array(7).fill(0);
  for (const log of activityLogs) weekdayCount[log.createdAt.getDay()]++;
  const maxWd = weekdayCount.indexOf(Math.max(...weekdayCount));
  const mostProductiveDay = Math.max(...weekdayCount) > 0 ? weekdays[maxWd] : null;

  // ─── مهلت‌ها ───
  const upcoming = active
    .filter((g) => g.deadline)
    .map((g) => ({ goal: g, left: daysLeft(g.deadline) ?? 9999 }))
    .filter(({ left }) => left >= 0 && left <= 14)
    .sort((a, b) => a.left - b.left)
    .slice(0, 6)
    .map(({ goal, left }) => ({
      goalId: goal.id, title: goal.title,
      deadline: (goal.deadline as Date).toISOString(),
      daysLeft: left, progress: goal.progress, category: goal.category,
    }));

  const dueSoonGoals = active.filter((g) => g.deadline && daysLeft(g.deadline) !== null && (daysLeft(g.deadline) as number) >= 0 && (daysLeft(g.deadline) as number) <= 7).length;
  const staleGoals = active.filter((g) => now.getTime() - g.updatedAt.getTime() > 14 * 86400000 && g.progress < 100).length;
  const avgActiveProgress = active.length > 0 ? Math.round(active.reduce((s, g) => s + g.progress, 0) / active.length) : 0;

  return {
    totals: {
      goalsCount: goals.length,
      activeCount: active.length,
      completedCount: completed.length,
      archivedCount: archived.length,
      completionRate: active.length + completed.length > 0
        ? Math.round((completed.length / (active.length + completed.length)) * 100) : 0,
      totalTasks: allTasks.length, doneTasks, inProgressTasks,
      avgActiveProgress, overdueTasks: overdue.length, dueSoonGoals, staleGoals,
    },
    byCategory, byPriority, completedByMonth,
    activity: { streak, activeDays: dayMap.size, last30, mostProductiveDay },
    overdue, upcoming,
  };
}
