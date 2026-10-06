// ═════ قرض‌ها و طلب‌ها — GET/POST /api/finance/debts ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";

export async function GET(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("finance", "enableDebts");
    if (gate) return gate;

    const debts = await db.financeDebt.findMany({
      where: { userId: auth.id },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    });

    return ok({
      debts,
      stats: {
        iOweOpen: debts.filter((d) => d.status === "open" && d.direction === "i_owe").reduce((s, d) => s + d.remainingAmount, 0),
        owedToMeOpen: debts.filter((d) => d.status === "open" && d.direction === "owed_to_me").reduce((s, d) => s + d.remainingAmount, 0),
        openCount: debts.filter((d) => d.status === "open").length,
      },
    });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("finance", "enableDebts");
    if (gate) return gate;

    const body = await parseJson<{
      direction: string; personName: string; amount: number;
      dueDate?: string; description?: string;
    }>(req);

    if (!body?.personName?.trim()) return fail("نام طرف حساب الزامی است");
    const direction = body.direction === "owed_to_me" ? "owed_to_me" : "i_owe";
    const amount = Math.round(Number(body.amount));
    if (!amount || amount <= 0) return fail("مبلغ باید مثبت باشد");
    if (amount > 2_000_000_000) return fail("مبلغ بیش از حد مجاز است");

    let dueDate: Date | null = null;
    if (body.dueDate) {
      const d = new Date(body.dueDate);
      if (!isNaN(d.getTime())) dueDate = d;
    }

    const debt = await db.financeDebt.create({
      data: {
        userId: auth.id,
        direction,
        personName: body.personName.trim().slice(0, 80),
        amount,
        remainingAmount: amount,
        dueDate,
        description: body.description?.slice(0, 300),
      },
    });

    await logActivity({
      userId: auth.id,
      action: "finance.debt.create",
      entity: "financeDebt",
      entityId: debt.id,
      details: { personName: debt.personName, direction, amount },
    });

    return ok({ debt });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
