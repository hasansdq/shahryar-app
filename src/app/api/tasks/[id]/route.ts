// ═════ ویرایش/جابجایی/حذف وظیفه — PATCH/DELETE /api/tasks/[id] ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { recalcProgress } from "@/lib/modules/goals/service";
import { logActivity } from "@/lib/core/logger";

interface TaskPatch {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  // ─── جابجایی Kanban ───
  newStatus?: string;   // تغییر ستون
  newGoalId?: string;   // جابجایی بین اهداف
  newOrder?: number;    // موقعیت جدید
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("goals");
    if (gate) return gate;

    const { id } = await params;
    const task = await db.task.findFirst({
      where: { id },
      include: { goal: { select: { id: true, userId: true } } },
    });
    if (!task || task.goal.userId !== auth.id) return fail("وظیفه یافت نشد", 404);

    const body = await parseJson<TaskPatch>(req);
    if (!body) return fail("درخواست نامعتبر است");

    // ─── حالت ۱: جابجایی بین ستون‌های کانبان ───
    if (body.newStatus) {
      if (!["todo", "in_progress", "done"].includes(body.newStatus)) {
        return fail("وضعیت نامعتبر است");
      }

      const targetGoalId = body.newGoalId || task.goalId;

      // اعتبارسنجی هدف مقصد (اگر جابجایی بین اهداف است)
      if (body.newGoalId && body.newGoalId !== task.goalId) {
        const targetGoal = await db.goal.findFirst({ where: { id: body.newGoalId, userId: auth.id } });
        if (!targetGoal) return fail("هدف مقصد یافت نشد", 404);
      }

      // یافتن موقعیت جدید در ستون مقصد
      const columnTasks = await db.task.findMany({
        where: { goalId: targetGoalId, status: body.newStatus },
        orderBy: { sortOrder: "asc" },
        select: { id: true, sortOrder: true },
      });

      const insertAt = Math.min(body.newOrder ?? columnTasks.length, columnTasks.length);
      const movedTaskId = task.id;

      // بازچینش ستون مقصد با جای‌درج
      let order = 0;
      for (const t of columnTasks) {
        if (order === insertAt) order++;
        await db.task.update({
          where: { id: t.id },
          data: { sortOrder: order },
        });
        order++;
      }

      await db.task.update({
        where: { id: task.id },
        data: {
          goalId: targetGoalId,
          status: body.newStatus,
          sortOrder: insertAt,
          ...(body.newStatus === "done" ? { completedAt: new Date() } : { completedAt: null }),
        },
      });

      // بازسازی پیشرفت هر دو هدف در صورت جابجایی بین اهداف
      await recalcProgress(task.goalId);
      if (targetGoalId !== task.goalId) await recalcProgress(targetGoalId);

      await logActivity({
        userId: auth.id,
        action: "task.move",
        entity: "task",
        entityId: movedTaskId,
        details: { to: body.newStatus, crossGoal: targetGoalId !== task.goalId },
      });

      return ok({ message: "وظیفه جابجا شد" });
    }

    // ─── حالت ۲: ویرایش ساده ───
    const data: Record<string, unknown> = {};
    if (body.title?.trim()) data.title = body.title.trim().slice(0, 150);
    if (body.description !== undefined) data.description = body.description?.slice(0, 500);
    if (body.status && ["todo", "in_progress", "done"].includes(body.status)) {
      data.status = body.status;
      data.completedAt = body.status === "done" ? new Date() : null;
    }
    if (body.priority && ["low", "medium", "high", "critical"].includes(body.priority)) {
      data.priority = body.priority;
    }
    if (body.dueDate !== undefined) {
      data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    }

    const updated = await db.task.update({ where: { id: task.id }, data });
    if (body.status) await recalcProgress(task.goalId);

    await logActivity({
      userId: auth.id,
      action: "task.update",
      entity: "task",
      entityId: task.id,
      details: { fields: Object.keys(data) },
    });

    return ok({ task: updated });
  } catch (err) {
    console.error("خطای ویرایش وظیفه:", err);
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
    const task = await db.task.findFirst({
      where: { id },
      include: { goal: { select: { userId: true } } },
    });
    if (!task || task.goal.userId !== auth.id) return fail("وظیفه یافت نشد", 404);

    const goalId = task.goalId;
    await db.task.delete({ where: { id } });
    await recalcProgress(goalId);

    await logActivity({ userId: auth.id, action: "task.delete", entity: "task", entityId: id });

    return ok({ message: "وظیفه حذف شد" });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
