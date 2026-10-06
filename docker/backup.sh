#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# شهریار — backup.sh (بکاپ کامل دیتابیس + رسانه‌ها)
# ═══════════════════════════════════════════════════════════════
# اجرا از ریشه‌ی پروژه یا هر جا:  bash docker/backup.sh [برچسب]
#
# خروجی در پوشه‌ی backups/ کنار پروژه:
#   • backups/db-<ts>[-برچسب].db        → اسنپ‌شات سازگار SQLite
#     (VACUUM INTO از داخل کانتینرِ در حال اجرا — بدون توقف سرویس)
#   • backups/media-<ts>[-برچسب].tar.gz → آرشیو رسانه‌های کاربران
#
# بازیابی (DOCKER-DEPLOY.md §بازیابی):
#   docker compose stop app
#   cp backups/db-XXXX.db docker-data/custom.db
#   tar xzf backups/media-XXXX.tar.gz -C docker-data
#   docker compose start app
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

LABEL="${1:-}"
TS="$(date +%Y%m%d-%H%M%S)"
SUFFIX=""
[ -n "$LABEL" ] && SUFFIX="-${LABEL}"

mkdir -p backups docker-data/backups

# ─── Compose با env-file صحیح ───
# همان قاعده‌ی deploy.sh: بدون --env-file، متغیرهای .env.docker
# (APP_PORT/APP_BIND) در جایگذاری compose نادیده گرفته می‌شوند.
COMPOSE="docker compose"
if [ -f .env.docker ]; then
  COMPOSE="docker compose --env-file .env.docker"
fi

# ─── ۱) اسنپ‌شات سازگار دیتابیس (VACUUM INTO) ───
DB_TARGET="backups/db-${TS}${SUFFIX}.db"
if $COMPOSE ps --status running app 2>/dev/null | grep -q shahryar-app; then
  echo "🗄  اسنپ‌شات دیتابیس (بدون توقف سرویس)…"
  $COMPOSE exec -T app node /app/scripts/docker-backup.mjs "${DB_TARGET}"
  # فایل داخل volume ساخته شده — به پوشه‌ی backups کنار پروژه هم کپی کن
  if [ -f "docker-data/${DB_TARGET}" ]; then
    cp "docker-data/${DB_TARGET}" "${DB_TARGET}"
  fi
else
  # کانتینر در حال اجرا نیست → کپی ساده (نبود writer یعنی سازگار است)
  if [ -f docker-data/custom.db ]; then
    echo "🗄  کانتینر متوقف است — کپی مستقیم دیتابیس…"
    cp docker-data/custom.db "${DB_TARGET}"
  else
    echo "⚠ دیتابیس موجود نیست — از بکاپ دیتابیس صرف‌نظر شد"
  fi
fi

# ─── ۲) آرشیو رسانه‌ها ───
MEDIA_TARGET="backups/media-${TS}${SUFFIX}.tar.gz"
if [ -d docker-data/media ] && [ -n "$(ls -A docker-data/media 2>/dev/null)" ]; then
  echo "🖼  آرشیو رسانه‌ها…"
  tar czf "${MEDIA_TARGET}" -C docker-data media
else
  echo "⚠ پوشه‌ی media خالی/ناموجود است — از آرشیو رسانه صرف‌نظر شد"
fi

echo "──────────────────────────────────────────"
echo "✅ بکاپ کامل شد:"
[ -f "${DB_TARGET}" ]   && echo "   • ${DB_TARGET}   ($(du -h "${DB_TARGET}" | cut -f1))"
[ -f "${MEDIA_TARGET}" ] && echo "   • ${MEDIA_TARGET} ($(du -h "${MEDIA_TARGET}" | cut -f1))"
echo "──────────────────────────────────────────"

# ─── ۳) نگهداری: فقط ۲۰ بکاپ آخر هر نوع ───
# نبود فایل مطابق الگو خطا نیست؛ خطاهای واقعی ls/rm همچنان دیپلوی را متوقف می‌کنند.
shopt -s nullglob
db_backups=(backups/db-*.db)
media_backups=(backups/media-*.tar.gz)
if (( ${#db_backups[@]} > 20 )); then
  ls -1t -- "${db_backups[@]}" | tail -n +21 | xargs -r rm -f
fi
if (( ${#media_backups[@]} > 20 )); then
  ls -1t -- "${media_backups[@]}" | tail -n +21 | xargs -r rm -f
fi
exit 0
