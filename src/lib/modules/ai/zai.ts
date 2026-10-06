// ═══════════════════════════════════════════════════════════════
// پوشش سرویس مدل — دسترسی امن به مدل‌های هوش مصنوعی
// سرویس‌دهنده‌ها:
//  • پیش‌فرض: ZAI SDK (GLM) — جستجوی وب، تولید تصویر، مدل بینایی
//  • اختصاصی: اندپوینت کاستوم ادمین (قالب OpenAI یا Anthropic)
//    برای گفتگوی متنی کل سیستم — قابل مدیریت از پنل CMS
// ═══════════════════════════════════════════════════════════════
import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";
import { addMeteredUsage, estimateTokens, extractProviderUsage, ESTIMATED_IMAGE_TOKENS } from "@/lib/modules/tokens/meter";

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

export async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

/** پیام چندوجهی — برای تصویر/سند (می‌تواند متن + رسانه باشد) */
export interface VisionContentItem {
  type: "text" | "image_url" | "file_url";
  text?: string;
  image_url?: { url: string };
  file_url?: { url: string };
}

export interface VisionMsg {
  role: "system" | "user" | "assistant";
  content: string | VisionContentItem[];
}

// ─── provider اختصاصی (تنظیم از پنل مدیریت) ───

interface CustomProviderConfig {
  enabled: boolean;
  name: string;
  baseUrl: string;
  format: "openai" | "anthropic";
  apiKey: string;
  model: string;
  maxTokens: number;
}

let providerCache: { at: number; cfg: CustomProviderConfig | null } = { at: 0, cfg: null };
const PROVIDER_CACHE_TTL = 10_000; // ۱۰ ثانیه — تغییرات پنل سریع اعمال می‌شود

/** خواندن کانفیگ provider اختصاصی با کش کوتاه (بدون لاگ کلید) */
async function getCustomProvider(): Promise<CustomProviderConfig | null> {
  if (Date.now() - providerCache.at < PROVIDER_CACHE_TTL) return providerCache.cfg;
  let cfg: CustomProviderConfig | null = null;
  try {
    const row = await db.setting.findUnique({ where: { key: "ai_custom_provider" } });
    if (row) {
      const p = JSON.parse(row.value);
      if (p && typeof p === "object" && p.enabled && p.baseUrl && p.apiKey && p.model) {
        // اعتبارسنجی پروتکل — فقط http/https
        const u = new URL(String(p.baseUrl));
        if (u.protocol === "http:" || u.protocol === "https:") {
          cfg = {
            enabled: true,
            name: String(p.name || "اختصاصی"),
            baseUrl: String(p.baseUrl).replace(/\/+$/, ""),
            format: p.format === "anthropic" ? "anthropic" : "openai",
            apiKey: String(p.apiKey),
            model: String(p.model),
            maxTokens: Number.isFinite(p.maxTokens) ? Number(p.maxTokens) : 4096,
          };
        }
      }
    }
  } catch {
    cfg = null;
  }
  providerCache = { at: Date.now(), cfg };
  return cfg;
}

/** باطل‌کردن کش provider (بعد از ذخیره تنظیمات جدید توسط ادمین) */
export function invalidateCustomProviderCache() {
  providerCache = { at: 0, cfg: null };
}

/** شکلی که بقیه سیستم انتظار دارد (سازگار با ZAI SDK) + usage برای مترینگ دقیق */
interface StandardChatResponse {
  choices?: Array<{
    message?: { content?: string | null; reasoning_content?: string | null; thinking?: string | null };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  model?: string;
}

const CUSTOM_TIMEOUT_MS = 110_000; // کمی کمتر از maxDuration روت چت (120s)

/** فراخوانی اندپوینت اختصاصی با قالب OpenAI */
async function customOpenAIRequest(
  cfg: CustomProviderConfig,
  messages: ChatMsg[],
  opts: { temperature?: number; maxTokens?: number }
): Promise<StandardChatResponse> {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: opts.temperature ?? 0.8,
      max_tokens: Math.min(opts.maxTokens ?? 4096, cfg.maxTokens),
    }),
    signal: AbortSignal.timeout(CUSTOM_TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`custom-api ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    model?: string;
  };
  return {
    choices: [
      { message: { content: json.choices?.[0]?.message?.content ?? null, reasoning_content: null } },
    ],
    ...(json.usage ? { usage: json.usage } : {}),
    ...(json.model ? { model: json.model } : {}),
  };
}

/** فراخوانی اندپوینت اختصاصی با قالب Anthropic Messages API */
async function customAnthropicRequest(
  cfg: CustomProviderConfig,
  messages: ChatMsg[],
  opts: { temperature?: number; maxTokens?: number }
): Promise<StandardChatResponse> {
  // پیام‌های system جدا می‌شوند (قالب Anthropic)
  const systemText = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const chatMsgs = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const res = await fetch(`${cfg.baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: Math.min(opts.maxTokens ?? 4096, cfg.maxTokens),
      temperature: opts.temperature ?? 0.8,
      ...(systemText ? { system: systemText } : {}),
      messages: chatMsgs,
    }),
    signal: AbortSignal.timeout(CUSTOM_TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`custom-api ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
    model?: string;
  };
  const text = (json.content || [])
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text)
    .join("");
  return {
    choices: [{ message: { content: text || null, reasoning_content: null } }],
    ...(json.usage
      ? { usage: { prompt_tokens: json.usage.input_tokens, completion_tokens: json.usage.output_tokens } }
      : {}),
    ...(json.model ? { model: json.model } : {}),
  };
}

/**
 * مترینگ یک پاسخ متنی — مصرف واقعی از usage سرویس؛ در نبود آن،
 * برآورد از طول پیام‌ها/پاسخ (علامت‌گذاری‌شده به‌عنوان برآوردی).
 * خارج از بافتار مترینگ → no-op.
 */
function meterChatResponse(res: unknown, messages: ChatMsg[]): void {
  const u = extractProviderUsage(res);
  if (!u) return;
  if (u.hasUsage) {
    addMeteredUsage({ inputTokens: u.inputTokens, outputTokens: u.outputTokens, model: u.model });
    return;
  }
  const inputChars = messages.reduce((s, m) => s + (m.content?.length ?? 0), 0);
  const msg = (res as { choices?: Array<{ message?: { content?: string | null; reasoning_content?: string | null } }> })
    ?.choices?.[0]?.message;
  const outputChars = (msg?.content?.length ?? 0) + (msg?.reasoning_content?.length ?? 0);
  addMeteredUsage({
    inputTokens: estimateTokens(String(inputChars)),
    outputTokens: estimateTokens(String(outputChars)),
    estimated: true,
    model: u.model,
  });
}

/**
 * گفتگو با مدل زبانی — با مسیریابی خودکار:
 * provider اختصاصی فعال → اندپوینت ادمین؛ در خطای شبکه/سرور به
 * سرویس پیش‌فرض ZAI برمی‌گردد تا چت کاربران هرگز قطع نشود.
 * مصرف هر مسیر دقیقاً متر می‌شود.
 */
export async function chatCompletion(
  messages: ChatMsg[],
  opts: { thinking?: boolean; temperature?: number; maxTokens?: number } = {}
) {
  const custom = await getCustomProvider();
  if (custom) {
    try {
      const res = custom.format === "anthropic"
        ? await customAnthropicRequest(custom, messages, opts)
        : await customOpenAIRequest(custom, messages, opts);
      meterChatResponse(res, messages);
      return res;
    } catch (err) {
      // تاب‌آوری: خطای اندپوینت اختصاصی هرگز نباید چت را قطع کند
      console.warn(
        `[ai] اندپوینت اختصاصی «${custom.name}» خطا داد — بازگشت به سرویس پیش‌فرض:`,
        err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200)
      );
    }
  }
  const zai = await getZAI();
  const res = await zai.chat.completions.create({
    messages,
    thinking: { type: opts.thinking ? "enabled" : "disabled" },
    temperature: opts.temperature ?? 0.8,
    max_tokens: opts.maxTokens ?? 4096,
  } as Parameters<typeof zai.chat.completions.create>[0]);
  meterChatResponse(res, messages);
  return res;
}

/**
 * گفتگو با مدل بینایی (GLM-4.6V) — همیشه روی سرویس پیش‌فرض ZAI
 * (اندپوینت‌های کاستوم پشتیبانی بینایی متفاوتی دارند؛ ثابت و امن می‌ماند)
 *
 * موارد استفاده در شهریار:
 *  - تصویر پیوست‌شده در چت: مدل خودِ تصویر را می‌بیند (image_url)
 *  - PDF اسکن‌شده/بدون لایه متنی: مدل خودِ سند را می‌خواند (file_url)
 *  - تشخیص محتوای تصویری برای کش حافظه گفتگو
 *
 * @param messages پیام‌ها با محتوای چندوجهی (متن + data URL رسانه)
 * @param opts.thinking فعال‌سازی زنجیره تفکر برای تحلیل پیچیده
 */
export async function visionCompletion(
  messages: VisionMsg[],
  opts: { thinking?: boolean; maxTokens?: number } = {}
): Promise<{ content: string } | null> {
  try {
    const zai = await getZAI();
    const response = await zai.chat.completions.createVision({
      model: "glm-4.6v",
      messages,
      thinking: { type: opts.thinking ? "enabled" : "disabled" },
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    } as Parameters<typeof zai.chat.completions.createVision>[0]);
    const content = response?.choices?.[0]?.message?.content;

    // ─── مترینگ: usage واقعی یا برآورد (متن + تصاویر ورودی) ───
    const u = extractProviderUsage(response);
    if (u) {
      if (u.hasUsage) {
        addMeteredUsage({ inputTokens: u.inputTokens, outputTokens: u.outputTokens, model: u.model ?? "glm-4.6v" });
      } else {
        let inputChars = 0;
        let images = 0;
        for (const m of messages) {
          if (typeof m.content === "string") {
            inputChars += m.content.length;
          } else if (Array.isArray(m.content)) {
            for (const part of m.content) {
              if (part.type === "text" && part.text) inputChars += part.text.length;
              if (part.type === "image_url" || part.type === "file_url") images += 1;
            }
          }
        }
        addMeteredUsage({
          inputTokens: estimateTokens(String(inputChars)) + images * ESTIMATED_IMAGE_TOKENS,
          outputTokens: estimateTokens(String(content ?? "")),
          estimated: true,
          model: "glm-4.6v",
        });
      }
    }

    return content ? { content: String(content).trim() } : null;
  } catch (err) {
    console.error("خطای مدل بینایی:", err);
    return null;
  }
}

/**
 * جستجوی وب — نتایج ساختاریافته (سرویس پیش‌فرض)
 */
export async function webSearch(query: string, num: number = 5): Promise<string> {
  try {
    const zai = await getZAI();
    const results = await zai.functions.invoke("web_search", {
      query,
      num,
      recency_days: 60,
    });
    const list = Array.isArray(results)
      ? results
      : ((results as { result?: unknown[] })?.result ?? []);
    const formatted = (list as Array<Record<string, unknown>>)
      .map((r, i) => {
        const name = String(r.name || r.title || "بدون عنوان");
        const snippet = String(r.snippet || r.content || r.abstract || "");
        const url = String(r.url || r.link || "");
        return `${i + 1}. ${name}\n${snippet}\nمنبع: ${url}`;
      })
      .join("\n\n");
    return formatted || JSON.stringify(results).slice(0, 3000);
  } catch (err) {
    console.error("خطای جستجوی وب:", err);
    return "";
  }
}

/**
 * تولید تصویر — خروجی base64 (سرویس پیش‌فرض)
 */
export async function generateImage(
  prompt: string,
  size:
    | "1024x1024"
    | "768x1344"
    | "864x1152"
    | "1344x768"
    | "1152x864"
    | "1440x720"
    | "720x1440" = "1024x1024"
): Promise<string | null> {
  try {
    const zai = await getZAI();
    const response = await zai.images.generations.create({ prompt, size });
    return response.data?.[0]?.base64 ?? null;
  } catch (err) {
    console.error("خطای تولید تصویر:", err);
    return null;
  }
}

/**
 * تست اتصال اندپوینت اختصاصی — فقط برای پنل مدیریت.
 * کانفیگ از بدنه درخواست می‌آید (نه ذخیره‌شده) تا ادمین قبل از
 * ذخیره بتواند تست کند. کلید هرگز لاگ نمی‌شود.
 */
export async function testCustomProvider(cfg: {
  baseUrl: string; format: "openai" | "anthropic"; apiKey: string; model: string;
}): Promise<{ ok: boolean; latencyMs: number; reply: string; error?: string }> {
  const start = Date.now();
  try {
    const messages: ChatMsg[] = [
      { role: "user", content: "سلام — این یک پیام تست اتصال است. فقط بنویس: اتصال برقرار است" },
    ];
    const res = cfg.format === "anthropic"
      ? await customAnthropicRequest(
          { enabled: true, name: "test", baseUrl: cfg.baseUrl.replace(/\/+$/, ""), format: "anthropic", apiKey: cfg.apiKey, model: cfg.model, maxTokens: 4096 },
          messages,
          { temperature: 0, maxTokens: 32 }
        )
      : await customOpenAIRequest(
          { enabled: true, name: "test", baseUrl: cfg.baseUrl.replace(/\/+$/, ""), format: "openai", apiKey: cfg.apiKey, model: cfg.model, maxTokens: 4096 },
          messages,
          { temperature: 0, maxTokens: 32 }
        );
    const reply = res.choices?.[0]?.message?.content || "";
    if (!reply.trim()) {
      return { ok: false, latencyMs: Date.now() - start, reply: "", error: "پاسخ خالی از اندپوینت دریافت شد" };
    }
    return { ok: true, latencyMs: Date.now() - start, reply: reply.slice(0, 200) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, latencyMs: Date.now() - start, reply: "", error: msg.slice(0, 300) };
  }
}
