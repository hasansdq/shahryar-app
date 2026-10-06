// ═════ هلپرهای مالی سمت کلاینت — فرمت، ماه جلالی، آیکن دسته‌ها ═════
"use client";

import { faNum } from "./persian";
import { JALALI_MONTHS, jalaliToday, toJalali } from "./jalali";

/** فرمت مبلغ تومان: ۴٬۲۵۰٬۰۰۰ (فارسی) */
export function toman(n: number): string {
  return faNum(Math.round(n).toLocaleString("en-US"));
}

/** فرمت فشرده برای کارت‌های آماری: ۴.۲ م / ۹۵۰ ه */
export function tomanShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${faNum((n / 1_000_000_000).toFixed(1))} میلیارد`;
  if (abs >= 1_000_000) return `${faNum((n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1))} میلیون`;
  if (abs >= 1_000) return `${faNum((n / 1_000).toFixed(0))} هزار`;
  return faNum(n);
}

/** کلید ماه جلالی فعلی: "1405-06" */
export function currentMonthKey(): string {
  const j = jalaliToday();
  return `${j.jy}-${String(j.jm).padStart(2, "0")}`;
}

/** برچسب فارسی ماه از کلید: «مرداد ۱۴۰۵» */
export function monthLabel(key: string): string {
  const [jy, jm] = key.split("-").map(Number);
  return `${JALALI_MONTHS[jm - 1]} ${faNum(jy)}`;
}

/** برچسب کوتاه ماه برای محور نمودار: «مرداد» */
export function monthShortLabel(key: string): string {
  const [, jm] = key.split("-").map(Number);
  return JALALI_MONTHS[jm - 1];
}

/** لیست n ماه اخیر (قدیمی→جدید) */
export function recentMonthKeys(n: number): string[] {
  const j = jalaliToday();
  const keys: string[] = [];
  let { jy, jm } = j;
  for (let i = 0; i < n; i++) {
    keys.unshift(`${jy}-${String(jm).padStart(2, "0")}`);
    jm -= 1;
    if (jm === 0) { jm = 12; jy -= 1; }
  }
  return keys;
}

/** تاریخ تراکنش به فرم جلالی خلاصه برای لیست */
export function txDateLabel(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const j = toJalali(d);
  return `${faNum(j.jd)} ${JALALI_MONTHS[j.jm - 1]}`;
}

/** انتخاب آیکن دسته از نام آیکن ذخیره‌شده */
export const CATEGORY_ICON_KEYS = [
  "utensils", "car", "home", "receipt", "heart-pulse", "shirt", "gamepad-2",
  "book-open", "shopping-cart", "gift", "sprout", "briefcase", "nut", "store",
  "trending-up", "circle-ellipsis", "tag", "wallet", "banknote", "piggy-bank",
] as const;

/** نام‌های نمایشی حساب */
export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  cash: "نقدی",
  bank: "حساب بانکی",
  card: "کارت بانکی",
  wallet: "کیف پول",
};

/** برچسب‌های نوع تراکنش */
export const TX_TYPE_LABELS: Record<string, string> = {
  income: "درآمد",
  expense: "هزینه",
  transfer: "انتقال",
};

/** برچسب دوره‌ی تکرار */
export const CADENCE_LABELS: Record<string, string> = {
  weekly: "هفتگی",
  monthly: "ماهانه",
  yearly: "سالانه",
};

/** رنگ وضعیت بودجه */
export function budgetStatus(pct: number): { color: string; label: string } {
  if (pct >= 100) return { color: "text-rose-500", label: "تجاوز از بودجه" };
  if (pct >= 80) return { color: "text-amber-500", label: "نزدیک سقف" };
  if (pct >= 50) return { color: "text-sky-500", label: "در مسیر" };
  return { color: "text-emerald-600", label: "آرام و مطمئن" };
}

/** رنگ امتیاز سلامت مالی */
export function healthColor(score: number): string {
  if (score >= 75) return "#10b981";
  if (score >= 50) return "#0ea5e9";
  if (score >= 35) return "#f59e0b";
  return "#ef4444";
}
