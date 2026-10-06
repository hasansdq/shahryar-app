// ═════ دسته‌بندی مالی — PATCH/DELETE /api/finance/categories/[id] ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("finance");
    if (gate) return gate;
    const { id } = await ctx.params;

    const existing = await db.financeCategory.findFirst({ where: { id, userId: auth.id } });
    if (!existing) return fail("دسته یافت نشد", 404);

    const body = await parseJson<{ name?: string; color?: string; icon?: string }>(req);
    const data: Record<string, unknown> = {};
    if (body?.name?.trim()) data.name = body.name.trim().slice(0, 40);
    if (body?.color) data.color = body.color;
    if (body?.icon) data.icon = body.icon;

    const category = await db.financeCategory.update({ where: { id }, data });
    return ok({ category });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("finance");
    if (gate) return gate;
    const { id } = await ctx.params;

    const existing = await db.financeCategory.findFirst({ where: { id, userId: auth.id } });
    if (!existing) return fail("دسته یافت نشد", 404);
    if (existing.kind === "builtin") return fail("دسته‌های پیش‌فرض قابل حذف نیستند");

    // تراکنش‌های این دسته بدون دسته می‌شوند (SetNull)
    await db.financeCategory.delete({ where: { id } });
    return ok({ deleted: true });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
