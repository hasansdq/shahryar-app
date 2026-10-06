// ═════ ویرایش/حذف قالب دسته‌بندی مالی — PATCH/DELETE /api/admin/finance/categories/[id] ═════
// تغییر قالب فقط سیدِ کاربران جدید را تحت تأثیر قرار می‌دهد (داده‌ی
// کاربران فعلی دست‌نخورده می‌ماند — حذف قالب هیچ دسته‌ی کاربری را پاک نمی‌کند)
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getAdmin, assertWritableAdmin } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";

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
    const tpl = await db.financeCategoryTemplate.findUnique({ where: { id } });
    if (!tpl) return fail("قالب یافت نشد", 404);

    const body = await parseJson<{
      name?: string; type?: string; icon?: string; color?: string; sortOrder?: number; isActive?: boolean;
    }>(req);
    if (!body) return fail("درخواست نامعتبر است");

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) {
      const name = body.name.trim().slice(0, 40);
      if (!name) return fail("نام قالب نمی‌تواند خالی باشد");
      data.name = name;
    }
    if (body.type !== undefined) {
      if (body.type !== "income" && body.type !== "expense") return fail("نوع نامعتبر است");
      data.type = body.type;
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
      if (!body.isActive) {
        // حداقل یک قالب فعال از هر نوع باید بماند
        for (const t of ["income", "expense"]) {
          const activeCount = await db.financeCategoryTemplate.count({
            where: { type: t, isActive: true },
          });
          const isLastOfItsType = tpl.type === t && activeCount <= 1;
          if (isLastOfItsType) return fail(`حداقل یک قالب فعال از نوع «${t === "income" ? "درآمد" : "هزینه"}» لازم است`, 400);
        }
      }
      data.isActive = body.isActive;
    }

    if (Object.keys(data).length === 0) return fail("چیزی برای بروزرسانی نیست");

    // تکراری‌نبودن نام+نوع (به‌جز خودش)
    if (data.name !== undefined || data.type !== undefined) {
      const name = (data.name as string) ?? tpl.name;
      const type = (data.type as string) ?? tpl.type;
      const dup = await db.financeCategoryTemplate.findFirst({
        where: { name, type, id: { not: id } },
      });
      if (dup) return fail("قالب دیگری با این نام و نوع وجود دارد", 400);
    }

    const updated = await db.financeCategoryTemplate.update({ where: { id }, data });

    await logActivity({
      adminId: admin.id,
      actorType: "admin",
      action: "cms.financeCategory.update",
      entity: "financeCategoryTemplate",
      entityId: id,
      details: body as Record<string, unknown>,
    });

    return ok({ template: updated });
  } catch (err) {
    console.error("خطای ویرایش قالب مالی:", err);
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
    const tpl = await db.financeCategoryTemplate.findUnique({ where: { id } });
    if (!tpl) return fail("قالب یافت نشد", 404);

    // حداقل یک قالب فعال از نوعش باید بماند
    const activeCount = await db.financeCategoryTemplate.count({
      where: { type: tpl.type, isActive: true },
    });
    if (tpl.isActive && activeCount <= 1) {
      return fail("آخرین قالب فعال این نوع قابل حذف نیست — به‌جایش غیرفعالش نکنید، حداقل یکی لازم است", 400);
    }

    await db.financeCategoryTemplate.delete({ where: { id } });

    await logActivity({
      adminId: admin.id,
      actorType: "admin",
      action: "cms.financeCategory.delete",
      entity: "financeCategoryTemplate",
      entityId: id,
      level: "warning",
      details: { name: tpl.name, type: tpl.type },
    });

    return ok({ message: "قالب حذف شد (دسته‌های ساخته‌شده‌ی کاربران فعلی دست‌نخورده می‌مانند)" });
  } catch (err) {
    console.error("خطای حذف قالب مالی:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
