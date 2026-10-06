// ═════ چت هوشیار — POST /api/ai/chat ═════
// دو حالت پاسخ:
//  • JSON معمولی (سازگار با قبل)
//  • استریم NDJSON با هدر X-Progress-Events: 1 —
//    هر خط یک رویداد: {type:"stage",...} و در انتها {type:"result",...}
//    تا UI چت مراحل زنده هوشیار را مرحله‌به‌مرحله نمایش دهد
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, userAgentFrom, guardModule } from "@/lib/core/api";
import { processChat, saveChatTurn, DEFAULT_CAPABILITIES, type ChatCapabilities } from "@/lib/modules/ai/chat-service";
import type { StageId } from "@/lib/modules/ai/stages";
import { rateLimit, getClientIp } from "@/lib/core/rate-limit";
import { guardAiBudget } from "@/lib/core/ai-budget";
import { logActivity } from "@/lib/core/logger";
import { verifiedMediaUrl } from "@/lib/media/verify";
import { getModuleState } from "@/lib/modules/cms/service";
import { createMeter } from "@/lib/modules/tokens/meter";
import { recordUsageSafe } from "@/lib/modules/tokens/usage";
import { getTokenSettings } from "@/lib/modules/tokens/settings";

export const maxDuration = 120; // حداکثر زمان پردازش برای حالت‌های سنگین

interface ChatRequestBody {
  message: string;
  sessionId?: string;
  mode?: string;
  attachment?: { url: string; name: string; mime: string };
}

/** استخراج قابلیت‌های فعال از کانفیگ ماژول چت (پنل مدیریت) */
function capabilitiesFromConfig(cfg: Record<string, boolean | number> | undefined): ChatCapabilities {
  if (!cfg) return { ...DEFAULT_CAPABILITIES };
  return {
    fileTools: cfg.enableFileTools !== false,
    codeInterpreter: cfg.enableCodeInterpreter !== false,
    maxFilesPerReply: clampInt(cfg.maxFilesPerReply, 1, 3, 3),
    maxSheetRows: clampInt(cfg.maxSheetRows, 100, 5000, 5000),
  };
}

function clampInt(v: unknown, min: number, max: number, dflt: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** فرمت رویداد مرحله برای استریم */
function stageLine(stage: StageId, detail?: string): string {
  return JSON.stringify({ type: "stage", stage, ...(detail ? { detail } : {}) });
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("chat");
    if (gate) return gate;

    // محدودیت نرخ پیام: ۳۰ پیام در ۵ دقیقه
    const rl = rateLimit(`chat:${auth.id}`, 30, 5 * 60 * 1000);
    if (!rl.allowed) {
      return fail(`سرعت ارسال پیام زیاد است. ${rl.retryAfterSec} ثانیه صبر کنید`, 429);
    }

    const body = await parseJson<ChatRequestBody>(req);
    if (!body?.message?.trim() && !body?.attachment) return fail("پیام خالی است");

    const message = (body.message || "").trim().slice(0, 4000);
    const mode = (["chat", "deep", "search", "image"].includes(body.mode || "") ? body.mode : "chat") as
      | "chat" | "deep" | "search" | "image";

    // حالت‌های غیرفعال از سوی مدیریت CMS → خطای شفاف فارسی
    const chatState = await getModuleState("chat");
    if (mode === "deep" && chatState?.config.enableDeepThink === false) {
      return fail("حالت تفکر عمیق توسط مدیریت سامانه غیرفعال شده است", 403);
    }
    if (mode === "search" && chatState?.config.enableWebSearch === false) {
      return fail("حالت جستجوی وب توسط مدیریت سامانه غیرفعال شده است", 403);
    }
    if (mode === "image" && chatState?.config.enableImageGen === false) {
      return fail("حالت تولید تصویر توسط مدیریت سامانه غیرفعال شده است", 403);
    }
    const capabilities = capabilitiesFromConfig(chatState?.config);

    // اعتبارسنجی پیوست — فقط فایل‌های موجود در مخزن کانونی پذیرفته و
    // همیشه URL کانونی جدید (/files/...) در دیتابیس ذخیره می‌شود
    let attachment: { url: string; name: string; mime: string } | null = null;
    if (body.attachment?.url) {
      // خواندن اسناد غیرفعال → پیوست پذیرفته نمی‌شود
      if (chatState?.config.enableDocReading === false) {
        return fail("خواندن فایل و سند توسط مدیریت سامانه غیرفعال شده است", 403);
      }
      const canonicalUrl = await verifiedMediaUrl(body.attachment.url);
      if (canonicalUrl) {
        attachment = {
          url: canonicalUrl,
          name: String(body.attachment.name || "فایل").slice(0, 120),
          mime: String(body.attachment.mime || "").slice(0, 100),
        };
      }
    }

    // ─── سهمیه روزانه یکپارچه AI (همه‌ی سطوح: چت، مشاور مالی، اهداف، ایجنت‌ها) ───
    // شمارش از ActivityLog با اکشن‌های ai.* — قابل مدیریت از پنل (dailyMessageLimit)
    // پس از پرشدن سهمیه رایگان، هزینه‌ی حالت از کیف پول توکن کسر می‌شود
    const chatFeature =
      body.mode === "image" ? "image_gen"
      : body.mode === "deep" ? "deep_think"
      : body.mode === "search" ? "web_search"
      : body.attachment ? "document_read"
      : "chat";
    const budgetGate = await guardAiBudget(auth.id, chatFeature);
    if (budgetGate) return budgetGate;

    // یافتن یا ساخت جلسه گفتگو
    let sessionId = body.sessionId;
    if (sessionId) {
      const session = await db.chatSession.findFirst({
        where: { id: sessionId, userId: auth.id },
      });
      if (!session) sessionId = undefined;
    }
    if (!sessionId) {
      const session = await db.chatSession.create({
        data: { userId: auth.id, mode, title: (message || `📎 ${attachment?.name || "فایل"}`).slice(0, 40) },
      });
      sessionId = session.id;
    }

    // ─── حالت استریم: مراحل زنده + نتیجه در انتها ───
    const wantsStream = req.headers.get("x-progress-events") === "1";
    const finalSessionId = sessionId;

    if (wantsStream) {
      const encoder = new TextEncoder();
      const startedAt = Date.now();
      const meter = createMeter(); // مترینگ دقیق مصرف این فراخوانی (مثل صورتحساب API)

      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const send = (line: string) => {
            try { controller.enqueue(encoder.encode(line + "\n")); } catch {}
          };

          try {
            const result = await meter.run(() =>
              processChat(
                auth.id,
                finalSessionId,
                message || `📎 ${attachment?.name || "فایل"}`,
                mode,
                attachment,
                capabilities,
                (stage, detail) => send(stageLine(stage, detail))
              )
            );

            await saveChatTurn(finalSessionId, message || `📎 ${attachment?.name || "فایل"}`, result, mode, auth.id, attachment);

            // ─── ثبت مصرف دقیق (ورودی + خروجی + هزینه ثابت تصویر) ───
            const snap = meter.snapshot();
            const settings = await getTokenSettings();
            const usage = await recordUsageSafe({
              userId: auth.id,
              feature: chatFeature,
              inputTokens: snap.inputTokens,
              outputTokens: snap.outputTokens,
              extraTokens: result.imageData ? settings.imageGenTokens : 0,
              estimated: snap.estimated,
              model: snap.model,
              title: (message || attachment?.name || "").slice(0, 60) || null,
              refId: finalSessionId,
              meta: {
                mode, searchUsed: result.searchUsed, hasImage: !!result.imageData,
                hasAttachment: !!attachment, generatedFiles: result.generatedFiles.length,
                calls: snap.calls, streamMs: Date.now() - startedAt,
              },
            });

            await logActivity({
              userId: auth.id,
              action: "ai.chat",
              entity: "chatSession",
              entityId: finalSessionId,
              details: {
                mode, searchUsed: result.searchUsed, hasImage: !!result.imageData,
                hasAttachment: !!attachment, generatedFiles: result.generatedFiles.length,
                streamMs: Date.now() - startedAt,
                tokens: usage?.totalTokens ?? 0,
              },
              ip: getClientIp(req),
              userAgent: userAgentFrom(req),
            });

            send(JSON.stringify({
              type: "result",
              data: {
                sessionId: finalSessionId,
                reply: {
                  content: result.content,
                  thinking: result.thinking,
                  searchUsed: result.searchUsed,
                  imageData: result.imageData,
                  attachment,
                  generatedFiles: result.generatedFiles,
                },
                // مصرف این پیام (نمایش در UI چت)
                usage: usage
                  ? {
                      inputTokens: snap.inputTokens,
                      outputTokens: snap.outputTokens,
                      totalTokens: usage.totalTokens,
                      chargedTokens: usage.charged,
                      balance: usage.balance,
                      estimated: snap.estimated,
                    }
                  : null,
              },
            }));
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes("429") || msg.includes("Too many requests")) {
              console.warn("سقف نرخ سرویس مدل (چت هوشیار):", msg.slice(0, 150));
              send(JSON.stringify({ type: "error", error: "در حال حاضر تقاضا زیاد است؛ یک دقیقه بعد دوباره امتحان کنید" }));
            } else {
              console.error("خطای چت هوشیار:", err);
              send(JSON.stringify({ type: "error", error: "هوشیار الان در دسترس نیست. چند لحظه بعد تلاش کنید" }));
            }
          } finally {
            try { controller.close(); } catch {}
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no", // غیرفعال‌کردن بافر پراکسی
        },
      });
    }

    // ─── حالت JSON معمولی (سازگار با قبل) ───
    // پردازش پیام با موتور هوشیار — پیوست کامل خوانده و تحلیل می‌شود
    // (موتور خواندن اسناد: PDF/Word/Excel/متن/کد + تصویر با مدل بینایی)
    const meter = createMeter();
    const result = await meter.run(() =>
      processChat(auth.id, sessionId, message || `📎 ${attachment?.name || "فایل"}`, mode, attachment, capabilities)
    );

    // ذخیره نوبت گفتگو
    await saveChatTurn(sessionId, message || `📎 ${attachment?.name || "فایل"}`, result, mode, auth.id, attachment);

    // ─── ثبت مصرف دقیق ───
    const snap = meter.snapshot();
    const settings = await getTokenSettings();
    const usage = await recordUsageSafe({
      userId: auth.id,
      feature: chatFeature,
      inputTokens: snap.inputTokens,
      outputTokens: snap.outputTokens,
      extraTokens: result.imageData ? settings.imageGenTokens : 0,
      estimated: snap.estimated,
      model: snap.model,
      title: (message || attachment?.name || "").slice(0, 60) || null,
      refId: sessionId,
      meta: {
        mode, searchUsed: result.searchUsed, hasImage: !!result.imageData,
        hasAttachment: !!attachment, generatedFiles: result.generatedFiles.length,
        calls: snap.calls,
      },
    });

    await logActivity({
      userId: auth.id,
      action: "ai.chat",
      entity: "chatSession",
      entityId: sessionId,
      details: { mode, searchUsed: result.searchUsed, hasImage: !!result.imageData, hasAttachment: !!attachment, generatedFiles: result.generatedFiles.length, tokens: usage?.totalTokens ?? 0 },
      ip: getClientIp(req),
      userAgent: userAgentFrom(req),
    });

    return ok({
      sessionId,
      reply: {
        content: result.content,
        thinking: result.thinking,
        searchUsed: result.searchUsed,
        imageData: result.imageData,
        attachment,
        generatedFiles: result.generatedFiles,
      },
      usage: usage
        ? {
            inputTokens: snap.inputTokens,
            outputTokens: snap.outputTokens,
            totalTokens: usage.totalTokens,
            chargedTokens: usage.charged,
            balance: usage.balance,
            estimated: snap.estimated,
          }
        : null,
    });
  } catch (err) {
    // خطای 429 سرویس مدل → پیام دقیق‌تر برای کاربر
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("429") || msg.includes("Too many requests")) {
      console.warn("سقف نرخ سرویس مدل (چت هوشیار):", msg.slice(0, 150));
      return fail("در حال حاضر تقاضا زیاد است؛ یک دقیقه بعد دوباره امتحان کنید", 429);
    }
    console.error("خطای چت هوشیار:", err);
    return fail("هوشیار الان در دسترس نیست. چند لحظه بعد تلاش کنید", 503);
  }
}
