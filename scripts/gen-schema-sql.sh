#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# بازتولید db/schema.sql از prisma/schema.prisma
# ═══════════════════════════════════════════════════════════════
# این فایل DDLِ idempotent (با IF NOT EXISTS) است که در زمان اجرا
# توسط src/lib/db.ts برای «خودشفایی اسکیمای دیتابیس» استفاده می‌شود.
#
# چه زمانی اجرا شود:
#   • بعد از هر تغییر در prisma/schema.prisma
#   • قبل از هر build/deploy (postbuild.mjs اجرای خودکار را انجام می‌دهد)
#
# خروجی: db/schema.sql — کنار دیتابیس قرار می‌گیرد تا در هر بسته‌ی
# دیپلوی (sandbox / standalone / پکیج پلتفرم) همراه دیتابیس باشد.
# ═══════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p db

./node_modules/.bin/prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script 2>/dev/null \
| sed -e 's/^CREATE TABLE "/CREATE TABLE IF NOT EXISTS "/' \
      -e 's/^CREATE UNIQUE INDEX "/CREATE UNIQUE INDEX IF NOT EXISTS "/' \
      -e 's/^CREATE INDEX "/CREATE INDEX IF NOT EXISTS "/' \
  > db/schema.sql

TABLES=$(grep -c 'CREATE TABLE IF NOT EXISTS' db/schema.sql)
INDEXES=$(grep -cE 'CREATE (UNIQUE )?INDEX IF NOT EXISTS' db/schema.sql)

if [ "$TABLES" -eq 0 ]; then
  echo "✗ خطا: هیچ جدولی تولید نشد — schema.prisma را بررسی کنید"
  exit 1
fi

# هر CREATE TABLE باید IF NOT EXISTS داشته باشد (تضمین idempotency)
if grep -qE '^CREATE TABLE(?! IF NOT EXISTS)' db/schema.sql 2>/dev/null || grep -qE '^CREATE TABLE "' db/schema.sql; then
  echo "✗ خطا: دستور CREATE TABLE بدون IF NOT EXISTS باقی مانده"
  exit 1
fi

echo "✓ db/schema.sql بازتولید شد: ${TABLES} جدول، ${INDEXES} ایندکس"
