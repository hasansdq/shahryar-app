// ═══ اسنپ‌شات سازگار دیتابیس — VACUUM INTO + راستی‌آزمایی ═══
// VACUUM INTO اسنپ‌شات تراکنشی می‌سازد؛ حتی اگر سرور وسط نوشتن باشد
// فایل نتیجه همیشه سازگار و بازشدنی است (برخلاف cp خام).
// راستی‌آزمایی: ادمین + جدول‌ها/ستون‌های حیاتی (درس Task 47: اسکیمای
// کهنه نباید هرگز بکاپ سالم را بازنویسی کند)
// خروجی: {ok, admins, users, businesses} — یا {ok:false, error}
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const ROOT = '/home/z/my-project';
const BACKUP = `${ROOT}/db/backup.db`;

const CRITICAL_TABLES = ['SmsSetting', 'OtpCode', 'Notification', 'NotificationRecipient'];
const CRITICAL_COLUMNS = { User: ['birthDate', 'isVerified', 'restrictedUntil'] };

const out = (o) => console.log(JSON.stringify(o));
const db = new PrismaClient();

try {
  // VACUUM INTO در فایل موقت + rename اتمیک — تضمین می‌کند backup.db
  // همیشه یا نسخه‌ی کامل قبلی است یا نسخه‌ی کامل جدید (هرگز نصفه)
  const TMP = `${ROOT}/db/.backup-tmp.db`;
  // فقط فایل موقت پاک می‌شود — backup.db تا لحظه‌ی rename اتمیک دست‌نخورده می‌ماند
  for (const f of [TMP, `${TMP}-journal`]) {
    try { fs.unlinkSync(f); } catch {}
  }

  await db.$executeRawUnsafe(`VACUUM INTO '${TMP}'`);

  // راستی‌آزمایی: فایل موقت باید با Prisma باز شود و ادمین داشته باشد
  const v = new PrismaClient({
    datasources: { db: { url: `file:${TMP}` } },
  });
  const admins = await v.adminUser.count();
  const users = await v.user.count();
  const businesses = await v.business.count();

  if (admins < 1) {
    await v.$disconnect();
    out({ ok: false, error: 'snapshot has no admins — refusing to replace backup' });
    process.exit(1);
  }

  // اسکیمای کامل؟ (جدول‌های حیاتی)
  const rows = await v.$queryRawUnsafe(`SELECT name FROM sqlite_master WHERE type='table'`);
  const tables = rows.map((r) => r.name);
  const missingTables = CRITICAL_TABLES.filter((t) => !tables.includes(t));
  if (missingTables.length) {
    await v.$disconnect();
    out({ ok: false, error: `stale schema (missing ${missingTables.join(',')}) — refusing to replace backup` });
    process.exit(1);
  }

  // ستون‌های حیاتی
  for (const [table, cols] of Object.entries(CRITICAL_COLUMNS)) {
    const info = await v.$queryRawUnsafe(`PRAGMA table_info("${table}")`);
    const present = info.map((r) => r.name);
    const missing = cols.filter((c) => !present.includes(c));
    if (missing.length) {
      await v.$disconnect();
      out({ ok: false, error: `stale schema (${table} missing ${missing.join(',')}) — refusing to replace backup` });
      process.exit(1);
    }
  }
  await v.$disconnect();

  // جایگزینی اتمیک — در هیچ لحظه‌ای backup.db ناقص/غایب نیست
  fs.renameSync(TMP, BACKUP);

  out({ ok: true, admins, users, businesses });
} catch (err) {
  out({ ok: false, error: String(err.message || err).slice(0, 120) });
  process.exit(1);
} finally {
  await db.$disconnect();
}

