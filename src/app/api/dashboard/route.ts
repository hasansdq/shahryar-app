// ═════ داشبورد کاربر — GET /api/dashboard ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, getUser } from "@/lib/core/api";

export async function GET(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);

    const now = new Date();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      activeGoals,
      completedGoals,
      todayTasks,
      featuredBusinesses,
      cityNews,
      memoriesCount,
    ] = await Promise.all([
      db.goal.findMany({
        where: { userId: auth.id, status: "active" },
        include: { tasks: { orderBy: { sortOrder: "asc" }, take: 3 } },
        orderBy: [{ priority: "desc" }, { deadline: "asc" }],
        take: 4,
      }),
      db.goal.count({ where: { userId: auth.id, status: "completed" } }),
      db.task.findMany({
        where: {
          status: { in: ["todo", "in_progress"] },
          goal: { userId: auth.id, status: "active" },
          OR: [{ dueDate: null }, { dueDate: { gte: startOfDay } }],
        },
        include: { goal: { select: { id: true, title: true, color: true } } },
        orderBy: [{ status: "desc" }, { sortOrder: "asc" }],
        take: 5,
      }),
      db.business.findMany({
        where: { isActive: true, isFeatured: true },
        include: { category: { select: { name: true, slug: true, icon: true, color: true } } },
        orderBy: { rating: "desc" },
        take: 6,
      }),
      db.cityData.findMany({
        where: { isPublished: true },
        orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
        take: 4,
      }),
      db.aIMemory.count({ where: { userId: auth.id } }),
    ]);

    // آمار وظایف امروز
    const [todayDone, todayTotal] = await Promise.all([
      db.task.count({
        where: {
          status: "done",
          completedAt: { gte: startOfDay },
          goal: { userId: auth.id },
        },
      }),
      db.task.count({
        where: {
          status: { in: ["todo", "in_progress", "done"] },
          goal: { userId: auth.id, status: "active" },
          OR: [
            { dueDate: { gte: startOfDay, lte: new Date(startOfDay.getTime() + 86400000) } },
          ],
        },
      }),
    ]);

    return ok({
      goals: activeGoals.slice(0, 4),
      stats: {
        activeGoals: activeGoals.length,
        completedGoals,
        todayTasks: todayTasks.length,
        todayDone,
        memoriesCount,
      },
      todayTasksList: todayTasks,
      featuredBusinesses: featuredBusinesses.map((b) => ({
        id: b.id, slug: b.slug, name: b.name, rating: b.rating,
        category: b.category, district: b.district, isVerified: b.isVerified,
      })),
      cityNews,
    });
  } catch (err) {
    console.error("خطای داشبورد:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
