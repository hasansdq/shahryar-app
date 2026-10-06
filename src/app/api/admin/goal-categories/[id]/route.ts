// ═════ ویرایش/حذف دسته‌بندی هدف — PATCH/DELETE /api/admin/goal-categories/[id] ═════
// حذف فقط وقتی هیچ هدفی از این دسته استفاده نکرده (وگرنه غیرفعال‌سازی)
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getAdmin, assertWritableAdmin } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { invalidateCmsCache } from "@/lib/modules/cms/service";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

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
    const cat = await db.goalCategory.findUnique({ where: { id } });
    if (!cat) return fail("دسته‌بندی یافت نشد", 404);

    const body = await parseJson<{
      name?: string; icon?: string; color?: string; sortOrder?: number; isActive?: boolean;
    }>(req);
    if (!body) return fail("درخواست نامعتبر است");

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) {
      const name = body.name.trim().slice(0, 40);
      if (!name) return fail("نام دسته‌بندی نمی‌تواند خالی باشد");
      data.name = name;
    }
    if (body.icon !== undefined) data.icon = body.icon.slice(0, 40);
    if (body.color !== undefined) {
      if (!HEX_COLOR.test(body.color)) return fail("کد رنگ نامعتبر است");
      data.color = body.color;
    }
    if (body.sortOrder !== undefined) {
      data.sortOrder = Math.min(999, Math.max(0, Math.round(Number(body.sortOrder) || 0)));
    }
    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") return fail("مقدار وضعیت نامعتبر است");
      // آخرین دسته‌ی فعال را نمی‌توان غیرفعال کرد
      if (!body.isActive) {
        const activeCount = await db.goalCategory.count({ where: { isActive: true } });
        if (activeCount <= 1) return fail("حداقل یک دسته‌بندی فعال لازم است", 400);
      }
      data.isActive = body.isActive;
    }

    if (Object.keys(data).length === 0) return fail("چیزی برای بروزرسانی نیست");

    const updated = await db.goalCategory.update({ where: { id }, data });
    invalidateCmsCache();

    await logActivity({
      adminId: admin.id,
      actorType: "admin",
      action: "cms.goalCategory.update",
      entity: "goalCategory",
      entityId: id,
      details: body as Record<string, unknown>,
    });

    return ok({ category: updated });
  } catch (err) {
    console.error("خطای ویرایش دسته‌بندی هدف:", err);
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
    const cat = await db.goalCategory.findUnique({ where: { id } });
    if (!cat) return fail("دسته‌بندی یافت نشد", 404);

    // اگر هدفی از این دسته استفاده کرده → حذف ممنوع (به‌جایش غیرفعال کن)
    const usage = await db.goal.count({ where: { category: cat.key } });
    if (usage > 0) {
      return fail(
        `این دسته در ${usage} هدف استفاده شده است — به‌جای حذف، آن را غیرفعال کنید`,
        400
      );
    }

    await db.goalCategory.delete({ where: { id } });
    invalidateCmsCache();

    await logActivity({
      adminId: admin.id,
      actorType: "admin",
      action: "cms.goalCategory.delete",
      entity: "goalCategory",
      entityId: id,
      level: "warning",
      details: { name: cat.name, key: cat.key },
    });

    return ok({ message: "دسته‌بندی حذف شد" });
  } catch (err) {
    console.error("خطای حذف دسته‌بندی هدف:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
