#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# اسنپ‌شات خودکار ماندگاری — دیتابیس + storage + کلیدها → گیت
# ═══════════════════════════════════════════════════════════════
# تنها چیزهایی که از ری‌ست سندباکس جان به در می‌برند، فایل‌های
# git-tracked هستند. این اسکریپت وضعیت فعلی را در سه فایل
# tracked ذخیره و commit می‌کند (اگر تغییری بوده):
#   db/backup.db              ← VACUUM INTO سازگار + راستی‌آزمایی
#   db/storage-backup.tar.gz  ← تصاویر/رسانه‌ها (تا سقف ۲۰۰MB)
#   db/env-backup             ← کلیدهای JWT/رمزنگاری پیامک
# اجرا: bash scripts/db-snapshot.sh   (watchdog هر ۱۰ دقیقه)
# ═══════════════════════════════════════════════════════════════
cd /home/z/my-project

# ۱) اسنپ‌شات دیتابیس — اگر ناموفق بود، بکاپ قبلی را خراب نکن
if ! node scripts/db-snapshot.mjs >/dev/null 2>&1; then
  echo "[snapshot $(date '+%H:%M:%S')] ⚠ اسنپ‌شات دیتابیس ناموفق — بکاپ قبلی حفظ شد"
  exit 1
fi

# ۲) بکاپ storage (فقط اگر کوچک است — جلوگیری از باد کردن گیت)
#    ⚠️ tar «قطعی» (deterministic): sort + mtime/owner یکسان + gzip بدون
#    timestamp → اگر محتوای storage تغییر نکرده باشد بایت‌به‌بایت همان
#    خروجی قبلی تولید می‌شود و git آن را بدون تغییر می‌بیند (no-op).
#    (قبلاً tar -czf ساده بود که به‌خاطر timestamp داخل gzip، هر ۱۰ دقیقه
#    یک blob جدید ~۳MB به تاریخچه اضافه می‌کرد و .git را باد می‌کرد.)
SIZE_MB=$(du -sm storage 2>/dev/null | cut -f1)
if [ -n "$SIZE_MB" ] && [ "$SIZE_MB" -lt 200 ] 2>/dev/null; then
  tar --sort=name --mtime='@0' --owner=0 --group=0 --numeric-owner \
    -cf - storage 2>/dev/null | gzip -n > db/storage-backup.tar.gz || true
fi

# ۳) بکاپ .env
[ -f .env ] && cp .env db/env-backup

# ۴) commit — فقط این سه مسیر؛ اگر تغییری نبوده no-op است
git add db/backup.db db/storage-backup.tar.gz db/env-backup 2>/dev/null
if git -c user.name="Super Z" -c user.email="agent@z.ai" \
  commit -m "chore(persist): اسنپ‌شات خودکار دیتابیس/storage/env" \
  -- db/backup.db db/storage-backup.tar.gz db/env-backup >/dev/null 2>&1; then
  echo "[snapshot $(date '+%H:%M:%S')] اسنپ‌شات جدید commit شد"
else
  echo "[snapshot $(date '+%H:%M:%S')] بدون تغییر — commit لازم نیست"
fi
