// ═════ قرض — PATCH (پرداخت/تسویه)/DELETE /api/finance/debts/[id] ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("finance", "enableDebts");
    if (gate) return gate;
    const { id } = await ctx.params;

    const existing = await db.financeDebt.findFirst({ where: { id, userId: auth.id } });
    if (!existing) return fail("قرض یافت نشد", 404);

    const body = await parseJson<{
      pay?: number; personName?: string; amount?: number;
      remainingAmount?: number; dueDate?: string | null;
      description?: string; status?: string;
    }>(req);

    const data: Record<string, unknown> = {};

    // ─── پرداخت قسط (کاهش مانده) / افزایش مانده ───
    if (body?.pay !== undefined) {
      const pay = Math.round(Number(body.pay));
      if (!pay) return fail("مبلغ نامعتبر است");
      const next = existing.remainingAmount - pay;
      if (next < 0) return fail("مبلغ پرداخت بیش از مانده است");
      data.remainingAmount = next;
      if (next === 0) {
        data.status = "settled";
        data.settledAt = new Date();
      }
      await logActivity({
        userId: auth.id,
        action: "finance.debt.pay",
        entity: "financeDebt",
        entityId: existing.id,
        details: { pay, personName: existing.personName },
      });
    }

    if (body?.personName?.trim()) data.personName = body.personName.trim().slice(0, 80);
    if (body?.amount !== undefined) {
      const a = Math.round(Number(body.amount));
      if (!a || a <= 0) return fail("مبلغ کل باید مثبت باشد");
      data.amount = a;
      if (body.remainingAmount === undefined && existing.remainingAmount > a) {
        data.remainingAmount = a;
      }
    }
    if (body?.remainingAmount !== undefined) {
      const r = Math.round(Number(body.remainingAmount));
      if (r < 0) return fail("مانده نمی‌تواند منفی باشد");
      data.remainingAmount = r;
      if (r === 0) {
        data.status = "settled";
        data.settledAt = new Date();
      }
    }
    if (body?.dueDate !== undefined) {
      if (body.dueDate) {
        const d = new Date(body.dueDate);
        if (!isNaN(d.getTime())) data.dueDate = d;
      } else {
        data.dueDate = null;
      }
    }
    if (body?.description !== undefined) data.description = body.description?.slice(0, 300);
    if (body?.status && ["open", "settled"].includes(body.status)) {
      data.status = body.status;
      if (body.status === "settled") {
        data.remainingAmount = 0;
        data.settledAt = new Date();
      }
    }

    const debt = await db.financeDebt.update({ where: { id }, data });
    return ok({ debt });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("finance", "enableDebts");
    if (gate) return gate;
    const { id } = await ctx.params;

    const existing = await db.financeDebt.findFirst({ where: { id, userId: auth.id } });
    if (!existing) return fail("قرض یافت نشد", 404);

    await db.financeDebt.delete({ where: { id } });
    return ok({ deleted: true });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
