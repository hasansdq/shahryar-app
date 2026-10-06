// ═════ آمار داشبورد مدیریت — GET /api/admin/stats ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, getAdmin } from "@/lib/core/api";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const weekAgo = new Date(Date.now() - 7 * 86400000);

    const [
      usersTotal, usersToday, usersActive,
      businessesTotal, businessesFeatured, categoriesTotal,
      goalsTotal, tasksDone,
      chatSessionsTotal, messagesTotal, messagesToday,
      memoriesTotal, reviewsTotal, cityDataTotal,
      logsToday,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { createdAt: { gte: startOfDay } } }),
      db.user.count({ where: { status: "ACTIVE" } }),
      db.business.count(),
      db.business.count({ where: { isFeatured: true } }),
      db.businessCategory.count(),
      db.goal.count(),
      db.task.count({ where: { status: "done" } }),
      db.chatSession.count(),
      db.chatMessage.count(),
      db.chatMessage.count({ where: { createdAt: { gte: startOfDay }, role: "user" } }),
      db.aIMemory.count(),
      db.businessReview.count(),
      db.cityData.count(),
      db.activityLog.count({ where: { createdAt: { gte: startOfDay } } }),
    ]);

    // رشد کاربران ۷ روز اخیر
    const usersGrowth = await db.user.findMany({
      where: { createdAt: { gte: weekAgo } },
      select: { createdAt: true },
    });
    const growthByDay: Array<{ day: string; count: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(Date.now() - i * 86400000);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      growthByDay.push({
        day: new Intl.DateTimeFormat("fa-IR", { weekday: "short" }).format(dayStart),
        count: usersGrowth.filter((u) => u.createdAt >= dayStart && u.createdAt < dayEnd).length,
      });
    }

    // پیام‌های هوشیار ۷ روز اخیر
    const messagesWeek = await db.chatMessage.findMany({
      where: { createdAt: { gte: weekAgo }, role: "user" },
      select: { createdAt: true },
    });
    const chatActivity: Array<{ day: string; count: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(Date.now() - i * 86400000);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      const dayLabel = new Intl.DateTimeFormat("fa-IR", { weekday: "short" }).format(dayStart);
      chatActivity.push({
        day: dayLabel,
        count: messagesWeek.filter((m) => m.createdAt >= dayStart && m.createdAt < dayEnd).length,
      });
    }

    // محبوب‌ترین اصناف
    const topBusinesses = await db.business.findMany({
      orderBy: [{ viewCount: "desc" }],
      take: 5,
      select: { id: true, name: true, viewCount: true, rating: true, category: { select: { name: true } } },
    });

    // آخرین کاربران
    const recentUsers = await db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, fullName: true, phone: true, createdAt: true, status: true },
    });

    // آخرین فعالیت‌ها
    const recentLogs = await db.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, action: true, level: true, createdAt: true, actorType: true },
    });

    return ok({
      totals: {
        usersTotal, usersToday, usersActive,
        businessesTotal, businessesFeatured, categoriesTotal,
        goalsTotal, tasksDone,
        chatSessionsTotal, messagesTotal, messagesToday,
        memoriesTotal, reviewsTotal, cityDataTotal, logsToday,
      },
      usersGrowth: growthByDay,
      chatActivity,
      topBusinesses,
      recentUsers,
      recentLogs,
    });
  } catch (err) {
    console.error("خطای آمار مدیریت:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
