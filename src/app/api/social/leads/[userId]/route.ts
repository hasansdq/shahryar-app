// ═══ لید ایجنت شخصی — GET / PATCH / DELETE /api/social/leads/[userId] ═══
// GET   → پروفایل کاربر لید + ترنسکریپت کامل گفتگو با ایجنت من
// PATCH → به‌روزرسانی وضعیت گردش کار (NEW/CONTACTED/CONVERTED/ARCHIVED) + یادداشت
// DELETE → حذف لید از فهرست (گفتگو دست‌نخورده می‌ماند)
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

export async function GET(req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("social");
    if (gate) return gate;

    const { userId } = await ctx.params;
    if (!userId || userId.length > 40) return fail("شناسه کاربر نامعتبر است");

    const lead = await db.agentLead.findUnique({
      where: { ownerKey_userId: { ownerKey: leadOwnerKey("user", auth.id), userId } },
      include: { user: { select: LEAD_USER_SELECT } },
    });
    if (!lead) return fail("این لید یافت نشد", 404);

    // گفتگوی خصوصی همین لید با ایجنت من
    // ⚠️ آخرین ۳۰۰ پیام (desc+take) سپس معکوس — قبلاً asc+take بود که
    // در گفتگوهای بلند فقط قدیمی‌ترین ۳۰۰ پیام را برمی‌گرداند
    const conv = await db.socialConversation.findUnique({
      where: { key: `agent:${userId}:${auth.id}` },
      select: {
        id: true,
        messages: { orderBy: { createdAt: "desc" }, take: 300, select: { id: true, senderType: true, content: true, createdAt: true } },
      },
    });
    if (conv) conv.messages.reverse();

    const messages: LeadMessageDTO[] = (conv?.messages || []).map((m) => ({
      id: m.id,
      fromUser: m.senderType === "user",
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    }));

    return ok({
      lead: {
        id: lead.id,
        user: toLeadUser(lead.user),
        status: lead.status as LeadStatus,
        note: lead.note,
        messageCount: lead.messageCount,
        firstMessageAt: lead.firstMessageAt.toISOString(),
        lastMessageAt: lead.lastMessageAt.toISOString(),
        wasReset: lead.messageCount > 0 && messages.length === 0,
      },
      messages,
      conversationId: conv?.id || null,
    });
  } catch (err) {
    console.error("خطای جزئیات لید:", err);
    return fail("خطای داخلی سرور", 500);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("social");
    if (gate) return gate;

    const { userId } = await ctx.params;
    const body = await parseJson<{ status?: string; note?: string }>(req);
    if (!body || (body.status === undefined && body.note === undefined)) {
      return fail("چیزی برای به‌روزرسانی ارسال نشده است");
    }
    if (body.status !== undefined && !isLeadStatus(body.status)) {
      return fail("وضعیت لید نامعتبر است");
    }

    const note = body.note !== undefined ? String(body.note).trim().slice(0, 1000) || null : undefined;

    const lead = await db.agentLead.findUnique({
      where: { ownerKey_userId: { ownerKey: leadOwnerKey("user", auth.id), userId } },
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
      action: "social.lead.update",
      entity: "agent-lead",
      entityId: lead.id,
      details: { status: updated.status, hasNote: !!updated.note },
    }).catch(() => {});

    return ok({ message: "لید به‌روزرسانی شد", status: updated.status, note: updated.note });
  } catch (err) {
    console.error("خطای به‌روزرسانی لید:", err);
    return fail("خطای داخلی سرور", 500);
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("social");
    if (gate) return gate;

    const { userId } = await ctx.params;
    const lead = await db.agentLead.findUnique({
      where: { ownerKey_userId: { ownerKey: leadOwnerKey("user", auth.id), userId } },
      select: { id: true },
    });
    if (!lead) return fail("این لید یافت نشد", 404);

    await db.agentLead.delete({ where: { id: lead.id } });
    return ok({ message: "لید حذف شد" });
  } catch (err) {
    console.error("خطای حذف لید:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
