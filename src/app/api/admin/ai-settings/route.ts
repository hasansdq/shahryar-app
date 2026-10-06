// ═════ تنظیمات هوش مصنوعی (ادمین) — GET/PUT /api/admin/ai-settings ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getAdmin, assertWritableAdmin } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { invalidateCustomProviderCache } from "@/lib/modules/ai/zai";

// ─── مقادیر پیش‌فرض (نمایش در اولین اجرا قبل از هر ذخیره) ───
const DEFAULT_SYSTEM_PROMPT = {
  persona: "هوشیار",
  tone: "صمیمی، گرم و همراهانه مثل یک رفیق باهوش",
  rules: [
    "همیشه فارسی روان و محاوره‌ای اما محترمانه پاسخ بده",
    "شهر کاربر رفسنجان است؛ راهنمایی‌ها را با شرایط محلی این شهر تطبیق بده",
    "برای مسائل عملی، راهکارهای گام‌به‌گام و اجرایی ارائه بده",
    "هرگز اطلاعات غلط نساز؛ اگر چیزی را نمی‌دانی صادقانه بگو",
  ],
};

export const DEFAULT_AI_SETTINGS = {
  defaultMode: "chat",
  thinkingEnabled: true,
  webSearchEnabled: true,
  imageGenEnabled: true,
  memoryEnabled: true,
  memoryExtractionInterval: 6,
  maxHistoryMessages: 24,
  temperature: 0.8,
  dailyMessageLimit: 150,
};

/** شکل امنِ provider اختصاصی برای ارسال به کلاینت — کلید هرگز کامل برنمی‌گردد */
export interface CustomProviderPublic {
  enabled: boolean;
  name: string;
  baseUrl: string;
  format: "openai" | "anthropic";
  model: string;
  maxTokens: number;
  hasApiKey: boolean;
  apiKeyPreview: string;
}

export const DEFAULT_CUSTOM_PROVIDER: CustomProviderPublic = {
  enabled: false,
  name: "",
  baseUrl: "",
  format: "openai",
  model: "",
  maxTokens: 4096,
  hasApiKey: false,
  apiKeyPreview: "",
};

/** خواندن provider اختصاصی از دیتابیس (شکل کامل داخلی) */
export async function readCustomProviderRaw(): Promise<{
  enabled: boolean; name: string; baseUrl: string;
  format: "openai" | "anthropic"; apiKey: string; model: string; maxTokens: number;
} | null> {
  const row = await db.setting.findUnique({ where: { key: "ai_custom_provider" } });
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.value);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      enabled: Boolean(parsed.enabled),
      name: String(parsed.name || "").slice(0, 60),
      baseUrl: String(parsed.baseUrl || "").slice(0, 300),
      format: parsed.format === "anthropic" ? "anthropic" : "openai",
      apiKey: String(parsed.apiKey || ""),
      model: String(parsed.model || "").slice(0, 120),
      maxTokens: Number.isFinite(parsed.maxTokens) ? Number(parsed.maxTokens) : 4096,
    };
  } catch {
    return null;
  }
}

/** نسخه عمومی (کلید ماسک) برای GET */
async function readCustomProviderPublic(): Promise<CustomProviderPublic> {
  const raw = await readCustomProviderRaw();
  if (!raw) return { ...DEFAULT_CUSTOM_PROVIDER };
  return {
    enabled: raw.enabled,
    name: raw.name,
    baseUrl: raw.baseUrl,
    format: raw.format,
    model: raw.model,
    maxTokens: raw.maxTokens,
    hasApiKey: raw.apiKey.length > 0,
    apiKeyPreview: raw.apiKey ? `••••${raw.apiKey.slice(-4)}` : "",
  };
}

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);


    const [promptSetting, aiSetting] = await Promise.all([
      db.setting.findUnique({ where: { key: "ai_system_prompt" } }),
      db.setting.findUnique({ where: { key: "ai_settings" } }),
    ]);
    const customProvider = await readCustomProviderPublic();

    // آمار AI
    const [totalSessions, totalMessages, totalMemories, todayMessages] = await Promise.all([
      db.chatSession.count(),
      db.chatMessage.count(),
      db.aIMemory.count(),
      db.chatMessage.count({
        where: { role: "user", createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
    ]);

    // توزیع حالت‌های چت
    const modeStats = await db.chatSession.groupBy({
      by: ["mode"],
      _count: true,
      orderBy: { _count: { mode: "desc" } },
    });

    // ⚠️ مقدار null هرگز به کلاینت برنمی‌گردد — همیشه پیش‌فرض مرج
    // (باگ قبلی: نبود ردیف در دیتابیس → اسکلتون ابدی در پنل)
    let systemPrompt = { ...DEFAULT_SYSTEM_PROMPT };
    if (promptSetting) {
      try {
        const parsed = JSON.parse(promptSetting.value);
        systemPrompt = {
          persona: String(parsed.persona || DEFAULT_SYSTEM_PROMPT.persona),
          tone: String(parsed.tone ?? ""),
          rules: Array.isArray(parsed.rules) ? parsed.rules.map(String) : [],
        };
      } catch { /* نگه‌داشتن پیش‌فرض */ }
    }

    let aiSettings = { ...DEFAULT_AI_SETTINGS };
    if (aiSetting) {
      try {
        const parsed = JSON.parse(aiSetting.value);
        aiSettings = { ...DEFAULT_AI_SETTINGS, ...parsed };
      } catch { /* نگه‌داشتن پیش‌فرض */ }
    }

    return ok({
      systemPrompt,
      aiSettings,
      customProvider,
      stats: { totalSessions, totalMessages, totalMemories, todayMessages, modeStats },
    });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);
    const writeGate = assertWritableAdmin(admin);
    if (writeGate) return writeGate;

    const body = await parseJson<{
      systemPrompt?: { persona?: string; tone?: string; rules?: string[] };
      aiSettings?: Record<string, unknown>;
      customProvider?: Record<string, unknown>;
    }>(req);
    if (!body) return fail("درخواست نامعتبر است");

    if (body.systemPrompt) {
      const current = await db.setting.findUnique({ where: { key: "ai_system_prompt" } });
      const merged = {
        ...(current ? JSON.parse(current.value) : {}),
        ...body.systemPrompt,
      };
      await db.setting.upsert({
        where: { key: "ai_system_prompt" },
        update: { value: JSON.stringify(merged) },
        create: { key: "ai_system_prompt", group: "ai", value: JSON.stringify(merged) },
      });
    }

    if (body.aiSettings) {
      const current = await db.setting.findUnique({ where: { key: "ai_settings" } });
      const merged = {
        ...(current ? JSON.parse(current.value) : {}),
        ...body.aiSettings,
      };
      await db.setting.upsert({
        where: { key: "ai_settings" },
        update: { value: JSON.stringify(merged) },
        create: { key: "ai_settings", group: "ai", value: JSON.stringify(merged) },
      });
    }

    // ─── provider اختصاصی — اعتبارسنجی امن + نگه‌داشتن کلید قبلی در صورت خالی بودن ───
    if (body.customProvider) {
      const input = body.customProvider;
      const current = await readCustomProviderRaw();

      const format = input.format === "anthropic" ? "anthropic" : "openai";
      let baseUrl = String(input.baseUrl || "").trim();
      // اعتبارسنجی امنیتی URL — فقط http/https
      let baseUrlOk = false;
      try {
        const u = new URL(baseUrl);
        baseUrlOk = u.protocol === "http:" || u.protocol === "https:";
        baseUrl = u.toString();
      } catch { /* نامعتبر */ }

      const enabled = Boolean(input.enabled);
      const model = String(input.model || "").trim().slice(0, 120);
      const name = String(input.name || "").trim().slice(0, 60);
      const apiKeyRaw = typeof input.apiKey === "string" ? input.apiKey.trim() : "";
      // کلید خالی → حفظ کلید ذخیره‌شده قبلی (ماسک شده از کلاینت می‌آید)
      const apiKey = apiKeyRaw && !apiKeyRaw.startsWith("••••") ? apiKeyRaw : (current?.apiKey || "");

      if (enabled && (!baseUrlOk || !model || !apiKey)) {
        return fail("برای فعال‌سازی API اختصاصی: Base URL معتبر (http/https)، نام مدل و کلید API الزامی است");
      }

      const maxTokensRaw = Number(input.maxTokens);
      const maxTokens = Number.isFinite(maxTokensRaw)
        ? Math.min(32000, Math.max(256, Math.round(maxTokensRaw)))
        : 4096;

      await db.setting.upsert({
        where: { key: "ai_custom_provider" },
        update: {
          value: JSON.stringify({ enabled, name, baseUrl, format, apiKey, model, maxTokens }),
        },
        create: {
          key: "ai_custom_provider", group: "ai",
          value: JSON.stringify({ enabled, name, baseUrl, format, apiKey, model, maxTokens }),
        },
      });
      // کش مسیریابی مدل فوراً باطل شود تا تنظیم جدید اعمال گردد
      invalidateCustomProviderCache();
    }

    await logActivity({
      adminId: admin.id, actorType: "admin",
      action: "admin.ai_settings_update", entity: "setting",
      level: "warning",
      details: {
        prompt: !!body.systemPrompt, settings: !!body.aiSettings,
        customProvider: !!body.customProvider,
      },
    });

    return ok({ message: "تنظیمات هوش مصنوعی ذخیره شد" });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
