// ═════ ویرایش/حذف داده شهری (ادمین) — PATCH/DELETE /api/admin/city-data/[id] ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getAdmin, assertWritableAdmin } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { verifiedMediaUrl } from "@/lib/media/verify";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);
    const writeGate = assertWritableAdmin(admin);
    if (writeGate) return writeGate;

    const { id } = await params;
    const item = await db.cityData.findUnique({ where: { id } });
    if (!item) return fail("رکورد یافت نشد", 404);

    const body = await parseJson<{
      category?: string; title?: string; content?: string; summary?: string;
      source?: string; imageUrl?: string; isPinned?: boolean; isPublished?: boolean;
    }>(req);
    if (!body) return fail("درخواست نامعتبر است");

    const data: Record<string, unknown> = {};
    if (body.category && ["news", "event", "announcement", "service", "tip"].includes(body.category)) {
      data.category = body.category;
    }
    if (body.title?.trim()) data.title = body.title.trim().slice(0, 200);
    if (body.content?.trim()) data.content = body.content.slice(0, 5000);
    if (body.summary !== undefined) data.summary = body.summary?.slice(0, 300);
    if (body.source !== undefined) data.source = body.source?.slice(0, 100);
    if (body.imageUrl !== undefined) {
      // فقط فایل موجود در مخزن کانونی؛ URL کانونی ذخیره می‌شود
      data.imageUrl = await verifiedMediaUrl(body.imageUrl);
    }
    if (body.isPinned !== undefined) data.isPinned = !!body.isPinned;
    if (body.isPublished !== undefined) data.isPublished = !!body.isPublished;

    const updated = await db.cityData.update({ where: { id }, data });

    await logActivity({
      adminId: admin.id, actorType: "admin",
      action: "admin.citydata_update", entity: "cityData", entityId: id,
    });

    return ok({ item: updated });
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
    const item = await db.cityData.findUnique({ where: { id } });
    if (!item) return fail("رکورد یافت نشد", 404);

    await db.cityData.delete({ where: { id } });

    await logActivity({
      adminId: admin.id, actorType: "admin",
      action: "admin.citydata_delete", entity: "cityData", entityId: id, level: "warning",
    });

    return ok({ message: "رکورد حذف شد" });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
