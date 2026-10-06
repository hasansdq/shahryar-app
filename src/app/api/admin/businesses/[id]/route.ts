// ═════ ویرایش/حذف صنف (ادمین) — PATCH/DELETE /api/admin/businesses/[id] ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getAdmin, assertWritableAdmin } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { verifiedMediaUrl, verifiedGalleryJson } from "@/lib/media/verify";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);
    const writeGate = assertWritableAdmin(admin);
    if (writeGate) return writeGate;

    const { id } = await params;
    const business = await db.business.findUnique({ where: { id } });
    if (!business) return fail("کسب‌وکار یافت نشد", 404);

    const body = await parseJson<Record<string, unknown>>(req);
    if (!body) return fail("درخواست نامعتبر است");

    const data: Record<string, unknown> = {};
    const strFields = ["description", "ownerName", "phone", "phone2", "email", "address",
      "district", "website", "instagram", "telegram", "whatsapp", "keywords"] as const;
    for (const f of strFields) {
      if (body[f] !== undefined) data[f] = (body[f] as string) || null;
    }
    // تصویر اصلی — فقط فایل موجود در مخزن کانونی
    if (body.imageUrl !== undefined) {
      data.imageUrl = await verifiedMediaUrl(body.imageUrl as string | undefined);
    }
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return fail("نام نمی‌تواند خالی باشد");
      data.name = name;
      data.slug = name.trim().replace(/[\s\u200c]+/g, "-").replace(/[^\p{L}\p{N}-]/gu, "").toLowerCase() || business.slug;
    }
    if (body.categoryId !== undefined) {
      const cat = await db.businessCategory.findUnique({ where: { id: String(body.categoryId) } });
      if (!cat) return fail("دسته‌بندی یافت نشد", 404);
      data.categoryId = cat.id;
    }
    if (body.latitude !== undefined) data.latitude = body.latitude ? Number(body.latitude) : null;
    if (body.longitude !== undefined) data.longitude = body.longitude ? Number(body.longitude) : null;
    if (body.services !== undefined) {
      data.services = Array.isArray(body.services) && body.services.length
        ? JSON.stringify(body.services.filter(Boolean).slice(0, 20)) : null;
    }
    if (body.workingHours !== undefined) {
      data.workingHours = body.workingHours ? JSON.stringify({ display: body.workingHours }) : null;
    }
    // گالری تصاویر — فقط فایل‌های موجود در مخزن کانونی
    if (body.gallery !== undefined) {
      data.gallery = await verifiedGalleryJson(body.gallery);
    }
    if (body.isVerified !== undefined) data.isVerified = !!body.isVerified;
    if (body.isFeatured !== undefined) data.isFeatured = !!body.isFeatured;
    if (body.isActive !== undefined) data.isActive = !!body.isActive;

    const updated = await db.business.update({ where: { id }, data });

    await logActivity({
      adminId: admin.id, actorType: "admin",
      action: "admin.business_update", entity: "business", entityId: id,
      details: { fields: Object.keys(data) },
    });

    return ok({ business: updated });
  } catch (err) {
    console.error("خطای ویرایش صنف:", err);
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
    const business = await db.business.findUnique({ where: { id } });
    if (!business) return fail("کسب‌وکار یافت نشد", 404);

    await db.business.delete({ where: { id } });

    await logActivity({
      adminId: admin.id, actorType: "admin",
      action: "admin.business_delete", entity: "business", entityId: id,
      level: "warning",
      details: { name: business.name },
    });

    return ok({ message: "کسب‌وکار حذف شد" });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
