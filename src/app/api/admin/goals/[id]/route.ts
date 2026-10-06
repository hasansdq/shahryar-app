// ═════ جزئیات/مودریشن هدف — GET/PATCH/DELETE /api/admin/goals/[id] ═════
// GET: هدف + وظایف + اطلاعات کاربر — PATCH: بایگانی/بازگردانی — DELETE: حذف
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getAdmin, assertWritableAdmin } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);


    const { id } = await params;
    const goal = await db.goal.findUnique({
      where: { id },
      include: {
        tasks: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        user: { select: { id: true, fullName: true, phone: true, status: true, createdAt: true } },
      },
    });
    if (!goal) return fail("هدف یافت نشد", 404);

    return ok({ goal });
  } catch (err) {
    console.error("خطای جزئیات هدف:", err);
    return fail("خطای داخلی سرور", 500);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);
    const writeGate = assertWritableAdmin(admin);
    if (writeGate) return writeGate;

    const { id } = await params;
    const body = await parseJson<{ action?: string }>(req);
    if (body?.action !== "archive" && body?.action !== "restore") {
      return fail("اقدام نامعتبر است (archive یا restore)");
    }

    const goal = await db.goal.findUnique({ where: { id } });
    if (!goal) return fail("هدف یافت نشد", 404);

    if (body.action === "archive") {
      await db.goal.update({ where: { id }, data: { status: "archived" } });
    } else {
      // بازگردانی → وضعیت بر اساس پیشرفت واقعی
      const total = await db.task.count({ where: { goalId: id } });
      const done = await db.task.count({ where: { goalId: id, status: "done" } });
      const completed = total > 0 && done === total;
      await db.goal.update({
        where: { id },
        data: {
          status: completed ? "completed" : "active",
          completedAt: completed ? new Date() : null,
        },
      });
    }

    await logActivity({
      adminId: admin.id,
      actorType: "admin",
      action: `cms.goal.${body.action}`,
      entity: "goal",
      entityId: id,
      details: { action: body.action, title: goal.title },
    });

    return ok({ message: body.action === "archive" ? "هدف بایگانی شد" : "هدف بازگردانی شد" });
  } catch (err) {
    console.error("خطای مودریشن هدف:", err);
    return fail("خطای داخلی سرور", 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);
    const writeGate = assertWritableAdmin(admin);
    if (writeGate) return writeGate;

    const { id } = await params;
    const goal = await db.goal.findUnique({
      where: { id },
      include: { _count: { select: { tasks: true } } },
    });
    if (!goal) return fail("هدف یافت نشد", 404);

    // وظایف با Cascade حذف می‌شوند
    await db.goal.delete({ where: { id } });

    await logActivity({
      adminId: admin.id,
      actorType: "admin",
      action: "cms.goal.delete",
      entity: "goal",
      entityId: id,
      level: "warning",
      details: { title: goal.title, tasksDeleted: goal._count.tasks },
    });

    return ok({ message: "هدف و وظایفش حذف شد" });
  } catch (err) {
    console.error("خطای حذف هدف:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
