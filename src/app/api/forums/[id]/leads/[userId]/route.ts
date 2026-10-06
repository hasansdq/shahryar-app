// ═══ لید ایجنت انجمن — GET / PATCH / DELETE /api/forums/[id]/leads/[userId] ═══
// GET   → پروفایل کاربر لید + ترنسکریپت کامل گفتگوی خصوصی او با ایجنت انجمن
// PATCH → وضعیت گردش کار + یادداشت (فقط رئیس انجمن)
// DELETE → حذف لید از فهرست (ترد خصوصی کاربر دست‌نخورده می‌ماند)
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import {
  isLeadStatus,
  leadOwnerKey,
  LEAD_USER_SELECT,
  toLeadUser,
  type LeadMessageDTO,
  type LeadStatus,
} from "@/lib/modules/leads/service";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string; userId: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("forums");
    if (gate) return gate;

    const { id, userId } = await ctx.params;
    if (!userId || userId.length > 40) return fail("شناسه کاربر نامعتبر است");

    const forum = await db.forum.findUnique({ where: { id }, select: { id: true, chairId: true } });
    if (!forum) return fail("انجمن یافت نشد", 404);
    if (forum.chairId !== auth.id) {
      return fail("مشاهده لیدها فقط برای رئیس انجمن ممکن است", 403);
    }

    const lead = await db.agentLead.findUnique({
      where: { ownerKey_userId: { ownerKey: leadOwnerKey("forum", id), userId } },
      include: { user: { select: LEAD_USER_SELECT } },
    });
    if (!lead) return fail("این لید یافت نشد", 404);

    // نقش کاربر در انجمن
    const member = await db.forumMember.findUnique({
      where: { forumId_userId: { forumId: id, userId } },
      select: { role: true, status: true },
    });
    const memberRole: "CHAIR" | "MEMBER" | "GUEST" =
      member?.status === "ACTIVE" ? (member.role === "CHAIR" ? "CHAIR" : "MEMBER") : "GUEST";

    // ترنسکریپت ترد خصوصی — آخرین ۳۰۰ پیام (desc+take) سپس معکوس؛
    // قبلاً asc+take بود که در تردهای بلند فقط قدیمی‌ها را برمی‌گرداند
    const rows = await db.forumMessage.findMany({
      where: { forumId: id, thread: "AGENT", threadUserId: userId },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { id: true, isFromAgent: true, content: true, createdAt: true },
    });
    rows.reverse();
    const messages: LeadMessageDTO[] = rows.map((m) => ({
      id: m.id,
      fromUser: !m.isFromAgent,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    }));

    return ok({
      lead: {
        id: lead.id,
        user: { ...toLeadUser(lead.user), memberRole },
        status: lead.status as LeadStatus,
        note: lead.note,
        messageCount: lead.messageCount,
        firstMessageAt: lead.firstMessageAt.toISOString(),
        lastMessageAt: lead.lastMessageAt.toISOString(),
        wasReset: lead.messageCount > 0 && messages.length === 0,
      },
      messages,
    });
  } catch (err) {
    console.error("خطای جزئیات لید انجمن:", err);
    return fail("خطای داخلی سرور", 500);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string; userId: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("forums");
    if (gate) return gate;

    const { id, userId } = await ctx.params;
    const body = await parseJson<{ status?: string; note?: string }>(req);
    if (!body || (body.status === undefined && body.note === undefined)) {
      return fail("چیزی برای به‌روزرسانی ارسال نشده است");
    }
    if (body.status !== undefined && !isLeadStatus(body.status)) {
      return fail("وضعیت لید نامعتبر است");
    }
    const note = body.note !== undefined ? String(body.note).trim().slice(0, 1000) || null : undefined;

    const forum = await db.forum.findUnique({ where: { id }, select: { id: true, chairId: true } });
    if (!forum) return fail("انجمن یافت نشد", 404);
    if (forum.chairId !== auth.id) {
      return fail("مدیریت لیدها فقط برای رئیس انجمن ممکن است", 403);
    }

    const lead = await db.agentLead.findUnique({
      where: { ownerKey_userId: { ownerKey: leadOwnerKey("forum", id), userId } },
      select: { id: true },
    });
    if (!lead) return fail("این لید یافت نشد", 404);

    const updated = await db.agentLead.update({
      where: { id: lead.id },
      data: {
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(note !== undefined ? { note } : {}),
      },
    });

    await logActivity({
      userId: auth.id,
      action: "forum.lead.update",
      entity: "agent-lead",
      entityId: lead.id,
      details: { forumId: id, status: updated.status },
    }).catch(() => {});

    return ok({ message: "لید به‌روزرسانی شد", status: updated.status, note: updated.note });
  } catch (err) {
    console.error("خطای به‌روزرسانی لید انجمن:", err);
    return fail("خطای داخلی سرور", 500);
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string; userId: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("forums");
    if (gate) return gate;

    const { id, userId } = await ctx.params;
    const forum = await db.forum.findUnique({ where: { id }, select: { id: true, chairId: true } });
    if (!forum) return fail("انجمن یافت نشد", 404);
    if (forum.chairId !== auth.id) {
      return fail("مدیریت لیدها فقط برای رئیس انجمن ممکن است", 403);
    }

    const lead = await db.agentLead.findUnique({
      where: { ownerKey_userId: { ownerKey: leadOwnerKey("forum", id), userId } },
      select: { id: true },
    });
    if (!lead) return fail("این لید یافت نشد", 404);

    await db.agentLead.delete({ where: { id: lead.id } });
    return ok({ message: "لید حذف شد" });
  } catch (err) {
    console.error("خطای حذف لید انجمن:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
