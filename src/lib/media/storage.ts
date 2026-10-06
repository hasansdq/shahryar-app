// ═══════════════════════════════════════════════════════════════
// موتور ذخیره‌سازی رسانه شهریار — نسخه ۲ (فقط سرور)
// ═══════════════════════════════════════════════════════════════
// سه قانون بنیادی این معماری:
//
// ۱) «یک مکان قطعی» — همه فایل‌ها در <ریشه‌پروژه>/storage/media
//    ذخیره می‌شوند؛ جایی خارج از public و خارج از .next/.next-prod.
//    بنابراین نه build دستی به آن‌ها می‌زند، نه ری‌استارت سرور، نه
//    کپی standalone. مسیر مطلق و پایدار در هر حالت اجرا.
//
// ۲) «تایید اتمیک درون‌درخواستی» — فایل بلافاصله پس از نوشتن،
//    توسط همان پردازشی که نوشته، از دیسک خوانده و بایت‌به‌بایت
//    مقایسه می‌شود. اگر POST موفق برگردد یعنی فایل «قطعاً» سالم
//    روی دیسک است؛ کلاینت دیگر نیازی به هیچ تایید دوم ندارد.
//    (در سیستم قبلی، تایید دومِ HEAD از مسیری جدا بود که به هر
//    دلیلی می‌توانست بشکند → خطای «فایل روی سرور تایید نشد»)
//
// ۳) «کلید، نه مسیر» — هیچ کدی مسیر مطلق نمی‌سازد؛ همه‌چیز از
//    طریق کلید استاندارد scope/سال‌جلالی-ماه/شناسه می‌گذرد که با
//    MEDIA_KEY_PATTERN اعتبارسنجی می‌شود (ضامن ساختاری ضد
//    path traversal).
// ═══════════════════════════════════════════════════════════════

import { mkdir, writeFile, stat, open, unlink, readdir } from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  EXT_BY_MIME,
  MEDIA_KEY_PATTERN,
  SCOPE_CONFIGS,
  LEGACY_DIR_BY_SCOPE,
  type MediaScope,
} from "./config";
import { fileUrl } from "./url";
import { isDirWritable, runtimeDataDir, copyTree } from "@/lib/core/runtime";
import { uploadUrlToDiskPaths } from "@/lib/core/uploads";

// ─── یافتن ریشه پایدار پروژه ───
// در dev ، cwd = ریشه پروژه است؛ اما در اجرای standalone ،
// cwd = <ریشه>/.next-prod/standalone می‌شود. نکته ظریف: Next.js هنگام
// build پوشه‌های prisma و db را داخل standalone هم کپی می‌کند، پس
// «وجود package.json + prisma» به‌تنهایی ریشه را مشخص نمی‌کند.
// راه‌حل قطعی: از cwd تا ریشه فایل‌سیستم همه‌ی کاندیداها را جمع می‌کنیم
// و «بالاترین» (سطحی‌ترین) کاندیدا را برمی‌گردانیم — چون پوشه standalone
// همیشه تودرتو داخل ریشه واقعی پروژه است. اگر استقرار فقط از خود
// standalone باشد (بدون پروژه والد)، همان تنها کاندیدا انتخاب می‌شود.
function findProjectRoot(): string {
  let dir = process.cwd();
  let best: string | null = null;

  for (let i = 0; i < 10; i++) {
    if (
      existsSync(path.join(dir, "package.json")) &&
      existsSync(path.join(dir, "prisma"))
    ) {
      best = dir; // ادامه بده — کاندیدای بالاتر شاید وجود داشته باشد
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return best || process.cwd(); // هیچ کاندیدا نبود → cwd
}

/** ریشه مطلق ذخیره‌سازی رسانه — یک‌بار محاسبه و کش می‌شود */
export function mediaRoot(): string {
  const g = globalThis as { __shahryarMediaRoot?: string };
  if (g.__shahryarMediaRoot) return g.__shahryarMediaRoot;

  let root =
    process.env.MEDIA_DIR?.trim() ||
    path.join(findProjectRoot(), "storage", "media");

  // ─── لایه‌ی اجرایی قابل‌نوشتن برای بسته‌های فقط‌خواندنی ───
  // در دیپلوی ابری (space-z / FC) پوشه‌ی کد فقط‌خواندنی است؛ آپلود
  // باید در مسیر قابل‌نوشتن (tmpdir) بنشیند. رسانه‌های موجود بسته
  // یک‌بار به همان‌جا کپی می‌شوند تا فایل‌های قبلی هم سرو شوند و
  // آپلودهای جدید هم بدون خطا ذخیره شوند. در dev / محیط عادی writable
  // این شاخه هرگز فعال نمی‌شود.
  try {
    if (!existsSync(root)) mkdirSync(root, { recursive: true });
  } catch {
    // شاید والدش فقط‌خواندنی است — با تست writability ادامه می‌دهیم
  }
  try {
    if (!isDirWritable(root)) {
      const overlay = path.join(runtimeDataDir(), "storage", "media");
      mkdirSync(overlay, { recursive: true });
      if (existsSync(root)) {
        const n = copyTree(root, overlay, false);
        console.log(
          `[media] بسته فقط‌خواندنی است — ${n} رسانه به ${overlay} کپی شد`
        );
      }
      root = overlay;
    }
  } catch (err) {
    console.error("[media] خطا در آماده‌سازی ریشه ذخیره‌سازی:", err);
  }

  g.__shahryarMediaRoot = root;
  return root;
}

// ─── تبدیل کلید ↔ مسیر مطلق (ایمن) ───

/**
 * کلید استاندارد → مسیر مطلق روی دیسک.
 * فقط و فقط کلیدهای منطبق بر MEDIA_KEY_PATTERN پذیرفته می‌شوند؛
 * همین یک خط، کل سطح حمله path traversal را می‌بندد.
 */
export function keyToAbsPath(key: string): string | null {
  if (!MEDIA_KEY_PATTERN.test(key)) return null;
  const parts = key.split("/");
  return path.join(mediaRoot(), parts[0], parts[1], parts[2]);
}

/** اعتبارسنجی کلید بدون دسترسی به دیسک */
export function isValidMediaKey(key: string): boolean {
  return MEDIA_KEY_PATTERN.test(key);
}

/**
 * حل کامل کلید → مسیر مطلق موجود روی دیسک.
 * ۱) ریشه کانونی (storage/media)
 * ۲) ریشه‌های آپلود قدیمی (public/uploads و کاندیداهای standalone) —
 *    فایل‌های endpoint /api/uploads نیز سرو می‌شوند تا URL کانونی
 *    /files/... برای همه فایل‌های واقعی موجود کار کند.
 *
 * ⚠️ نکته حیاتی: نام پوشه قدیمی برای برخی scopeها «جمع» بود
 * (avatars/businesses/posts) — probing با نام scope جدید هرگز فایل‌های
 * قدیمی را پیدا نمی‌کرد؛ نگاشت LEGACY_DIR_BY_SCOPE این شکاف را می‌بندد.
 */
export function resolveMediaAbsPath(key: string): string | null {
  if (!MEDIA_KEY_PATTERN.test(key)) return null;
  const parts = key.split("/");
  const abs = path.join(mediaRoot(), parts[0], parts[1], parts[2]);
  if (existsSync(abs)) return abs;
  // probing ریشه‌های قدیمی — با هر دو نام پوشه (قدیمی جمع + scope جدید)
  const scope = parts[0] as MediaScope;
  const legacyDir = LEGACY_DIR_BY_SCOPE[scope];
  const month = parts[1];
  const file = parts[2];
  for (const dir of legacyDir && legacyDir !== scope ? [legacyDir, scope] : [scope]) {
    for (const p of uploadUrlToDiskPaths(`/uploads/${dir}/${month}/${file}`)) {
      if (existsSync(p)) return p;
    }
  }
  return null;
}

// ─── پوشه ماهانه جلالی ───

/** سال‌-ماه جلالی به فرمت استاندارد ۱۴۰۵-۰۶ (به وقت رفسنجان) */
export function jalaliMonthFolder(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-u-ca-persian", {
    year: "numeric",
    month: "numeric",
    timeZone: "Asia/Tehran",
  }).formatToParts(date);
  const y = parseInt((parts.find((p) => p.type === "year")?.value || "1404").replace(/\D/g, "")) || 1404;
  const m = parseInt((parts.find((p) => p.type === "month")?.value || "1").replace(/\D/g, "")) || 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

// ─── نوع نتیجه ذخیره ───

export interface SavedMedia {
  /** کلید استاندارد: scope/سال‌جلالی-ماه/شناسه.پسوند */
  key: string;
  /** URL عمومی جدید: /files/scope/سال‌جلالی-ماه/شناسه.پسوند */
  url: string;
  absolutePath: string;
  fileName: string;
  originalName: string;
  size: number;
  mime: string;
  scope: MediaScope;
}

// ─── ذخیره با تایید اتمیک ───

/**
 * ذخیره امن فایل + تایید اتمیک درون‌درخواستی.
 *
 * مراحل: اعتبارسنجی → ساخت کلید یکتا → نوشتن → «خواندن دوباره از
 * دیسک و مقایسه بایت‌ها» → خروجی. اگر هر مرحله شکست بخورد، استثنا
 * پرتاب می‌شود و کلاینت خطای صریح می‌گیرد — هرگز URL فایلِ ناموجود
 * تولید نمی‌شود.
 */
export async function saveMediaFile(params: {
  scope: MediaScope;
  buffer: Buffer;
  mime: string;
  originalName: string;
}): Promise<SavedMedia> {
  const { scope, buffer, mime, originalName } = params;
  const cfg = SCOPE_CONFIGS[scope];
  if (!cfg) throw new Error("بخش آپلود نامعتبر است");
  if (!buffer || buffer.length === 0) throw new Error("فایل خالی است");

  // ─── حفظ پسوند اصلی فایل‌های متنی/کد ───
  // مرورگر برای .py/.md/.sql/... اغلب «text/plain» می‌فرستد؛ اگر
  // EXT_BY_MIME مستقیم اعمال شود، همه به .txt تبدیل می‌شوند و پسوند
  // اصلی (برای دانلود و تشخیص زبان) از دست می‌رود. قاعده: برای
  // mimeهای متنی، پسوندِ امنِ نام اصلی فایل مقدم است.
  const rawOrigExt = path
    .extname(originalName || "")
    .toLowerCase()
    .replace(".", "");
  const safeOrigExt = /^[a-z0-9]{1,8}$/.test(rawOrigExt) ? rawOrigExt : "";
  const isTextyMime =
    mime.startsWith("text/") || ["application/json", "application/xml", "application/javascript"].includes(mime);

  const ext =
    safeOrigExt && isTextyMime
      ? safeOrigExt
      : EXT_BY_MIME[mime] ||
        ((): string => {
          return safeOrigExt || "bin";
        })();

  const id = `${Date.now().toString(36)}${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const fileName = `${id}.${ext}`;
  const key = `${scope}/${jalaliMonthFolder()}/${fileName}`;

  const absPath = keyToAbsPath(key);
  if (!absPath) throw new Error("کلید فایل نامعتبر است");

  const absDir = path.dirname(absPath);
  await mkdir(absDir, { recursive: true });

  // نوشتن با flush کامل
  await writeFile(absPath, buffer, { flag: "wx" }); // wx: اگر تصادفاً وجود داشت، خطا بده

  // ⚡ تایید اتمیک: همان پردازه، همان لحظه، از دیسک می‌خواند
  try {
    const s = await stat(absPath);
    if (!s.isFile()) throw new Error("فایل معمولی نیست");
    if (s.size !== buffer.length) {
      throw new Error(`ناقص نوشته شد (${s.size} از ${buffer.length} بایت)`);
    }
    // خواندن آغاز فایل از دیسک و مقایسه بایت‌به‌بایت با حافظه
    const fh = await open(absPath, "r");
    try {
      const probeLen = Math.min(512, buffer.length);
      const probe = Buffer.alloc(probeLen);
      await fh.read(probe, 0, probeLen, 0);
      if (!probe.equals(buffer.subarray(0, probeLen))) {
        throw new Error("محتوای فایل روی دیسک با مبدأ مغایرت دارد");
      }
    } finally {
      await fh.close();
    }
  } catch (err) {
    // هر شکستی در تایید → پاک کردن فایل ناقص و پرتاب خطا
    try {
      await unlink(absPath);
    } catch {
      /* بهترین تلاش */
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[media] تایید اتمیک نوشتن شکست خورد:", key, msg);
    throw new Error("فایل به‌صورت کامل و سالم روی سرور ثبت نشد؛ دوباره تلاش کنید");
  }

  return {
    key,
    url: fileUrl(key),
    absolutePath: absPath,
    fileName,
    originalName: originalName.slice(0, 200),
    size: buffer.length,
    mime,
    scope,
  };
}

// ─── خواندن و وضعیت فایل ───

export interface MediaFileStat {
  absPath: string;
  size: number;
  mtimeMs: number;
}

/** وضعیت فایل روی دیسک (بدون خواندن محتوا) — null یعنی وجود ندارد */
export async function statMediaFile(key: string): Promise<MediaFileStat | null> {
  // اول ریشه کانونی (سریع) — سپس ریشه‌های آپلود قدیمی (fallback سازگاری)
  const canonical = keyToAbsPath(key);
  if (canonical) {
    try {
      const s = await stat(canonical);
      if (s.isFile() && s.size > 0) return { absPath: canonical, size: s.size, mtimeMs: s.mtimeMs };
    } catch {}
  }
  // probing با هر دو نام پوشه قدیمی (جمع) و scope جدید — مثل resolveMediaAbsPath
  if (MEDIA_KEY_PATTERN.test(key)) {
    const parts = key.split("/");
    const scope = parts[0] as MediaScope;
    const legacyDir = LEGACY_DIR_BY_SCOPE[scope];
    const month = parts[1];
    const file = parts[2];
    for (const dir of legacyDir && legacyDir !== scope ? [legacyDir, scope] : [scope]) {
      for (const p of uploadUrlToDiskPaths(`/uploads/${dir}/${month}/${file}`)) {
        try {
          const s = await stat(p);
          if (s.isFile() && s.size > 0) return { absPath: p, size: s.size, mtimeMs: s.mtimeMs };
        } catch {}
      }
    }
  }
  return null;
}

/** حذف فایل — برای پاکسازی‌های مدیریتی */
export async function deleteMediaFile(key: string): Promise<boolean> {
  const absPath = keyToAbsPath(key);
  if (!absPath) return false;
  try {
    await unlink(absPath);
    return true;
  } catch {
    return false;
  }
}

/** شمارش فایل‌ها (برای health check) — سطح‌بندی سبک */
export async function countMediaFiles(): Promise<number> {
  let count = 0;
  const root = mediaRoot();
  try {
    for (const scope of await readdir(root, { withFileTypes: true })) {
      if (!scope.isDirectory()) continue;
      const monthDir = path.join(root, scope.name);
      for (const month of await readdir(monthDir, { withFileTypes: true })) {
        if (!month.isDirectory()) continue;
        const files = await readdir(path.join(monthDir, month.name));
        count += files.length;
      }
    }
  } catch {
    /* پوشه‌ای نبود — صفر */
  }
  return count;
}
