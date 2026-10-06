// ═════ پیام‌رسانی گفتگو — GET / POST /api/social/conversations/[id] ═════
// GET: جزئیات گفتگو + پیام‌ها
// POST: ارسال پیام — در DM ذخیره می‌شود؛ در گفتگوی ایجنت،
//       پاسخ ایجنت با موتور AI سراسری + دانش اختصاصی مالک ساخته می‌شود
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { rateLimit } from "@/lib/core/rate-limit";
import { guardAiBudget } from "@/lib/core/ai-budget";
import { chatCompletion, type ChatMsg } from "@/lib/modules/ai/zai";
import { createMeter } from "@/lib/modules/tokens/meter";
import { recordUsageSafe } from "@/lib/modules/tokens/usage";
import { buildAgentSystemPrompt, getGlobalAiConfig, getAgentDisplayConfig } from "@/lib/modules/social/agent-prompt";
import { touchLead } from "@/lib/modules/leads/service";
import type { SocialChatMessage } from "@/lib/modules/social/types";

const MAX_MESSAGE = 2000;

/** آیا من به این گفتگو دسترسی دارم؟ */
function canAccess(conv: { userAId: string; userBId: string | null; ownerId: string | null }, meId: string): boolean {
  return conv.userAId === meId || conv.userBId === meId || conv.ownerId === meId;
}

const USER_SELECT = {
  id: true,
  fullName: true,
  avatarUrl: true,
  avatarColor: true,
  socialProfile: { select: { headline: true, bannerTheme: true } },
} as const;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("social");
    if (gate) return gate;

    const { id } = await ctx.params;
    const conv = await db.socialConversation.findUnique({
      where: { id },
      include: {
        userA: { select: USER_SELECT },
        userB: { select: USER_SELECT },
        owner: { select: USER_SELECT },
        // ⚠️ صفحه‌بندی صحیح: آخرین ۱۲۰ پیام (desc + take) سپس معکوس به
        // ترتیب زمانی. قبلاً asc+take بود که بعد از ۱۲۰ پیام فقط قدیمی‌ها
        // را برمی‌گرداند و پیام‌های جدید هرگز به کلاینت نمی‌رسیدند
        messages: { orderBy: { createdAt: "desc" }, take: 120, include: { sender: { select: { id: true, fullName: true } } } },
      },
    });
    if (!conv || !canAccess(conv, auth.id)) return fail("این گفتگو یافت نشد", 404);
    conv.messages.reverse();

    const isSelfAgent = conv.type === "agent" && conv.userAId === auth.id && conv.ownerId === auth.id;
    const isOwnerSide = conv.type === "agent" && conv.ownerId === auth.id && !isSelfAgent;
    const other = conv.type === "dm" ? (conv.userAId === auth.id ? conv.userB : conv.userA) : isOwnerSide ? conv.userA : conv.owner;

    // آمار ایجنت مالک (برای نشان‌دادن آمادگی)
    let agentStats: { items: number; totalChars: number } | null = null;
    let agentConfig: { enabled: boolean; name: string | null; greeting: string | null; questions: string[]; styleLabel: string | null } | null = null;
    if (conv.type === "agent" && conv.ownerId) {
      const agg = await db.knowledgeItem.aggregate({
        where: { userId: conv.ownerId },
        _count: { _all: true },
        _sum: { charCount: true },
      });
      agentStats = { items: agg._count._all, totalChars: agg._sum.charCount || 0 };
      agentConfig = await getAgentDisplayConfig(conv.ownerId);
    }

    const messages: SocialChatMessage[] = conv.messages.map((m) => ({
      id: m.id,
      senderType: m.senderType as "user" | "agent",
      senderId: m.senderId,
      senderName: m.senderId ? m.sender?.fullName || null : null,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    }));

    return ok({
      conversation: {
        id: conv.id,
        type: conv.type as "dm" | "agent",
        myRole: isOwnerSide ? "agent-owner" : "participant",
      },
      other: other
        ? {
            userId: other.id,
            name: other.fullName || "کاربر شهریار",
            avatarUrl: other.avatarUrl,
            avatarColor: other.avatarColor,
            headline: other.socialProfile?.headline ?? null,
          }
        : null,
      agentStats,
      agentConfig,
      messages,
    });
  } catch (err) {
    console.error("خطای GET گفتگو:", err);
    return fail("خطای داخلی سرور", 500);
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("social");
    if (gate) return gate;

    const { id } = await ctx.params;
    const body = await parseJson<{ content?: string }>(req);
    // اعتبارسنجی نوع — پیام غیرمتنی (عدد/آبجکت) نباید ۴۵۰/۵۰۰ بدهد
    if (body?.content !== undefined && typeof body.content !== "string") {
      return fail("متن پیام نامعتبر است");
    }
    const content = (body?.content || "").trim();
    if (!content) return fail("متن پیام خالی است");
    if (content.length > MAX_MESSAGE) return fail(`پیام حداکثر ${MAX_MESSAGE.toLocaleString("fa-IR")} کاراکتر می‌تواند باشد`);

    const conv = await db.socialConversation.findUnique({ where: { id } });
    if (!conv || !canAccess(conv, auth.id)) return fail("این گفتگو یافت نشد", 404);

    // ─── DM: فقط ذخیره‌ی پیام ───
    if (conv.type === "dm") {
      const dmGate = await guardModule("social", "enableDirectChat");
      if (dmGate) return dmGate;

      // نرخ فقط بر پایه شناسه کاربر — IP با XFF قابل چرخش است و قبلاً
      // با تزریق هدر، سقف هر IP تازه‌ای باز می‌شد
      const rl = rateLimit(`social-dm:${auth.id}`, 60, 3600_000);
      if (!rl.allowed) return fail("پیام‌های شما بیش از حد مجاز است؛ کمی صبر کنید", 429);

      const message = await db.socialMessage.create({
        data: { conversationId: conv.id, senderId: auth.id, senderType: "user", content },
      });
      await db.socialConversation.update({
        where: { id: conv.id },
        data: { updatedAt: new Date(), messageCount: { increment: 1 } },
      });

      return ok({
        userMessage: {
          id: message.id,
          senderType: "user",
          senderId: auth.id,
          senderName: auth.fullName,
          content: message.content,
          createdAt: message.createdAt.toISOString(),
        } satisfies SocialChatMessage,
        agentReply: null,
      });
    }

    // ─── گفتگو با ایجنت ───
    const agentGate = await guardModule("social", "enableAgentChat");
    if (agentGate) return agentGate;

    // در گفتگوی ایجنت فقط «چت‌کننده» (userA) پیام می‌فرستد؛ مالک فقط می‌بیند
    if (conv.userAId !== auth.id) {
      return fail("این گفتگو فقط برای مشاهده است؛ برای ارتباط مستقیم از پیام‌رسانی استفاده کنید", 403);
    }

    // ایجنت مالک باید فعال باشد
    const ownerProfile = await db.socialProfile.findUnique({
      where: { userId: conv.ownerId! },
      select: { agentEnabled: true },
    });
    if (ownerProfile?.agentEnabled === false) {
      return fail("ایجنت این کاربر در حال حاضر غیرفعال است", 403);
    }

    const rl = rateLimit(`social-agent:${auth.id}`, 30, 3600_000);
    if (!rl.allowed) return fail("تعداد پیام‌ها به ایجنت زیاد است؛ کمی بعد دوباره تلاش کنید", 429);

    // سهمیه روزانه یکپارچه AI (مشترک بین چت/مشاور/اهداف/ایجنت‌ها)
    const budgetGate = await guardAiBudget(auth.id, "social_agent");
    if (budgetGate) return budgetGate;

    const ownerId = conv.ownerId!;

    // ذخیره‌ی پیام کاربر
    const message = await db.socialMessage.create({
      data: { conversationId: conv.id, senderId: auth.id, senderType: "user", content },
    });
    await db.socialConversation.update({
      where: { id: conv.id },
      data: { updatedAt: new Date(), messageCount: { increment: 1 } },
    });

    // ثبت/به‌روزرسانی لید برای مالک ایجنت — گفتگوی آزمایشی خودِ مالک لید نیست
    if (auth.id !== ownerId) {
      await touchLead({ scope: "user", ownerId, userId: auth.id });
    }

    // ساخت پرامپت ایجنت + تاریخچه
    const [{ systemPrompt }, globalCfg, history] = await Promise.all([
      buildAgentSystemPrompt(ownerId),
      getGlobalAiConfig(),
      db.socialMessage.findMany({
        where: { conversationId: conv.id },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: { senderType: true, senderId: true, content: true },
      }),
    ]);

    const owner = await db.user.findUnique({ where: { id: ownerId }, select: { fullName: true } });
    const ownerName = owner?.fullName || "صاحب پروفایل";

    const messages: ChatMsg[] = [{ role: "system", content: systemPrompt }];
    // تاریخچه به ترتیب زمانی (قدیم → جدید)
    for (const m of history.reverse()) {
      if (m.senderType === "agent") {
        messages.push({ role: "assistant", content: m.content.slice(0, 4000) });
      } else {
        // پیام شخصی خودِ مالک (اگر روزی ارسال شود) برچسب می‌خورد
        const isOwnerMsg = m.senderId === ownerId;
        messages.push({
          role: "user",
          content: isOwnerMsg
            ? `【پیام شخصی خودِ ${ownerName}】: ${m.content.slice(0, 4000)}`
            : m.content.slice(0, 4000),
        });
      }
    }

    // پارامترهای سراسری سیستم (پنل مدیریت)
    const thinking = globalCfg.settings.thinkingEnabled !== false;
    const rawTemp = Number(globalCfg.settings.temperature);
    const temperature = Number.isFinite(rawTemp) && rawTemp >= 0 && rawTemp <= 2 ? rawTemp : 0.7;

    let replyText: string | null = null;
    const meter = createMeter();
    try {
      const res = await meter.run(() => chatCompletion(messages, { thinking, temperature, maxTokens: 3072 }));
      replyText = res?.choices?.[0]?.message?.content?.trim() || null;
    } catch (err) {
      console.error("خطای مدل ایجنت اجتماعی:", err);
    }

    if (!replyText) {
      replyText = "ایجنتِ «" + ownerName + "» الان موقتاً در دسترس نیست. چند لحظه بعد دوباره پیام بفرستید — پیام شما ثبت شد.";
    }

    // ─── ثبت مصرف دقیق ایجنت شخصی ───
    const snap = meter.snapshot();
    if (snap.calls > 0) {
      await recordUsageSafe({
        userId: auth.id,
        feature: "social_agent",
        inputTokens: snap.inputTokens,
        outputTokens: snap.outputTokens,
        estimated: snap.estimated,
        model: snap.model,
        title: `گفتگو با ایجنت ${ownerName}`.slice(0, 120),
        refId: message.id,
        meta: { ownerId, conversationId: conv.id, chars: content.length, thinking },
      });
    }

    const reply = await db.socialMessage.create({
      data: { conversationId: conv.id, senderId: null, senderType: "agent", content: replyText },
    });
    await db.socialConversation.update({
      where: { id: conv.id },
      data: { updatedAt: new Date(), messageCount: { increment: 1 } },
    });

    // پاسخ ایجنت هم در آمار پیگیری لید شمرده می‌شود (ردوبدل کامل)
    if (auth.id !== ownerId) {
      await touchLead({ scope: "user", ownerId, userId: auth.id });
    }

    await logActivity({
      userId: auth.id,
      action: "ai.social_agent",
      entity: "social-conversation",
      entityId: conv.id,
      details: { ownerId, chars: content.length, aiGenerated: replyText !== null },
    });

    return ok({
      userMessage: {
        id: message.id,
        senderType: "user",
        senderId: auth.id,
        senderName: auth.fullName,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      } satisfies SocialChatMessage,
      agentReply: {
        id: reply.id,
        senderType: "agent",
        senderId: null,
        senderName: null,
        content: reply.content,
        createdAt: reply.createdAt.toISOString(),
      } satisfies SocialChatMessage,
    });
  } catch (err) {
    console.error("خطای POST پیام:", err);
    return fail("خطای داخلی سرور", 500);
  }
}

// ═══ بازنشانی گفتگوی ایجنت — DELETE /api/social/conversations/[id] ═══
// چت‌کننده (userA) می‌تواند گفتگوی خودش با ایجنت را بازنشانی کند:
// همه‌ی پیام‌ها حذف و شمارنده صفر می‌شود؛ خود گفتگو برای ادامه باقی می‌ماند.
// رکورد لید مالک حفظ می‌شود (CRM) اما ترنسکریپت آن خالی خواهد بود.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("social");
    if (gate) return gate;

    const { id } = await ctx.params;
    const conv = await db.socialConversation.findUnique({ where: { id } });
    if (!conv || !canAccess(conv, auth.id)) return fail("این گفتگو یافت نشد", 404);

    // بازنشانی فقط برای گفتگوی ایجنت و فقط توسط خودِ چت‌کننده
    if (conv.type !== "agent") {
      return fail("بازنشانی فقط برای گفتگو با ایجنت ممکن است؛ پیام‌رسانی مستقیم دست‌نخورده می‌ماند", 403);
    }
    if (conv.userAId !== auth.id) {
      return fail("فقط خودتان می‌توانید این گفتگو را بازنشانی کنید", 403);
    }

    const agentGate = await guardModule("social", "enableAgentChat");
    if (agentGate) return agentGate;

    const deleted = await db.socialMessage.deleteMany({ where: { conversationId: conv.id } });
    await db.socialConversation.update({
      where: { id: conv.id },
      data: { messageCount: 0, updatedAt: new Date() },
    });

    await logActivity({
      userId: auth.id,
      action: "social.agent.reset",
      entity: "social-conversation",
      entityId: conv.id,
      details: { ownerId: conv.ownerId, deletedMessages: deleted.count },
    });

    return ok({ message: "گفتگو بازنشانی شد", deletedMessages: deleted.count });
  } catch (err) {
    console.error("خطای بازنشانی گفتگو:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
