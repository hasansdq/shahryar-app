// ═══ لیدهای ایجنت شخصی — GET /api/social/leads ═══
// فهرست حرفه‌ای افرادی که با ایجنت من گفتگو کرده‌اند + آمار گردش کار.
// گفتگوهای آزمایشی خودم (self-agent) لید نیستند.
// بک‌فیل شفاف: گفتگوهای قدیمیِ قبل از این فیچر هم به‌صورت خودکار لید می‌شوند.
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, getUser, guardModule } from "@/lib/core/api";
import {
  leadOwnerKey,
  LEAD_USER_SELECT,
  toLeadUser,
  type LeadSummaryDTO,
  type LeadStatsDTO,
  type LeadsListResult,
  type LeadStatus,
} from "@/lib/modules/leads/service";

export async function GET(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("social");
    if (gate) return gate;

    const ownerKey = leadOwnerKey("user", auth.id);

    // ─── گفتگوهای ایجنت من — فقط متادیتا (بدون لود پیام‌ها) ───
    // قبلاً «همه‌ی پیام‌های همه‌ی گفتگوها» لود می‌شد و روی هر GET یک
    // upsert برای هر گفتگو اجرا می‌شد — با شهرکی پرچت این یعنی ده‌ها
    // هزار ردیف و N کوئری نوشتاری در هر باز شدن پنل لیدها
    const convs = await db.socialConversation.findMany({
      where: { type: "agent", ownerId: auth.id, userAId: { not: auth.id } },
      select: { id: true, userAId: true, createdAt: true, updatedAt: true },
      take: 500,
    });

    // ─── بک‌فیل شفاف — فقط گفتگوهای بدون لید (معمولاً صفر) ───
    const existingLeads = await db.agentLead.findMany({
      where: { ownerKey },
      select: { userId: true },
    });
    const leadUserIds = new Set(existingLeads.map((l) => l.userId));
    const missing = convs.filter((c) => c.userAId && !leadUserIds.has(c.userAId));
    for (const c of missing.slice(0, 50)) {
      // فقط پیام اول/آخر این گفتگوی جدید — ۲ کوئری سبک به‌جای لود کل تاریخچه
      const [firstMsg, lastMsg, count] = await Promise.all([
        db.socialMessage.findFirst({
          where: { conversationId: c.id },
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        }),
        db.socialMessage.findFirst({
          where: { conversationId: c.id },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
        db.socialMessage.count({ where: { conversationId: c.id } }),
      ]);
      await db.agentLead.upsert({
        where: { ownerKey_userId: { ownerKey, userId: c.userAId! } },
        create: {
          scope: "user",
          ownerKey,
          ownerUserId: auth.id,
          userId: c.userAId!,
          messageCount: count,
          firstMessageAt: firstMsg?.createdAt || c.createdAt,
          lastMessageAt: lastMsg?.createdAt || c.updatedAt,
        },
        update: {},
      });
    }

    // ─── آخرین پیام هر گفتگو برای پیش‌نمایش کارت (یک کوئری) ───
    const lastMsgs = await db.socialMessage.findMany({
      where: { conversation: { type: "agent", ownerId: auth.id } },
      orderBy: { createdAt: "desc" },
      select: { conversationId: true, content: true, senderType: true },
      take: 400,
    });
    const lastByConv = new Map<string, { content: string; senderType: string }>();
    for (const m of lastMsgs) {
      if (!lastByConv.has(m.conversationId)) lastByConv.set(m.conversationId, m);
    }

    // زنده‌بودن هر گفتگو: conversationId → userAId (برای تشخیص بازنشانی)
    const convIdByUser = new Map(convs.map((c) => [c.userAId!, c.id]));
    const liveCounts = await db.socialMessage.groupBy({
      by: ["conversationId"],
      _count: { _all: true },
      where: { conversation: { type: "agent", ownerId: auth.id } },
    });
    const liveByConv = new Map(liveCounts.map((g) => [g.conversationId, g._count._all]));

    // ─── لیدها ───
    const [leadRows, profile] = await Promise.all([
      db.agentLead.findMany({
        where: { ownerKey },
        orderBy: { lastMessageAt: "desc" },
        include: { user: { select: LEAD_USER_SELECT } },
      }),
      db.socialProfile.findUnique({ where: { userId: auth.id }, select: { agentEnabled: true } }),
    ]);

    const stats: LeadStatsDTO = { total: leadRows.length, NEW: 0, CONTACTED: 0, CONVERTED: 0, ARCHIVED: 0, guests: 0 };
    const leads: LeadSummaryDTO[] = leadRows.map((row) => {
      stats[row.status as LeadStatus] = (stats[row.status as LeadStatus] || 0) + 1;
      const convId = convIdByUser.get(row.userId);
      const last = convId ? lastByConv.get(convId) : undefined;
      const live = convId ? liveByConv.get(convId) || 0 : 0;
      return {
        id: row.id,
        user: toLeadUser(row.user),
        status: row.status as LeadStatus,
        note: row.note,
        messageCount: row.messageCount,
        firstMessageAt: row.firstMessageAt.toISOString(),
        lastMessageAt: row.lastMessageAt.toISOString(),
        lastMessagePreview: last
          ? (last.senderType === "agent" ? `🤖 ${last.content}` : last.content).replace(/\s+/g, " ").slice(0, 90)
          : null,
        wasReset: row.messageCount > 0 && live === 0,
      };
    });

    const result: LeadsListResult = { leads, stats, agentEnabled: profile?.agentEnabled !== false };
    return ok(result);
  } catch (err) {
    console.error("خطای فهرست لیدها:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
