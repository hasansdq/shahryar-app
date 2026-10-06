import { PrismaClient } from '@prisma/client'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  copyFileSync,
  writeFileSync,
  chmodSync,
} from 'node:fs'
import path from 'node:path'
import { isDirWritable, isFileWritable, runtimeDataDir } from './core/runtime'

// ═══════════════════════════════════════════════════════════════
// حل مسیر دیتابیس SQLite — مقاوم در برابر هر حالت اجرا:
//  ۱) dev:            cwd = ریشه پروژه
//  ۲) standalone:     cwd = .next-prod/standalone (تودرتو در پروژه)
//  ۳) دیپلوی ابری:    cwd = /app/next-service-dist و بسته فقط‌خواندنی
//
// منطق: مسیر فایل db از DATABASE_URL جدا می‌شود؛ اگر آن مسیر روی
// این ماشین وجود ندارد، db/custom.db نسبت به «ریشه واقعی پروژه»
// (بالاترین پوشه‌ای که package.json + prisma دارد) استفاده می‌شود.
// ═══════════════════════════════════════════════════════════════

interface ResolvedDatabase {
  /** آدرس کامل برای Prisma (file:...) */
  url: string
  /** مسیر مطلق فایل sqlite بدون پیشوند file: — برای یافتن schema.sql */
  filePath: string
  /** مسیر اصلی (قبل از overlay) — برای تشخیص فعال‌بودن لایه اجرایی */
  sourcePath: string
  /** آیا نسخه‌ی کپی‌شده‌ی قابل‌نوشتن (overlay) در حال استفاده است؟ */
  overlay: boolean
}

function findProjectRoot(): string {
  // یافتن ریشه واقعی پروژه — بالاترین پوشه با package.json + prisma
  // (پوشه standalone داخل ریشه تودرتو است، پس بالاترین کاندیدا ریشه واقعی است)
  let dir = process.cwd()
  let best: string | null = null
  for (let i = 0; i < 10; i++) {
    if (
      existsSync(path.join(dir, 'package.json')) &&
      existsSync(path.join(dir, 'prisma'))
    ) {
      best = dir
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return best || process.cwd()
}

// ─── لایه‌ی اجرایی قابل‌نوشتن (Read-Only Deployment Overlay) ───
// در محیط ابری (space-z / FC) بسته‌ی دیپلوی فقط‌خواندنی است؛ SQLite
// نمی‌تواند سشن بنویسد → لاگین «خطای داخلی سرور» می‌شود. اگر فایل یا
// دایرکتوری دیتابیس قابل‌نوشتن نبود، دیتابیس (و schema.sql) یک‌بار به
// tmpdir کپی می‌شود و همان نسخه‌ی قابل‌نوشتن استفاده می‌شود. در بوت‌های
// گرمِ همان کانتینر، نسخه‌ی قبلی (با داده‌های جدیدتر) بازیابی می‌شود.
function ensureWritableDatabase(dbPath: string): string {
  const fileOk = existsSync(dbPath) && isFileWritable(dbPath)
  const dirOk = isDirWritable(path.dirname(dbPath))
  if (fileOk && dirOk) return dbPath // محیط عادی — بدون هیچ تغییری

  const dir = path.join(runtimeDataDir(), 'db')
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  } catch {
    // حتی tmpdir هم قابل‌نوشتن نیست — بهترین تلاش:
  }
  if (!isDirWritable(dir)) {
    console.warn('[db] هیچ مسیر قابل‌نوشتی در دسترس نیست — ادامه با مسیر اصلی')
    return dbPath
  }

  const target = path.join(dir, 'custom.db')
  if (existsSync(target) && isFileWritable(target)) {
    console.log(`[db] بسته فقط‌خواندنی است — دیتابیس اجرایی قبلی در ${target} بازیابی شد`)
    return target
  }

  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    if (existsSync(dbPath)) {
      copyFileSync(dbPath, target)
      // نکته‌ی حیاتی: copyFileSync مجوزهای فایل مبدأ را حفظ می‌کند؛
      // اگر بسته فقط‌خواندنی باشد، «کپی» هم فقط‌خواندنی می‌شود! صریحاً
      // مجوز نوشتن به فایل کپی‌شده می‌دهیم.
      chmodSync(target, 0o644)
    } else {
      // دیتابیس بسته وجود ندارد (استقرار نو) → فایل خالی؛ خودشفایی
      // اسکیما جداول را می‌سازد
      writeFileSync(target, '')
    }
    const schemaSrc = path.join(path.dirname(dbPath), 'schema.sql')
    if (existsSync(schemaSrc)) {
      copyFileSync(schemaSrc, path.join(dir, 'schema.sql'))
    }
    console.log(`[db] بسته فقط‌خواندنی است — دیتابیس به ${target} کپی شد`)
    return target
  } catch (err) {
    console.error('[db] کپی دیتابیس به مسیر قابل‌نوشتن شکست خورد:', err)
    return dbPath
  }
}

function resolveDatabase(): ResolvedDatabase {
  const raw = process.env.DATABASE_URL || ''

  // غیر SQLite → دست نخورده پاس بده (خودشفایی فقط برای sqlite است)
  if (raw && !raw.startsWith('file:'))
    return { url: raw, filePath: '', sourcePath: '', overlay: false }

  let dbPath: string

  // فایل SQLite اشاره‌شده در env
  if (raw) {
    const declared = raw.replace(/^file:/, '')
    if (path.isAbsolute(declared)) {
      if (existsSync(declared)) {
        dbPath = declared
      } else {
        console.warn(
          `[db] مسیر دیتابیس «${declared}» روی این ماشین وجود ندارد؛ جستجوی ریشه پروژه…`
        )
        dbPath = ''
      }
    } else {
      // مسیر نسبی — نسبت به cwd حل می‌شود؛ اگر نبود، ریشه پروژه را امتحان کن
      const abs = path.resolve(process.cwd(), declared)
      if (existsSync(abs)) dbPath = abs
      else dbPath = ''
    }
  } else {
    dbPath = ''
  }

  if (!dbPath) {
    const root = findProjectRoot()
    const dbDir = path.join(root, 'db')
    try {
      if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true })
    } catch (err) {
      // فایل‌سیستم فقط‌خواندنی (دیپلوی ابری) — خودشفایی/overlay
      // در ادامه مسیرِ ناموجود را به لایه‌ی قابل‌نوشتن می‌برد.
      console.warn(`[db] ساخت مسیر «${dbDir}» ممکن نیست (فقط‌خواندنی؟):`, err)
    }
    dbPath = path.join(dbDir, 'custom.db')
    console.log(`[db] دیتابیس در ${dbPath} استفاده می‌شود`)
  }

  // لایه‌ی قابل‌نوشتن برای بسته‌های فقط‌خواندنی (محیط ابری)
  const finalPath = ensureWritableDatabase(dbPath)
  return {
    url: `file:${finalPath}`,
    filePath: finalPath,
    sourcePath: dbPath,
    overlay: finalPath !== dbPath,
  }
}

// ⚠️ حل‌سازی مسیر هرگز نباید «ارزیابی ماژول» را بشکند: در محیط FC
// ابری (space-z) tmpdir ممکن است قابل‌نوشتن نباشد و هر خطای ارزیابی
// ماژول، همه‌ی روت‌های API را یک‌جا با Internal Server Error خام از
// کار می‌اندازد. هر خرابی محیطی باید به خطای «قابل‌گرفتن» در هندلرها
// ختم شود، نه به کرش ماژول.
let resolvedDb: ResolvedDatabase
try {
  resolvedDb = resolveDatabase()
} catch (err) {
  console.error(
    '[db] خطای غیرمنتظره در حل مسیر دیتابیس — استفاده‌ی خام از DATABASE_URL:',
    err
  )
  const fallbackUrl = process.env.DATABASE_URL || 'file:db/custom.db'
  resolvedDb = {
    url: fallbackUrl,
    filePath: fallbackUrl.replace(/^file:/, ''),
    sourcePath: fallbackUrl.replace(/^file:/, ''),
    overlay: false,
  }
}

// ═══════════════════════════════════════════════════════════════
// خودشفایی اسکیمای دیتابیس (Database Schema Self-Healing)
// ═══════════════════════════════════════════════════════════════
// اگر فایل دیتابیس «موجود ولی بدون جدول» باشد (سناریوی دیپلوی که
// db push روی فایل نهایی اعمال نشده)، هر کوئری با P2021 شکست می‌خورد
// و لاگین/ثبت‌نام «خطای داخلی سرور» می‌دهد. پیش از «اولین» کوئری هر
// پروسه، جداول موجود با db/schema.sql مقایسه و در صورت کمبود، DDLِ
// idempotent (همه با IF NOT EXISTS) اعمال می‌شود — بدون دست‌زدن به
// داده‌های موجود و مستقل از pipeline دیپلوی.
// ═══════════════════════════════════════════════════════════════

function findSchemaSql(dbFile: string): string | null {
  if (!dbFile) return null
  const candidates = [
    // ۱) کنار فایل دیتابیسِ حل‌شده — همه حالت‌ها اینجا پوشش داده می‌شوند:
    //    dev: <ریشه>/db/schema.sql | پکیج پلتفرم: /app/db/schema.sql
    //    standalone: <standalone>/db/schema.sql | لایه اجرایی: tmpdir/db/schema.sql
    path.join(path.dirname(dbFile), 'schema.sql'),
    // ۲) fallback نسبت به cwd
    path.join(process.cwd(), 'db', 'schema.sql'),
  ]
  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  return null
}

/**
 * تقسیم فایل SQL به دستورات مجزا — هر دستور حداکثر یک statement است.
 * کامنت‌های «--» و قطعات خالی حذف می‌شوند.
 */
function splitSqlStatements(sql: string): string[] {
  return sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => {
      const nonComment = s
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('')
        .trim()
      return nonComment.length > 0
    })
}

async function bootstrapSchema(base: PrismaClient): Promise<void> {
  const sqlPath = findSchemaSql(resolvedDb.filePath)
  if (!sqlPath) {
    console.warn(
      '[db] فایل db/schema.sql یافت نشد — خودشفایی اسکیما غیرفعال است'
    )
    return
  }

  const sql = readFileSync(sqlPath, 'utf8')
  const expected = [...sql.matchAll(/CREATE TABLE IF NOT EXISTS "([^"]+)"/g)].map(
    (m) => m[1]
  )
  if (expected.length === 0) {
    console.warn('[db] db/schema.sql جدولی ندارد — نادیده گرفته شد')
    return
  }

  // جداول موجود در دیتابیس فعلی
  let existing: Set<string>
  try {
    const rows = (await base.$queryRawUnsafe(
      "SELECT name FROM sqlite_master WHERE type='table'"
    )) as Array<{ name: string }>
    existing = new Set(rows.map((r) => r.name))
  } catch (err) {
    // مثلاً دیتابیس غیر-sqlite — خودشفایی معنا ندارد
    console.warn('[db] بررسی جداول ممکن نشد:', err)
    return
  }

  const missing = expected.filter((t) => !existing.has(t))
  if (missing.length === 0) return // اسکیما کامل است — هیچ کاری نکن

  // اعمال DDL — idempotent و بدون دست‌زدن به داده‌های موجود
  const statements = splitSqlStatements(sql)
  let applied = 0
  for (const stmt of statements) {
    try {
      await base.$executeRawUnsafe(stmt)
      applied++
    } catch (err) {
      console.error(
        `[db] اجرای دستور DDL شکست خورد (${stmt.slice(0, 60)}…):`,
        err
      )
    }
  }
  console.log(
    `[db] خودشفایی اسکیما: ${applied} دستور اعمال شد — جداول ایجادشده: ${missing.join(', ')}`
  )
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createDbClient>
  dbReady?: Promise<void> | undefined
}

/** اطلاعات تشخیصی مسیر دیتابیس برای /api/diag/db — بدون افشای راز */
export function getDbDiagnostics() {
  return {
    resolvedPath: resolvedDb.filePath,
    sourcePath: resolvedDb.sourcePath,
    overlayActive: resolvedDb.overlay,
    envDatabaseUrlSet: Boolean(process.env.DATABASE_URL),
  }
}

function createDbClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
    datasources: { db: { url: resolvedDb.url } },
  })

  // تضمین اجرای یک‌باره‌ی bootstrap در طول عمر پروسه (+ retry پس از خطا)
  const ensureSchema = (): Promise<void> => {
    if (!globalForPrisma.dbReady) {
      globalForPrisma.dbReady = bootstrapSchema(base).catch((err) => {
        // ریست تا درخواست بعدی دوباره تلاش کند؛ کوئری اصلی خطای خودش را نشان می‌دهد
        globalForPrisma.dbReady = undefined
        console.error('[db] خطای آماده‌سازی اسکیمای دیتابیس:', err)
      })
    }
    return globalForPrisma.dbReady
  }

  // همه‌ی عملیات دیتابیس از این گره می‌گذرند؛ اولین عملیات،
  // اسکیما را در صورت نیاز خودکار اعمال می‌کند.
  return base.$extends({
    query: {
      $allOperations: async ({ query, args }) => {
        await ensureSchema()
        return query(args)
      },
    },
  })
}

export const db = globalForPrisma.prisma ?? createDbClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
