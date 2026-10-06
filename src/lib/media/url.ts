// ═══════════════════════════════════════════════════════════════
// مدیریت URL رسانه شهریار — نسخه ۲ (ایزومورفیک)
// ═══════════════════════════════════════════════════════════════
// تنها مرجع تبدیل «کلید فایل ↔ URL عمومی» در کل سامانه.
// هر URL رسانه‌ای در سامانه از همین‌جا می‌گذرد — هیچ جای دیگری
// حق ساختن یا تفسیر URL فایل را ندارد.
//
// فضای‌نام URL جدید:      /files/{scope}/{سال‌جلالی}-{ماه}/{شناسه}.{پسوند}
// فضای‌نام قدیمی (فقط خواندنی، برای مهاجرت بی‌دردسر):
//                        /uploads/{پوشه‌قدیمی}/{سال}-{ماه}/{نام‌فایل}
// ═══════════════════════════════════════════════════════════════

import {
  MEDIA_KEY_PATTERN,
  LEGACY_KEY_PATTERN,
  LEGACY_DIR_TO_SCOPE,
  type MediaScope,
} from "./config";

/** پیشوند URL جدید — تنها فضای‌نام رسمی رسانه سامانه */
export const MEDIA_URL_PREFIX = "/files";

/** پیشوند URL نسل قبل — فقط برای شناسایی و بازگردانی، هرگز برای ذخیره */
export const LEGACY_URL_PREFIX = "/uploads";

export interface ParsedMediaUrl {
  /** کلید استاندارد جدید ( scope/سال-ماه/فایل ) */
  key: string;
  scope: MediaScope;
  /** آیا از فضای‌نام قدیمی آمده بود؟ */
  legacy: boolean;
}

/** ساخت URL عمومی از کلید — تنها راه مجاز ساخت URL */
export function fileUrl(key: string): string {
  return `${MEDIA_URL_PREFIX}/${key}`;
}

/**
 * تفسیر هر ورودی رسانه‌ای به کلید استاندارد.
 * ورودی‌های پذیرفته‌شده:
 *   /files/chat/1405-06/x.png          (جدید — مسیر نسبی)
 *   /uploads/avatars/1405-06/x.png     (قدیمی — نگاشت خودکار به avatar)
 *   https://هردامنه‌ای/files/chat/...  (URL مطلق — فقط مسیرش برداشته می‌شود)
 *   https://هردامنه‌ای/uploads/...     (قدیمیِ مطلق)
 * خروجی: کلید استاندارد یا null اگر ساختار نامعتبر بود.
 */
export function parseMediaUrl(input: string | null | undefined): ParsedMediaUrl | null {
  if (!input || typeof input !== "string") return null;

  // اگر URL مطلق بود → فقط pathname آن را نگه دار (امن: بدون دامنه‌چک،
  // چون کلید بعداً روی دیسک اعتبارسنجی وجود می‌شود)
  let path = input.trim();
  if (/^https?:\/\//i.test(path) || path.startsWith("//")) {
    try {
      path = new URL(path).pathname;
    } catch {
      return null;
    }
  }

  // نرمال‌سازی سبک: حذف کوئری/هاش و اسلش‌های تکراری
  path = path.split(/[?#]/)[0];

  // ── فضای‌نام جدید ──
  if (path.startsWith(MEDIA_URL_PREFIX + "/")) {
    const key = path.slice(MEDIA_URL_PREFIX.length + 1);
    if (!MEDIA_KEY_PATTERN.test(key)) return null;
    const scope = key.split("/")[0] as MediaScope;
    return { key, scope, legacy: false };
  }

  // ── فضای‌نام قدیمی (نگاشت به ساختار جدید) ──
  if (path.startsWith(LEGACY_URL_PREFIX + "/")) {
    const legacyKey = path.slice(LEGACY_URL_PREFIX.length + 1);
    if (!LEGACY_KEY_PATTERN.test(legacyKey)) return null;
    const parts = legacyKey.split("/");
    const mappedScope = LEGACY_DIR_TO_SCOPE[parts[0]];
    if (!mappedScope) return null;
    // پوشه‌ی ماه قدیمی ممکن است یک‌رقمی باشد (مثلاً 6-1405) → استانداردسازی
    const [y, m] = parts[1].split("-");
    const monthFolder = `${y.padStart(4, "0")}-${m.padStart(2, "0")}`;
    const key = `${mappedScope}/${monthFolder}/${parts[2]}`;
    if (!MEDIA_KEY_PATTERN.test(key)) return null;
    return { key, scope: mappedScope, legacy: true };
  }

  return null;
}

/** آیا این یک URL رسانه‌ای سامانه است (جدید یا قدیمی)؟ */
export function isMediaUrl(input: string | null | undefined): boolean {
  return parseMediaUrl(input) !== null;
}

/**
 * ساخت URL عمومی امن برای رندر در UI:
 * ورودی‌های نامعتبر (خارج از سامانه) عمداً رد می‌شوند → null
 */
export function safeMediaUrl(input: string | null | undefined): string | null {
  const parsed = parseMediaUrl(input);
  return parsed ? fileUrl(parsed.key) : null;
}
