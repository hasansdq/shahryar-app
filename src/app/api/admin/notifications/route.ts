// ═══ مدیریت اعلان‌ها — GET/POST /api/admin/notifications ═══
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getAdmin, assertWritableAdmin } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { audienceWhere, hasAnyFilter, filterLabels, type AudienceFilters } from "@/lib/admin/notification-filters";

const TYPES = ["info", "success", "warning", "celebration", "marketing"];
const VIEWS = ["home", "chat", "goals", "businesses", "finance", "social", "profile"];

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);


    const notifications = await db.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        _count: { select: { recipients: true } },
        recipients: { where: { readAt: { not: null } }, select: { id: true } },
      },
    });

    return ok({
      notifications: notifications.map((n) => ({
        id: n.id, title: n.title, body: n.body, type: n.type,
        ctaLabel: n.ctaLabel, ctaView: n.ctaView, audience: n.audience,
        isActive: n.isActive, scheduledAt: n.scheduledAt, expiresAt: n.expiresAt,
        createdAt: n.createdAt,
        delivered: n._count.recipients,
        read: n.recipients.length,
      })),
    });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);
    const writeGate = assertWritableAdmin(admin);
    if (writeGate) return writeGate;

    const body = await parseJson<{
      title?: string; body?: string; type?: string;
      ctaLabel?: string; ctaView?: string;
      filters?: AudienceFilters;
      expiresAt?: string;
      sendNow?: boolean;
    }>(req);
    if (!body) return fail("درخواست نامعتبر است");

    const title = (body.title || "").trim().slice(0, 80);
    const text = (body.body || "").trim().slice(0, 1000);
    if (!title || !text) return fail("عنوان و متن اعلان الزامی است");

    const type = TYPES.includes(body.type || "") ? body.type! : "info";
    const ctaView = body.ctaView && VIEWS.includes(body.ctaView) ? body.ctaView : null;
    const filters = body.filters || {};
    const filtered = hasAnyFilter(filters);

    // شمارش مخاطبان پیش از ارسال
    const audience = await db.user.findMany({
      where: audienceWhere(filters),
      select: { id: true },
    });

    const notification = await db.notification.create({
      data: {
        title, body: text, type,
        ctaLabel: body.ctaLabel?.trim().slice(0, 30) || null,
        ctaView,
        audience: filtered ? "filtered" : "all",
        filters: filtered ? JSON.stringify(filters) : null,
        isActive: body.sendNow !== false,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        createdBy: admin.id,
      },
    });

    // تحویل فوری برای مخاطبان فعلی (رکوردهای unread) — بقیه در اولین fetch بعدی
    if (notification.isActive) {
      const now = new Date();
      const expiresAt = notification.expiresAt && notification.expiresAt <= now ? notification.expiresAt : null;
      if (!expiresAt) {
        const existingRecs = await db.notificationRecipient.findMany({
          where: { notificationId: notification.id },
          select: { userId: true },
        });
        const existingSet = new Set(existingRecs.map((r) => r.userId));
        const fresh = audience.filter((u) => !existingSet.has(u.id));
        if (fresh.length) {
          await db.notificationRecipient.createMany({
            data: fresh.map((u) => ({ notificationId: notification.id, userId: u.id })),
          });
        }
      }
    }

    await logActivity({
      adminId: admin.id, actorType: "admin",
      action: "admin.notification_create", entity: "notification", entityId: notification.id,
      details: { title, type, recipients: audience.length, filters: filtered ? filterLabels(filters) : "همه" },
    });

    return ok({
      message: `اعلان ساخته شد — تحویل به ${audience.length} کاربر`,
      id: notification.id,
      recipients: audience.length,
    });
  } catch (err) {
    console.error("خطای ساخت اعلان:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
