// ═════ بودجه — DELETE /api/finance/budgets/[id] ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, getUser, guardModule } from "@/lib/core/api";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("finance", "enableBudgets");
    if (gate) return gate;
    const { id } = await ctx.params;

    const existing = await db.financeBudget.findFirst({ where: { id, userId: auth.id } });
    if (!existing) return fail("بودجه یافت نشد", 404);

    await db.financeBudget.delete({ where: { id } });
    return ok({ deleted: true });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
