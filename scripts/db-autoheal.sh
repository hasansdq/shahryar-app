#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# بازیابی خودکار پس از ری‌ست سندباکس (autoheal)
# ═══════════════════════════════════════════════════════════════
# سندباکس با غیرفعال‌شدن، فایل‌های gitignore شده را پاک می‌کند:
#   db/custom.db (داده‌ها) + storage/ (تصاویر) + .env (کلیدها)
# فایل‌های git-tracked زنده می‌مانند؛ پس بکاپ‌ها همان‌جا هستند:
#   db/backup.db + db/storage-backup.tar.gz + db/env-backup
#
# این اسکریپت در سه نقطه اجرا می‌شود:
#   ۱) اسکریپت dev در package.json (بوت پلتفرم: bun run dev)
#   ۲) شروع watchdog
#   ۳) دستی: bash scripts/db-autoheal.sh  (با ری‌وایو سرور)
#
# سه ترمیم مستقل:
#   A) دیتابیس خالی/خراب → بازگردانی از backup.db + همگام‌سازی اسکیما
#   B) storage خالی → استخراج از storage-backup.tar.gz
#   C) کلیدهای .env ناقص → الحاق کلیدهای غایب از env-backup
# ═══════════════════════════════════════════════════════════════
cd /home/z/my-project
MODE="${1:-}"   # --no-revive → فقط ترمیم؛ سرور را خودش بالا می‌آورد (بوت)
LOG_PREFIX="[autoheal $(date '+%H:%M:%S')]"

# ─── A) دیتابیس ───
HEALTH=$(node scripts/db-health.mjs 2>/dev/null || echo '{"healthy":false,"reason":"health-check-failed"}')
if echo "$HEALTH" | grep -q '"healthy":true'; then
  echo "$LOG_PREFIX دیتابیس سالم است ✓ ($HEALTH)"
else
  echo "$LOG_PREFIX دیتابیس آسیب‌دیده است ($HEALTH) — ترمیم..."
  if [ ! -f db/backup.db ]; then
    echo "$LOG_PREFIX ⚠ بکاپی وجود ندارد — فقط اسکیما ساخته می‌شود"
    npx prisma db push --skip-generate >/dev/null 2>&1 || true
  else
    # اگر سروری روشن است، اول خاموش (هندل باز روی فایل = خطر واگرایی)
    # ⚠️ الگوی دقیق — «next dev» به‌تنهایی self-match می‌شود چون این
    # اسکریپت از درون اسکریپت dev (cmdline حاوی «; next dev») اجرا می‌شود!
    pkill -f "node_modules/.bin/next" 2>/dev/null
    pkill -f "next-server" 2>/dev/null
    pkill -f "postcss.js" 2>/dev/null
    sleep 2

    # زنجیره fallback: backup.db (تازه‌ترین اسنپ‌شات) → بکاپ ثانویه T42
    # اسنپ‌شات‌ها اتمیک‌اند، اما اگر به هر دلیلی خراب شد دومی نجات می‌دهد
    for SRC in db/backup.db db/custom.db.bak-t42; do
      [ -f "$SRC" ] || continue
      cp "$SRC" db/custom.db
      AFTER=$(node scripts/db-health.mjs 2>/dev/null || echo '{"healthy":false}')
      if echo "$AFTER" | grep -q '"healthy":true'; then
        echo "$LOG_PREFIX دیتابیس از $SRC بازیابی شد → $AFTER"
        break
      fi
      echo "$LOG_PREFIX ⚠ $SRC سلامت را برنگرداند — تلاش با منبع بعدی..."
    done
    # همگام‌سازی اسکیما — اگر بعد از آخرین اسنپ‌شات مدلی اضافه شده باشد
    npx prisma db push --skip-generate >/dev/null 2>&1 || true
  fi
fi

# ─── B) storage (تصاویر و رسانه‌ها) ───
STORAGE_FILES=$(find storage -type f 2>/dev/null | head -1)
if [ -z "$STORAGE_FILES" ] && [ -f db/storage-backup.tar.gz ]; then
  echo "$LOG_PREFIX storage خالی است — استخراج از بکاپ..."
  rm -rf db/.restore-tmp
  mkdir -p db/.restore-tmp
  if tar -xzf db/storage-backup.tar.gz -C db/.restore-tmp 2>/dev/null; then
    rm -rf storage
    mv db/.restore-tmp/storage storage
    echo "$LOG_PREFIX storage بازیابی شد ($(find storage -type f | wc -l) فایل)"
  else
    echo "$LOG_PREFIX ⚠ استخراج بکاپ storage ناموفق بود"
  fi
  rm -rf db/.restore-tmp
fi

# ─── C) کلیدهای .env (JWT_SECRET / SMS_ENC_KEY و ...) ───
# فقط کلیدهای غایب را از بکاپ الحاق می‌کند — موارد موجود دست‌نخورده
if [ -f db/env-backup ]; then
  CHANGED=0
  while IFS= read -r line || [ -n "$line" ]; do
    KEY="${line%%=*}"
    # ردیف کامنت/خالی/بدون = را رد کن
    case "$KEY" in ""|\#*) continue ;; esac
    echo "$line" | grep -q "=" || continue
    if ! grep -q "^${KEY}=" .env 2>/dev/null; then
      echo "$line" >> .env
      CHANGED=$((CHANGED+1))
    fi
  done < db/env-backup
  [ "$CHANGED" -gt 0 ] && echo "$LOG_PREFIX $CHANGED کلید از env-backup الحاق شد (JWT/رمزنگاری پیامک)"
fi

# ─── گارد پس از بوت (درس Task 47) ───
# پلتفرم گاهی ~۷۵ ثانیه بعد از بوت فایل‌های gitignored را با آرشیو کهنه
# بازمی‌گرداند و دیتابیس ترمیم‌شده را له می‌کند. این گارد ۸ دقیقه
# سلامت را چک می‌کند و در صورت clobber نرم-بازسازی می‌کند.
# (قفل داخلی از چند نمونه هم‌زمان جلوگیری می‌کند)
( setsid nohup bash /home/z/my-project/scripts/db-postboot-guard.sh >/dev/null 2>&1 & )

# ─── ری‌وایو سرور (فقط حالت دستی) ───
if [ "$MODE" != "--no-revive" ]; then
  echo "$LOG_PREFIX راه‌اندازی سرور با watchdog..."
  bash scripts/revive-preview.sh >/dev/null 2>&1
fi

exit 0
