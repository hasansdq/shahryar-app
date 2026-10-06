#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# گارد ضد clobber پس از بوت (درس Task 47)
# ───────────────────────────────────────────────────────────────
# مشکل: پلتفرم گاهی ~۷۵ ثانیه بعد از بوت، فایل‌های gitignored را با
# یک آرشیو کهنه بازمی‌گرداند — از جمله db/custom.db با اسکیمای قدیمی
# (بدون SmsSetting/OtpCode/...) که باعث خطای 500 در ذخیره تنظیمات و
# ورود OTP می‌شد. autoheal قبل از سرور اجرا می‌شود و نمی‌تواند جلوی
# این بازنویسیِ بعدی را بگیرد.
#
# راه‌حل: این گارد بلافاصله بعد از autoheال بوت اجرا می‌شود و ۸ دقیقه
# هر ۲۰ ثانیه سلامت را چک می‌کند؛ اگر clobber اتفاق افتاد (اسکیمای
# کهنه/بدون ادمین)، نرم‌بازسازی می‌کند: cp + prisma db push — بدون
# کشتن سرور (پلتفرم مالک سرور است؛ کشتنش اپ را کاملاً خاموش می‌کند).
# cp روی inode موجود = هندل‌های باز SQLite همان فایل را می‌بینند؛
# SQLite با کوکی schema_version کش را باطل می‌کند.
# لاگ: /home/z/my-project/db-guard.log
# ═══════════════════════════════════════════════════════════════
cd /home/z/my-project
LOCK=/tmp/db-postboot-guard.lock

# جلوگیری از چند نمونه هم‌زمان (mkdir اتمیک است)
if ! mkdir "$LOCK" 2>/dev/null; then
  # نمونه قبلی تازه است؟ (کمتر از ۱۰ دقیقه) → همین کافی است
  if [ -n "$(find "$LOCK" -maxdepth 0 -mmin -10 2>/dev/null)" ]; then
    exit 0
  fi
  rm -rf "$LOCK"
  mkdir "$LOCK" 2>/dev/null || exit 0
fi
trap 'rm -rf "$LOCK"' EXIT

echo "[$(date '+%m-%d %H:%M:%S')] گارد پس از بوت شروع شد (PID $$)" >> db-guard.log

for i in $(seq 1 24); do   # ۲۴ چرخه × ۲۰ ثانیه = ۸ دقیقه
  sleep 20
  HEALTH=$(node scripts/db-health.mjs 2>/dev/null || echo '{"healthy":false,"reason":"check-failed"}')
  if echo "$HEALTH" | grep -q '"healthy":true'; then
    # در چرخه‌های اول لاگ بده، بعداً فقط تفاوت
    [ "$i" -le 3 ] && echo "[$(date '+%m-%d %H:%M:%S')] چرخه $i: سالم ✓ $HEALTH" >> db-guard.log
    continue
  fi

  echo "[$(date '+%m-%d %H:%M:%S')] ⚠ چرخه $i: دیتابیس ناسالم شد ($HEALTH) — بازنویسی توسط پلتفرم؟ نرم‌بازسازی..." >> db-guard.log

  if [ ! -f db/backup.db ]; then
    echo "[$(date '+%m-%d %H:%M:%S')] ✗ بکاپی نیست — فقط db push" >> db-guard.log
    npx prisma db push --skip-generate >> db-guard.log 2>&1 || true
    continue
  fi

  # نرم‌بازسازی: بدون کشتن سرور
  cp db/backup.db db/custom.db
  echo "[$(date '+%m-%d %H:%M:%S')] cp backup.db انجام شد" >> db-guard.log
  npx prisma db push --skip-generate >> db-guard.log 2>&1 || true

  AFTER=$(node scripts/db-health.mjs 2>/dev/null || echo '{"healthy":false}')
  if echo "$AFTER" | grep -q '"healthy":true'; then
    echo "[$(date '+%m-%d %H:%M:%S')] ✓ نرم-بازسازی موفق: $AFTER" >> db-guard.log
    # دو چرخه بعدی هم چک کن، بعد خارج شو
    sleep 40
    FINAL=$(node scripts/db-health.mjs 2>/dev/null || echo '{"healthy":false}')
    echo "[$(date '+%m-%d %H:%M:%S')] چک نهایی: $FINAL" >> db-guard.log
    exit 0
  else
    echo "[$(date '+%m-%d %H:%M:%S')] ✗ هنوز ناسالم: $AFTER — ادامه چرخه‌ها" >> db-guard.log
  fi
done
echo "[$(date '+%m-%d %H:%M:%S')] گارد پس از بوت پایان یافت (۸ دقیقه بدون clobber)" >> db-guard.log
