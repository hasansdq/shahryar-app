// ═════ موتور آپلود یکپارچه شهریار ═════
// سیستم مرکزی مدیریت فایل برای تمام بخش‌های سامانه:
// پیوست چت هوشیار، تصویر پروفایل، گالری اصناف، تصاویر دانش شهری
//
// ساختار پوشه‌ها:
// public/uploads/{scope}/{jalaliYear}-{jalaliMonth}/{uuid}.{ext}
// مثال: public/uploads/chat/1405-05/a1b2c3d4e5.jpg
//
// فایل‌ها داخل public ذخیره می‌شوند تا مستقیماً و بدون API اضافه
// به‌صورت استاتیک سریع سرو شوند — بدون تاخیر، بدون 404

import { mkdir, writeFile, stat, access } from "fs/promises";
import { constants, existsSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";

// ═════ ریشه‌های کاندیدای ذخیره‌سازی ═════
// سامانه باید در هر حالت اجرا (dev / next start / standalone) مسیر درست را پیدا کند:
//  ۱) cwd/public/uploads — حالت dev و اجرای start از ریشه پروژه
//  ۲) cwd/.next*/standalone/public/uploads — حالت standalone (هر دو پوشه build)
//  ۳) بالا رفتن تا ۴ سطح از cwd برای یافتن public/uploads
function candidateUploadRoots(): string[] {
  const roots: string[] = [];
  const add = (p: string) => {
    if (!roots.includes(p)) roots.push(p);
  };
  const cwd = process.cwd();
  add(path.resolve(cwd, "public", "uploads"));
  add(path.resolve(cwd, ".next", "standalone", "public", "uploads"));
  add(path.resolve(cwd, ".next-prod", "standalone", "public", "uploads"));
  let dir = cwd;
  for (let i = 0; i < 4; i++) {
    add(path.resolve(dir, "public", "uploads"));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return roots;
}

/** ریشه قابل‌نوشتن اصلی — همان جایی که فایل‌های جدید ذخیره می‌شوند */
function writableUploadRoot(): string {
  const roots = candidateUploadRoots();
  // اولین ریشه‌ای که پوشه‌اش (public) واقعاً وجود دارد
  for (const r of roots) {
    // پوشه‌های standalone فقط fallback خواندن‌اند — نوشتن در آن‌ها یعنی
    // گم‌شدن فایل پس از build بعدی؛ ریشه کانونی واقعی همیشه پیدا می‌شود
    if (/(^|[\\/])\.next(-prod)?[\\/]standalone[\\/]/.test(r)) continue;
    const publicDir = path.dirname(r);
    if (existsSync(publicDir)) return r;
  }
  return roots[0];
}

/** تبدیل URL عمومی به مسیرهای مطلق کاندیدا روی دیسک (ایمن در برابر پیمایش مسیر) */
export function uploadUrlToDiskPaths(url: string): string[] {
  if (!isInternalUploadUrl(url)) return [];
  const rel = url.slice("/uploads/".length);
  const parts = rel.split("/");
  if (parts.length !== 3 || parts.some((p) => !p || p === "." || p === ".." || p.includes("\\") || /[\/\u0000]/.test(p))) {
    return [];
  }
  return candidateUploadRoots().map((root) => path.join(root, ...parts));
}

export type UploadScope = "chat" | "avatar" | "business" | "city" | "misc" | "post";

interface ScopeConfig {
  dir: string;
  maxBytes: number;
  allowed: RegExp;
  label: string;
}

const SCOPE_CONFIGS: Record<UploadScope, ScopeConfig> = {
  chat: {
    dir: "chat",
    maxBytes: 10 * 1024 * 1024, // ۱۰ مگابایت
    allowed: /^(image\/(png|jpe?g|webp|gif|avif)|application\/pdf|text\/plain|text\/csv|application\/msword|application\/vnd\.(openxmlformats-officedocument\.(wordprocessingml(\.document)?|presentationml(\.presentation)?|spreadsheetml(\.sheet)?)|ms-excel|ms-powerpoint|oasis\.opendocument\.spreadsheet)|application\/zip|application\/x-rar-compressed)$/,
    label: "پیوست گفتگو",
  },
  avatar: {
    dir: "avatars",
    maxBytes: 3 * 1024 * 1024, // ۳ مگابایت
    allowed: /^image\/(png|jpe?g|webp|gif|avif)$/,
    label: "تصویر پروفایل",
  },
  business: {
    dir: "businesses",
    maxBytes: 6 * 1024 * 1024, // ۶ مگابایت
    allowed: /^image\/(png|jpe?g|webp|gif|avif)$/,
    label: "تصویر کسب‌وکار",
  },
  city: {
    dir: "city",
    maxBytes: 6 * 1024 * 1024,
    allowed: /^image\/(png|jpe?g|webp|gif|avif)$/,
    label: "تصویر دانش شهری",
  },
  misc: {
    dir: "misc",
    maxBytes: 6 * 1024 * 1024,
    allowed: /^(image\/(png|jpe?g|webp|gif|avif)|application\/pdf)$/,
    label: "فایل عمومی",
  },
  // پیوست پست فید — چندرسانه‌ای کامل: تصویر، ویدیو، صوت و فایل‌های عمومی
  post: {
    dir: "posts",
    maxBytes: 30 * 1024 * 1024, // ۳۰ مگابایت — ویدیو/صوت سبک شبکه اجتماعی
    allowed: /^image\/(png|jpe?g|webp|gif|avif)$|^video\/(mp4|webm|quicktime|x-matroska|ogg)$|^audio\/(mpeg|mp3|mp4|wav|wave|x-wav|webm|ogg|aac|flac|x-m4a|m4a|mpga)$|^application\/(pdf|zip|x-rar-compressed|msword|vnd\.(openxmlformats-officedocument\.(wordprocessingml(\.document)?|presentationml(\.presentation)?|spreadsheetml(\.sheet)?)|ms-excel|ms-powerpoint)|vnd\.oasis\.opendocument\.(spreadsheet|text|presentation))$|^text\/(plain|csv)$/,
    label: "پیوست پست شهریار",
  },
};

/**
 * پسوند امن — «فقط» از نگاشت مجاز mime→ext مشتق می‌شود.
 *
 * ⚠️ امنیتی: هرگز پسوند از نام فایل اصلی (کنترل‌شده توسط کاربر) گرفته
 * نمی‌شود — در غیر این صورت فایل evil.html با mime مجاز به‌صورت
 * .html در public/ ذخیره و همان‌مبدأ به‌صورت text/html رندر می‌شود
 * (XSS ذخیره‌شده هم‌مبدأ → ربودن سشن). mime بدون نگاشت → bin.
 */
function safeExtension(mime: string): string {
  const mimeExt: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
    "application/pdf": "pdf",
    "text/plain": "txt",
    "text/csv": "csv",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    // واریانت‌های بدون .document که regex مجاز scopes قبول می‌کنند
    "application/vnd.openxmlformats-officedocument.wordprocessingml": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml": "xlsx",
    "application/vnd.oasis.opendocument.spreadsheet": "ods",
    "application/vnd.oasis.opendocument.text": "odt",
    "application/vnd.oasis.opendocument.presentation": "odp",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/vnd.openxmlformats-officedocument.presentationml": "pptx",
    "application/zip": "zip",
    "application/x-rar-compressed": "rar",
    "application/x-rar": "rar",
    // ─── چندرسانه‌ای پیوست پست ───
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "video/x-matroska": "mkv",
    "video/ogg": "ogv",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "m4a",
    "audio/mpeg3": "mp3",
    "audio/x-mpeg-3": "mp3",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/x-wav": "wav",
    "audio/webm": "weba",
    "audio/ogg": "ogg",
    "audio/aac": "aac",
    "audio/flac": "flac",
    "audio/x-m4a": "m4a",
    "audio/m4a": "m4a",
    "audio/mpga": "mp3",
  };
  const ext = mimeExt[mime];
  // دفاع عمیق: پسوند نتیجه باید در فهرست امن باشد (هرگز html/svg/js/xml)
  const SAFE_EXT = new Set([
    "png", "jpg", "jpeg", "webp", "gif", "avif", "pdf", "txt", "csv",
    "doc", "docx", "xls", "xlsx", "ods", "odt", "odp", "ppt", "pptx",
    "zip", "rar", "mp4", "webm", "mov", "mkv", "ogv", "mp3", "m4a",
    "wav", "weba", "ogg", "aac", "flac", "bin",
  ]);
  return ext && SAFE_EXT.has(ext) ? ext : "bin";
}

/** پوشه ماهانه بر اساس تاریخ جلالی — برای دسته‌بندی منطقی فایل‌ها (۱۴۰۵-۰۶) */
function monthlyFolderJalali(): string {
  const parts = new Intl.DateTimeFormat("en-u-ca-persian", {
    year: "numeric",
    month: "numeric",
    timeZone: "Asia/Tehran",
  }).formatToParts(new Date());
  const yearPart = parts.find((p) => p.type === "year")?.value || "1404";
  const monthPart = parts.find((p) => p.type === "month")?.value || "1";
  const jy = parseInt(yearPart.replace(/\D/g, "")) || 1404;
  const jm = parseInt(monthPart.replace(/\D/g, "")) || 1;
  return `${jy}-${String(jm).padStart(2, "0")}`;
}

export interface SavedUpload {
  url: string; // URL عمومی: /uploads/chat/1405-05/uuid.jpg
  absolutePath: string;
  fileName: string;
  size: number;
  mime: string;
  scope: UploadScope;
}

/** اعتبارسنجی اینکه URL آپلود از سیستم خودمان است (جلوگیری از URL جعلی) */
export function isInternalUploadUrl(url: string): boolean {
  return typeof url === "string" && /^\/uploads\/(chat|avatars|businesses|city|misc|posts)\/\d{1,4}-\d{1,4}\/[A-Za-z0-9._-]+$/.test(url);
}

/**
 * ⚡ تایید وجود واقعی فایل روی دیسک برای یک URL عمومی
 * این تابع ضامن «بدون 404» است: هیچ URL‌ای که فایلش وجود نداشته باشد
 * وارد دیتابیس یا رابط کاربری نمی‌شود.
 */
export async function verifyUploadUrl(url: string): Promise<{
  exists: boolean;
  absolutePath?: string;
  size?: number;
  error?: string;
}> {
  if (!isInternalUploadUrl(url)) return { exists: false, error: "آدرس فایل نامعتبر است" };
  for (const abs of uploadUrlToDiskPaths(url)) {
    try {
      const s = await stat(abs);
      if (s.isFile() && s.size > 0) return { exists: true, absolutePath: abs, size: s.size };
    } catch {
      /* مسیر بعدی */
    }
  }
  return { exists: false, error: "فایل روی سرور یافت نشد" };
}

/**
 * فیلتر URL به URLهای تاییدشده — یعنی فایل واقعاً روی دیسک وجود دارد.
 * برای استفاده در همه APIهایی که URL تصویر ذخیره می‌کنند:
 * هیچ URL شکسته (404) دیگر وارد دیتابیس نمی‌شود.
 */
export async function filterVerifiedUploadUrl(url: string | null | undefined): Promise<string | null> {
  if (!url || !isInternalUploadUrl(url)) return null;
  const v = await verifyUploadUrl(url);
  return v.exists ? url : null;
}

/** سری‌سازی گالری تصاویر با تایید وجود همه فایل‌ها روی دیسک */
export async function serializeVerifiedGallery(gallery: unknown, maxItems = 12): Promise<string | null> {
  if (!Array.isArray(gallery)) return null;
  const items: Array<{ url: string; name: string }> = [];
  for (const g of gallery.slice(0, maxItems)) {
    if (!g || typeof g !== "object") continue;
    const url = (g as { url?: unknown }).url;
    if (typeof url !== "string") continue;
    const verified = await filterVerifiedUploadUrl(url);
    if (verified) items.push({ url: verified, name: String((g as { name?: unknown }).name || "تصویر").slice(0, 120) });
  }
  return items.length ? JSON.stringify(items) : null;
}

/** نقشه پسوند → mime برای سرو صحیح فایل‌ها */
export const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  txt: "text/plain; charset=utf-8",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
  rar: "application/x-rar-compressed",
  // ─── چندرسانه‌ای پیوست پست ───
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  ogv: "video/ogg",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  weba: "audio/webm",
  ogg: "audio/ogg",
  aac: "audio/aac",
  flac: "audio/flac",
  bin: "application/octet-stream",
};

export interface UploadValidation {
  valid: boolean;
  error?: string;
}

export const UPLOAD_LIMITS = {
  chat: 10 * 1024 * 1024,
  avatar: 3 * 1024 * 1024,
  business: 6 * 1024 * 1024,
  city: 6 * 1024 * 1024,
  misc: 6 * 1024 * 1024,
  post: 30 * 1024 * 1024,
} as const;

/** الگوی فایل مجاز برای هر بخش — برای اعتبارسنجی سمت کلاینت */
export const UPLOAD_ALLOWED_HINT: Record<string, string> = {
  chat: "تصویر، PDF، Word، Excel یا ZIP",
  avatar: "PNG، JPG، WebP یا GIF",
  business: "PNG، JPG، WebP یا GIF",
  city: "PNG، JPG، WebP یا GIF",
  misc: "تصویر یا PDF",
  post: "تصویر، ویدیو، صوت، PDF یا فایل آفیس",
};

/** نوع مؤثر آپلود — برای type خالی/octet-stream از پسوند نام فایل استنتاج می‌شود */
function effectiveUploadMime(file: { type: string; name?: string }): string {
  if (file.type && file.type !== "application/octet-stream") return file.type;
  const ext = (file.name || "").toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || "";
  const inferred = ext ? MIME_BY_EXT[ext]?.split(";")[0].trim() : null;
  return inferred || file.type;
}

export function validateUpload(file: { size: number; type: string; name?: string }, scope: UploadScope): UploadValidation {
  const cfg = SCOPE_CONFIGS[scope];
  if (!cfg) return { valid: false, error: "بخش آپلود نامعتبر است" };
  if (file.size === 0) return { valid: false, error: "فایل خالی است" };
  if (file.size > cfg.maxBytes) {
    const maxMB = Math.round(cfg.maxBytes / (1024 * 1024));
    return { valid: false, error: `حجم فایل بیشتر از ${maxMB} مگابایت مجاز نیست` };
  }
  // نوع مؤثر: مرورگر برای برخی پسوندها (.mov/.mkv/.flac/…) type خالی یا
  // octet-stream می‌فرستد → استنتاج از پسوند نام فایل (هم‌راستا با media/config)
  if (!cfg.allowed.test(effectiveUploadMime(file))) {
    return {
      valid: false,
      error:
        scope === "avatar" || scope === "business" || scope === "city"
          ? "فقط فایل‌های تصویری (PNG، JPG، WebP) مجاز هستند"
          : scope === "post"
            ? "نوع فایل مجاز نیست (تصویر، ویدیو، صوت، PDF یا فایل آفیس بفرستید)"
            : "نوع فایل مجاز نیست (تصویر، PDF، Word، Excel یا ZIP بفرستید)",
    };
  }
  return { valid: true };
}

/**
 * ذخیره امن فایل با ساختار پوشه‌ای دسته‌بندی‌شده
 * خروجی: URL عمومی دقیق برای لود مستقیم در UI
 */
export async function saveUpload(file: File, scope: UploadScope): Promise<SavedUpload> {
  const cfg = SCOPE_CONFIGS[scope];
  const monthFolder = monthlyFolderJalali();
  // پسوند فقط از mime whitelist — نام اصلی فایل هرگز ملاک نیست (رفع XSS)؛
  // برای type خالی/octet-stream از پسوند نام فایل استنتاج می‌شود
  const ext = safeExtension(effectiveUploadMime(file));
  const fileName = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}.${ext}`;

  // ریشه قابل‌نوشتن کانونی — در همه حالت‌های اجرا سازگار (dev/start/standalone)
  const absDir = path.join(writableUploadRoot(), cfg.dir, monthFolder);

  await mkdir(absDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  const absPath = path.join(absDir, fileName);
  await writeFile(absPath, buffer);

  // اطمینان از نوشته‌شدن فایل (پیشگیری از 404)
  try {
    await access(absPath, constants.F_OK);
    const s = await stat(absPath);
    if (s.size === 0) throw new Error("فایل خالی نوشته شد");
    if (s.size !== file.size) throw new Error(`ناقص نوشته شد (${s.size}/${file.size})`);
  } catch (err) {
    console.error("خطای تایید نوشتن فایل:", err);
    throw new Error("خطا در ذخیره فایل؛ دوباره تلاش کنید");
  }

  // URL عمومی — با اسلش‌های استاندارد وب (نه ویندوز)
  const publicUrl = `/uploads/${cfg.dir}/${monthFolder}/${fileName}`;

  return {
    url: publicUrl,
    absolutePath: absPath,
    fileName,
    size: file.size,
    mime: file.type,
    scope,
  };
}

export function scopeLabel(scope: UploadScope): string {
  return SCOPE_CONFIGS[scope]?.label || "فایل";
}

export function maxScopeSize(scope: UploadScope): number {
  return SCOPE_CONFIGS[scope]?.maxBytes || 5 * 1024 * 1024;
}

export { SCOPE_CONFIGS };
