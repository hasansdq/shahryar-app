// ═════ هدف مالی — PATCH (واریز/برزش)/DELETE /api/finance/goals/[id] ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("finance");
    if (gate) return gate;
    const { id } = await ctx.params;

    const existing = await db.financeGoal.findFirst({ where: { id, userId: auth.id } });
    if (!existing) return fail("هدف یافت نشد", 404);

    const body = await parseJson<{
      contribute?: number; title?: string; targetAmount?: number;
      deadline?: string | null; color?: string; note?: string; status?: string;
    }>(req);

    const data: Record<string, unknown> = {};

    // ─── واریز به هدف (افزودن مبلغ به پس‌انداز فعلی) ───
    if (body?.contribute !== undefined) {
      const add = Math.round(Number(body.contribute));
      if (!add) return fail("مبلغ واریز نامعتبر است");
      if (Math.abs(add) > 2_000_000_000) return fail("مبلغ بیش از حد مجاز است");
      const next = existing.currentAmount + add;
      if (next < 0) return fail("موجودی هدف منفی نمی‌شود");
      const nextAmount = Math.min(next, existing.targetAmount);
      data.currentAmount = nextAmount;
      // رساندن هدف به سقف = تکمیل خودکار
      if (nextAmount >= existing.targetAmount) {
        data.status = "completed";
        data.completedAt = new Date();
      }
      await logActivity({
        userId: auth.id,
        action: "finance.goal.contribute",
        entity: "financeGoal",
        entityId: existing.id,
        details: { add, title: existing.title },
      });
    }

    if (body?.title?.trim()) data.title = body.title.trim().slice(0, 100);
    if (body?.targetAmount !== undefined) {
      const t = Math.round(Number(body.targetAmount));
      if (!t || t <= 0) return fail("مبلغ هدف باید مثبت باشد");
      data.targetAmount = t;
    }
    if (body?.deadline !== undefined) {
      if (body.deadline) {
        const d = new Date(body.deadline);
        if (!isNaN(d.getTime())) data.deadline = d;
      } else {
        data.deadline = null;
      }
    }
    if (body?.color) data.color = body.color;
    if (body?.note !== undefined) data.note = body.note?.slice(0, 300);
    if (body?.status && ["active", "completed", "cancelled"].includes(body.status)) {
      data.status = body.status;
      if (body.status === "completed") data.completedAt = new Date();
    }

    const goal = await db.financeGoal.update({ where: { id }, data });
    return ok({ goal });
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

    const existing = await db.financeGoal.findFirst({ where: { id, userId: auth.id } });
    if (!existing) return fail("هدف یافت نشد", 404);

    await db.financeGoal.delete({ where: { id } });
    return ok({ deleted: true });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
