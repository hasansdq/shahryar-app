// ═════ ویرایش/حذف هدف — PATCH/DELETE /api/goals/[id] ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { recalcProgress } from "@/lib/modules/goals/service";
import { listActiveGoalCategories } from "@/lib/modules/cms/service";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("goals");
    if (gate) return gate;

    const { id } = await params;
    const goal = await db.goal.findFirst({ where: { id, userId: auth.id } });
    if (!goal) return fail("هدف یافت نشد", 404);

    const body = await parseJson<{
      title?: string; description?: string; category?: string; priority?: string;
      color?: string; deadline?: string | null; status?: string; progress?: number;
    }>(req);
    if (!body) return fail("درخواست نامعتبر است");

    const data: Record<string, unknown> = {};
    if (body.title?.trim()) data.title = body.title.trim().slice(0, 120);
    if (body.description !== undefined) data.description = body.description?.slice(0, 1000);
    if (body.category) {
      // فقط دسته‌های فعالِ مدیریت‌شده در CMS پذیرفته می‌شود
      const activeCats = await listActiveGoalCategories();
      if (activeCats.some((c) => c.key === body.category)) {
        data.category = body.category;
      }
    }
    if (body.priority && ["low", "medium", "high", "critical"].includes(body.priority)) {
      data.priority = body.priority;
    }
    if (body.color) data.color = body.color;
    if (body.deadline !== undefined) {
      if (body.deadline === null || body.deadline === "") {
        data.deadline = null;
      } else {
        const d = new Date(body.deadline);
        if (!isNaN(d.getTime())) data.deadline = d;
      }
    }
    if (body.status && ["active", "completed", "archived"].includes(body.status)) {
      data.status = body.status;
      if (body.status === "completed") data.completedAt = new Date();
      if (body.status === "active") data.completedAt = null;
    }
    if (typeof body.progress === "number") {
      data.progress = Math.min(100, Math.max(0, body.progress));
    }

    const updated = await db.goal.update({ where: { id }, data, include: { tasks: true } });

    await logActivity({ userId: auth.id, action: "goal.update", entity: "goal", entityId: id });

    return ok({ goal: updated });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("goals");
    if (gate) return gate;

    const { id } = await params;
    const goal = await db.goal.findFirst({ where: { id, userId: auth.id } });
    if (!goal) return fail("هدف یافت نشد", 404);

    await db.goal.delete({ where: { id } });
    await logActivity({ userId: auth.id, action: "goal.delete", entity: "goal", entityId: id });

    return ok({ message: "هدف حذف شد" });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
