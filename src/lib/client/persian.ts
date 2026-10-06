// ═════ ابزارهای فارسی — تاریخ جلالی، ساعت رسمی ایران، اعداد، متن ═════

/** منطقه زمانی رسمی ایران — در تمام سیستم فقط همین استفاده می‌شود */
export const IRAN_TZ = "Asia/Tehran";

/** تبدیل عدد به رشته با ارقام فارسی */
export function faNum(n: number | string): string {
  return String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

/** تبدیل ارقام فارسی به انگلیسی */
export function enNum(s: string): string {
  return s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

/** تاریخ جلالی خوانا: ۲۶ مرداد ۱۴۰۵ — به وقت رسمی ایران */
export function faDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: IRAN_TZ,
  }).format(d);
}

/** تاریخ کوتاه جلالی: ۱۴۰۵/۰۵/۲۶ */
export function faDateShort(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: IRAN_TZ,
  }).format(d);
}

/** تاریخ و زمان جلالی: ۲۶ مرداد ۱۴۰۵، ۱۴:۳۰ — ساعت رسمی ۲۴ ساعته ایران */
export function faDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: IRAN_TZ,
  }).format(d);
}

/** روز هفته + تاریخ جلالی: سه‌شنبه ۲۶ مرداد ۱۴۰۵ */
export function faDateWithWeekday(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: IRAN_TZ,
  }).format(d);
}

/** زمان نسبی فارسی: «۳ دقیقه پیش» */
export function faRelative(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "همین حالا";
  if (mins < 60) return `${faNum(mins)} دقیقه پیش`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${faNum(hours)} ساعت پیش`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${faNum(days)} روز پیش`;
  if (days < 30) return `${faNum(Math.floor(days / 7))} هفته پیش`;
  return faDate(d);
}

/** ساعت رسمی ایران: ۱۴:۳۰ (۲۴ ساعته) */
export function faTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: IRAN_TZ,
  }).format(d);
}

/** ساعت و دقیقه رسمی ایران به همراه ثانیه */
export function faTimeWithSeconds(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone: IRAN_TZ,
  }).format(d);
}

/** سال جلالی جاری به وقت ایران */
export function currentJalaliYear(): number {
  const parts = new Intl.DateTimeFormat("en-u-ca-persian", {
    year: "numeric",
    timeZone: IRAN_TZ,
  }).format(new Date());
  return parseInt(parts.replace(/\D/g, "")) || 1404;
}

/** سلام متناسب با ساعت رسمی ایران */
export function greeting(): string {
  const h = parseInt(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: IRAN_TZ }).format(new Date())
  );
  if (h < 5) return "شب بخیر";
  if (h < 12) return "صبح بخیر";
  if (h < 17) return "وقت بخیر";
  if (h < 20) return "عصر بخیر";
  return "شب بخیر";
}

/** برچسب‌های فارسی ثابت */
export const LABELS = {
  priorities: { low: "کم", medium: "متوسط", high: "زیاد", critical: "بحرانی" } as Record<string, string>,
  goalCategories: {
    personal: "شخصی", health: "سلامت", career: "شغلی",
    education: "تحصیلی", financial: "مالی", family: "خانوادگی",
  } as Record<string, string>,
  taskStatus: { todo: "در انتظار", in_progress: "در حال انجام", done: "انجام‌شده" } as Record<string, string>,
  memoryCategories: {
    personal: "شخصی", preference: "ترجیحات", goal: "هدف",
    health: "سلامت", family: "خانواده", other: "سایر",
  } as Record<string, string>,
  cityCategories: {
    news: "خبر", event: "رویداد", announcement: "اطلاعیه",
    service: "خدمت", tip: "نکته",
  } as Record<string, string>,
  weekdays: ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"],
} as const;

/** رنگ اولیه بر اساس کلید */
export const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  medium: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  critical: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

/** رنگ‌های آواتار */
export const AVATAR_COLORS = [
  "from-blue-500 to-indigo-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-violet-500 to-purple-600",
  "from-cyan-500 to-blue-600",
  "from-cyan-500 to-sky-600",
];

export function avatarColor(index: string | number): string {
  const i = typeof index === "number" ? index : parseInt(index) || 0;
  return AVATAR_COLORS[i % AVATAR_COLORS.length];
}

/** قالب‌بندی امتیاز */
export function faRating(rating: number): string {
  return faNum(rating.toFixed(1));
}

/** مخفی‌سازی شماره موبایل برای حریم خصوصی */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone;
  return phone.slice(0, 4) + "***" + phone.slice(-3);
}
