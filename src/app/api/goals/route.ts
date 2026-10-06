// ═════ مدیریت اهداف — GET/POST /api/goals ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { getModuleState, listActiveGoalCategories } from "@/lib/modules/cms/service";

export async function GET(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("goals");
    if (gate) return gate;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status"); // active | completed | archived | all

    const goals = await db.goal.findMany({
      where: {
        userId: auth.id,
        ...(status && status !== "all" ? { status } : { status: { in: ["active", "completed"] } }),
      },
      include: { tasks: { orderBy: { sortOrder: "asc" } } },
      orderBy: [{ updatedAt: "desc" }],
    });

    // آمار کلی — همیشه روی کل اهداف (مستقل از فیلتر)
    const [totalTasks, doneTasks, statusCounts] = await Promise.all([
      db.task.count({ where: { goal: { userId: auth.id } } }),
      db.task.count({ where: { goal: { userId: auth.id }, status: "done" } }),
      db.goal.groupBy({
        by: ["status"],
        where: { userId: auth.id },
        _count: { _all: true },
      }),
    ]);
    const statusMap = new Map(statusCounts.map((s) => [s.status, s._count._all]));

    return ok({
      goals,
      stats: {
        goalsCount: goals.length,
        activeCount: statusMap.get("active") || 0,
        completedCount: statusMap.get("completed") || 0,
        archivedCount: statusMap.get("archived") || 0,
        totalTasks, doneTasks,
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
    const gate = await guardModule("goals");
    if (gate) return gate;

    // محدودیت اهداف فعال (کانفیگ CMS — ۰ = بدون محدودیت)
    const goalsState = await getModuleState("goals");
    const maxGoals = Number(goalsState?.config.maxActiveGoals ?? 0) || 0;
    if (maxGoals > 0) {
      const activeCount = await db.goal.count({ where: { userId: auth.id, status: "active" } });
      if (activeCount >= maxGoals) {
        return fail(`حداکثر ${maxGoals} هدف فعال می‌توانید داشته باشید. یکی را تکمیل یا بایگانی کنید`, 400);
      }
    }

    const body = await parseJson<{
      title: string; description?: string; category?: string;
      priority?: string; color?: string; deadline?: string; tasks?: string[];
    }>(req);
    if (!body?.title?.trim()) return fail("عنوان هدف الزامی است");

    const title = body.title.trim().slice(0, 120);

    // دسته‌بندی — از دسته‌های فعال مدیریت‌شده در CMS (با fallback امن)
    const activeCats = await listActiveGoalCategories();
    const validCatKeys = new Set(activeCats.map((c) => c.key));
    const category = validCatKeys.has(body.category || "")
      ? (body.category as string)
      : activeCats[0]?.key || "personal";
    const priority = ["low", "medium", "high", "critical"].includes(body.priority || "")
      ? body.priority : "medium";

    let deadline: Date | null = null;
    if (body.deadline) {
      const d = new Date(body.deadline);
      if (!isNaN(d.getTime())) deadline = d;
    }

    const goal = await db.goal.create({
      data: {
        userId: auth.id,
        title,
        description: body.description?.slice(0, 1000),
        category,
        priority,
        color: body.color || "#0e8a5a",
        deadline,
        tasks: body.tasks?.length
          ? {
              create: body.tasks
                .filter((t) => t?.trim())
                .slice(0, 30)
                .map((t, i) => ({ title: t.trim().slice(0, 150), sortOrder: i })),
            }
          : undefined,
      },
      include: { tasks: true },
    });

    await logActivity({
      userId: auth.id,
      action: "goal.create",
      entity: "goal",
      entityId: goal.id,
      details: { title },
    });

    return ok({ goal });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
