// ═════ قالب پیامک دستی OTP — ماژول خالص (سرور + کلاینت) ═════
// بدون هیچ وابستگی به Prisma — قابل import در کامپوننت‌های کلاینت
// ═══════════════════════════════════════════════════════════════

/**
 * متن پیش‌فرض پیامک دستی — اگر مدیر قالبی تعیین نکرده باشد
 * ساختار: خط اول کد تایید + یک خط فاصله + امضای رایان تکنولوژی + لغو11
 */
export const DEFAULT_OTP_TEMPLATE =
  "کد تایید شما در شهریار {code} می باشد!\n\nرایان تکنولوژی\nلغو11";

/** جای‌نگهدارهای پشتیبانی‌شده — لاتین و فارسی */
const PLACEHOLDERS = ["{code}", "%code%", "{کد تایید}", "{کد}"] as const;

/**
 * ساخت متن پیامک دستی — جایگزینی {code} و %code% و {کد} با کد تایید.
 * اگر قالب خالی باشد از پیش‌فرض استفاده می‌شود.
 * اگر قالب جای‌نگهدار نداشته باشد، کد به انتهای متن الحاق می‌شود
 * تا پیامک ارسالی بی‌معنا نشود.
 */
export function renderOtpTemplate(template: string | null | undefined, code: string): string {
  const tpl = template && template.trim() ? template.trim() : DEFAULT_OTP_TEMPLATE;
  if (!PLACEHOLDERS.some((p) => tpl.includes(p))) {
    return `${tpl}\n${code}`;
  }
  return tpl
    .replaceAll("{کد تایید}", code) // اول طولانی‌ترین، تا زیررشته اشتباه جایگزین نشود
    .replaceAll("{code}", code)
    .replaceAll("%code%", code)
    .replaceAll("{کد}", code);
}
