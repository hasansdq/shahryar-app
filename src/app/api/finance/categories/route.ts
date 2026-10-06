// ═════ دسته‌بندی‌های مالی — GET/POST /api/finance/categories ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { ensureDefaultCategories } from "@/lib/modules/finance/service";

export async function GET(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("finance");
    if (gate) return gate;

    await ensureDefaultCategories(auth.id);
    const categories = await db.financeCategory.findMany({
      where: { userId: auth.id },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
    });
    return ok({ categories });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("finance");
    if (gate) return gate;

    const body = await parseJson<{ name: string; type?: string; color?: string; icon?: string }>(req);
    if (!body?.name?.trim()) return fail("نام دسته الزامی است");
    const type = body.type === "income" ? "income" : "expense";

    // حداکثر ۱۲ دسته‌ی سفارشی از هر نوع
    const customCount = await db.financeCategory.count({
      where: { userId: auth.id, type, kind: "custom" },
    });
    if (customCount >= 12) return fail("حداکثر ۱۲ دسته‌ی سفارشی از هر نوع مجاز است");

    const maxOrder = await db.financeCategory.findFirst({
      where: { userId: auth.id, type },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const category = await db.financeCategory.create({
      data: {
        userId: auth.id,
        name: body.name.trim().slice(0, 40),
        type,
        color: body.color || (type === "income" ? "#27ae60" : "#e67e22"),
        icon: body.icon || "tag",
        kind: "custom",
        sortOrder: (maxOrder?.sortOrder || 0) + 1,
      },
    });

    return ok({ category });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
