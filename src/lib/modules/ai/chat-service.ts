// ═══════════════════════════════════════════════════════════════
// سرویس چت هوشیار — هماهنگ‌کننده اصلی گفتگو
// حالت‌ها: chat | deep (تفکر عمیق) | search (جستجوی وب) | image (تولید تصویر)
// ═══════════════════════════════════════════════════════════════
import { db } from "@/lib/db";
import { chatCompletion, webSearch, generateImage, visionCompletion, type VisionMsg, type VisionContentItem } from "./zai";
import { buildSystemPrompt } from "./prompt-builder";
import { extractMemories } from "./memory-engine";
import { prepareAttachmentForTurn, compactReference } from "./document-reader";
import {
  processFileSpecs,
  appendErrorNotes,
  hasFileSpecBlock,
  detectFileIntent,
} from "./file-generator/pipeline";
import type { GeneratedFileInfo } from "./file-generator/spec";
import type { StageEmitter } from "./stages";

/** قابلیت‌های فعال هوشیار — از کانفیگ ماژول چت در پنل مدیریت */
export interface ChatCapabilities {
  /** ابزار ساخت فایل (Word/Excel/PDF/...) */
  fileTools: boolean;
  /** مفسر کد روی اکسل/CSV پیوست */
  codeInterpreter: boolean;
  /** سقف‌های پویا */
  maxFilesPerReply: number;
  maxSheetRows: number;
}

export const DEFAULT_CAPABILITIES: ChatCapabilities = {
  fileTools: true,
  codeInterpreter: true,
  maxFilesPerReply: 3,
  maxSheetRows: 5000,
};

export interface ChatAttachment {
  url: string;
  name: string;
  mime: string;
}

export interface ChatResult {
  content: string;
  thinking: string | null;
  searchUsed: boolean;
  imageData: string | null;
  /** فایل‌های تولیدی هوشیار (Word/Excel/PDF/...) */
  generatedFiles: GeneratedFileInfo[];
}

interface ThinkableResponse {
  choices?: Array<{
    message?: { content?: string | null; reasoning_content?: string | null; thinking?: string | null };
  }>;
}

/**
 * فراخوانی متمرکز برای تولید فقط spec فایل — مسیر retry:
 * وقتی پاسخ اصلی بلوک بریده/نامعتبر داشت یا قصد فایل بدون بلوک ماند
 */
async function focusedSpecGeneration(
  userMessage: string,
  brokenReply: string,
  recentHistory: Array<{ role: string; content: string }>,
  previousErrors: string[] = []
): Promise<string | null> {
  const system = `تو مولد خالص spec فایل هستی. خروجی تو «فقط» یک یا چند بلوک \`\`\`file-spec با JSON معتبر است — هیچ توضیح اضافه ننویس.
پروتکل: {"kind":"docx"|"pdf"|"xlsx"|"csv"|"md"|"txt"|"html","fileName":"بدون پسوند", ...}
• docx/pdf: {"doc":{"title":"...","subtitle":"...","blocks":[{"type":"h1|h2|h3|p|quote","text":"..."},{"type":"bullets|numbers","items":[...]},{"type":"table","caption":"...","header":[...],"rows":[[...]]},{"type":"kv","items":[["کلید","مقدار"]]},{"type":"spacer"},{"type":"pagebreak"}]}}
• xlsx: {"sheets":[{"name":"...","columns":[...],"rows":[[...]],"colFormats":["money|percent|int|date|text"],"totals":true,"columnWidths":[..]}]}
• ویرایش اکسل/CSV پیوست: {"source":"attachment","transform":"کد JS روی rows (آرایه اشیاء) که return می‌دهد"} — هر کلید فارسی/فاصله‌دار حتماً داخل کوتیشن: r['مبلغ نهایی'] نه r[مبلغ نهایی]
• csv: {"columns":[...],"rows":[[...]]} — md/txt: {"text":"..."} — html: {"title":"...","text":"<p>...</p>"}
قواعد: JSON کاملاً معتبر (بدون کامای اضافی/کامنت)، اعداد به‌صورت عدد JSON، حداکثر ۳ فایل، اعداد را خودت از داده‌های موجود استخراج کن و دقیق باش. اگر فایل قابل ساخت نیست دقیقاً بنویس: CANNOT_BUILD

⚠️ خطاهای مرگبار JSON که باید مطلقاً از آن‌ها پرهیز کنی (قبلاً رخ داده‌اند):
۱. هرگز دو کوتیشن پشت‌سرهم در شروع رشته ننویس — «""متن"» غلط است، «"متن"» درست است.
۲. بین المان‌های آرایه فقط کاما بگذار — «],["متن"» درست، "},{"متن"» غلط (آکولاد ممنوع).
۳. براکت‌ها را دقیق باز/بسته کن — «[["متن"» درست، «[[]"متن"» غلط.
۴. بعد از هر رشته/مقدار حتماً کاما بگذار؛ کامای انتهایی هم نگذار.
قبل از ارسال، کل JSON را یک‌بار ذهنی بازبینی کن.`;

  const historyPart = recentHistory.slice(-6).map((m) => ({
    role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
    content: m.content.slice(0, 1500),
  }));

  const res = (await chatCompletion(
    [
      { role: "system", content: system },
      ...historyPart,
      {
        role: "user",
        content:
          `درخواست کاربر: «${userMessage}»\n\nپاسخ قبلی که نامعتبر/بریده شد:\n${brokenReply.slice(-4000)}` +
          (previousErrors.length
            ? `\n\n⚠️ خطاهای تلاش قبلی (دقیقاً همین‌ها را رفع کن):\n${previousErrors.map((e) => `• ${e}`).join("\n")}`
            : "") +
          `\n\nحالا فقط بلوک file-spec معتبر و کامل تولید کن.`,
      },
    ],
    { thinking: false, temperature: 0.2, maxTokens: 12000 }
  )) as ThinkableResponse;

  const txt = res.choices?.[0]?.message?.content?.trim();
  if (!txt || txt.includes("CANNOT_BUILD")) return null;
  return txt;
}

/**
 * پردازش پاسخ مدل برای ساخت فایل — با یک تلاش retry متمرکز
 */
async function processFileGeneration(
  rawContent: string,
  userMessage: string,
  sessionId: string,
  attachment: ChatAttachment | null,
  historyMessages: Array<{ role: "user" | "assistant"; content: string }>,
  caps: ChatCapabilities,
  onStage?: StageEmitter
): Promise<{ content: string; files: GeneratedFileInfo[] }> {
  const pipelineCtx = {
    sessionId,
    attachment: attachment ? { url: attachment.url, name: attachment.name, mime: attachment.mime } : null,
    codeInterpreterEnabled: caps.codeInterpreter,
    limits: { specsPerReply: caps.maxFilesPerReply, sheetRows: caps.maxSheetRows },
    onStage,
  };
  const primary = await processFileSpecs(rawContent, pipelineCtx);

  let content = primary.content;
  let files = primary.files;
  let errors = primary.errors;

  // نیازمند retry؟ (بلوک بریده / قصد فایل بدون بلوک / خطای اعتبارسنجی)
  const intent = detectFileIntent(userMessage);
  const needRetry =
    files.length === 0 &&
    (primary.incomplete || (intent && !hasFileSpecBlock(rawContent)) || primary.errors.length > 0);

  if (needRetry) {
    onStage?.("retrying", "بهبود ساختار فایل و تلاش مجدد");
    const specText = await focusedSpecGeneration(userMessage, rawContent, historyMessages, errors);
    if (specText) {
      const secondary = await processFileSpecs(specText, pipelineCtx);
      if (secondary.files.length > 0) {
        files = secondary.files;
        errors = secondary.errors;
      } else {
        errors = [...errors, ...secondary.errors];
      }
    }
    // بلوک بریده‌شده اصلی را از متن نمایشی پاک کن
    content = content
      .replace(/```file-spec[\s\S]*$/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (!content && files.length > 0) {
      content =
        files.length === 1
          ? `فایل «${files[0].name}» آماده شد! از کارت دانلود زیر دریافتش کن.`
          : `${files.length} فایل آماده شد! از کارت‌های دانلود زیر دریافتشان کن.`;
    }
  }

  return { content: appendErrorNotes(content, errors), files };
}

/**
 * پردازش پیام کاربر و تولید پاسخ هوشیار — با موتور خواندن اسناد
 * onStage: گزارش مراحل زنده برای UI چت (استریم)
 */
export async function processChat(
  userId: string,
  sessionId: string,
  userMessage: string,
  mode: "chat" | "deep" | "search" | "image",
  attachment?: ChatAttachment | null,
  capabilities: ChatCapabilities = DEFAULT_CAPABILITIES,
  onStage?: StageEmitter
): Promise<ChatResult> {
  onStage?.("queued");

  // ─── حالت تولید تصویر ───
  if (mode === "image") {
    onStage?.("thinking", "تصور و ترکیب تصویر از توضیحات شما");
    const base64 = await generateImage(userMessage, "1024x1024");
    if (base64) {
      onStage?.("finalizing");
      const content = "این تصویر طبق توضیحات شما ساخته شد. اگر تغییر یا اصلاحی می‌خواهید بگویید تا نسخه جدیدی بسازم.";
      return { content, thinking: null, searchUsed: false, imageData: base64, generatedFiles: [] };
    }
    return {
      content: "متأسفانه در ساخت تصویر مشکلی پیش آمد. لطفاً چند لحظه بعد دوباره تلاش کنید.",
      thinking: null, searchUsed: false, imageData: null, generatedFiles: [],
    };
  }

  // ─── تنظیمات سیستم ───
  let maxHistory = 24;
  let temperature = 0.8;
  try {
    const setting = await db.setting.findUnique({ where: { key: "ai_settings" } });
    if (setting) {
      const cfg = JSON.parse(setting.value);
      maxHistory = cfg.maxHistoryMessages || 24;
      temperature = cfg.temperature ?? 0.8;
    }
  } catch {}

  // ─── جستجوی وب (در صورت فعال بودن حالت) ───
  let searchUsed = false;
  let searchResults = "";
  if (mode === "search") {
    onStage?.("searching_web", "جستجو در منابع وب برای جدیدترین اطلاعات");
    searchResults = await webSearch(userMessage, 6);
    searchUsed = searchResults.length > 0;
  }

  // ─── موتور خواندن اسناد — آماده‌سازی پیوست برای این نوبت ───
  // تصویر: تزریق چندوجهی (مدل پیکسل‌ها را می‌بیند) + کش موازی
  // سند: استخراج کامل (PDF/Word/Excel/متن) + بلوک XML ساختاریافته
  if (attachment) {
    onStage?.(
      attachment.mime?.startsWith("image/") ? "analyzing_image" : "reading_doc",
      attachment.name
    );
  }
  const attachCtx = attachment
    ? await prepareAttachmentForTurn(attachment)
    : null;

  // ─── ساخت پرامپت سیستم مهندسی‌شده ───
  onStage?.("thinking", mode === "deep" ? "تحلیل عمیق و چندمرحله‌ای سؤال" : "تحلیل پیام و آماده‌سازی پاسخ");
  const systemPrompt = await buildSystemPrompt({
    userId,
    userMessage,
    mode,
    searchResults: searchUsed ? searchResults : undefined,
    hasAttachment: Boolean(attachment),
    attachmentKind: attachCtx?.method || null,
    fileToolsEnabled: capabilities.fileTools,
    codeInterpreterEnabled: capabilities.codeInterpreter,
    maxFilesPerReply: capabilities.maxFilesPerReply,
    maxSheetRows: capabilities.maxSheetRows,
  });

  // ─── تاریخچه گفتگو — با مرجع فشرده‌ی پیوست‌های قبلی ───
  // وقتی کاربر قبلاً فایل فرستاده و الان پیگیری می‌کند («بخش دومش
  // را توضیح بده»)، خلاصه‌ی محتوای کش‌شده کنار همان پیام تاریخی
  // تزریق می‌شود تا مدل زمینه را از دست ندهد.
  const history = await db.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: maxHistory,
    select: { role: true, content: true, attachmentUrl: true, attachmentName: true, attachmentMime: true },
  });
  history.reverse();

  // پیوست‌های قبلی → مرجع فشرده از کش استخراج (حداکثر ۳ سند اخیر)
  const prevAttachUrls = [
    ...new Set(
      history
        .filter((m) => m.role === "user" && m.attachmentUrl && m.attachmentUrl !== attachment?.url)
        .map((m) => m.attachmentUrl!)
    ),
  ].slice(-3);

  const prevExtractions = prevAttachUrls.length
    ? await db.documentExtraction.findMany({
        where: { mediaUrl: { in: prevAttachUrls } },
        select: { mediaUrl: true, name: true, mime: true, content: true },
      })
    : [];
  const refByurl = new Map(prevExtractions.map((e) => [e.mediaUrl, e]));

  const historyMessages: Array<{ role: "user" | "assistant"; content: string }> = history.map((m) => {
    let content = m.content.slice(0, 3000);
    if (m.role === "user" && m.attachmentUrl) {
      const ex = refByurl.get(m.attachmentUrl);
      if (ex) {
        content += `\n\n[📎 پیوست این پیام — ${compactReference(ex.name, ex.mime, ex.content)}]`;
      } else {
        content += `\n\n[📎 این پیام یک فایل پیوست داشت: «${m.attachmentName || "بدون نام"}»]`;
      }
    }
    return { role: m.role as "user" | "assistant", content };
  });

  // ─── فراخوانی مدل ───
  const isDeep = mode === "deep";
  const baseMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...historyMessages,
  ];

  if (searchUsed) {
    baseMessages.push({
      role: "system",
      content: `نتایج جستجوی وب برای «${userMessage}»:\n${searchResults}\n\nپاسخ را بر اساس این نتایج و با ذکر منابع بده.`,
    });
  }

  // بلوک سند (PDF/Word/Excel/...) — system مجاور پیام کاربر؛
  // محتوای پرنوسان نزدیک به پرسش، قواعد پایدار در پرامپت سیستم
  if (attachCtx?.documentBlock) {
    baseMessages.push({ role: "system", content: attachCtx.documentBlock });
  }

  let response: ThinkableResponse;

  // قصد ساخت فایل → سقف توکن بالاتر تا spec کامل بریده نشود
  const fileIntent = capabilities.fileTools && detectFileIntent(userMessage);
  const maxTokens = isDeep ? 6000 : fileIntent ? 12000 : 4000;

  if (attachCtx?.imageDataUrl) {
    // ─── نوبت تصویری: کل گفتگو به مدل بینایی (GLM-4.6V) —
    // مدل خودِ تصویر را می‌بیند (حداکثر دقت، بدون واسطه‌ی توصیف)
    onStage?.("analyzing_image", attachment?.name);
    const visionMessages: VisionMsg[] = [
      ...baseMessages.map((m) => ({ role: m.role, content: m.content })),
      {
        role: "user",
        content: [
          { type: "text", text: userMessage || "این تصویر را کامل تحلیل کن." },
          { type: "image_url", image_url: { url: attachCtx.imageDataUrl } },
        ] satisfies VisionContentItem[],
      },
    ];
    const visionRes = await visionCompletion(visionMessages, {
      thinking: isDeep,
      maxTokens: isDeep ? 6000 : fileIntent ? 12000 : 4000,
    });
    response = {
      choices: [{ message: { content: visionRes?.content || null, reasoning_content: null } }],
    };
    // کش توصیف تصویر (برای پیگیری‌های بعدی) — اطمینان از ذخیره
    await attachCtx.cachePromise;
  } else {
    // ─── نوبت متنی معمول (بدون تصویر) ───
    baseMessages.push({ role: "user", content: userMessage });
    onStage?.("writing");
    response = (await chatCompletion(baseMessages, {
      thinking: isDeep,
      temperature: isDeep ? Math.max(0.3, temperature - 0.4) : temperature,
      maxTokens,
    })) as ThinkableResponse;
  }

  const choice = response.choices?.[0]?.message;
  let content = choice?.content?.trim() || "ببخشید، الان نتونستم پاسخ خوبی آماده کنم. دوباره بپرسید.";
  const thinking = (choice?.reasoning_content || choice?.thinking || null)?.trim() || null;

  // ─── خط لوله ساخت فایل (Word/Excel/PDF/...) ───
  let generatedFiles: GeneratedFileInfo[] = [];
  if (capabilities.fileTools && hasFileSpecBlock(content)) {
    onStage?.("planning_file", "استخراج ساختار فایل از پاسخ");
    const out = await processFileGeneration(content, userMessage, sessionId, attachment || null, historyMessages, capabilities, onStage);
    content = out.content;
    generatedFiles = out.files;
  } else if (capabilities.fileTools && detectFileIntent(userMessage)) {
    // مدل بلوک ننوشت اما کاربر فایل خواسته — یک تلاش متمرکز
    onStage?.("planning_file", "طراحی ساختار فایل درخواستی");
    const out = await processFileGeneration(content, userMessage, sessionId, attachment || null, historyMessages, capabilities, onStage);
    content = out.content;
    generatedFiles = out.files;
  }

  onStage?.("finalizing");

  return {
    content,
    thinking: isDeep ? thinking : null,
    searchUsed,
    imageData: null,
    generatedFiles,
  };
}

/**
 * ذخیره پیام کاربر و پاسخ هوشیار + فعال‌سازی موتور حافظه
 */
export async function saveChatTurn(
  sessionId: string,
  userMessage: string,
  result: ChatResult,
  mode: string,
  userId: string,
  attachment?: ChatAttachment | null
) {
  const isFirstMessage = await db.chatMessage.count({ where: { sessionId } }) === 0;

  await db.chatMessage.create({
    data: {
      sessionId,
      role: "user",
      content: userMessage,
      attachmentUrl: attachment?.url || null,
      attachmentName: attachment?.name || null,
      attachmentMime: attachment?.mime || null,
    },
  });

  const assistantMsg = await db.chatMessage.create({
    data: {
      sessionId,
      role: "assistant",
      content: result.content,
      thinking: result.thinking,
      searchUsed: result.searchUsed,
      searchResults: null,
      imageData: result.imageData,
      imagePrompt: mode === "image" ? userMessage : null,
      ...(result.generatedFiles.length > 0
        ? { generatedFiles: JSON.parse(JSON.stringify(result.generatedFiles)) as object }
        : {}),
    },
  });

  // عنوان جلسه از اولین پیام
  const titleUpdate = isFirstMessage
    ? { title: userMessage.slice(0, 40) + (userMessage.length > 40 ? "…" : "") }
    : {};

  await db.chatSession.update({
    where: { id: sessionId },
    data: { ...titleUpdate, updatedAt: new Date(), mode, messageCount: { increment: 2 } },
  });

  // حافظه داینامیک — بدون بلاک‌کردن پاسخ با await در مسیر اصلی
  extractMemories(userId, sessionId).catch(() => {});

  return assistantMsg;
}
