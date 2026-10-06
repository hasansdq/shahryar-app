#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# شهریار — deploy.sh (استقرار/به‌روزرسانی بدون از دست رفتن داده)
# ═══════════════════════════════════════════════════════════════
# روی سرور، از ریشه‌ی پروژه اجرا کنید:
#   bash docker/deploy.sh              # به‌روزرسانی کامل (بکاپ خودکار قبل)
#   bash docker/deploy.sh --no-backup  # بدون بکاپ قبل از دیپلوی
#   bash docker/deploy.sh --seed       # نصب تازه + Seed اولیه
#
# چیزی که این اسکریپت «نمی‌کند»:
#   • هرگز docker compose down -v نمی‌زند (پاک‌کردن volume = پاک‌شدن داده)
#   • هرگز docker-data/ را لمس نمی‌کند
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

# ─── پرچم‌ها ───
DO_BACKUP=1
DO_SEED=0
for arg in "$@"; do
  case "$arg" in
    --no-backup) DO_BACKUP=0 ;;
    --seed)      DO_SEED=1 ;;
    *) echo "آرگومان ناشناخته: $arg"; exit 1 ;;
  esac
done

# ─── پیش‌پردازش ───
if [ ! -f .env.docker ]; then
  echo "✗ فایل .env.docker یافت نشد."
  echo "  ابتدا: cp .env.docker.example .env.docker  و مقادیر را تنظیم کنید."
  exit 1
fi

if grep -q '^JWT_SECRET=CHANGE_ME' .env.docker 2>/dev/null; then
  echo "✗ JWT_SECRET هنوز مقدار پیش‌فرض است!"
  echo "  روی سرور بسازید:  openssl rand -hex 32"
  echo "  و در .env.docker جایگزین CHANGE_ME کنید."
  exit 1
fi

# SMS_ENC_KEY باید دقیقاً ۶۴ کاراکتر hex باشد (۶۴=۳۲بایت) — کلید
# رمزنگاری اعتبارنامه‌ی پنل پیامک؛ بدون آن، ذخیره‌ی تنظیمات پیامک و
# ثبت‌نام با کد پیامکی بعد از ری‌استارت بی‌صدا می‌شکند.
if ! grep -qE '^SMS_ENC_KEY=[0-9a-fA-F]{64}$' .env.docker 2>/dev/null; then
  echo "✗ SMS_ENC_KEY معتبر نیست (یا پیش‌فرض است، یا ۶۴ کاراکتر hex نیست)!"
  echo "  روی سرور بسازید:  openssl rand -hex 32"
  echo "  و در .env.docker جلوی SMS_ENC_KEY= قرار دهید."
  echo "  ⚠ این کلید باید بین ری‌استارت‌ها ثابت بماند — بعداً عوضش نکنید."
  exit 1
fi

APP_PORT="$(grep -E '^APP_PORT=' .env.docker | tail -1 | cut -d= -f2 || true)"
APP_PORT="${APP_PORT:-3100}"
APP_BIND="$(grep -E '^APP_BIND=' .env.docker | tail -1 | cut -d= -f2 || true)"
APP_BIND="${APP_BIND:-127.0.0.1}"

# ─── Compose با env-file صحیح ───
# ⚠️ docker compose به‌طور پیش‌فرض فقط فایل .env را برای جایگذاری
# متغیرها می‌خواند (APP_PORT/APP_BIND/TZ) — نه .env.docker! بدون
# --env-file، پورت/bind تعریف‌شده در .env.docker نادیده گرفته می‌شد
# و همیشه پیش‌فرض 3100 اعمال می‌شد. همه‌ی فراخوانی‌ها از این تابع
# عبور می‌کنند تا رفتار یکسان و پیش‌بین‌پذیر بماند.
compose() {
  docker compose --env-file .env.docker "$@"
}

mkdir -p docker-data/media docker-data/backups secrets

echo "──────────────────────────────────────────"
echo "  🚀 استقرار شهریار — $(date '+%Y-%m-%d %H:%M:%S')"
echo "  پورت میزبان: ${APP_BIND}:${APP_PORT}"
echo "──────────────────────────────────────────"

# ─── ۱) بکاپ پیش از دیپلوی (اگر دیتابیس موجود است) ───
# ⚠️ شکست بکاپ = توقف کامل دیپلوی. ادامه‌ی دیپلوی پس از بکاپِ ناموفق
# یعنی تغییر اسکیمای دیتابیس بدون تور ایمنی — در صورت خرابی، هیچ
# نقطه‌ی بازگشتی وجود نخواهد داشت. (دستی/عمدی: پرچم --no-backup)
if [ "$DO_BACKUP" = "1" ] && [ -f docker-data/custom.db ]; then
  echo "📦 گام ۱/۵: بکاپ پیش از دیپلوی…"
  if ! bash docker/backup.sh "pre-deploy"; then
    echo "✗ بکاپ پیش از دیپلوی ناموفق بود — برای حفاظت از داده، دیپلوی متوقف شد."
    echo "  عیب‌یابی:  bash docker/backup.sh pre-deploy"
    echo "  (فقط اگر مطمئنید):  bash docker/deploy.sh --no-backup"
    exit 1
  fi
else
  if [ "$DO_BACKUP" = "1" ]; then
    echo "📦 گام ۱/۵: بدون بکاپ (دیتابیس تازه — چیزی برای بکاپ نیست)"
  else
    echo "📦 گام ۱/۵: بدون بکاپ (--no-backup — خودتان مسئولیت را پذیرفته‌اید)"
  fi
fi

# ─── ۲) ساخت ایمیج‌های جدید ───
echo "🔨 گام ۲/۵: ساخت ایمیج…"
compose build

# ─── ۳) Seed (اختیاری — فقط نصب تازه) ───
if [ "$DO_SEED" = "1" ]; then
  echo "🌱 گام ۳/۵: Seed اولیه…"
  compose --profile tools run --rm seed
else
  echo "🌱 گام ۳/۵: بدون Seed (داده‌های موجود حفظ می‌شوند)"
fi

# ─── ۴) اجرا (migrate خودکار قبل از اپ اجرا می‌شود) ───
echo "▶️  گام ۴/۵: راه‌اندازی کانتینرها…"
compose up -d

# ─── ۵) انتظار برای سلامت ───
echo "❤️  گام ۵/۵: بررسی سلامت…"
STATUS="starting"
for i in $(seq 1 45); do
  STATUS="$(docker inspect --format '{{.State.Health.Status}}' shahryar-app 2>/dev/null || echo "starting")"
  [ "$STATUS" = "healthy" ] && break
  [ "$STATUS" = "unhealthy" ] && break
  sleep 2
done

echo "──────────────────────────────────────────"
compose ps
echo "──────────────────────────────────────────"

if [ "$STATUS" = "healthy" ]; then
  echo "✅ استقرار موفق — شهریار سالم روی ${APP_BIND}:${APP_PORT} سرو می‌شود."
  echo "   سلامت:      curl http://${APP_BIND}:${APP_PORT}/api/health"
  echo "   پنل مدیریت: http(s)://<دامنه‌ی-پراکسی‌شده>/shah-ad"
  echo "   لاگ زنده:    docker compose --env-file .env.docker logs -f app"
  echo "   ⚠ سلامت اپ ≠ سلامت سرویس‌های AI — بعد از دیپلوی تست بدهید:"
  echo "     پنل مدیریت ← هوش مصنوعی ← «سلامت سرویس‌های AI» ← اجرای آزمون"
else
  echo "⚠ وضعیت سلامت: ${STATUS}"
  echo "  لاگ‌ها را ببینید:  docker compose --env-file .env.docker logs --tail=100 app migrate"
  exit 1
fi
