// ═══════════════════════════════════════════════════════════════
// پیکربندی مرکزی سامانه رسانه شهریار — نسخه ۲ (بازطراحی کامل)
// ═══════════════════════════════════════════════════════════════
// تک‌منبع حقیقت برای همه چیز: scopeها، سقف حجم، mimeهای مجاز،
// نگاشت پسوند↔mime و ساختار کلید فایل.
//
// این ماژول «عمداً» خالص (pure) است — نه fs، نه سرور، نه کلاینت —
// تا هم API سرور و هم کد کلاینت دقیقاً از یک جدول مشترک استفاده کنند
// و دیگر هرگز دو جدول حدی (سرور/کلاینت) از هم فاصله نگیرند.
//
// ساختار کلید فایل (برای همه فایل‌ها، بدون استثنا):
//   {scope}/{سال‌جلالی}-{ماه}/{شناسه‌یکتا}.{پسوند}
//   مثال: chat/1405-06/mtc9x2k1a4b5c6d7.png
// URL عمومی متناظر:
//   /files/{scope}/{سال‌جلالی}-{ماه}/{شناسه‌یکتا}.{پسوند}
// ═══════════════════════════════════════════════════════════════

export type MediaScope = "chat" | "avatar" | "business" | "city" | "misc" | "post" | "article";

export const MEDIA_SCOPES: readonly MediaScope[] = [
  "chat",
  "avatar",
  "business",
  "city",
  "misc",
  "post",
  "article",
] as const;

export interface ScopeConfig {
  /** نام پوشه روی دیسک — دقیقاً برابر خود scope */
  dir: string;
  maxBytes: number;
  allowed: RegExp;
  label: string;
  hint: string;
}

export const SCOPE_CONFIGS: Record<MediaScope, ScopeConfig> = {
  chat: {
    dir: "chat",
    maxBytes: 10 * 1024 * 1024,
    // فقط فرمت‌هایی که موتور خواندن اسناد هوشیار پشتیبانی می‌کند
    // (تصویر → مدل بینایی | PDF → متن + بینایی | docx/xlsx/متن/کد → استخراج)
    // text/javascript و text/css برای فایل‌های کد که مرورگر نوع دقیق می‌فرستد
    allowed:
      /^(image\/(png|jpe?g|webp|gif|avif)|application\/pdf|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)|application\/vnd\.ms-excel|text\/(plain|markdown|csv|html|xml|javascript|css|x-.+)|application\/(json|xml|javascript|sql|yaml|toml|octet-stream))$/,
    label: "پیوست گفتگو",
    hint: "تصویر، PDF، Word (docx)، Excel، متن، CSV یا کد (۴۰+ زبان)",
  },
  avatar: {
    dir: "avatar",
    maxBytes: 3 * 1024 * 1024,
    allowed: /^image\/(png|jpe?g|webp|gif|avif)$/,
    label: "تصویر پروفایل",
    hint: "PNG، JPG، WebP یا GIF",
  },
  business: {
    dir: "business",
    maxBytes: 6 * 1024 * 1024,
    allowed: /^image\/(png|jpe?g|webp|gif|avif)$/,
    label: "تصویر کسب‌وکار",
    hint: "PNG، JPG، WebP یا GIF",
  },
  city: {
    dir: "city",
    maxBytes: 6 * 1024 * 1024,
    allowed: /^image\/(png|jpe?g|webp|gif|avif)$/,
    label: "تصویر دانش شهری",
    hint: "PNG، JPG، WebP یا GIF",
  },
  misc: {
    dir: "misc",
    maxBytes: 6 * 1024 * 1024,
    allowed: /^(image\/(png|jpe?g|webp|gif|avif)|application\/pdf)$/,
    label: "فایل عمومی",
    hint: "تصویر یا PDF",
  },
  // پیوست پست فید — چندرسانه‌ای کامل (هم‌راستا با core/uploads نسل قبل)
  post: {
    dir: "post",
    maxBytes: 30 * 1024 * 1024,
    allowed:
      /^image\/(png|jpe?g|webp|gif|avif)$|^video\/(mp4|webm|quicktime|x-matroska|ogg)$|^audio\/(mpeg|mp3|mp4|wav|wave|x-wav|webm|ogg|aac|flac|x-m4a|m4a|mpga)$|^application\/(pdf|zip|x-rar-compressed|msword|vnd\.(openxmlformats-officedocument\.(wordprocessingml(\.document)?|presentationml(\.presentation)?|spreadsheetml(\.sheet)?)|ms-excel|ms-powerpoint)|vnd\.oasis\.opendocument\.(spreadsheet|text|presentation))$|^text\/(plain|csv)$/,
    label: "پیوست پست شهریار",
    hint: "تصویر، ویدیو، صوت، PDF یا فایل آفیس",
  },
  // تصاویر نشریه انجمن — شاخص مقاله و تصاویر داخل متن
  article: {
    dir: "article",
    maxBytes: 8 * 1024 * 1024,
    allowed: /^image\/(png|jpe?g|webp|gif|avif)$/,
    label: "تصویر مقاله",
    hint: "PNG، JPG، WebP یا GIF",
  },
};

// ─── ساختار کلید فایل ───
// فقط حروف کوچک، رقم، خط تیره در شناسه — نقطه فقط جداکننده پسوند.
// این الگو خودش ضامن امنیت مسیر است: «..»، اسلش اضافه، کاراکتر نال
// و هر پیمایش مسیری ساختاراً غیرممکن می‌شود.
const SCOPE_ALT = MEDIA_SCOPES.join("|");

export const MEDIA_KEY_PATTERN = new RegExp(
  `^(${SCOPE_ALT})/\\d{4}-\\d{2}/[a-z0-9][a-z0-9-]{5,39}\\.[a-z0-9]{2,5}$`
);

/** کلید قدیمی (سیستم قبلی) — پوشه‌های avatars/businesses/posts */
const LEGACY_SCOPE_ALT = "chat|avatars|businesses|city|misc|posts";
export const LEGACY_KEY_PATTERN = new RegExp(
  `^(${LEGACY_SCOPE_ALT})/\\d{1,4}-\\d{1,4}/[A-Za-z0-9._-]+$`
);

/** نگاشت پوشه قدیمی → scope جدید */
export const LEGACY_DIR_TO_SCOPE: Record<string, MediaScope> = {
  chat: "chat",
  avatars: "avatar",
  businesses: "business",
  city: "city",
  misc: "misc",
  posts: "post",
};

/** نگاشت معکوس — scope جدید → نام پوشه روی دیسک در سیستم قدیمی.
 *  برای fallback خواندن فایل‌های قدیمی از public/uploads: نام پوشه‌های
 *  قدیمی برای avatar/business/post جمع (plural) بود. */
export const LEGACY_DIR_BY_SCOPE: Record<MediaScope, string> = {
  chat: "chat",
  avatar: "avatars",
  business: "businesses",
  city: "city",
  misc: "misc",
  post: "posts",
  article: "article",
};

// ─── نگاشت پسوند ↔ mime ───

// ═══ پسوندهای کد و فایل متنی تخصصی ═══
// مرورگرها برای این پسوندها اغلب type خالی یا غلط (مثل video/mp2t
// برای TypeScript!) می‌فرستند؛ سامانه به «پسوند فایل» اعتماد می‌کند
// و نوع را از همین جدول استنتاج می‌کند. تمام زبان‌های mainstream
// و فرمت‌های داده/کانفیگ پوشش داده شده‌اند.
export const CODE_EXTS: ReadonlySet<string> = new Set([
  // وب و جاوااسکریپت
  "js", "jsx", "mjs", "cjs", "ts", "tsx", "html", "htm", "css",
  "scss", "sass", "less", "styl", "vue", "svelte", "astro",
  // پایتون و داده‌محور
  "py", "pyw", "ipynb", "r", "jl",
  // جاوا و خانواده JVM
  "java", "kt", "kts", "scala", "groovy", "gradle",
  // خانواده C
  "c", "h", "cpp", "cc", "cxx", "hpp", "hh", "cs", "m", "mm",
  // سیستم‌های دیگر
  "go", "rs", "zig", "swift", "dart", "rb", "php", "pl", "pm",
  "lua", "ex", "exs", "erl", "hs", "ml", "clj", "elm", "v",
  // شل و اسکریپت
  "sh", "bash", "zsh", "fish", "bat", "cmd", "ps1", "psm1", "mk",
  // داده و کانفیگ
  "sql", "graphql", "gql", "prisma", "hcl", "tf", "proto", "http",
  "toml", "ini", "cfg", "conf", "env", "properties", "editorconfig",
  "gitignore", "dockerfile", "makefile",
  // مستندسازی و متن غنی
  "md", "mdx", "rst", "adoc", "tex", "log",
]);

export const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  pdf: "application/pdf",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  markdown: "text/markdown",
  mdx: "text/markdown; charset=utf-8",
  csv: "text/csv",
  tsv: "text/csv",
  json: "application/json",
  xml: "application/xml",
  html: "text/html",
  htm: "text/html",
  css: "text/css; charset=utf-8",
  log: "text/plain; charset=utf-8",
  yml: "text/plain; charset=utf-8",
  yaml: "text/plain; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  ts: "text/plain; charset=utf-8",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
  rar: "application/x-rar-compressed",
  bin: "application/octet-stream",
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
  // ─── زبان‌های برنامه‌نویسی — همه به‌صورت متنی UTF-8 سرو می‌شوند ───
  mjs: "text/javascript; charset=utf-8",
  cjs: "text/javascript; charset=utf-8",
  jsx: "text/javascript; charset=utf-8",
  tsx: "text/plain; charset=utf-8",
  py: "text/x-python; charset=utf-8",
  pyw: "text/x-python; charset=utf-8",
  rb: "text/x-ruby; charset=utf-8",
  go: "text/x-go; charset=utf-8",
  rs: "text/x-rust; charset=utf-8",
  java: "text/x-java; charset=utf-8",
  kt: "text/x-kotlin; charset=utf-8",
  kts: "text/x-kotlin; charset=utf-8",
  scala: "text/x-scala; charset=utf-8",
  swift: "text/x-swift; charset=utf-8",
  c: "text/x-c; charset=utf-8",
  h: "text/x-c; charset=utf-8",
  cpp: "text/x-c++; charset=utf-8",
  cc: "text/x-c++; charset=utf-8",
  cxx: "text/x-c++; charset=utf-8",
  hpp: "text/x-c++; charset=utf-8",
  cs: "text/x-csharp; charset=utf-8",
  php: "text/x-php; charset=utf-8",
  dart: "text/x-dart; charset=utf-8",
  lua: "text/x-lua; charset=utf-8",
  sh: "text/x-shellscript; charset=utf-8",
  bash: "text/x-shellscript; charset=utf-8",
  ps1: "text/x-powershell; charset=utf-8",
  sql: "application/sql; charset=utf-8",
  graphql: "application/graphql; charset=utf-8",
  gql: "application/graphql; charset=utf-8",
  toml: "text/x-toml; charset=utf-8",
  ini: "text/plain; charset=utf-8",
  env: "text/plain; charset=utf-8",
  vue: "text/x-vue; charset=utf-8",
  svelte: "text/plain; charset=utf-8",
  scss: "text/x-scss; charset=utf-8",
  sass: "text/x-sass; charset=utf-8",
  less: "text/x-less; charset=utf-8",
  ipynb: "application/json; charset=utf-8",
};

/** mime → پسوند امن برای نام‌گذاری فایل ذخیره‌شده */
export const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/zip": "zip",
  "application/x-rar-compressed": "rar",
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

/** پسوندهایی که مرورگر باید داخل خودش باز کند (نه دانلود) */
export const INLINE_EXTS = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "avif",
  "pdf",
  "txt",
  // پخش درون‌صفحه‌ای رسانه پیوست پست
  "mp4",
  "webm",
  "mov",
  "mp3",
  "m4a",
  "wav",
  "ogg",
]);

/** استنتاج MIME از نام فایل — برای type خالی مرورگر
 * (بخش charset نگاشت سرو فایل حذف می‌شود تا با regex اعتبارسنجی سازگار بماند) */
export function inferMimeFromName(name: string): string | null {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (!ext) return null;
  const mime = MIME_BY_EXT[ext];
  return mime ? mime.split(";")[0].trim() : null;
}

/** نوع مؤثر فایل برای اعتبارسنجی/ذخیره — مرجع واحد سرور و کلاینت.
 *  مرورگرها برای برخی پسوندها (.mov/.mkv/.flac/.ts/…) File.type خالی می‌فرستند و
 *  در multipart به‌صورت application/octet-stream ظاهر می‌شود؛ در این حالت
 *  نوع از «پسوند فایل» استنتاج می‌شود — درست مثل فایل‌های کد. */
export function effectiveMime(file: { type: string; name?: string }): string {
  const ext = (file.name || "").toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || "";
  if (CODE_EXTS.has(ext)) return "text/plain";
  if (file.type && file.type !== "application/octet-stream") return file.type;
  return (file.name ? inferMimeFromName(file.name) : null) || file.type || "";
}

/** اعتبارسنجی حجم و نوع فایل — استفاده مشترک سرور و کلاینت */
export function validateMediaFile(
  file: { size: number; type: string; name?: string },
  scope: MediaScope
): { valid: boolean; error?: string } {
  const cfg = SCOPE_CONFIGS[scope];
  if (!cfg) return { valid: false, error: "بخش آپلود نامعتبر است" };
  if (file.size === 0) return { valid: false, error: "فایل خالی است" };
  if (file.size > cfg.maxBytes) {
    const maxMB = Math.round(cfg.maxBytes / (1024 * 1024));
    return { valid: false, error: `حجم فایل بیشتر از ${maxMB} مگابایت مجاز نیست` };
  }
  // فایل‌های با type خالی/octet-stream → استنتاج از پسوند (رفع 422 نادرست)
  if (!cfg.allowed.test(effectiveMime(file))) {
    return { valid: false, error: `این نوع فایل مجاز نیست (${cfg.hint})` };
  }
  return { valid: true };
}

/** برچسب فارسی scope */
export function scopeLabel(scope: MediaScope): string {
  return SCOPE_CONFIGS[scope]?.label || "فایل";
}
