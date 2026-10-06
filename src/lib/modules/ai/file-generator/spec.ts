// ═══════════════════════════════════════════════════════════════
// پروتکل ساخت فایل هوشیار — اسکیمای اعتبارسنجی (zod)
// ═══════════════════════════════════════════════════════════════
// مدل زبانی در پاسخ خود بلوک ```file-spec با JSON می‌نویسد؛ این
// اسکیما «تنها مرز اعتماد» است — هر چه از مدل بیاید قبل از ساخت
// فایل باید از این اعتبارسنجی سالم عبور کند (امنیت + کیفیت).
//
// ساختار کلی (discriminated union روی kind):
//   docx | pdf  → blocks (سند ساخت‌یافته)
//   xlsx        → sheets (استایل‌دار RTL) | source+transform (ویرایش پیوست)
//   csv         → columns+rows | source+transform
//   md | txt    → text
//   html        → title + text
// ═══════════════════════════════════════════════════════════════
import { z } from "zod";

// ─── سقف‌های امنیتی/کیفیتی ───
export const LIMITS = {
  fileNameMax: 60,
  blocksPerDoc: 250,
  tableRows: 3000,
  tableCols: 30,
  cellText: 3000,
  paraText: 8000,
  listItems: 200,
  sheetsPerFile: 8,
  sheetRows: 5000,
  sheetCols: 40,
  transformCodeChars: 20000,
  transformResultRows: 20000,
  csvRows: 8000,
  textFileChars: 120000,
  specsPerReply: 3,
} as const;

// ─── ابزارهای پاک‌سازی ───

/** نام فایل امن: بدون مسیر، بدون کاراکتر ممنوع ویندوز، با طول محدود */
export function sanitizeFileName(raw: string, fallback: string): string {
  let name = String(raw || "")
    .replace(/[/\\:*?"<>|\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, LIMITS.fileNameMax)
    .replace(/[. ]+$/g, "") // بدون نقطه/فاصله انتهایی (سازگار ویندوز)
    .replace(/^[. ]+/, "") // بدون نقطه ابتدایی (ضد ../ و فایل‌های مخفی)
    .trim();
  if (!name) name = fallback;
  return name;
}

/** مقدار سلول: رشته کوتاه یا عدد یا بولی یا تهی */
const cellValue = z.union([z.string().max(LIMITS.cellText), z.number().finite(), z.boolean(), z.null()]);

/** متن منعطف — مدل گاهی عدد/بولی/null/آبجکت در فیلد متنی می‌فرستد؛ به رشته تبدیل می‌شود */
const flexText = (max: number) =>
  z.preprocess(
    (v) => {
      if (v === null || v === undefined) return "";
      if (typeof v === "object") {
        // مدل گاهی {text: "..."} یا آبجکت تو در تو می‌فرستد
        const obj = v as Record<string, unknown>;
        if (typeof obj.text === "string") return obj.text;
        if (typeof obj.value === "string") return obj.value;
        try {
          return JSON.stringify(v);
        } catch {
          return String(v);
        }
      }
      return v;
    },
    z
      .union([z.string(), z.number().finite(), z.boolean()])
      .transform((v) => String(v))
      .pipe(z.string().max(max))
  );

/** ردیف جدول منعطف — اگر مدل آبجکت فرستاد (به‌جای آرایه)، مقادیرش به‌ترتیب کلیدها برداشته می‌شود */
const flexRow = (max: number) =>
  z.preprocess(
    (v) => {
      if (Array.isArray(v)) return v;
      if (v && typeof v === "object") return Object.values(v as Record<string, unknown>);
      return v;
    },
    z.array(cellValue).min(1).max(max)
  );

// ─── بلوک‌های سند (docx و pdf مشترک) ───
export const blockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("h1"),
    text: flexText(LIMITS.paraText),
  }),
  z.object({
    type: z.literal("h2"),
    text: flexText(LIMITS.paraText),
  }),
  z.object({
    type: z.literal("h3"),
    text: flexText(LIMITS.paraText),
  }),
  z.object({
    type: z.literal("p"),
    text: flexText(LIMITS.paraText),
  }),
  z.object({
    type: z.literal("bullets"),
    items: z.array(flexText(LIMITS.paraText)).min(1).max(LIMITS.listItems),
  }),
  z.object({
    type: z.literal("numbers"),
    items: z.array(flexText(LIMITS.paraText)).min(1).max(LIMITS.listItems),
  }),
  z.object({
    type: z.literal("quote"),
    text: flexText(LIMITS.paraText),
  }),
  z.object({
    type: z.literal("table"),
    caption: flexText(300).optional(),
    header: z.array(flexText(200)).min(1).max(LIMITS.tableCols),
    rows: z.array(flexRow(LIMITS.tableCols)).min(1).max(LIMITS.tableRows),
  }),
  z.object({
    type: z.literal("kv"),
    items: z
      .array(
        z.preprocess(
          (v) => {
            if (Array.isArray(v)) return v;
            if (v && typeof v === "object") return Object.values(v as Record<string, unknown>);
            return v;
          },
          z.tuple([flexText(200), flexText(LIMITS.cellText)])
        )
      )
      .min(1)
      .max(100),
  }),
  z.object({ type: z.literal("spacer") }),
  z.object({ type: z.literal("pagebreak") }),
]);
export type DocBlock = z.infer<typeof blockSchema>;

const docPayload = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().max(300).optional(),
  blocks: z.array(blockSchema).min(1).max(LIMITS.blocksPerDoc),
});

// ─── شیت اکسل ───
export const sheetSchema = z.object({
  name: flexText(31),
  columns: z.array(flexText(200)).min(1).max(LIMITS.sheetCols),
  rows: z.array(flexRow(LIMITS.sheetCols)).min(1).max(LIMITS.sheetRows),
  columnWidths: z.array(z.number().int().min(4).max(80)).optional(),
  /** فرمت عددی هر ستون (اختیاری): "money" | "percent" | "int" | "date" | "text" */
  colFormats: z.array(z.enum(["money", "percent", "int", "date", "text"])).optional(),
  totals: z.boolean().optional(), // ردیف جمع پایین
});
export type SheetSpec = z.infer<typeof sheetSchema>;

// ─── حالت transform (مفسر کد روی فایل پیوست) ───
const transformPayload = z.object({
  source: z.literal("attachment"),
  /** برای xlsx چندشیتِ: اندیس شیت مبدأ (پیش‌فرض ۰) */
  sourceSheet: z.number().int().min(0).max(19).optional(),
  /** نام شیت خروجی (فقط xlsx) */
  resultSheetName: z.string().min(1).max(31).optional(),
  /** کد JS — تابع(rows, columns) که باید return کند */
  transform: z.string().min(1).max(LIMITS.transformCodeChars),
});

// ─── اسکیمای اصلی (union روی kind) ───
// نکته zod v4: در discriminated union همه اعضا باید ObjectSchema خالص
// باشند (نه intersection) — فیلدهای transform مستقیم داخل آبجکت هر kind
export const fileSpecSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("docx"),
    fileName: z.string().max(120),
    doc: docPayload,
  }),
  z.object({
    kind: z.literal("pdf"),
    fileName: z.string().max(120),
    doc: docPayload,
  }),
  z.object({
    kind: z.literal("xlsx"),
    fileName: z.string().max(120),
    sheets: z.array(sheetSchema).min(1).max(LIMITS.sheetsPerFile).optional(),
    // حالت ویرایش پیوست (مفسر کد):
    source: z.literal("attachment").optional(),
    sourceSheet: z.number().int().min(0).max(19).optional(),
    resultSheetName: z.string().min(1).max(31).optional(),
    transform: z.string().max(LIMITS.transformCodeChars).optional(),
  }),
  z.object({
    kind: z.literal("csv"),
    fileName: z.string().max(120),
    columns: z.array(flexText(200)).min(1).max(LIMITS.sheetCols).optional(),
    rows: z.array(flexRow(LIMITS.sheetCols)).min(1).max(LIMITS.csvRows).optional(),
    /** جداکننده خروجی: پیش‌فرض کاما */
    delimiter: z.enum([",", ";", "\t"]).optional(),
    // حالت ویرایش پیوست (مفسر کد):
    source: z.literal("attachment").optional(),
    sourceSheet: z.number().int().min(0).max(19).optional(),
    transform: z.string().max(LIMITS.transformCodeChars).optional(),
  }),
  z.object({
    kind: z.literal("md"),
    fileName: z.string().max(120),
    text: z.string().min(1).max(LIMITS.textFileChars),
  }),
  z.object({
    kind: z.literal("txt"),
    fileName: z.string().max(120),
    text: z.string().min(1).max(LIMITS.textFileChars),
  }),
  z.object({
    kind: z.literal("html"),
    fileName: z.string().max(120),
    title: z.string().min(1).max(200),
    text: z.string().min(1).max(LIMITS.textFileChars),
  }),
]);
export type FileSpec = z.infer<typeof fileSpecSchema>;

/** آیا spec حالت transform روی پیوست است؟ */
export function isTransformSpec(spec: FileSpec): boolean {
  return (
    (spec.kind === "xlsx" || spec.kind === "csv") &&
    "source" in spec &&
    spec.source === "attachment" &&
    typeof (spec as { transform?: unknown }).transform === "string"
  );
}

/** پسوند و MIME هر kind */
export const KIND_META: Record<FileSpec["kind"], { ext: string; mime: string; label: string }> = {
  docx: {
    ext: "docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    label: "Word",
  },
  xlsx: {
    ext: "xlsx",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    label: "Excel",
  },
  pdf: { ext: "pdf", mime: "application/pdf", label: "PDF" },
  csv: { ext: "csv", mime: "text/csv; charset=utf-8", label: "CSV" },
  md: { ext: "md", mime: "text/markdown; charset=utf-8", label: "Markdown" },
  txt: { ext: "txt", mime: "text/plain; charset=utf-8", label: "Text" },
  html: { ext: "html", mime: "text/html; charset=utf-8", label: "HTML" },
};

export interface GeneratedFileInfo {
  url: string;
  name: string;
  mime: string;
  size: number;
  kind: FileSpec["kind"];
}
