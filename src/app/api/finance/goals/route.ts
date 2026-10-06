// ═════ اهداف مالی — GET/POST /api/finance/goals ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";

export async function GET(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("finance");
    if (gate) return gate;

    const goals = await db.financeGoal.findMany({
      where: { userId: auth.id },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });

    return ok({
      goals,
      stats: {
        active: goals.filter((g) => g.status === "active").length,
        completed: goals.filter((g) => g.status === "completed").length,
        totalTarget: goals.filter((g) => g.status === "active").reduce((s, g) => s + g.targetAmount, 0),
        totalSaved: goals.filter((g) => g.status === "active").reduce((s, g) => s + g.currentAmount, 0),
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
    const gate = await guardModule("finance");
    if (gate) return gate;

    const body = await parseJson<{
      title: string; targetAmount: number; currentAmount?: number;
      deadline?: string; color?: string; note?: string;
    }>(req);

    if (!body?.title?.trim()) return fail("عنوان هدف الزامی است");
    const targetAmount = Math.round(Number(body.targetAmount));
    if (!targetAmount || targetAmount <= 0) return fail("مبلغ هدف باید مثبت باشد");
    if (targetAmount > 2_000_000_000) return fail("مبلغ بیش از حد مجاز است");
    const currentAmount = Math.round(Number(body.currentAmount) || 0);
    if (currentAmount < 0 || currentAmount > targetAmount) return fail("مبلغ ذخیره‌شده نامعتبر است");

    const activeCount = await db.financeGoal.count({
      where: { userId: auth.id, status: "active" },
    });
    if (activeCount >= 20) return fail("حداکثر ۲۰ هدف فعال مجاز است");

    let deadline: Date | null = null;
    if (body.deadline) {
      const d = new Date(body.deadline);
      if (!isNaN(d.getTime())) deadline = d;
    }

    const goal = await db.financeGoal.create({
      data: {
        userId: auth.id,
        title: body.title.trim().slice(0, 100),
        targetAmount,
        currentAmount,
        deadline,
        color: body.color || "#0e8a5a",
        note: body.note?.slice(0, 300),
        status: currentAmount >= targetAmount ? "completed" : "active",
        completedAt: currentAmount >= targetAmount ? new Date() : null,
      },
    });

    await logActivity({
      userId: auth.id,
      action: "finance.goal.create",
      entity: "financeGoal",
      entityId: goal.id,
      details: { title: goal.title, targetAmount },
    });

    return ok({ goal });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
