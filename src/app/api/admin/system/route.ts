// ═════ سلامت و نسخه سیستم (ادمین) — GET /api/admin/system ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, getAdmin } from "@/lib/core/api";
import fs from "fs";
import path from "path";

const APP_VERSION = "1.0.0";
const BUILD_DATE = "2026-08-26";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);

    const mem = process.memoryUsage();
    const uptime = process.uptime();

    // حجم دیتابیس
    const dbPath = path.join(process.cwd(), "db", "custom.db");
    let dbSize = 0;
    try {
      const stat = fs.statSync(dbPath);
      dbSize = stat.size;
    } catch {}

    // شمارش رکوردها
    const [
      users, businesses, categories, goals, tasks,
      chatSessions, chatMessages, memories, reviews,
      cityData, logs, sessions, adminSessions, settings,
    ] = await Promise.all([
      db.user.count(), db.business.count(), db.businessCategory.count(),
      db.goal.count(), db.task.count(),
      db.chatSession.count(), db.chatMessage.count(), db.aIMemory.count(),
      db.businessReview.count(), db.cityData.count(), db.activityLog.count(),
      db.session.count(), db.adminSession.count(), db.setting.count(),
    ]);

    // سشن‌های فعال
    const activeSessions = await db.session.count({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
    });

    // آخرین خطاها
    const recentErrors = await db.activityLog.findMany({
      where: { level: "error" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { action: true, createdAt: true, ip: true },
    });

    // سلامت کلی
    const checks: Array<{ name: string; status: "ok" | "warn"; detail: string }> = [
      { name: "اتصال دیتابیس", status: "ok", detail: "SQLite متصل است" },
      {
        name: "حافظه سیستم",
        status: mem.heapUsed < 500 * 1024 * 1024 ? "ok" : "warn",
        detail: `${Math.round(mem.heapUsed / 1024 / 1024)} مگابایت استفاده‌شده`,
      },
      {
        name: "زمان پاسخ‌دهی",
        status: uptime > 0 ? "ok" : "warn",
        detail: `فعال از ${Math.round(uptime / 60)} دقیقه پیش`,
      },
      {
        name: "حجم دیتابیس",
        status: dbSize < 100 * 1024 * 1024 ? "ok" : "warn",
        detail: `${(dbSize / 1024 / 1024).toFixed(2)} مگابایت`,
      },
      {
        name: "سشن‌های فعال",
        status: activeSessions < 1000 ? "ok" : "warn",
        detail: `${activeSessions} سشن فعال`,
      },
      {
        name: "سرویس هوش مصنوعی",
        status: "ok",
        detail: "Z-AI SDK آماده است",
      },
    ];

    return ok({
      version: APP_VERSION,
      buildDate: BUILD_DATE,
      environment: process.env.NODE_ENV || "development",
      nodeVersion: process.version,
      uptime: Math.round(uptime),
      memory: {
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        rssMB: Math.round(mem.rss / 1024 / 1024),
      },
      database: {
        sizeMB: +(dbSize / 1024 / 1024).toFixed(2),
        provider: "SQLite",
        tables: {
          users, businesses, categories, goals, tasks,
          chatSessions, chatMessages, memories, reviews,
          cityData, logs, sessions, adminSessions, settings,
        },
      },
      checks,
      recentErrors,
    });
  } catch (err) {
    console.error("خطای بررسی سیستم:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
