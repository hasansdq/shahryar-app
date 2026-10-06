// ═══ پیام‌های انجمن — GET / POST / DELETE /api/forums/[id]/messages ═════
// GET  ?thread=forum|agent — پیام‌های رشته:
//      • تالار گروهی (FORUM): مشترک بین همه‌ی اعضا
//      • گفتگوی ایجنت (AGENT): ترد خصوصی ۱:۱ هر کاربر (عضو یا مهمان) —
//        هر کاربر فقط پیام‌های خودش را می‌بیند
// POST {content, thread} — ارسال پیام؛ در تالار اگر پیام شامل @agent یا
//      @ایجنت باشد، پاسخ ایجنت بلافاصله تولید و در همان گفتگو برای همه ثبت می‌شود.
//      در رشته‌ی AGENT پیام و پاسخ در ترد خصوصی فرستنده ثبت می‌شود و
//      لید رئیس انجمن به‌روز می‌شود.
// DELETE ?thread=agent — بازنشانی گفتگوی خصوصی من با ایجنت انجمن
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { rateLimit } from "@/lib/core/rate-limit";
import { guardAiBudget } from "@/lib/core/ai-budget";
import { createMeter } from "@/lib/modules/tokens/meter";
import { recordUsageSafe } from "@/lib/modules/tokens/usage";
import { MAX_MESSAGE, detectAgentMention, listMessages, loadForumForUser } from "@/lib/modules/forums/service";
import { generateForumAgentReply } from "@/lib/modules/forums/agent";
import { touchLead } from "@/lib/modules/leads/service";
import type { ForumThread } from "@/lib/modules/forums/types";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("forums");
    if (gate) return gate;

    const { id } = await ctx.params;
    const threadParam = new URL(req.url).searchParams.get("thread") || "forum";
    const thread: ForumThread = threadParam === "agent" ? "AGENT" : "FORUM";

    const loaded = await loadForumForUser(id, auth.id);
    if (!loaded) return fail("انجمن یافت نشد", 404);

    const isMemberActive = !!loaded.membership && loaded.membership.status === "ACTIVE";
    const isPublic = loaded.forum.type === "PUBLIC";

    // تالار گفتمان: فقط اعضای فعال
    if (thread === "FORUM" && !isMemberActive) {
      return fail("مشاهده گفتگوهای انجمن فقط برای اعضای فعال ممکن است", 403);
    }

    // گفتگوی ایجنت: ترد خصوصی — اعضا + مهمان‌های انجمن عمومی
    if (thread === "AGENT") {
      const agentGate = await guardModule("forums", "enableForumAgent");
      if (agentGate) return agentGate;
      if (!loaded.forum.agentEnabled) {
        return fail("ایجنت این انجمن غیرفعال است", 403);
      }
      // مهمانِ انجمن خصوصی اصلاً به اینجا نمی‌رسد (loadForumForUser null)
      if (!isMemberActive && !isPublic) {
        return fail("مشاهده گفتگوهای انجمن فقط برای اعضای فعال ممکن است", 403);
      }
    }

    const agentName = loaded.forum.agentName?.trim() || `ایجنت ${loaded.forum.title}`;
    // رشته‌ی ایجنت: فقط ترد خصوصی خودم (مهمان هم تاریخچه‌ی خودش را می‌بیند)
    const messages = await listMessages(id, thread, agentName, 120, thread === "AGENT" ? auth.id : undefined);
    return ok({ messages, guest: thread === "AGENT" && !isMemberActive });
  } catch (err) {
    console.error("خطای خواندن پیام‌های انجمن:", err);
    return fail("خطای داخلی سرور", 500);
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("forums");
    if (gate) return gate;

    const { id } = await ctx.params;
    const body = await parseJson<{ content?: string; thread?: string }>(req);
    // اعتبارسنجی نوع — پیام غیرمتنی نباید ۵۰۰ بدهد
    if (body?.content !== undefined && typeof body.content !== "string") {
      return fail("متن پیام نامعتبر است");
    }
    const content = (body?.content || "").trim();
    const thread: ForumThread = body?.thread === "agent" ? "AGENT" : "FORUM";
    if (!content) return fail("متن پیام خالی است");
    if (content.length > MAX_MESSAGE) return fail(`پیام حداکثر ${MAX_MESSAGE.toLocaleString("fa-IR")} کاراکتر می‌تواند باشد`);

    const loaded = await loadForumForUser(id, auth.id);
    if (!loaded) return fail("انجمن یافت نشد", 404);

    const isMemberActive = !!loaded.membership && loaded.membership.status === "ACTIVE";
    const isBanned = loaded.membership?.status === "BANNED";
    const isPublic = loaded.forum.type === "PUBLIC";
    // مهمان = غیرعضوِ انجمن عمومی که در رشته ایجنت گفتگو می‌کند
    // ⚠️ کاربر مسدودشده (BANNED) مهمان تلقی نمی‌شود — بلاک باید در کانال AI
    // هم اجرا شود وگرنه مسدود می‌تواند بی‌نهایت هزینه ایجنت تولید کند
    const isGuest = thread === "AGENT" && !isMemberActive && !isBanned;

    // تالار گفتمان: فقط اعضای فعال
    if (thread === "FORUM" && !isMemberActive) {
      return fail("ارسال پیام در انجمن فقط برای اعضای فعال ممکن است", 403);
    }
    // مسدودشده: هیچ رشته‌ای (تالار یا ایجنت) برایش باز نیست
    if (isBanned) {
      return fail("عضویت شما در این انجمن مسدود شده است", 403);
    }
    // گفتگوی خصوصی با ایجنت فقط در انجمن عمومی برای غیراعضا باز است
    if (isGuest && !isPublic) {
      return fail("گفتگو با ایجنت فقط برای اعضای فعال ممکن است", 403);
    }
    if (loaded.forum.status === "PAUSED") {
      return fail("این انجمن موقتاً غیرفعال است", 403);
    }

    // گفتگوی خصوصی با ایجنت: اگر قابلیت در CMS خاموش یا ایجنت غیرفعال است،
    // پیام اصلاً در این رشته ثبت نمی‌شود (جلوگیری از پیام مرده بدون پاسخ)
    if (thread === "AGENT") {
      const agentGate = await guardModule("forums", "enableForumAgent");
      if (agentGate) return agentGate;
      if (!loaded.forum.agentEnabled) {
        return fail("ایجنت این انجمن غیرفعال است", 403);
      }
    }

    // محدودیت نرخ: پیام عادی شل‌تر، فراخوان ایجنت سخت‌گیرانه‌تر (هزینه AI)
    // کلیدها فقط بر پایه شناسه کاربر — IP با XFF قابل چرخش بود
    const isAgentCall = thread === "AGENT" || detectAgentMention(content);
    if (isAgentCall) {
      // سهمیه روزانه یکپارچه AI (مشترک بین همه‌ی سطوح هوش مصنوعی)
      const budgetGate = await guardAiBudget(auth.id, "forum_agent");
      if (budgetGate) return budgetGate;
    }
    const rl = isAgentCall
      ? rateLimit(`forum-agent:${auth.id}`, 15, 10 * 60_000) // ۱۵ فراخوان ایجنت در ۱۰ دقیقه
      : rateLimit(`forum-msg:${auth.id}`, 60, 3600_000);
    if (!rl.allowed) {
      return fail(
        isAgentCall ? "فراخوانی‌های ایجنت زیاد است؛ کمی صبر کنید" : "پیام‌های شما بیش از حد مجاز است؛ کمی صبر کنید",
        429
      );
    }

    // ─── ثبت پیام ───
    // رشته‌ی AGENT: پیام در ترد خصوصی فرستنده ثبت می‌شود (عضو و مهمان یکسان) —
    // منبع ترنسکریپت لید رئیس انجمن
    const message = await db.forumMessage.create({
      data: {
        forumId: id,
        thread,
        threadUserId: thread === "AGENT" ? auth.id : null,
        senderId: auth.id,
        isFromAgent: false,
        content,
      },
    });

    // به‌روزرسانی لید رئیس انجمن — پیام کاربر + پاسخ ایجنت هر دو شمرده می‌شوند
    if (thread === "AGENT") {
      await touchLead({ scope: "forum", ownerId: id, userId: auth.id });
    }

    // ─── پاسخ ایجنت ───
    // گفتگوی خصوصی: پاسخ در همان درخواست برگردانده می‌شود (UX چت ۱:۱)
    // تالار گروهی: پاسخ پس از تولید با polling به همه اعضا می‌رسد —
    // درخواست سریع برمی‌گردد و ایجنت در پس‌زمینه پاسخ می‌سازد
    let agentPending = false;
    let agentReply: { id: string; content: string } | null = null;

    // پاسخ ایجنت فقط وقتی تولید می‌شود که هم قابلیت در CMS فعال باشد هم ایجنت انجمن —
    // در غیر این صورت پیام @agent مانند پیام عادی ثبت می‌شود (بدون پاسخ AI)
    let agentFeatureOn = loaded.forum.agentEnabled;
    if (agentFeatureOn && thread === "FORUM" && detectAgentMention(content)) {
      const flagGate = await guardModule("forums", "enableForumAgent");
      agentFeatureOn = !flagGate;
    }
    const needsAgent = agentFeatureOn && (thread === "AGENT" || (thread === "FORUM" && detectAgentMention(content)));

    if (needsAgent) {
      const senderName = auth.fullName || (isGuest ? "مهمان" : "عضو انجمن");
      const agentMeter = createMeter();
      const forumTitle = loaded.forum.title;
      if (thread === "AGENT") {
        const result = await agentMeter.run(() =>
          generateForumAgentReply({
            forumId: id,
            thread,
            triggeringUserId: auth.id,
            triggeringUserName: senderName,
            threadUserId: auth.id,
            guest: isGuest,
          })
        );
        if (result.ok && result.messageId && result.content) {
          agentReply = { id: result.messageId, content: result.content };
          // پاسخ ایجنت هم در آمار لید شمرده می‌شود (ردوبدل کامل)
          await touchLead({ scope: "forum", ownerId: id, userId: auth.id });
        }
        // ─── ثبت مصرف دقیق ایجنت انجمن ───
        const snap = agentMeter.snapshot();
        if (snap.calls > 0) {
          await recordUsageSafe({
            userId: auth.id,
            feature: "forum_agent",
            inputTokens: snap.inputTokens,
            outputTokens: snap.outputTokens,
            estimated: snap.estimated,
            model: snap.model,
            title: `ایجنت انجمن ${forumTitle}`.slice(0, 120),
            refId: agentReply?.id ?? message.id,
            meta: { thread, forumId: id, chars: content.length, guest: isGuest, ok: result.ok },
          });
        }
      } else {
        // پس‌زمینه — پاسخ با polling برگردانده می‌شود
        agentPending = true;
        agentMeter
          .run(() =>
            generateForumAgentReply({
              forumId: id,
              thread,
              triggeringUserId: auth.id,
              triggeringUserName: senderName,
            })
          )
          .then(async (r) => {
            if (!r.ok) console.warn("[ForumAgent] پاسخ ناموفق:", r.error);
            // ─── ثبت مصرف دقیق (پس‌زمینه) ───
            const snap = agentMeter.snapshot();
            if (snap.calls > 0) {
              await recordUsageSafe({
                userId: auth.id,
                feature: "forum_agent",
                inputTokens: snap.inputTokens,
                outputTokens: snap.outputTokens,
                estimated: snap.estimated,
                model: snap.model,
                title: `ایجنت انجمن ${forumTitle}`.slice(0, 120),
                refId: r.messageId ?? message.id,
                meta: { thread, forumId: id, chars: content.length, ok: r.ok },
              }).catch(() => {});
            }
          })
          .catch((e) => console.error("[ForumAgent] خطای پس‌زمینه:", e));
      }
    }

    if (isAgentCall) {
      await logActivity({
        userId: auth.id,
        action: "ai.forum_agent",
        entity: "forum",
        entityId: id,
        details: { thread, chars: content.length, guest: isGuest },
      }).catch(() => {});
    }

    const agentName = loaded.forum.agentName?.trim() || `ایجنت ${loaded.forum.title}`;
    return ok({
      message: {
        id: message.id,
        thread,
        isFromAgent: false,
        senderId: auth.id,
        senderName: auth.fullName,
        senderAvatarUrl: null,
        senderAvatarColor: null,
        content,
        createdAt: message.createdAt.toISOString(),
      },
      agentPending,
      agentReply,
      agentName,
      guest: isGuest,
    });
  } catch (err) {
    console.error("خطای ارسال پیام انجمن:", err);
    return fail("خطای داخلی سرور", 500);
  }
}

// ═══ بازنشانی گفتگوی خصوصی با ایجنت انجمن — DELETE ?thread=agent ═══
// همه‌ی پیام‌های ترد خصوصی من حذف می‌شود؛ رکورد لید رئیس انجمن حفظ می‌شود
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("forums");
    if (gate) return gate;

    const { id } = await ctx.params;
    const threadParam = new URL(req.url).searchParams.get("thread") || "";
    if (threadParam !== "agent") {
      return fail("بازنشانی فقط برای گفتگوی خصوصی با ایجنت ممکن است", 400);
    }

    const loaded = await loadForumForUser(id, auth.id);
    if (!loaded) return fail("انجمن یافت نشد", 404);

    const isMemberActive = !!loaded.membership && loaded.membership.status === "ACTIVE";
    // گفتگو با ایجنت برای اعضا + مهمان‌های انجمن عمومی باز است
    if (!isMemberActive && loaded.forum.type !== "PUBLIC") {
      return fail("گفتگو با ایجنت فقط برای اعضای فعال ممکن است", 403);
    }

    const agentGate = await guardModule("forums", "enableForumAgent");
    if (agentGate) return agentGate;

    // فقط ترد خصوصی خودم — تردهای دیگران دست‌نخورده می‌مانند
    const deleted = await db.forumMessage.deleteMany({
      where: { forumId: id, thread: "AGENT", threadUserId: auth.id },
    });

    await logActivity({
      userId: auth.id,
      action: "forum.agent.reset",
      entity: "forum",
      entityId: id,
      details: { deletedMessages: deleted.count },
    }).catch(() => {});

    return ok({ message: "گفتگو بازنشانی شد", deletedMessages: deleted.count });
  } catch (err) {
    console.error("خطای بازنشانی گفتگوی ایجنت انجمن:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
