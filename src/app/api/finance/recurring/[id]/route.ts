// ═════ تکرارشونده — PATCH/DELETE /api/finance/recurring/[id] ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser } from "@/lib/core/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const { id } = await ctx.params;

    const existing = await db.financeRecurring.findFirst({ where: { id, userId: auth.id } });
    if (!existing) return fail("قلم تکرارشونده یافت نشد", 404);

    const body = await parseJson<{
      title?: string; amount?: number; cadence?: string;
      isActive?: boolean; nextRunDate?: string; description?: string;
    }>(req);

    const data: Record<string, unknown> = {};
    if (body?.title?.trim()) data.title = body.title.trim().slice(0, 100);
    if (body?.amount !== undefined) {
      const a = Math.round(Number(body.amount));
      if (!a || a <= 0) return fail("مبلغ باید مثبت باشد");
      data.amount = a;
    }
    if (body?.cadence && ["weekly", "monthly", "yearly"].includes(body.cadence)) data.cadence = body.cadence;
    if (body?.isActive !== undefined) data.isActive = Boolean(body.isActive);
    if (body?.nextRunDate) {
      const d = new Date(body.nextRunDate);
      if (!isNaN(d.getTime())) data.nextRunDate = d;
    }
    if (body?.description !== undefined) data.description = body.description?.slice(0, 300);

    const recurring = await db.financeRecurring.update({
      where: { id },
      data,
      include: {
        account: { select: { name: true, color: true } },
        category: { select: { name: true, color: true, icon: true } },
      },
    });
    return ok({ recurring });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const { id } = await ctx.params;

    const existing = await db.financeRecurring.findFirst({ where: { id, userId: auth.id } });
    if (!existing) return fail("قلم تکرارشونده یافت نشد", 404);

    await db.financeRecurring.delete({ where: { id } });
    return ok({ deleted: true });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
