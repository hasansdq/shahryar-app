// ═══ مدیریت یک اعلان — PATCH/DELETE /api/admin/notifications/[id] ═══
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
    const n = await db.notification.findUnique({ where: { id } });
    if (!n) return fail("اعلان یافت نشد", 404);

    const body = await parseJson<{ isActive?: boolean }>(req);
    if (!body || typeof body.isActive !== "boolean") return fail("درخواست نامعتبر است");

    await db.notification.update({ where: { id }, data: { isActive: body.isActive } });

    await logActivity({
      adminId: admin.id, actorType: "admin",
      action: body.isActive ? "admin.notification_activate" : "admin.notification_deactivate",
      entity: "notification", entityId: id, details: { title: n.title },
    });

    return ok({ message: body.isActive ? "اعلان فعال شد" : "اعلان غیرفعال شد" });
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
    const n = await db.notification.findUnique({ where: { id } });
    if (!n) return fail("اعلان یافت نشد", 404);

    await db.notification.delete({ where: { id } });

    await logActivity({
      adminId: admin.id, actorType: "admin",
      action: "admin.notification_delete", entity: "notification", entityId: id,
      level: "warning", details: { title: n.title },
    });

    return ok({ message: "اعلان حذف شد" });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
