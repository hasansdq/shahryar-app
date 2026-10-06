// ═══ لیدهای ایجنت انجمن — GET /api/forums/[id]/leads ═══
// فهرست حرفه‌ای لیدهای دریافتی ایجنت انجمن — فقط رئیس انجمن.
// هر لید = کاربری (عضو یا مهمان) که در ترد خصوصی با ایجنت گفتگو کرده؛
// شامل آمار گردش کار، نقش کاربر در انجمن و پیش‌نمایش آخرین پیام.
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, getUser, guardModule } from "@/lib/core/api";
import {
  leadOwnerKey,
  LEAD_USER_SELECT,
  toLeadUser,
  type LeadSummaryDTO,
  type LeadStatsDTO,
  type LeadStatus,
} from "@/lib/modules/leads/service";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("forums");
    if (gate) return gate;

    const { id } = await ctx.params;
    const forum = await db.forum.findUnique({ where: { id }, select: { id: true, chairId: true, status: true } });
    if (!forum) return fail("انجمن یافت نشد", 404);

    // فقط رئیس انجمن لیدها را می‌بیند
    if (forum.chairId !== auth.id) {
      return fail("مشاهده لیدها فقط برای رئیس انجمن ممکن است", 403);
    }

    const ownerKey = leadOwnerKey("forum", id);

    // ─── لیدها ───
    const leadRows = await db.agentLead.findMany({
      where: { ownerKey },
      orderBy: { lastMessageAt: "desc" },
      include: { user: { select: LEAD_USER_SELECT } },
    });

    // عضویت هر لید در انجمن (نقش: رئیس/عضو/مهمان) — یک کوئری
    const memberRows = await db.forumMember.findMany({
      where: { forumId: id, userId: { in: leadRows.map((r) => r.userId) } },
      select: { userId: true, role: true, status: true },
    });
    const memberByUser = new Map(memberRows.map((m) => [m.userId, m]));

    // آخرین پیام ترد خصوصی هر لید + تعداد زنده (برای بازنشانی) — دو کوئری
    const lastMsgs = await db.forumMessage.findMany({
      where: { forumId: id, thread: "AGENT", threadUserId: { in: leadRows.map((r) => r.userId) } },
      orderBy: { createdAt: "desc" },
      select: { threadUserId: true, content: true, isFromAgent: true },
      take: 400,
    });
    const lastByUser = new Map<string, { content: string; isFromAgent: boolean }>();
    for (const m of lastMsgs) {
      if (m.threadUserId && !lastByUser.has(m.threadUserId)) lastByUser.set(m.threadUserId, m);
    }
    const liveGroups = await db.forumMessage.groupBy({
      by: ["threadUserId"],
      _count: { _all: true },
      where: { forumId: id, thread: "AGENT", threadUserId: { not: null } },
    });
    const liveByUser = new Map(liveGroups.map((g) => [g.threadUserId!, g._count._all]));

    const stats: LeadStatsDTO = { total: leadRows.length, NEW: 0, CONTACTED: 0, CONVERTED: 0, ARCHIVED: 0, guests: 0 };
    const leads: LeadSummaryDTO[] = leadRows.map((row) => {
      stats[row.status as LeadStatus] = (stats[row.status as LeadStatus] || 0) + 1;
      const member = memberByUser.get(row.userId);
      const memberRole: "CHAIR" | "MEMBER" | "GUEST" =
        member?.status === "ACTIVE" ? (member.role === "CHAIR" ? "CHAIR" : "MEMBER") : "GUEST";
      if (memberRole === "GUEST") stats.guests++;
      const last = lastByUser.get(row.userId);
      const live = liveByUser.get(row.userId) || 0;
      return {
        id: row.id,
        user: { ...toLeadUser(row.user), memberRole },
        status: row.status as LeadStatus,
        note: row.note,
        messageCount: row.messageCount,
        firstMessageAt: row.firstMessageAt.toISOString(),
        lastMessageAt: row.lastMessageAt.toISOString(),
        lastMessagePreview: last
          ? (last.isFromAgent ? `🤖 ${last.content}` : last.content).replace(/\s+/g, " ").slice(0, 90)
          : null,
        wasReset: row.messageCount > 0 && live === 0,
      };
    });

    return ok({ leads, stats });
  } catch (err) {
    console.error("خطای فهرست لیدهای انجمن:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
