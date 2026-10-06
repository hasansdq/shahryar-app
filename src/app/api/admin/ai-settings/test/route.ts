// ═════ تست اتصال اندپوینت اختصاصی — POST /api/admin/ai-settings/test ═════
// کانفیگ از بدنه درخواست می‌آید (تست قبل از ذخیره)؛ کلید هرگز لاگ نمی‌شود
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getAdmin, assertWritableAdmin } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { testCustomProvider } from "@/lib/modules/ai/zai";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);
    const writeGate = assertWritableAdmin(admin);
    if (writeGate) return writeGate;

    const body = await parseJson<{
      baseUrl?: string; format?: string; apiKey?: string; model?: string;
    }>(req);
    if (!body) return fail("درخواست نامعتبر است");

    const baseUrl = String(body.baseUrl || "").trim();
    const format = body.format === "anthropic" ? "anthropic" : "openai";
    const model = String(body.model || "").trim();
    // کلید ماسک‌شده از کلاینت → باید کلید واقعی از دیتابیس خوانده شود
    let apiKey = String(body.apiKey || "").trim();
    if (!apiKey || apiKey.startsWith("••••")) {
      const row = await db.setting.findUnique({ where: { key: "ai_custom_provider" } });
      try {
        apiKey = row ? String(JSON.parse(row.value).apiKey || "") : "";
      } catch {
        apiKey = "";
      }
    }

    if (!baseUrl || !model || !apiKey) {
      return fail("برای تست اتصال: Base URL، نام مدل و کلید API لازم است");
    }

    // اعتبارسنجی پروتکل — فقط http/https
    try {
      const u = new URL(baseUrl);
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("bad-proto");
    } catch {
      return fail("Base URL معتبر نیست (باید با http:// یا https:// شروع شود)");
    }

    const result = await testCustomProvider({ baseUrl, format, apiKey, model });

    await logActivity({
      adminId: admin.id, actorType: "admin",
      action: "admin.ai_custom_provider_test", entity: "setting",
      level: "info",
      details: { ok: result.ok, latencyMs: result.latencyMs, format },
    });

    return ok(result);
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
