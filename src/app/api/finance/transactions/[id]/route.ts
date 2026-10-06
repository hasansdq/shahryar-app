// ═════ تراکنش مالی — PATCH/DELETE /api/finance/transactions/[id] ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";

type Ctx = { params: Promise<{ id: string }> };
const MAX_AMOUNT = 2_000_000_000;

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("finance");
    if (gate) return gate;
    const { id } = await ctx.params;

    const existing = await db.financeTransaction.findFirst({ where: { id, userId: auth.id } });
    if (!existing) return fail("تراکنش یافت نشد", 404);

    const body = await parseJson<{
      amount?: number; categoryId?: string | null; date?: string;
      description?: string; accountId?: string; transferToId?: string | null;
    }>(req);

    const data: Record<string, unknown> = {};
    if (body?.amount !== undefined) {
      const amount = Math.round(Number(body.amount));
      if (!amount || amount <= 0) return fail("مبلغ باید مثبت باشد");
      if (amount > MAX_AMOUNT) return fail("مبلغ بیش از حد مجاز است");
      data.amount = amount;
    }
    if (body?.accountId) {
      const account = await db.financeAccount.findFirst({
        where: { id: body.accountId, userId: auth.id },
      });
      if (!account) return fail("حساب یافت نشد");
      data.accountId = account.id;
    }
    if (body?.transferToId !== undefined) {
      if (body.transferToId) {
        const target = await db.financeAccount.findFirst({
          where: { id: body.transferToId, userId: auth.id },
        });
        if (!target) return fail("حساب مقصد یافت نشد");
        if (target.id === (data.accountId || existing.accountId)) return fail("حساب مبدأ و مقصد یکسان است");
        data.transferToId = target.id;
      } else {
        data.transferToId = null;
      }
    }
    if (body?.categoryId !== undefined) {
      if (body.categoryId) {
        const cat = await db.financeCategory.findFirst({
          where: { id: body.categoryId, userId: auth.id },
        });
        if (!cat) return fail("دسته یافت نشد");
        data.categoryId = cat.id;
      } else {
        data.categoryId = null;
      }
    }
    if (body?.date) {
      const d = new Date(body.date);
      if (!isNaN(d.getTime())) data.date = d;
    }
    if (body?.description !== undefined) data.description = body.description?.trim().slice(0, 300);

    const transaction = await db.financeTransaction.update({
      where: { id },
      data,
      include: {
        account: { select: { name: true, color: true } },
        category: { select: { name: true, color: true, icon: true } },
        transferTo: { select: { name: true } },
      },
    });

    return ok({ transaction });
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

    const existing = await db.financeTransaction.findFirst({ where: { id, userId: auth.id } });
    if (!existing) return fail("تراکنش یافت نشد", 404);

    await db.financeTransaction.delete({ where: { id } });
    return ok({ deleted: true });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
