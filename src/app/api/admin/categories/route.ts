// ═════ مدیریت دسته‌بندی‌ها (ادمین) — GET/POST /api/admin/categories ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getAdmin, assertWritableAdmin } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);


    const categories = await db.businessCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { businesses: true } } },
    });

    return ok({
      categories: categories.map((c) => ({
        ...c,
        businessesCount: c._count.businesses,
        _count: undefined,
      })),
    });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);
    const writeGate = assertWritableAdmin(admin);
    if (writeGate) return writeGate;

    const body = await parseJson<{
      name: string; icon?: string; color?: string; description?: string; sortOrder?: number;
    }>(req);
    if (!body?.name?.trim()) return fail("نام دسته‌بندی الزامی است");

    const name = body.name.trim();
    const slug = name.replace(/[\s\u200c]+/g, "-").replace(/[^\p{L}\p{N}-]/gu, "").toLowerCase();
    const exists = await db.businessCategory.findFirst({
      where: { OR: [{ name }, { slug }] },
    });
    if (exists) return fail("دسته‌بندی با این نام قبلاً ثبت شده است");

    const maxOrder = await db.businessCategory.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });

    const category = await db.businessCategory.create({
      data: {
        name,
        slug,
        icon: body.icon || "Store",
        color: body.color || "#0e8a5a",
        description: body.description?.slice(0, 300),
        sortOrder: body.sortOrder ?? (maxOrder?.sortOrder ?? 0) + 1,
      },
    });

    await logActivity({
      adminId: admin.id, actorType: "admin",
      action: "admin.category_create", entity: "category", entityId: category.id,
      details: { name },
    });

    return ok({ category });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
