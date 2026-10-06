// ═══ اعلان‌های کاربر — GET/POST /api/notifications ═══
// GET: تحویل تنبل — اعلان‌های فعالِ منطبق که هنوز رکورد دریافت ندارم
// POST: علامت‌گذاری خوانده‌شده (تکی یا همه)
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser } from "@/lib/core/api";
import { parseFilters, userMatchesFilters } from "@/lib/admin/notification-filters";

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return fail("احراز هویت نشده‌اید", 401);

    const now = new Date();

    // اعلان‌های فعال و منقضی‌نشده
    const active = await db.notification.findMany({
      where: {
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    const valid = active;

    // دریافت‌های من
    const mine = await db.notificationRecipient.findMany({
      where: { userId: user.id },
      select: { notificationId: true, readAt: true, createdAt: true },
    });
    const mineMap = new Map(mine.map((m) => [m.notificationId, m]));

    // ─── تحویل تنبل: اعلان‌های منطبق که رکورد ندارم ───
    const toDeliver: string[] = [];
    for (const n of valid) {
      if (mineMap.has(n.id)) continue;
      const filters = parseFilters(n.filters);
      if (await userMatchesFilters(user.id, filters)) toDeliver.push(n.id);
    }
    if (toDeliver.length) {
      const existingMine = await db.notificationRecipient.findMany({
        where: { userId: user.id, notificationId: { in: toDeliver } },
        select: { notificationId: true },
      });
      const mineSet = new Set(existingMine.map((r) => r.notificationId));
      const freshNids = toDeliver.filter((nid) => !mineSet.has(nid));
      if (freshNids.length) {
        await db.notificationRecipient.createMany({
          data: freshNids.map((nid) => ({ notificationId: nid, userId: user.id })),
        });
      }
    }

    // لیست نهایی = اعلان‌های دریافتی (قدیمی + جدید)
    const finalIds = valid.map((n) => n.id);
    const finalRecipients = await db.notificationRecipient.findMany({
      where: { userId: user.id, notificationId: { in: finalIds } },
      orderBy: { createdAt: "desc" },
    });
    const notifications = finalRecipients
      .map((r): {
        id: string; title: string; body: string; type: string;
        ctaLabel: string | null; ctaView: string | null;
        createdAt: Date; readAt: Date | null;
      } | null => {
        const n = valid.find((v) => v.id === r.notificationId);
        if (!n) return null;
        return {
          id: n.id, title: n.title, body: n.body, type: n.type,
          ctaLabel: n.ctaLabel, ctaView: n.ctaView,
          createdAt: r.createdAt,
          readAt: r.readAt,
        };
      })
      .filter((n): n is NonNullable<typeof n> => n !== null)
      .slice(0, 20);

    return ok({
      notifications,
      unread: notifications.filter((n) => !n.readAt).length,
    });
  } catch (err) {
    console.error("خطای اعلان‌های کاربر:", err);
    return fail("خطای داخلی سرور", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return fail("احراز هویت نشده‌اید", 401);

    const body = await parseJson<{ id?: string; all?: boolean }>(req);
    if (!body) return fail("درخواست نامعتبر است");

    const now = new Date();
    if (body.all) {
      await db.notificationRecipient.updateMany({
        where: { userId: user.id, readAt: null },
        data: { readAt: now },
      });
      return ok({ message: "همه اعلان‌ها خوانده شد" });
    }

    if (body.id) {
      await db.notificationRecipient.updateMany({
        where: { userId: user.id, notificationId: body.id, readAt: null },
        data: { readAt: now },
      });
      return ok({ message: "خوانده شد" });
    }

    return fail("شناسه اعلان لازم است");
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
