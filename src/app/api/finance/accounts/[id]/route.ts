// ═════ حساب مالی — PATCH/DELETE /api/finance/accounts/[id] ═════
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

    const existing = await db.financeAccount.findFirst({ where: { id, userId: auth.id } });
    if (!existing) return fail("حساب یافت نشد", 404);

    const body = await parseJson<{
      name?: string; type?: string; initialBalance?: number;
      color?: string; note?: string; isActive?: boolean;
    }>(req);

    const data: Record<string, unknown> = {};
    if (body?.name?.trim()) data.name = body.name.trim().slice(0, 60);
    if (body?.type && ["cash", "bank", "card", "wallet"].includes(body.type)) data.type = body.type;
    if (body?.initialBalance !== undefined) {
      const v = Number(body.initialBalance) || 0;
      if (Math.abs(v) > 2_000_000_000) return fail("مبلغ بیش از حد مجاز است");
      data.initialBalance = Math.round(v);
    }
    if (body?.color) data.color = body.color;
    if (body?.note !== undefined) data.note = body.note?.slice(0, 200);
    if (body?.isActive !== undefined) data.isActive = Boolean(body.isActive);

    const account = await db.financeAccount.update({ where: { id }, data });
    return ok({ account });
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

    const existing = await db.financeAccount.findFirst({ where: { id, userId: auth.id } });
    if (!existing) return fail("حساب یافت نشد", 404);

    // اگر تراکنشی به حساب وصل است → فقط بایگانی؛ وگرنه حذف کامل
    const txCount = await db.financeTransaction.count({
      where: { OR: [{ accountId: id }, { transferToId: id }] },
    });
    if (txCount > 0) {
      await db.financeAccount.update({ where: { id }, data: { isActive: false } });
      return ok({ archived: true, message: "حساب به دلیل وجود تراکنش بایگانی شد" });
    }

    await db.financeAccount.delete({ where: { id } });
    return ok({ deleted: true });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
