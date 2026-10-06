// ═══════════════════════════════════════════════════════════════
// مراحل پردازش هوشیار — قرارداد مشترک سرور (stream) و کلاینت (UI)
// ═══════════════════════════════════════════════════════════════

/** شناسه مراحل — به ترتیب منطقی پردازش */
export type StageId =
  | "queued"          // پیام دریافت و پذیرفته شد
  | "reading_doc"     // خواندن سند/فایل پیوست‌شده
  | "analyzing_image" // تحلیل تصویر پیوست‌شده
  | "searching_web"   // جستجوی وب
  | "thinking"        // تحلیل و استدلال مدل
  | "writing"         // نگارش پاسخ
  | "planning_file"   // طراحی ساختار فایل
  | "writing_code"    // نوشتن کد پردازش داده
  | "running_code"    // اجرای کد روی داده‌ها
  | "building_file"   // ساخت فایل
  | "saving_file"     // ذخیره و آماده‌سازی دانلود
  | "retrying"        // تلاش مجدد هوشمند
  | "finalizing";     // نهایی‌سازی پاسخ

/** رویداد مرحله — هر خط NDJSON در استریم چت */
export interface StageEvent {
  type: "stage";
  stage: StageId;
  /** جزئیات (مثلاً نام فایل) */
  detail?: string;
  /** شماره مرحله برای پیشرفت کلی 0..1 */
  progress?: number;
  /** زمان نسبی از شروع (ms) */
  at?: number;
}

/** رویداد نهایی — آخرین خط استریم */
export interface ResultEvent<T = unknown> {
  type: "result";
  data: T;
}

/** رویداد خطا */
export interface ErrorEvent {
  type: "error";
  error: string;
}

export type StreamEvent<T = unknown> = StageEvent | ResultEvent<T> | ErrorEvent;

/** فراخوان‌گر مرحله — در عمق خط لوله چت پاس داده می‌شود */
export type StageEmitter = (stage: StageId, detail?: string) => void;
