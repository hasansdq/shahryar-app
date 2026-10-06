// ═══════════════════════════════════════════════════════════════
// سلامت سرویس‌های هوش مصنوعی — GET/POST /api/admin/ai-status
// ═══════════════════════════════════════════════════════════════
// چرا این روت وجود دارد:
//  • «بالا آمدن سایت» فقط یعنی Next.js و دیتابیس زنده‌اند — نه اینکه
//    قابلیت‌های AI (چت/جستجوی وب/تولید تصویر/بینایی) کار کنند.
//  • چت متنی می‌تواند از اندپوینت اختصاصی ادمین بیاید، اما جستجوی
//    وب، تولید تصویر و بینایی همیشه به سرویس پیش‌فرض (ZAI) وابسته‌اند.
//
// GET  → وضعیت پیکربندی (بدون فراخوانی شبکه): مسیریابی هر قابلیت،
//        وجود فایل کانفیگ ZAI، ویژگی‌های روشن/خاموش CMS
// POST → آزمون زنده‌ی هر سرویس با کوچک‌ترین فراخوانی ممکن
//        (بدنه اختیاری: { image: true } برای تست تولید تصویر که
//        هزینه‌بر است و به‌طور پیش‌فرض اجرا نمی‌شود)
//
// نکات:
//  • فقط ادمین؛ همراه rate-limit (آزمون‌ها فراخوانی واقعی مدل‌اند).
//  • خارج از بافتار مترینگ اقتصاد توکن → هیچ کسر/ثبتی برای کاربران
//    انجام نمی‌شود (مترینگ لایه zai.ts فقط داخل بافتار روت‌های کاربر
//    فعال است؛ اینجا مستقیم SDK صدا زده می‌شود).
// ═══════════════════════════════════════════════════════════════
import fs from "fs";
import path from "path";
import os from "os";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getAdmin } from "@/lib/core/api";
import { rateLimit } from "@/lib/core/rate-limit";
import { logActivity } from "@/lib/core/logger";
import { getZAI } from "@/lib/modules/ai/zai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const PROBE_TIMEOUT_MS = 45_000;

/** نتیجه یک آزمون زنده */
interface ProbeResult {
  ok: boolean;
  latencyMs: number;
  sample?: string;
  error?: string;
}

/** اجرای یک آزمون با سقف زمانی و گرفتن خطای واقعی (نه پنهان‌شده) */
async function probe(label: string, fn: () => Promise<string>): Promise<ProbeResult> {
  const start = Date.now();
  try {
    const sample = await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("مهلت پاسخ گذشت (timeout)")), PROBE_TIMEOUT_MS)
      ),
    ]);
    return { ok: true, latencyMs: Date.now() - start, sample: sample.slice(0, 120) };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    console.error(`[ai-status] آزمون «${label}» ناموفق:`, raw.slice(0, 300));
    return { ok: false, latencyMs: Date.now() - start, error: raw.slice(0, 300) };
  }
}

/** آیا فایل کانفیگ سرویس پیش‌فرض (ZAI) در یکی از مسیرهای استاندارد SDK هست؟ */
function findZaiConfig(): { present: boolean; path: string | null } {
  const candidates = [
    path.join(process.cwd(), ".z-ai-config"),
    path.join(os.homedir(), ".z-ai-config"),
    "/etc/.z-ai-config",
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return { present: true, path: p };
    } catch { /* دسترسی نداریم → بعدی */ }
  }
  return { present: false, path: null };
}

/** خواندن تنظیمات AI ذخیره‌شده (ویژگی‌های روشن/خاموش) */
async function readAiFeatureFlags() {
  const row = await db.setting.findUnique({ where: { key: "ai_settings" } });
  if (!row) {
    return { webSearchEnabled: true, imageGenEnabled: true, memoryEnabled: true, dailyMessageLimit: 150 };
  }
  try {
    const p = JSON.parse(row.value);
    return {
      webSearchEnabled: p.webSearchEnabled !== false,
      imageGenEnabled: p.imageGenEnabled !== false,
      memoryEnabled: p.memoryEnabled !== false,
      dailyMessageLimit: Number.isFinite(p.dailyMessageLimit) ? Number(p.dailyMessageLimit) : 150,
    };
  } catch {
    return { webSearchEnabled: true, imageGenEnabled: true, memoryEnabled: true, dailyMessageLimit: 150 };
  }
}

/** کانفیگ کامل provider اختصاصی (برای تعیین مسیریابی و آزمون) */
async function readCustomProvider() {
  const row = await db.setting.findUnique({ where: { key: "ai_custom_provider" } });
  if (!row) return null;
  try {
    const p = JSON.parse(row.value);
    if (!p || typeof p !== "object") return null;
    const enabled = Boolean(p.enabled) && !!p.baseUrl && !!p.apiKey && !!p.model;
    return {
      enabled,
      name: String(p.name || "اختصاصی"),
      baseUrl: String(p.baseUrl || ""),
      format: p.format === "anthropic" ? ("anthropic" as const) : ("openai" as const),
      apiKey: String(p.apiKey || ""),
      model: String(p.model || ""),
    };
  } catch {
    return null;
  }
}

// ─── GET: وضعیت پیکربندی (بدون فراخوانی شبکه) ───
export async function GET(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);

    const [custom, flags] = await Promise.all([
      readCustomProvider(),
      readAiFeatureFlags(),
    ]);
    const zaiCfg = findZaiConfig();

    // مسیریابی هر قابلیت بر اساس پیکربندی فعلی
    const routing = {
      chat: custom?.enabled ? `اختصاصی (${custom.name || custom.model})` : "پیش‌فرض ZAI",
      webSearch: "پیش‌فرض ZAI",
      vision: "پیش‌فرض ZAI (glm-4.6v)",
      imageGen: "پیش‌فرض ZAI",
    };

    return ok({
      routing,
      customProvider: custom
        ? { enabled: custom.enabled, name: custom.name, model: custom.model, format: custom.format }
        : null,
      zaiConfigFile: zaiCfg,
      features: flags,
      // قابلیت‌هایی که «الان قابل استفاده» نیستند (پیکربندی/تنظیمات)
      blockers: [
        ...(!zaiCfg.present
          ? [
              "فایل کانفیگ سرویس پیش‌فرض (ZAI) یافت نشد — بدون آن: چت (در نبود اندپوینت اختصاصی)، جستجوی وب، تولید تصویر و بینایی کار نمی‌کنند. روی VPS فایل secrets/z-ai-config را مونت کنید (DOCKER-DEPLOY.md §۴-۲)",
            ]
          : []),
      ],
    });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}

// ─── POST: آزمون زنده‌ی سرویس‌ها ───
export async function POST(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);

    // آزمون‌ها فراخوانی واقعی مدل‌اند — محدود برای جلوگیری از هزینه/سوءاستفاده
    const rl = rateLimit(`ai-status:${admin.id}`, 3, 60_000);
    if (!rl.allowed) {
      return fail(`تست‌ها بیش از حد مکرر است — ${rl.retryAfterSec} ثانیه دیگر تلاش کنید`, 429);
    }

    const body = await parseJson<{ image?: boolean }>(req);
    const includeImage = !!body?.image;

    const custom = await readCustomProvider();
    const zaiCfg = findZaiConfig();

    const results: Record<string, ProbeResult> = {};

    // ۱) مسیر فعال چت متنی — همان مسیری که کاربران واقعاً استفاده می‌کنند:
    //    اندپوینت اختصاصی فعال → تست همان؛ وگرنه تست سرویس پیش‌فرض
    if (custom?.enabled) {
      results.chatActive = await probe("چت (اندپوینت اختصاصی)", async () => {
        const isAnthropic = custom.format === "anthropic";
        const res = await fetch(
          `${custom.baseUrl.replace(/\/+$/, "")}${isAnthropic ? "/v1/messages" : "/chat/completions"}`,
          {
            method: "POST",
            headers: isAnthropic
              ? { "Content-Type": "application/json", "x-api-key": custom.apiKey, "anthropic-version": "2023-06-01" }
              : { "Content-Type": "application/json", Authorization: `Bearer ${custom.apiKey}` },
            body: JSON.stringify(
              isAnthropic
                ? { model: custom.model, max_tokens: 16, messages: [{ role: "user", content: "سلام — فقط بنویس: اتصال برقرار است" }] }
                : { model: custom.model, max_tokens: 16, messages: [{ role: "user", content: "سلام — فقط بنویس: اتصال برقرار است" }] }
            ),
            signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
          }
        );
        if (!res.ok) throw new Error(`پاسخ اندپوینت: HTTP ${res.status}`);
        return "اندپوینت اختصاصی پاسخ داد";
      });
    }

    if (zaiCfg.present) {
      // ۲) سرویس پیش‌فرض (ZAI) — چت متنی پایه
      results.zaiChat = await probe("چت (سرویس پیش‌فرض ZAI)", async () => {
        const zai = await getZAI();
        const res = await zai.chat.completions.create({
          messages: [{ role: "user", content: "سلام — فقط بنویس: اتصال برقرار است" }],
          thinking: { type: "disabled" },
          max_tokens: 16,
        } as Parameters<typeof zai.chat.completions.create>[0]);
        const text = res?.choices?.[0]?.message?.content;
        if (!text) throw new Error("پاسخ خالی از سرویس دریافت شد");
        return String(text);
      });

      // ۳) جستجوی وب — همیشه ZAI
      results.webSearch = await probe("جستجوی وب", async () => {
        const zai = await getZAI();
        const out = await zai.functions.invoke("web_search", { query: "رفسنجان", num: 1, recency_days: 365 });
        const list = Array.isArray(out) ? out : ((out as { result?: unknown[] })?.result ?? []);
        if (!list || list.length === 0) throw new Error("نتیجه‌ای از جستجو برنگشت");
        return `${list.length} نتیجه`;
      });

      // ۴) بینایی (glm-4.6v) — تصویر ۱×۱ پیکسل؛ کوچک‌ترین آزمون ممکن
      results.vision = await probe("بینایی (glm-4.6v)", async () => {
        const zai = await getZAI();
        // PNG یک‌پیکسلی قرمز
        const pixel =
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
        const res = await zai.chat.completions.createVision({
          model: "glm-4.6v",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "رنگ این تصویر چیست؟ فقط یک کلمه جواب بده" },
                { type: "image_url", image_url: { url: pixel } },
              ],
            },
          ],
          thinking: { type: "disabled" },
          max_tokens: 16,
        } as Parameters<typeof zai.chat.completions.createVision>[0]);
        const text = res?.choices?.[0]?.message?.content;
        if (!text) throw new Error("پاسخ خالی از مدل بینایی دریافت شد");
        return String(text);
      });

      // ۵) تولید تصویر — هزینه‌بر؛ فقط با درخواست صریح
      if (includeImage) {
        results.imageGen = await probe("تولید تصویر", async () => {
          const zai = await getZAI();
          const res = await zai.images.generations.create({
            prompt: "یک دایره قرمز ساده روی زمینه سفید",
            size: "1024x1024",
          });
          const b64 = res?.data?.[0]?.base64;
          if (!b64) throw new Error("تصویری از سرویس برنگشت");
          return `تصویر ${Math.round((b64.length * 3) / 4 / 1024)}KB تولید شد`;
        });
      }
    } else {
      const msg = "فایل کانفیگ سرویس پیش‌فرض (.z-ai-config) موجود نیست";
      results.zaiChat = { ok: false, latencyMs: 0, error: msg };
      results.webSearch = { ok: false, latencyMs: 0, error: msg };
      results.vision = { ok: false, latencyMs: 0, error: msg };
      if (includeImage) results.imageGen = { ok: false, latencyMs: 0, error: msg };
    }

    const allOk = Object.values(results).every((r) => r.ok);

    await logActivity({
      adminId: admin.id,
      actorType: "admin",
      action: "admin.ai_status_test",
      entity: "setting",
      level: allOk ? "info" : "warning",
      details: {
        ok: allOk,
        services: Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.ok])),
      },
    });

    return ok({
      ok: allOk,
      testedAt: new Date().toISOString(),
      includeImage,
      zaiConfigFile: zaiCfg,
      results,
    });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
