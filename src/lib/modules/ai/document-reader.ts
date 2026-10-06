// ═══════════════════════════════════════════════════════════════
// موتور خواندن اسناد هوشیار — Document Intelligence Pipeline
// ═══════════════════════════════════════════════════════════════
// معماری سه‌مرحله‌ای (از دید مهندسی پرامپت):
//
//  ۱) استخراج (Extraction) — به تفکیک نوع فایل:
//     • تصویر (png/jpg/webp/gif/avif) → مدل بینایی GLM-4.6V؛
//       OCR کامل متن‌های داخل تصویر + توصیف ساختاریافته
//     • PDF → ابتدا استخراج لایه متنی (pdf-parse؛ سریع و دقیق)؛
//       اگر متنِ سالم کافی نبود (PDF اسکن‌شده یا فونت خراب) →
//       مدل بینایی خودِ سند را می‌خواند (file_url؛ دقت بالا)
//     • DOCX → mammoth (متن خام با حفظ ساختار پاراگراف‌ها)
//     • XLSX/XLS → برگه‌به‌برگه به فرم CSV خوانا (با نام شیت)
//     • متن/کد (txt, md, csv, json, html, کدها) → خواندن مستقیم
//     • فرمت‌های غیرقابل‌خواندن (zip/rar/doc قدیمی/ppt) → پاسخ شفاف
//
//  ۲) بودجه‌بندی (Budgeting) — مدیریت پنجره متن:
//     • سقف کاراکتر به‌ازای هر سند؛ برش هوشمند «ابتدا ۶۰٪ + انتها ۴۰٪»
//       چون ابتدای سند معمولاً عنوان/چکیده و انتهای آن نتیجه‌گیری است
//     • ثبت دقیق wasTruncated و fullLength برای شفافیت به مدل
//
//  ۳) کش (Caching) — جدول DocumentExtraction:
//     • استخراج هر فایل یک‌بار انجام می‌شود (با mediaUrl یکتا)
//     • پیگیری‌های بعدی («بخش دومش را توضیح بده») از کش می‌خوانند
//     • فایل تغییریافته (size متفاوت) به‌روزرسانی می‌شود
// ═══════════════════════════════════════════════════════════════
import { readFileSync, existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { db } from "@/lib/db";
import { keyToAbsPath, isValidMediaKey } from "@/lib/media/storage";
import { parseMediaUrl } from "@/lib/media/url";
import { uploadUrlToDiskPaths } from "@/lib/core/uploads";
import { visionCompletion } from "./zai";

// ═══ لنگر require زمان-اجرا ═══
// این پکیج‌ها (pdf-parse/mammoth/xlsx) عمداً bundle نمی‌شوند — pdfjs-dist
// داخل pdf-parse فقط در محیط خام Node/Bun سالم اجرا می‌شود. لنگرِ
// «ریشه‌ی اپ» (cwd) در همه‌ی حالت‌ها درست کار می‌کند:
//   dev: cwd = ریشه پروژه → node_modules پروژه
//   standalone: cwd = ریشه بسته (next-service-dist) → node_modules بسته
// (import.meta.url پس از bundle شدن قابل‌اتکا نیست)
const nodeRequire = createRequire(path.join(process.cwd(), "package.json"));

// ─── بودجه‌های متنی (کاراکتر) ───
const MAX_CHARS_PER_DOC = 20000; // ≈ ۵-۶ هزار توکن فارسی — سقف هر سند
const HEAD_RATIO = 0.6; // سهم ابتدای سند هنگام برش

// ─── تشخیص نوع سند ───
type DocKind = "image" | "pdf" | "docx" | "sheet" | "text" | "code" | "unsupported";

// پسوندهای قابل‌خواندن متنی (متن + کد + داده) — هماهنگ با CODE_EXTS
const TEXTUAL_EXT_RE =
  /\.(txt|md|mdx|markdown|csv|tsv|json|xml|html?|htm|log|yml|yaml|toml|ini|cfg|conf|env|properties|js|jsx|mjs|cjs|ts|tsx|css|scss|sass|less|styl|vue|svelte|astro|py|pyw|ipynb|rb|go|rs|zig|java|kt|kts|scala|groovy|gradle|c|h|cpp|cc|cxx|hpp|hh|cs|m|mm|swift|dart|php|pl|pm|lua|ex|exs|erl|hs|ml|clj|elm|v|sh|bash|zsh|fish|bat|cmd|ps1|psm1|mk|sql|graphql|gql|prisma|hcl|tf|proto|http|rst|adoc|tex|editorconfig|gitignore|dockerfile|makefile)$/i;

// نام فارسی زبان‌های برنامه‌نویسی — برای برچسب‌گذاری در پرامپت
const LANG_NAMES: Record<string, string> = {
  js: "JavaScript", jsx: "React JSX", mjs: "JavaScript (ESM)", cjs: "CommonJS",
  ts: "TypeScript", tsx: "React TSX", vue: "Vue", svelte: "Svelte", astro: "Astro",
  html: "HTML", htm: "HTML", css: "CSS", scss: "SCSS", sass: "SASS", less: "Less", styl: "Stylus",
  py: "Python", pyw: "Python", ipynb: "Jupyter Notebook", r: "R", jl: "Julia",
  java: "Java", kt: "Kotlin", kts: "Kotlin", scala: "Scala", groovy: "Groovy", gradle: "Gradle",
  c: "C", h: "C Header", cpp: "C++", cc: "C++", cxx: "C++", hpp: "C++ Header", hh: "C++ Header",
  cs: "C#", m: "Objective-C", mm: "Objective-C++", swift: "Swift", dart: "Dart",
  go: "Go", rs: "Rust", zig: "Zig", rb: "Ruby", php: "PHP", pl: "Perl", pm: "Perl",
  lua: "Lua", ex: "Elixir", exs: "Elixir", erl: "Erlang", hs: "Haskell", ml: "OCaml",
  clj: "Clojure", elm: "Elm", v: "V",
  sh: "Shell", bash: "Bash", zsh: "Zsh", fish: "Fish", bat: "Batch", cmd: "Batch",
  ps1: "PowerShell", psm1: "PowerShell", mk: "Makefile",
  sql: "SQL", graphql: "GraphQL", gql: "GraphQL", prisma: "Prisma Schema",
  hcl: "HCL", tf: "Terraform", proto: "Protocol Buffers", http: "HTTP",
  json: "JSON", xml: "XML", yml: "YAML", yaml: "YAML", toml: "TOML",
  ini: "INI", cfg: "Config", conf: "Config", env: "Environment", properties: "Properties",
  md: "Markdown", mdx: "MDX", rst: "reStructuredText", adoc: "AsciiDoc", tex: "LaTeX",
  csv: "CSV", tsv: "TSV", log: "Log", dockerfile: "Dockerfile", makefile: "Makefile",
  gitignore: "Git Ignore", editorconfig: "EditorConfig",
};

function detectKind(name: string, mime: string): DocKind {
  const ext = path.extname(name || "").toLowerCase();
  const m = (mime || "").toLowerCase();

  if (m.startsWith("image/") || /\.(png|jpe?g|webp|gif|avif)$/i.test(ext)) return "image";
  if (m === "application/pdf" || ext === ".pdf") return "pdf";
  if (m.includes("wordprocessingml") || ext === ".docx") return "docx";
  if (m.includes("spreadsheetml") || m === "application/vnd.ms-excel" || /\.(xlsx?|csv)$/i.test(ext))
    return "sheet";
  if (m.startsWith("text/") || TEXTUAL_EXT_RE.test(ext)) {
    // کد یا داده ساخت‌یافته؟ (نه متن ساده) — برای برچسب زبان
    const e = ext.slice(1);
    return e === "txt" ? "text" : "code";
  }
  return "unsupported";
}

// ─── کیفیت متن PDF ───
/**
 * سنجش سلامت متن استخراج‌شده از PDF. فونت‌های خراب یا PDFهای
 * اسکن‌شده، متنِ دارای کاراکترهای کنترلی/تهی زیاد تولید می‌کنند.
 */
function isPdfTextHealthy(text: string): boolean {
  if (text.trim().length < 80) return false;
  const bad = (text.match(/[\u0000-\u0008\u000E-\u001F\uFFFD]/g) || []).length;
  return bad / text.length < 0.05; // بیش از ۵٪ کاراکتر خراب → ناسالم
}

// ─── برش هوشمند با حفظ ساختار ───
function applyBudget(text: string): { content: string; fullLength: number; wasTruncated: boolean } {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (clean.length <= MAX_CHARS_PER_DOC) {
    return { content: clean, fullLength: clean.length, wasTruncated: false };
  }
  const headLen = Math.floor(MAX_CHARS_PER_DOC * HEAD_RATIO);
  const tailLen = MAX_CHARS_PER_DOC - headLen - 120; // جای نشانگر برش
  const head = clean.slice(0, headLen);
  const tail = clean.slice(-tailLen);
  const marker =
    "\n\n[… بخش میانی سند برای صرفه‌جویی در طول پیام حذف شد؛ " +
    `${clean.length.toLocaleString("fa-IR")} کاراکتر کامل بود؛ ابتدا و انتها حفظ شد …]\n\n`;
  return {
    content: head + marker + tail,
    fullLength: clean.length,
    wasTruncated: true,
  };
}

// ─── استخراج‌کننده‌های اختصاصی ───

/** DOCX — متن خام ساختارمند (خروجی mammoth یک Promise است — await می‌شود) */
async function extractDocxText(buf: Buffer): Promise<string> {
  const mammoth = nodeRequire("mammoth");
  const result = (await mammoth.extractRawText({ buffer: buf })) as {
    value?: string;
    messages?: Array<unknown>;
  };
  return (result?.value || "").toString();
}

/** XLSX/XLS — همه برگه‌ها به CSV خوانا */
function extractSheetText(buf: Buffer): string {
  const XLSX = nodeRequire("xlsx");
  const wb = XLSX.read(buf, { type: "buffer" });
  const parts: string[] = [];
  for (const name of wb.SheetNames as string[]) {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
    if (csv.trim()) parts.push(`── برگه «${name}» ──\n${csv}`);
  }
  return parts.join("\n\n");
}

/** تصویر → توصیف عمیق با مدل بینایی (شامل OCR متن داخل تصویر) */
async function describeImage(dataUrl: string): Promise<string | null> {
  const res = await visionCompletion(
    [
      {
        role: "system",
        content:
          "تو یک موتور تحلیل تصویر دقیق هستی. تصویر داده‌شده را «کامل» تحلیل کن و پاسخ را فقط به فارسی و فشرده بده (حداکثر ۲۵۰۰ کاراکتر) با این ساختار:\n" +
          "۱) نوع و موضوع کلی تصویر\n" +
          "۲) همه متن‌های داخل تصویر، عیناً و دقیق (OCR — شامل اعداد، تاریخ‌ها، مبالغ)\n" +
          "۳) اشیاء/اشخاص/مکان‌های قابل‌تشخیص\n" +
          "۴) رنگ‌ها، چیدمان و جزئیات بصری مهم\n" +
          "۵) هر اطلاعات قابل‌استنتاج (مثلاً نوع سند، برند، مبلغ فاکتور)\n" +
          "هیچ حدس نادرستی نزن؛ چیزی که خوانا نیست را «ناخوانا» بنویس.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "این تصویر را کامل تحلیل کن." },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    { maxTokens: 3000 }
  );
  return res?.content || null;
}

/** PDF اسکن‌شده → خوانش کامل توسط مدل بینایی */
async function readPdfByVision(dataUrl: string, name: string): Promise<string | null> {
  const res = await visionCompletion(
    [
      {
        role: "system",
        content:
          "تو یک موتور خوانش سند هستی. سند PDF داده‌شده را کامل و دقیق بخوان و محتوایش را به فارسی و ساختاریافت (با عناوین بخش‌ها) بازنویسی کن. " +
          "همه اطلاعات کلیدی را عیناً حفظ کن: تاریخ‌ها، شماره‌ها، مبالغ، نام‌ها، شناسه‌ها، بندها و جداول. " +
          "متن جدول‌ها را به شکل خوانا (هر سطر در یک خط) بیاور. چیزی که ناخواناست را صریحاً «ناخوانا» علامت بزن. حدس نزن.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: `سند «${name}» را کامل بخوان و محتوایش را ساختاریافت بازنویسی کن.` },
          { type: "file_url", file_url: { url: dataUrl } },
        ],
      },
    ],
    { maxTokens: 6000 }
  );
  return res?.content || null;
}

// ─── نتیجه‌ی استخراج ───
export interface ExtractedDocument {
  /** متن نهایی برای تزریق به پرامپت */
  content: string;
  /** روش استخراج */
  method: string;
  /** نام فایل */
  name: string;
  /** MIME */
  mime: string;
  /** طول کامل قبل از برش */
  fullLength: number;
  /** آیا برش خورده؟ */
  wasTruncated: boolean;
  /** آیا استخراج موفق بود؟ */
  ok: boolean;
}

/**
 * حل مسیر URL پیوست → مسیر مطلق فایل روی دیسک
 * ریشه کانونی (storage/media) + ریشه‌های آپلود (public/uploads و کاندیداها)
 */
function resolveMediaPath(url: string): string | null {
  const parsed = parseMediaUrl(url);
  if (!parsed || !isValidMediaKey(parsed.key)) return null;
  // ۱) ریشه کانونی جدید (storage/media)
  const abs = keyToAbsPath(parsed.key);
  if (abs && existsSync(abs)) return abs;
  // ۲) ریشه‌های آپلود — پیوست‌های چت از این مسیر ذخیره می‌شوند
  const legacyPaths = uploadUrlToDiskPaths(`/uploads/${parsed.key}`);
  for (const p of legacyPaths) {
    if (existsSync(p)) return p;
  }
  return null;
}

/** ساخت data URL از فایل برای مدل بینایی */
function toDataUrl(absPath: string, mime: string): string {
  const b64 = readFileSync(absPath).toString("base64");
  const safeMime = mime || guessMimeFromExt(absPath);
  return `data:${safeMime};base64,${b64}`;
}

function guessMimeFromExt(p: string): string {
  const ext = path.extname(p).toLowerCase();
  const map: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".avif": "image/avif",
  };
  return map[ext] || "application/octet-stream";
}

/**
 * استخراج محتوای سند «بدون کش» — هسته‌ی خط لوله
 */
async function extractFresh(absPath: string, name: string, mime: string): Promise<ExtractedDocument> {
  const kind = detectKind(name, mime);
  const buf = readFileSync(absPath);
  const base = { name, mime: mime || guessMimeFromExt(absPath) };

  const wrap = (content: string, method: string, ok = true): ExtractedDocument => {
    const budgeted = applyBudget(content);
    return { ...base, ...budgeted, method, ok };
  };

  switch (kind) {
    case "image": {
      const desc = await describeImage(toDataUrl(absPath, base.mime));
      if (desc) return wrap(desc, "image-vision");
      return wrap(
        "تصویر پیوست شد اما تحلیل آن در دسترس نبود. از کاربر بپرس چه چیزی در تصویر است یا بعداً دوباره بفرست.",
        "image-failed",
        false
      );
    }

    case "pdf": {
      // گام ۱: لایه متنی
      let text: string | null = null;
      try {
        const pdfParse = nodeRequire("pdf-parse") as (b: Buffer) => Promise<{ text?: string }>;
        const r = await pdfParse(buf);
        text = r?.text || "";
        if (!isPdfTextHealthy(text)) text = null;
      } catch (err) {
        console.error("[doc-reader] pdf-parse error:", err);
        text = null;
      }
      if (text) return wrap(text, "pdf-text");

      // گام ۲: خوانش بینایی (PDF اسکن‌شده یا فونت خراب)
      const visionText = await readPdfByVision(toDataUrl(absPath, "application/pdf"), name);
      if (visionText) return wrap(visionText, "pdf-vision");

      return wrap(
        "فایل PDF پیوست شد اما متن آن قابل استخراج نبود. از کاربر بخواه محتوای کلیدی را متنی بفرستد.",
        "pdf-failed",
        false
      );
    }

    case "docx": {
      try {
        return wrap(await extractDocxText(buf), "docx");
      } catch (err) {
        console.error("[doc-reader] mammoth error:", err);
        return wrap("فایل Word خوانده نشد.", "docx-failed", false);
      }
    }

    case "sheet": {
      try {
        return wrap(extractSheetText(buf), "xlsx");
      } catch (err) {
        console.error("[doc-reader] xlsx error:", err);
        return wrap("فایل اکسل خوانده نشد.", "xlsx-failed", false);
      }
    }

    case "text": {
      return wrap(buf.toString("utf8"), "text");
    }

    case "code": {
      // فایل کد/داده — با برچسب زبان تا مدل دقیق بداند با چه چیزی طرف است
      const ext = path.extname(name).toLowerCase().slice(1);
      const lang = LANG_NAMES[ext] || ext.toUpperCase();
      const code = buf.toString("utf8");
      const lineCount = code.split("\n").length;
      const header =
        `[فایل کد/داده — زبان: ${lang} | نام فایل: ${name} | ${lineCount.toLocaleString("en-US")} خط]\n`;
      return wrap(header + code, `code:${ext}`);
    }

    default: {
      const ext = path.extname(name).toLowerCase();
      return wrap(
        `فایل «${name}» با پسوند ${ext || "نامشخص"} پیوست شد. فرمت آن قابل خواندن مستقیم نیست ` +
          `(فرمت‌های پشتیبانی‌شده: تصویر، PDF، Word (docx)، Excel، متن و کد). ` +
          `اگر محتوای آن مهم است، از کاربر بخواه فایل را در یکی از این قالب‌ها بفرستد.`,
        "unsupported",
        false
      );
    }
  }
}

/**
 * استخراج «با کش» — API اصلی برای chat-service
 * @param url URL کانونی رسانه (/files/chat/...)
 */
export async function readAttachment(
  url: string,
  name: string,
  mime: string
): Promise<ExtractedDocument> {
  const failed: ExtractedDocument = {
    content: `فایل «${name}» روی سرور یافت نشد. از کاربر بخواه دوباره آن را پیوست کند.`,
    method: "missing",
    name,
    mime,
    fullLength: 0,
    wasTruncated: false,
    ok: false,
  };

  const absPath = resolveMediaPath(url);
  if (!absPath) return failed;

  const size = statSync(absPath).size;

  // کش معتبر؟ (فایل هم‌اندازه = همان استخراج)
  try {
    const cached = await db.documentExtraction.findUnique({ where: { mediaUrl: url } });
    if (cached && cached.sizeBytes === size) {
      return {
        content: cached.content,
        method: cached.method,
        name: cached.name,
        mime: cached.mime,
        fullLength: cached.fullLength,
        wasTruncated: cached.wasTruncated,
        ok: cached.method !== "unsupported" && !cached.method.endsWith("-failed"),
      };
    }
  } catch (err) {
    console.error("[doc-reader] خطای خواندن کش استخراج:", err);
  }

  // استخراج تازه
  const fresh = await extractFresh(absPath, name, mime);

  // ذخیره/به‌روزرسانی کش
  try {
    await db.documentExtraction.upsert({
      where: { mediaUrl: url },
      create: {
        mediaUrl: url,
        name: fresh.name,
        mime: fresh.mime,
        sizeBytes: size,
        content: fresh.content,
        method: fresh.method,
        fullLength: fresh.fullLength,
        wasTruncated: fresh.wasTruncated,
      },
      update: {
        name: fresh.name,
        mime: fresh.mime,
        sizeBytes: size,
        content: fresh.content,
        method: fresh.method,
        fullLength: fresh.fullLength,
        wasTruncated: fresh.wasTruncated,
      },
    });
  } catch (err) {
    console.error("[doc-reader] خطای ذخیره کش استخراج:", err);
  }

  return fresh;
}

/**
 * مرجع فشرده برای تاریخچه‌ی گفتگو — وقتی کاربر قبلاً فایل فرستاده و
 * الان پیگیری می‌کند، این خلاصه در تاریخچه تزریق می‌شود تا مدل
 * زمینه را از دست ندهد (بدون تزریق کامل سند دوباره).
 */
export function compactReference(name: string, mime: string, content: string, maxChars = 600): string {
  const head = content.replace(/\s+/g, " ").trim().slice(0, maxChars);
  return `${name} (${mime}): ${head}${content.length > maxChars ? "…" : ""}`;
}

/**
 * قالب‌بندی سند برای تزریق «حرفه‌ای» به پرامپت — با تگ‌های XML که
 * مرز سند را برای مدل کاملاً روشن می‌کند (ضد توهم) + متادیتای کامل
 */
export function formatDocumentForPrompt(doc: ExtractedDocument, index: number): string {
  const meta = [
    `name="${doc.name}"`,
    `type="${doc.mime}"`,
    `extraction="${doc.method}"`,
    `full-length="${doc.fullLength.toLocaleString("en-US")} chars"`,
    doc.wasTruncated ? `truncated="yes — head 60% + tail 40% kept"` : `truncated="no"`,
  ].join(" ");

  return [
    `<attached_document id="${index}" ${meta}>`,
    `<document_content>`,
    doc.content,
    `</document_content>`,
    `</attached_document>`,
  ].join("\n");
}

// ═══════════════════════════════════════════════════════════════
// API اصلی برای chat-service — آماده‌سازی پیوست برای «این نوبت» گفتگو
// ═══════════════════════════════════════════════════════════════

export interface AttachmentTurnContext {
  /** image → تصویر خام برای تزریق چندوجهی (حداکثر دقت) */
  kind: "image" | "document" | "none";
  imageDataUrl: string | null;
  /** document → بلوک system برای تزریق کنار پیام کاربر */
  documentBlock: string | null;
  /** روش استخراج (برای لاگ) */
  method: string;
  /**
   * برای تصاویر: پرامیسِ کش‌کردن توصیف (describeImage) که «موازی با
   * فراخوانی اصلی» اجرا می‌شود؛ caller بعد از پاسخ اصلی await می‌کند
   * تا کش برای پیگیری‌های بعدی ذخیره شده باشد.
   */
  cachePromise: Promise<unknown>;
}

/**
 * آماده‌سازی پیوست برای نوبت فعلی گفتگو — تصمیم مهندسی:
 *  • تصویر: مدلِ اصلی خودِ پیکسل‌ها را می‌بیند (image_url چندوجهی)
 *    و «هم‌زمان» یک توصیف ساختاریافته برای کش/پیگیری‌ها ساخته می‌شود
 *  • سند: محتوا استخراج (با کش) و به‌صورت بلوک XML تزریق می‌شود
 */
export async function prepareAttachmentForTurn(
  attachment: { url: string; name: string; mime: string }
): Promise<AttachmentTurnContext> {
  const none: AttachmentTurnContext = {
    kind: "none", imageDataUrl: null, documentBlock: null, method: "none",
    cachePromise: Promise.resolve(),
  };

  const absPath = resolveMediaPath(attachment.url);
  if (!absPath) {
    return {
      ...none,
      method: "missing",
      documentBlock: `فایل پیوست‌شده «${attachment.name}» روی سرور یافت نشد؛ از کاربر بخواه دوباره بفرستد.`,
    };
  }

  const kind = detectKind(attachment.name, attachment.mime);

  // ─── تصویر: تزریق چندوجهی + کش موازی ───
  if (kind === "image") {
    const dataUrl = toDataUrl(absPath, attachment.mime);
    // توصیف برای کش — موازی با فراخوانی اصلی چت اجرا می‌شود
    const cachePromise = readAttachment(attachment.url, attachment.name, attachment.mime)
      .catch((err) => console.error("[doc-reader] خطای کش تصویر:", err));
    return { kind: "image", imageDataUrl: dataUrl, documentBlock: null, method: "image-multimodal", cachePromise };
  }

  // ─── سند: استخراج (با کش) + بلوک XML ───
  const doc = await readAttachment(attachment.url, attachment.name, attachment.mime);
  const block = [
    `📎 سند پیوست‌شده توسط کاربر — محتوای کامل استخراج‌شده در ادامه آمده است.`,
    `این محتوا را «مبنای پاسخ» قرار بده: فقط از همین محتوا نقل‌قول دقیق بزن؛ اگر پاسخِ پرسش کاربر در سند نیست، صریحاً بگو «در سند نیست». اگر سند برش خورده (${doc.wasTruncated ? "این سند برش خورده است" : "کامل است"})، فقط از بخش موجود استفاده کن و درباره بخش حذف‌شده حدس نزن.`,
    ``,
    formatDocumentForPrompt(doc, 1),
  ].join("\n");

  return { kind: "document", imageDataUrl: null, documentBlock: block, method: doc.method, cachePromise: Promise.resolve() };
}
