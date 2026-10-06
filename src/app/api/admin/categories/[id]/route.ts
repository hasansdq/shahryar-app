// ═════ ویرایش/حذف دسته‌بندی (ادمین) — PATCH/DELETE /api/admin/categories/[id] ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getAdmin, assertWritableAdmin } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);
    const writeGate = assertWritableAdmin(admin);
    if (writeGate) return writeGate;

    const { id } = await params;
    const category = await db.businessCategory.findUnique({ where: { id } });
    if (!category) return fail("دسته‌بندی یافت نشد", 404);

    const body = await parseJson<{
      name?: string; icon?: string; color?: string; description?: string;
      sortOrder?: number; isActive?: boolean;
    }>(req);
    if (!body) return fail("درخواست نامعتبر است");

    const data: Record<string, unknown> = {};
    if (body.name?.trim()) {
      const trimmedName: string = body.name.trim();
      data.name = trimmedName;
      data.slug = trimmedName.replace(/[\s\u200c]+/g, "-").replace(/[^\p{L}\p{N}-]/gu, "").toLowerCase();
    }
    if (body.icon) data.icon = body.icon;
    if (body.color) data.color = body.color;
    if (body.description !== undefined) data.description = body.description?.slice(0, 300);
    if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;
    if (body.isActive !== undefined) data.isActive = !!body.isActive;

    const updated = await db.businessCategory.update({ where: { id }, data });

    await logActivity({
      adminId: admin.id, actorType: "admin",
      action: "admin.category_update", entity: "category", entityId: id,
    });

    return ok({ category: updated });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);
    const writeGate = assertWritableAdmin(admin);
    if (writeGate) return writeGate;

    const { id } = await params;
    const category = await db.businessCategory.findUnique({
      where: { id },
      include: { _count: { select: { businesses: true } } },
    });
    if (!category) return fail("دسته‌بندی یافت نشد", 404);

    if (category._count.businesses > 0) {
      return fail(`این دسته‌بندی ${category._count.businesses} کسب‌وکار دارد. ابتدا آنها را منتقل یا حذف کنید`);
    }

    await db.businessCategory.delete({ where: { id } });

    await logActivity({
      adminId: admin.id, actorType: "admin",
      action: "admin.category_delete", entity: "category", entityId: id, level: "warning",
    });

    return ok({ message: "دسته‌بندی حذف شد" });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
