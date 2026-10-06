// ═════ مدیریت وظایف — POST /api/tasks ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";

export async function POST(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("goals");
    if (gate) return gate;

    const body = await parseJson<{
      goalId: string; title: string; description?: string;
      priority?: string; dueDate?: string; status?: string;
    }>(req);
    if (!body?.goalId || !body?.title?.trim()) {
      return fail("هدف و عنوان وظیفه الزامی است");
    }

    // مالکیت هدف
    const goal = await db.goal.findFirst({ where: { id: body.goalId, userId: auth.id } });
    if (!goal) return fail("هدف یافت نشد", 404);

    const maxOrder = await db.task.findFirst({
      where: { goalId: goal.id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const task = await db.task.create({
      data: {
        goalId: goal.id,
        title: body.title.trim().slice(0, 150),
        description: body.description?.slice(0, 500),
        priority: ["low", "medium", "high", "critical"].includes(body.priority || "") ? body.priority! : "medium",
        status: ["todo", "in_progress", "done"].includes(body.status || "") ? body.status! : "todo",
        sortOrder: (maxOrder?.sortOrder ?? -1) + 1,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      },
    });

    await logActivity({
      userId: auth.id,
      action: "task.create",
      entity: "task",
      entityId: task.id,
      details: { goalId: goal.id, title: task.title },
    });

    return ok({ task });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
