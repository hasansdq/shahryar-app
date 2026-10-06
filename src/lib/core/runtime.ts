// ═══════════════════════════════════════════════════════════════
// ابزارهای محیط اجرا — سازگاری با فایل‌سیستم فقط‌خواندنی
// ═══════════════════════════════════════════════════════════════
// مشکل ریشه‌ای: در دیپلوی production (محیط ابری space-z / FC) پوشه‌ی
// کدِ بسته معمولاً «فقط‌خواندنی» است. SQLite برای هر تراکنش نوشتنی
// (ساخت سشن، به‌روزرسانی لاگین، ثبت‌نام...) باید در دایرکتوری دیتابیس
// فایل journal بسازد و خود فایل را بنویسد — روی بسته‌ی فقط‌خواندنی با
// خطای SQLITE_READONLY («attempt to write a readonly database») شکست
// می‌خورد و لاگین «خطای داخلی سرور» می‌دهد؛ در حالی که همین بسته در
// پیش‌نمایش (dev) بی‌نقص کار می‌کند.
//
// راه‌حل این ماژول: تشخیص writability واقعی (نه فقط permission bits —
// mount فقط‌خواندنی هم گرفته می‌شود) + مسیر داده‌ی اجرایی قابل‌نوشتن
// در tmpdir (در ابر /tmp است) + کپی بازگشتی سبک و قابل‌حمل (بدون
// وابستگی به fs.cpSync تا در هر runtime ای — node یا bun — کار کند).
// ═══════════════════════════════════════════════════════════════
import {
  closeSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
  existsSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * آیا فایل برای «نوشتن» باز می‌شود؟
 * open با پرچم r+ هم permission bits را چک می‌کند هم خطای EROFS
 * (mount فقط‌خواندنی) را برمی‌گرداند — دقیقاً همان چیزی که SQLite نیاز دارد.
 * فایل ناموجود → false (نمی‌شود درباره‌ی نوشتن قضاوت کرد).
 */
export function isFileWritable(file: string): boolean {
  try {
    const fd = openSync(file, 'r+')
    closeSync(fd)
    return true
  } catch {
    return false
  }
}

/**
 * آیا در دایرکتوری اجازه‌ی ساخت فایل داده می‌شود؟
 * SQLite فایل‌های journal/-wal/-shm را در همان دایرکتوری می‌سازد؛
 * پس قابل‌نوشتن بودنِ خودِ دایرکتوری هم به اندازه‌ی فایل حیاتی است.
 */
export function isDirWritable(dir: string): boolean {
  const probe = path.join(dir, `.probe-${process.pid}-${Date.now()}`)
  try {
    const fd = openSync(probe, 'w')
    closeSync(fd)
    unlinkSync(probe)
    return true
  } catch {
    return false
  }
}

/**
 * کاندیدای دایرکتوری را آزمایش می‌کند — در صورت نیاز می‌سازد و اگر
 * واقعاً قابل‌نوشتن بود همان مسیر را برمی‌گرداند، وگرنه null.
 * هرگز خطا پرتاب نمی‌کند.
 */
function probeWritableDir(dir: string): string | null {
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    return isDirWritable(dir) ? dir : null
  } catch {
    return null
  }
}

/**
 * مسیر داده‌های اجرایی قابل‌نوشتن — خارج از بسته‌ی فقط‌خواندنی.
 *
 * ⚠️ این تابع «هرگز» خطا پرتاب نمی‌کند — قبلاً mkdir بدون try/catch
 * داشتیم و در محیط FC ابری (که tmpdir آن قابل‌نوشتن نیست) همین خطا
 * در «زمان ارزیابی ماژول» رخ می‌داد و کل روت‌های API را با
 * Internal Server Error خام از کار می‌انداخت.
 *
 * زنجیره‌ی کاندیداها (به‌ترتیب؛ اولینِ قابل‌نوشتن انتخاب می‌شود):
 *   ۱) os.tmpdir() — با احترام به TMPDIR محیط
 *   ۲) /tmp صریح   — استاندارد کانتینرهای ابری
 *   ۳) /dev/shm    — tmpfs موجود در اغلب کانتینرها
 *   ۴) کنار cwd    — آخرین پناه (برای محیط‌های غیر کلاسیک)
 * نتیجه در globalThis کش می‌شود تا در بوت گرم همان کانتینر، همان
 * مسیر (و داده‌های قبلی) انتخاب شود. اگر هیچ کاندیدا قابل‌نوشتن
 * نبود، مسیر اصلی tmpdir برگردانده می‌شود — فراخواننده‌ها پیش از
 * استفاده writability را چک می‌کنند و به حالت degraded (فقط‌خواندنی)
 * برمی‌گردند؛ اما برنامه هرگز کرش نمی‌کند.
 */
export function runtimeDataDir(): string {
  const g = globalThis as { __shahryarRuntimeDataDir?: string }
  if (g.__shahryarRuntimeDataDir) return g.__shahryarRuntimeDataDir

  const primary = path.join(os.tmpdir(), 'shahryar-runtime')
  const candidates = [
    primary,
    '/tmp/shahryar-runtime',
    '/dev/shm/shahryar-runtime',
    path.join(process.cwd(), '.shahryar-runtime'),
  ]

  let chosen = primary
  for (const c of new Set(candidates)) {
    if (probeWritableDir(c)) {
      chosen = c
      break
    }
  }
  if (chosen !== primary) {
    console.log(`[runtime] tmpdir پیش‌فرض قابل‌استفاده نیست — مسیر اجرایی: ${chosen}`)
  }
  g.__shahryarRuntimeDataDir = chosen
  return chosen
}

/**
 * کپی بازگشتی سبک — پیاده‌سازی دستی برای قابلیت حمل کامل
 * (بدون fs.cpSync که قدیم‌ها در بعضی runtime ها ناقص بود).
 * @param overwrite اگر false باشد فایل‌های موجود مقصد را بازنویسی نمی‌کند
 * @returns تعداد فایل‌های کپی‌شده
 */
export function copyTree(src: string, dst: string, overwrite = false): number {
  let count = 0
  let entries: string[]
  try {
    entries = readdirSync(src)
  } catch {
    return 0
  }
  for (const entry of entries) {
    const s = path.join(src, entry)
    const d = path.join(dst, entry)
    let isDir = false
    try {
      isDir = statSync(s).isDirectory()
    } catch {
      continue // قابل خواندن نیست — رد شو
    }
    if (isDir) {
      if (!existsSync(d)) mkdirSync(d, { recursive: true })
      count += copyTree(s, d, overwrite)
    } else {
      if (!overwrite && existsSync(d)) continue
      try {
        mkdirSync(path.dirname(d), { recursive: true })
        writeFileSync(d, readFileSync(s))
        count++
      } catch {
        // تک فایل شکست خورد — بقیه ادامه پیدا کنند
      }
    }
  }
  return count
}
