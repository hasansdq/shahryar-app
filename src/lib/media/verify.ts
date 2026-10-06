// ═══════════════════════════════════════════════════════════════
// تایید رسانه در نقاط ذخیره دیتابیس — نسخه ۲ (فقط سرور)
// ═══════════════════════════════════════════════════════════════
// تنها دروازه ورود URL تصویر/فایل به دیتابیس. هر API که فیلد
// رسانه‌ای ذخیره می‌کند (چت، آواتار، صنف، دانش شهری) از همین‌جا
// استفاده می‌کند و همیشه «URL کانونی جدید» ذخیره می‌شود — حتی اگر
// کلاینت یا داده قدیمی URL نسل قبل (/uploads/...) فرستاده باشد.
//
// تفاوت با نسل قبل: تایید فقط یک stat سبک روی «یک» مسیر قطعی است؛
// نه جستجوی چند ریشه کاندیدا، نه فراخوانی HTTP.
// ═══════════════════════════════════════════════════════════════

import { parseMediaUrl, fileUrl } from "./url";
import { statMediaFile } from "./storage";

export interface MediaVerification {
  exists: boolean;
  /** URL کانونی جدید — فقط وقتی exists=true */
  url?: string;
  key?: string;
  size?: number;
  error?: string;
}

/**
 * تایید کامل یک ورودی رسانه‌ای: تفسیر URL (جدید یا قدیمی) →
 * بررسی وجود واقعی فایل در مخزن کانونی → بازگرداندن URL استاندارد.
 */
export async function verifyMedia(input: string | null | undefined): Promise<MediaVerification> {
  const parsed = parseMediaUrl(input);
  if (!parsed) return { exists: false, error: "آدرس فایل نامعتبر است" };

  const st = await statMediaFile(parsed.key);
  if (!st) return { exists: false, error: "فایل روی سرور یافت نشد", key: parsed.key };

  return { exists: true, url: fileUrl(parsed.key), key: parsed.key, size: st.size };
}

/**
 * URL تاییدشده یا null — برای فیلدهای ساده (imageUrl، avatarUrl، ...).
 * همیشه URL کانونی جدید برمی‌گرداند تا دیتابیس به‌مرور یکدست شود.
 */
export async function verifiedMediaUrl(
  input: string | null | undefined
): Promise<string | null> {
  const v = await verifyMedia(input);
  return v.exists ? v.url! : null;
}

/**
 * اعتبارسنجی گالری تصاویر (آرایه {url,name}) → JSON آماده ذخیره.
 * فقط آیتم‌هایی که فایلشان واقعاً موجود است باقی می‌مانند و
 * URLهایشان به شکل کانونی جدید بازنویسی می‌شود.
 */
export async function verifiedGalleryJson(
  gallery: unknown,
  maxItems = 12
): Promise<string | null> {
  if (!Array.isArray(gallery)) return null;

  const items: Array<{ url: string; name: string }> = [];
  for (const g of gallery.slice(0, maxItems)) {
    if (!g || typeof g !== "object") continue;
    const url = await verifiedMediaUrl((g as { url?: unknown }).url as string | undefined);
    if (!url) continue;
    const name = String((g as { name?: unknown }).name || "تصویر").slice(0, 120);
    items.push({ url, name });
  }

  return items.length ? JSON.stringify(items) : null;
}
