// ═══ بررسی سلامت دیتابیس — خروجی JSON برای مصرف اسکریپتی ═══
// سالم = فایل هست + باز می‌شود + حداقل یک ادمین دارد + اسکیمای کامل دارد.
//
// ⚠️ درس Task 47: پلتفرم گاهی ~۷۵ ثانیه بعد از بوت، دیتابیس را با یک
// آرشیو کهنه (مثلاً وضعیت ۱۳ سپتامبر بدون جداول SmsSetting/OtpCode)
// بازمی‌گرداند. چون COUNT(*) حتی روی جدولِ ناسازگار با اسکیما کار می‌کند،
// چکِ صرفِ «ادمین دارد» چنین فایلی را سالم می‌پنداشت و ترمیم رد می‌شد.
// پس سلامت = داده (ادمین) + اسکیما (جدول‌ها و ستون‌های حیاتی).
import { PrismaClient } from '@prisma/client';
import { existsSync, statSync } from 'fs';

const DB = '/home/z/my-project/db/custom.db';
const out = (o) => console.log(JSON.stringify(o));

if (!existsSync(DB)) {
  out({ healthy: false, reason: 'missing' });
  process.exit(0);
}

let size = 0;
try { size = statSync(DB).size; } catch {}

// جدول‌ها و ستون‌هایی که نبودشان یعنی اسکیمای کهنه/ناقص است
const CRITICAL_TABLES = ['SmsSetting', 'OtpCode', 'Notification', 'NotificationRecipient'];
const CRITICAL_COLUMNS = { User: ['birthDate', 'isVerified', 'restrictedUntil'] };

const db = new PrismaClient();
try {
  const admins = await db.adminUser.count();
  if (admins < 1) {
    out({ healthy: false, reason: 'no-admins (reset wiped data)', admins, size });
    process.exit(0);
  }

  // جدول‌های حیاتی
  const rows = await db.$queryRawUnsafe(
    `SELECT name FROM sqlite_master WHERE type='table'`
  );
  const tables = rows.map((r) => r.name);
  const missingTables = CRITICAL_TABLES.filter((t) => !tables.includes(t));
  if (missingTables.length) {
    out({ healthy: false, reason: `stale-schema:missing-tables:${missingTables.join(',')}`, admins, size });
    process.exit(0);
  }

  // ستون‌های حیاتی
  for (const [table, cols] of Object.entries(CRITICAL_COLUMNS)) {
    const info = await db.$queryRawUnsafe(`PRAGMA table_info("${table}")`);
    const present = info.map((r) => r.name);
    const missingCols = cols.filter((c) => !present.includes(c));
    if (missingCols.length) {
      out({ healthy: false, reason: `stale-schema:${table}:missing-cols:${missingCols.join(',')}`, admins, size });
      process.exit(0);
    }
  }

  const users = await db.user.count();
  const businesses = await db.business.count();
  out({ healthy: true, admins, users, businesses, size });
} catch (err) {
  out({ healthy: false, reason: 'corrupt:' + String(err.message || err).slice(0, 80), size });
} finally {
  await db.$disconnect();
}
