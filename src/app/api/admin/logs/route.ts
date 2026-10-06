// ═════ لاگ فعالیت‌های سیستم (ادمین) — GET /api/admin/logs ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, getAdmin } from "@/lib/core/api";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);

    const { searchParams } = new URL(req.url);
    const level = searchParams.get("level") || "";
    const actorType = searchParams.get("actorType") || "";
    const action = (searchParams.get("action") || "").trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "30")));

    const where: Record<string, unknown> = {};
    if (level) where.level = level;
    if (actorType) where.actorType = actorType;
    if (action) where.action = { contains: action };

    const [logs, total] = await Promise.all([
      db.activityLog.findMany({
        where,
        include: {
          user: { select: { fullName: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.activityLog.count({ where }),
    ]);

    // آمار لاگ‌ها
    const [errorCount, warningCount] = await Promise.all([
      db.activityLog.count({ where: { level: "error" } }),
      db.activityLog.count({ where: { level: "warning" } }),
    ]);

    return ok({
      logs,
      stats: { errorCount, warningCount },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
