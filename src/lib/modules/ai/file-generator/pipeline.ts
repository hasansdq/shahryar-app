// ═══════════════════════════════════════════════════════════════
// خط لوله ساخت فایل هوشیار — Pipeline
// ═══════════════════════════════════════════════════════════════
// جریان:
//  ۱) استخراج بلوک‌های ```file-spec از پاسخ مدل
//  ۲) پارس JSON مداراگر (fence اضافی، کامای انتهایی) + اعتبارسنجی zod
//  ۳) ساخت فایل:
//     • docx/pdf → سازنده سند ساخت‌یافته راست‌چین
//     • xlsx/csv مستقیم → از داده‌های داخل spec
//     • xlsx/csv از پیوست → مفسر کد امن روی داده‌ی «فایل اصلی»
//       (پارس مجدد از دیسک با وفاداری کامل، نه متن برش‌خورده)
//  ۴) ذخیره در مخزن رسانه (scope=chat) → کارت دانلود در چت
//
// رویکرد «مفسر کد»: برای ویرایش اکسل/CSV مدل «کد جاوااسکریپت»
// می‌نویسد که روی ردیف‌های واقعی فایل اجرا می‌شود — داده‌های
// بزرگ بدون عبور از پنجره متن مدل، دقیق و کامل پردازش می‌شوند.
// ═══════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { db } from "@/lib/db";
import { keyToAbsPath, isValidMediaKey } from "@/lib/media/storage";
import { parseMediaUrl } from "@/lib/media/url";
import { saveMediaFile } from "@/lib/media/storage";
import { uploadUrlToDiskPaths } from "@/lib/core/uploads";
import {
  fileSpecSchema,
  isTransformSpec,
  KIND_META,
  LIMITS,
  sanitizeFileName,
  type FileSpec,
  type GeneratedFileInfo,
} from "./spec";
import { buildDocx } from "./docx-builder";
import { buildXlsx } from "./xlsx-builder";
import { buildPdf } from "./pdf-builder";
import { buildCsv, buildText, buildHtml } from "./text-builders";
import { runTransform } from "./sandbox";
import { parseJsonWithRepair } from "./json-repair";
import type { StageEmitter } from "../stages";

// xlsx برای پارس فایل پیوست (همان الگوی require زمان-اجرا document-reader)
const nodeRequire = createRequire(path.join(process.cwd(), "package.json"));

// ─── الگوهای بلوک file-spec ───
const COMPLETE_SPEC_RE = /```file-spec\s*\n([\s\S]*?)```/g;
const OPENING_SPEC_RE = /```file-spec/;

/** آیا پاسخ مدل بلوک file-spec دارد؟ (کامل یا ناقص) */
export function hasFileSpecBlock(content: string): boolean {
  return OPENING_SPEC_RE.test(content);
}

/** آیا بلوک ناقص/بریده‌شده وجود دارد؟ (نشانه تمام‌شدن توکن) */
export function hasIncompleteSpecBlock(content: string): boolean {
  const complete = content.match(COMPLETE_SPEC_RE)?.length || 0;
  const openings = (content.match(/```file-spec/g) || []).length;
  return openings > complete;
}

/**
 * پارس JSON بلوک با موتور ترمیم چندلایه (json-repair.ts) —
 * گلیش‌های واقعی مدل (کوتیشن دوبل ""X، براکت سرگردان [[]"،
 * جابجایی }{ ↔ ][، کامای جاافتاده، newline خام) ترمیم می‌شوند.
 * اولین کاندیدایی که هم JSON.parse و هم zod را پاس کند برنده است.
 */
function tolerantJsonParse(raw: string): { parsed: unknown | null; validationFailed: boolean } {
  const outcome = parseJsonWithRepair(raw, (v) => fileSpecSchema.safeParse(v).success);
  return { parsed: outcome.value, validationFailed: outcome.validationFailed };
}

// ─── تشخیص قصد ساخت فایل (برای مسیر retry) ───
const FILE_INTENT_RE =
  /(ساخت|بساز|می‌سازم|مساز|تولید کن|آماده کن|ایجاد کن|خروجی بگیر|خروجی گرفتن|ذخیره کن|بگیر).{0,40}(فایل|سند|گزارش|فاکتور|جدول|قرارداد|پروپوزال|رزومه|نامه|اکسل|excel|xlsx|ورد|word|docx|پی\s*دی\s*اف|pdf|csv|مارک\s*داون|markdown|اچ\s*تی\s*ام\s*ال|html)|(فایل|سند|گزارش|اکسل|excel|ورد|word|pdf|پی\s*دی\s*اف|csv).{0,30}(بساز|میخوام|می‌خوام|بده|بمیده|برام|آماده کن|تولید کن|بگیر|بگیری)/i;

/** آیا پیام کاربر خواستار ساخت/خروجی فایل است؟ */
export function detectFileIntent(message: string): boolean {
  return FILE_INTENT_RE.test(message);
}

// ─── پارس فایل جدولی پیوست (وفاداری کامل از دیسک) ───
interface ParsedSheet {
  columns: string[];
  rowsAsObjects: Record<string, unknown>[];
  rowsAsArrays: unknown[][];
}

function resolveMediaPath(url: string): string | null {
  const parsed = parseMediaUrl(url);
  if (!parsed || !isValidMediaKey(parsed.key)) return null;
  // ۱) ریشه کانونی جدید (storage/media)
  const abs = keyToAbsPath(parsed.key);
  if (abs && existsSync(abs)) return abs;
  // ۲) ریشه‌های قدیمی/جاری آپلود (public/uploads و کاندیداهای standalone) —
  //    آپلود پیوست‌های چت از این مسیرها ذخیره می‌شوند
  const legacyPaths = uploadUrlToDiskPaths(`/uploads/${parsed.key}`);
  for (const p of legacyPaths) {
    if (existsSync(p)) return p;
  }
  return null;
}

function isSheetAttachment(name?: string | null, mime?: string | null): boolean {
  const m = (mime || "").toLowerCase();
  if (m.includes("spreadsheetml") || m === "application/vnd.ms-excel" || m === "text/csv") return true;
  return /\.(xlsx?|csv)$/i.test(name || "");
}

/** خواندن شیت از فایل پیوست روی دیسک — اولین شیت یا اندیس دلخواه */
function parseSheetFromDisk(absPath: string, sheetIdx: number): ParsedSheet | null {
  try {
    const XLSX = nodeRequire("xlsx");
    const buf = readFileSync(absPath);
    const wb = XLSX.read(buf, { type: "buffer" });
    const names = wb.SheetNames as string[];
    if (names.length === 0) return null;
    const sheetName = names[Math.min(sheetIdx, names.length - 1)];
    const arr = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null, raw: true }) as unknown[][];
    if (!arr || arr.length === 0) return null;

    const columns = (arr[0] as unknown[]).map((c) => String(c ?? "").trim());
    const rowsAsArrays = arr.slice(1).filter((r) => Array.isArray(r) && r.some((v) => v !== null && v !== undefined && v !== ""));
    const rowsAsObjects = rowsAsArrays.map((r) => {
      const obj: Record<string, unknown> = {};
      columns.forEach((c, i) => {
        obj[c] = (r as unknown[])[i] ?? null;
      });
      return obj;
    });
    if (columns.length === 0) return null;
    return { columns, rowsAsObjects, rowsAsArrays };
  } catch (err) {
    console.error("[file-gen] خطای پارس فایل جدولی پیوست:", err);
    return null;
  }
}

/** یافتن آخرین پیوست جدولی جلسه (وقتی پیوست همین نوبت جدولی نیست) */
async function findLastSheetAttachmentUrl(sessionId: string, excludeUrl?: string | null): Promise<string | null> {
  const msgs = await db.chatMessage.findMany({
    where: { sessionId, role: "user", attachmentUrl: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { attachmentUrl: true, attachmentName: true, attachmentMime: true },
  });
  for (const m of msgs) {
    if (m.attachmentUrl && m.attachmentUrl !== excludeUrl && isSheetAttachment(m.attachmentName, m.attachmentMime)) {
      return m.attachmentUrl;
    }
  }
  return null;
}

// ─── ساخت یک فایل از spec معتبر ───
async function buildOne(
  spec: FileSpec,
  ctx: {
    sessionId: string;
    attachment: { url: string; name: string; mime: string } | null;
    codeInterpreterEnabled?: boolean;
    onStage?: StageEmitter;
  }
): Promise<{ buffer: Buffer; prettyName: string }> {
  const meta = KIND_META[spec.kind];

  // ─── حالت transform روی پیوست (مفسر کد) ───
  if (isTransformSpec(spec)) {
    if (ctx.codeInterpreterEnabled === false) {
      throw new Error("مفسر کد توسط مدیریت سامانه غیرفعال است — امکان ویرایش فایل اکسل/CSV پیوست وجود ندارد");
    }
    // پیوست مبدأ: همین نوبت اگر جدولی است، وگرنه آخرین پیوست جدولی جلسه
    let sourceUrl: string | null = null;
    let absPath: string | null = null;

    if (ctx.attachment && isSheetAttachment(ctx.attachment.name, ctx.attachment.mime)) {
      const p = resolveMediaPath(ctx.attachment.url);
      if (p) {
        sourceUrl = ctx.attachment.url;
        absPath = p;
      }
    }
    if (!absPath) {
      const fallbackUrl = await findLastSheetAttachmentUrl(ctx.sessionId, sourceUrl);
      if (fallbackUrl) {
        const p = resolveMediaPath(fallbackUrl);
        if (p) {
          sourceUrl = fallbackUrl;
          absPath = p;
        }
      }
    }
    if (!sourceUrl || !absPath) {
      throw new Error("فایل اکسل/CSV مبدأی در این گفتگو پیدا نشد — ابتدا فایل را پیوست کنید");
    }

    const parsed = parseSheetFromDisk(absPath, "sourceSheet" in spec ? (spec.sourceSheet as number) || 0 : 0);
    if (!parsed) throw new Error("فایل پیوست جدولی قابل خواندن نبود");

    const transform = (spec as { transform: string }).transform;
    ctx.onStage?.("running_code", `اجرای کد روی ${faCount(parsed.rowsAsObjects.length)} ردیف داده`);
    const result = runTransform(transform, parsed.rowsAsObjects, parsed.columns);
    if (!result.ok || !result.columns || !result.rows) {
      throw new Error(result.error || "اجرای کد تبدیل ناموفق بود");
    }

    if (spec.kind === "xlsx") {
      const resultSheetName = (spec as { resultSheetName?: string }).resultSheetName || "نتیجه تبدیل";
      const buffer = await buildXlsx([
        { name: resultSheetName, columns: result.columns, rows: result.rows as (string | number | boolean | null)[][], totals: false },
      ]);
      return { buffer, prettyName: sanitizeFileName(spec.fileName, "نتیجه-تبدیل") + ".xlsx" };
    }
    const buffer = buildCsv({ columns: result.columns, rows: result.rows }, (spec as { delimiter?: "," | ";" | "\t" }).delimiter);
    return { buffer, prettyName: sanitizeFileName(spec.fileName, "نتیجه-تبدیل") + ".csv" };
  }

  // ─── حالت‌های مستقیم ───
  switch (spec.kind) {
    case "docx": {
      const buffer = await buildDocx(spec.doc, spec.fileName);
      return { buffer, prettyName: sanitizeFileName(spec.fileName, "سند") + ".docx" };
    }
    case "pdf": {
      const buffer = await buildPdf(spec.doc);
      return { buffer, prettyName: sanitizeFileName(spec.fileName, "سند") + ".pdf" };
    }
    case "xlsx": {
      if (!spec.sheets || spec.sheets.length === 0) throw new Error("برای فایل اکسل داده شیت‌ها لازم است");
      const buffer = await buildXlsx(spec.sheets);
      return { buffer, prettyName: sanitizeFileName(spec.fileName, "داده‌ها") + ".xlsx" };
    }
    case "csv": {
      if (!spec.columns || !spec.rows) throw new Error("برای فایل CSV ستون‌ها و ردیف‌ها لازم است");
      const buffer = buildCsv({ columns: spec.columns, rows: spec.rows }, spec.delimiter);
      return { buffer, prettyName: sanitizeFileName(spec.fileName, "داده‌ها") + ".csv" };
    }
    case "md":
      return { buffer: buildText(spec.text), prettyName: sanitizeFileName(spec.fileName, "سند") + ".md" };
    case "txt":
      return { buffer: buildText(spec.text), prettyName: sanitizeFileName(spec.fileName, "سند") + ".txt" };
    case "html": {
      const jalali = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
        year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Tehran",
      }).format(new Date());
      const buffer = buildHtml(spec.title, spec.text, jalali);
      return { buffer, prettyName: sanitizeFileName(spec.fileName, "صفحه") + ".html" };
    }
    default:
      throw new Error(`نوع فایل پشتیبانی نمی‌شود: ${String((spec as { kind: string }).kind)}`);
  }
}

// ─── API اصلی خط لوله ───
export interface FilePipelineResult {
  /** متن پاسخ پس از حذف بلوک‌های spec */
  content: string;
  /** فایل‌های ساخته‌شده */
  files: GeneratedFileInfo[];
  /** خطاهای فارسی برای نمایش به کاربر */
  errors: string[];
  /** آیا بلوک بریده/ناقص بود؟ (نیاز به retry با توکن بیشتر) */
  incomplete: boolean;
}

export interface FilePipelineCtx {
  sessionId: string;
  attachment?: { url: string; name: string; mime: string } | null;
  /** مفسر کد فعال است؟ (ویرایش اکسل/CSV پیوست) */
  codeInterpreterEnabled?: boolean;
  /** سقف‌های پویا از پنل مدیریت */
  limits?: { specsPerReply?: number; sheetRows?: number };
  /** گزارش مرحله برای UI چت */
  onStage?: StageEmitter;
}

/** تعداد فارسی — برای جزئیات مرحله */
function faCount(n: number): string {
  return String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
}

export async function processFileSpecs(
  rawContent: string,
  ctx: FilePipelineCtx
): Promise<FilePipelineResult> {
  const files: GeneratedFileInfo[] = [];
  const errors: string[] = [];

  const matches = [...rawContent.matchAll(COMPLETE_SPEC_RE)];
  const incomplete = hasIncompleteSpecBlock(rawContent);

  if (matches.length === 0) {
    // فقط بلوک ناقص (بریده‌شده) — محتوای خام را برای retry نگه دار
    return { content: rawContent, files, errors, incomplete };
  }

  let cleaned = rawContent;
  const maxSpecs = Math.max(1, Math.min(LIMITS.specsPerReply, ctx.limits?.specsPerReply ?? LIMITS.specsPerReply));

  for (const m of matches.slice(0, maxSpecs)) {
    const blockFull = m[0];
    const jsonRaw = m[1];

    const { parsed, validationFailed } = tolerantJsonParse(jsonRaw);
    if (!parsed) {
      errors.push(
        "ساخت فایل ناموفق بود: ساختار JSON نامعتبر بود (حتی پس از ترمیم خودکار)"
      );
      cleaned = cleaned.replace(blockFull, "");
      continue;
    }
    if (validationFailed) {
      // پارس شد اما هیچ کاندیدای ترمیمی zod را پاس نکرد — با خطای دقیق ادامه بده
    }

    const check = fileSpecSchema.safeParse(parsed);
    if (!check.success) {
      const first = check.error.issues[0];
      const where = first ? `${first.path.join(".") || "ریشه"}` : "";
      errors.push(`ساخت فایل ناموفق بود — فیلد «${where}» نامعتبر است (${first?.code || ""})`);
      cleaned = cleaned.replace(blockFull, "");
      continue;
    }

    try {
      const spec = check.data;

      // سقف پویای ردیف‌ها از پنل مدیریت (کوچک‌تر از حد امنیتی ثابت)
      const dynRowCap = ctx.limits?.sheetRows;
      if (typeof dynRowCap === "number" && dynRowCap > 0) {
        const countRows = (rows: unknown) => (Array.isArray(rows) ? rows.length : 0);
        const overLimit =
          (("sheets" in spec && Array.isArray(spec.sheets))
            ? (spec.sheets as Array<{ rows?: unknown }>).some((s) => countRows(s.rows) > dynRowCap)
            : false) ||
          (("rows" in spec && Array.isArray(spec.rows)) ? countRows(spec.rows) > dynRowCap : false);
        if (overLimit) {
          throw new Error(`تعداد ردیف‌ها از سقف تعیین‌شده در پنل مدیریت (${faCount(dynRowCap)} ردیف) بیشتر است — داده‌ها را کوچک‌تر یا تقسیم کنید`);
        }
      }

      const prettyNameGuess = sanitizeFileName(spec.fileName, "فایل");
      ctx.onStage?.("building_file", `${prettyNameGuess}.${spec.kind}`);
      const { buffer, prettyName } = await buildOne(spec, {
        sessionId: ctx.sessionId,
        attachment: ctx.attachment || null,
        codeInterpreterEnabled: ctx.codeInterpreterEnabled,
        onStage: ctx.onStage,
      });
      if (buffer.length === 0) throw new Error("فایل خالی تولید شد");

      // ذخیره در مخزن کانونی — scope چت (تایید اتمیک درون خودِ ذخیره)
      ctx.onStage?.("saving_file", prettyName);
      const saved = await saveMediaFile({
        scope: "chat",
        buffer,
        mime: KIND_META[spec.kind].mime,
        originalName: prettyName,
      });

      files.push({
        url: saved.url,
        name: prettyName,
        mime: KIND_META[spec.kind].mime,
        size: saved.size,
        kind: spec.kind,
      });
      cleaned = cleaned.replace(blockFull, "");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "خطای ناشناخته";
      console.error("[file-gen] خطای ساخت فایل:", msg);
      errors.push(`ساخت فایل ناموفق بود: ${msg.slice(0, 200)}`);
      cleaned = cleaned.replace(blockFull, "");
    }
  }

  // حذف هر بلوک ناقص باقی‌مانده (از retry جداگانه می‌آید)
  if (incomplete) {
    cleaned = cleaned.replace(/```file-spec[\s\S]*$/g, "").trimEnd();
  }

  // پاک‌سازی فضای خالی اضافی پس از حذف بلوک‌ها
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

  // اگر پاسخ عملاً فقط بلوک بود و فایل ساخته شد — متن پیش‌فرض
  if (!cleaned && files.length > 0) {
    cleaned =
      files.length === 1
        ? `فایل «${files[0].name}» آماده شد! از کارت دانلود زیر دریافتش کن.`
        : `${files.length} فایل آماده شد! از کارت‌های دانلود زیر دریافتشان کن.`;
  }

  return { content: cleaned, files, errors, incomplete };
}

/** متن خطاها را به انتهای پاسخ پاسخ می‌چسباند (شفاف برای کاربر) */
export function appendErrorNotes(content: string, errors: string[]): string {
  if (errors.length === 0) return content;
  const notes = errors.map((e) => `⚠️ ${e}`).join("\n");
  return content ? `${content}\n\n${notes}` : notes;
}
