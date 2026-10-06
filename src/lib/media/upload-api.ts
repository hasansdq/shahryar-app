// ═══════════════════════════════════════════════════════════════
// API رسانه شهریار — POST /api/media (نسخه ۲)
// ═══════════════════════════════════════════════════════════════
// تنها endpoint آپلود کل سامانه. یک مسیر، بدون fallback، بدون
// کش endpoint، بدون self-heal — چون دیگر چیزی نیست که بشکند:
//
//   درخواست ← احراز هویت ← سقف نرخ ← اعتبارسنجی ← ذخیره در مخزن
//   کانونی + تایید اتمیک (خواندن دوباره از دیسک) ← پاسخ نهایی
//
// پاسخ 200 یعنی فایل «قطعاً» سالم روی دیسک است — این تضمین داخل
// همان درخواست اثبات می‌شود، نه با یک تایید جداگانه بعد از آن.
//
// این فایل در lib قرار دارد (نه در app/api) تا منطق، مستقل از
// فایل‌های نازک روت، قابل نگهداری و تست باشد.
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { ok, fail, getUser, getAdmin, userAgentFrom } from "@/lib/core/api";
import { rateLimit, getClientIp } from "@/lib/core/rate-limit";
import { logActivity } from "@/lib/core/logger";
import { validateMediaFile, effectiveMime, scopeLabel, MEDIA_SCOPES, type MediaScope } from "./config";
import { saveMediaFile, mediaRoot, countMediaFiles } from "./storage";

export async function POST(req: NextRequest) {
  try {
    // ── احراز هویت: کاربر اپ یا مدیر سیستم ──
    const auth = (await getUser(req)) || (await getAdmin(req));
    if (!auth) return fail("برای بارگذاری فایل وارد شوید", 401);
    const isUserAuth = "phone" in auth; // کاربر phone دارد، مدیر username

    // ── سقف نرخ: ۲۰ فایل در دقیقه برای هر حساب ──
    const rl = rateLimit(`media:${auth.id}`, 20, 60 * 1000);
    if (!rl.allowed) {
      return fail(`درخواست زیاد است. ${rl.retryAfterSec} ثانیه صبر کنید`, 429);
    }

    // ── پردازش فرم ──
    const formData = await req.formData();
    const file = formData.get("file");
    const scopeRaw = String(formData.get("scope") || "misc");

    if (!(file instanceof File)) return fail("فایلی ارسال نشده است");

    const scope = (
      (MEDIA_SCOPES as readonly string[]).includes(scopeRaw) ? scopeRaw : "misc"
    ) as MediaScope;

    // ── اعتبارسنجی حجم و نوع (جدول مشترک با کلاینت) ──
    const validation = validateMediaFile(file, scope);
    if (!validation.valid) {
      return fail(validation.error || "فایل نامعتبر است", 422);
    }

    // ── ذخیره در مخزن کانونی + تایید اتمیک ──
    const buffer = Buffer.from(await file.arrayBuffer());
    // نوع مؤثر: مرورگر برای برخی پسوندها octet-stream می‌فرستد → از پسوند استنتاج می‌کنیم
    const mime = effectiveMime(file) || "application/octet-stream";
    const saved = await saveMediaFile({
      scope,
      buffer,
      mime,
      originalName: file.name || "فایل",
    });

    // ── لاگ فعالیت ──
    await logActivity({
      userId: isUserAuth ? auth.id : undefined,
      adminId: isUserAuth ? undefined : auth.id,
      action: "media.upload",
      entity: "media",
      entityId: saved.key,
      details: {
        scope,
        size: saved.size,
        mime: saved.mime,
        key: saved.key,
        url: saved.url,
        label: scopeLabel(scope),
      },
      ip: getClientIp(req),
      userAgent: userAgentFrom(req),
    });

    return ok({
      url: saved.url,
      key: saved.key,
      fileName: saved.fileName,
      originalName: saved.originalName,
      size: saved.size,
      mime: saved.mime,
      scope,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "خطای ناشناخته";
    console.error("[media] خطای آپلود:", err);
    // پیام‌های فارسی موتور ذخیره‌سازی عیناً به کاربر می‌رسند
    if (err instanceof Error && err.message.includes("بازنویسی")) {
      return fail(msg, 409);
    }
    if (
      err instanceof Error &&
      (msg.includes("ناقص") || msg.includes("مغایرت") || msg.includes("ثبت نشد"))
    ) {
      return fail(msg, 500);
    }
    return fail("بارگذاری فایل ناموفق بود؛ لطفاً دوباره تلاش کنید", 500);
  }
}

/** بررسی سلامت سرویس رسانه — GET /api/media (نیازمند احراز هویت) */
export async function GET(req: NextRequest) {
  const auth = (await getUser(req)) || (await getAdmin(req));
  if (!auth) return fail("احراز هویت نشده‌اید", 401);

  const files = await countMediaFiles();
  return ok({
    service: "media",
    version: 2,
    status: "ready",
    scopes: MEDIA_SCOPES,
    root: mediaRoot(),
    files,
  });
}
