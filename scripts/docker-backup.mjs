#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// شهریار — docker-backup.mjs (اسنپ‌شات سازگار دیتابیس SQLite)
// ═══════════════════════════════════════════════════════════════
// داخل کانتینرِ در حال اجرای اپ اجرا می‌شود (docker compose exec)
// و با دستور «VACUUM INTO» یک اسنپ‌شات «سازگار» (consistent) از
// دیتابیس می‌سازد — بدون توقف سرویس و بدون خطر خرابی در میانه‌ی
// تراکنش. خروجی داخل Volume می‌نشیند و روی میزبان در
// docker-data/backups/ دیده می‌شود.
//
// اجرا:  docker compose exec -T app node /app/scripts/docker-backup.mjs backups/db-<ts>.db
//        (مسیر نسبت به /app/data — path traversal مسدود است)
// ═══════════════════════════════════════════════════════════════
import path from "node:path";
import { mkdirSync, statSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const DATA_DIR = process.env.DATA_DIR || "/app/data";
const rel = process.argv[2];

if (!rel) {
  console.error("استفاده: node docker-backup.mjs <مسیر-نسبی-دریافت-فایل-بکاپ>");
  console.error("مثال: node docker-backup.mjs backups/db-20260913-120000.db");
  process.exit(1);
}

// ─── امنیت مسیر: فقط مسیر نسبیِ بدون traversal پذیرفته می‌شود ───
if (path.isAbsolute(rel) || rel.split("/").includes("..")) {
  console.error("✗ مسیر بکاپ باید نسبی و بدون «..» باشد.");
  process.exit(1);
}

const target = path.join(DATA_DIR, rel);
mkdirSync(path.dirname(target), { recursive: true });

// VACUUM INTO روی فایل موجود خطا می‌دهد — اسم timestamp-based است
// اما برای اطمینان چک می‌شود:
try {
  statSync(target);
  console.error(`✗ فایل بکاپ از قبل وجود دارد: ${target}`);
  process.exit(1);
} catch {
  /* مطلوب — فایل نباید وجود داشته باشد */
}

const db = new PrismaClient({
  // منبعِ قطعی: دیتابیسِ Volume (DATA_DIR) — نه env محیط؛
  // در کانتینر هر دو یکی‌اند اما این‌طوری اسکریپت علیه env های
  // ambient مقاوم است و همیشه از همان Volume بکاپ می‌گیرد.
  datasources: { db: { url: `file:${DATA_DIR}/custom.db` } },
});
try {
  // escape تک‌کوت برای امنیت SQL (اسم فایل کنترل‌شده است، ضامن دوم)
  const sqlPath = target.replace(/'/g, "''");
  await db.$executeRawUnsafe(`VACUUM INTO '${sqlPath}'`);
  const st = statSync(target);
  const mb = (st.size / (1024 * 1024)).toFixed(2);
  console.log(`✓ اسنپ‌شات دیتابیس ساخته شد: ${target} (${mb} MB)`);
} catch (err) {
  console.error("✗ ساخت بکاپ دیتابیس ناموفق بود:", err?.message || err);
  process.exit(1);
} finally {
  await db.$disconnect();
}
