// ═════ حافظه‌های هوش مصنوعی کاربران (ادمین) — GET /api/admin/memories ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, getAdmin } from "@/lib/core/api";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const category = searchParams.get("category") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(5, parseInt(searchParams.get("limit") || "20")));

    const where: Record<string, unknown> = {};
    if (q) {
      where.OR = [
        { key: { contains: q } },
        { value: { contains: q } },
        { user: { OR: [{ fullName: { contains: q } }, { phone: { contains: q } }] } },
      ];
    }
    if (category) where.category = category;

    const [memories, total] = await Promise.all([
      db.aIMemory.findMany({
        where,
        include: { user: { select: { fullName: true, phone: true, avatarColor: true } } },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.aIMemory.count({ where }),
    ]);

    // توزیع دسته‌ها
    const categoryStats = await db.aIMemory.groupBy({
      by: ["category"],
      _count: true,
      orderBy: { _count: { category: "desc" } },
    });

    return ok({
      memories,
      categoryStats,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
