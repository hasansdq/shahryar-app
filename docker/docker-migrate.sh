#!/bin/sh
# ═══════════════════════════════════════════════════════════════
# شهریار — docker-migrate.sh (مرحله‌ی migrator)
# ═══════════════════════════════════════════════════════════════
# در هر دیپلوی، پیش از بالا آمدن اپ اجرا می‌شود (سرویس migrate
# در docker-compose با depends_on گره خورده است):
#   • حالت پیش‌فرض (بدون آرگومان): prisma db push روی Volume →
#     اسکیما همیشه با نسخه‌ی کد هم‌گام است؛ تغییرات افزایشی خودکار
#     اعمال می‌شوند و اگر تغییری «مخرب» باشد، بدون --accept-data-loss
#     متوقف می‌شود (محافظ داده در برابر به‌روزرسانی‌های خطرناک).
#   • seed → اجرای Seed اولیه (نصب تازه):
#       docker compose --profile tools run --rm seed
#   • هر آرگومان دیگر → مستقیماً اجرا می‌شود (ابزار مدیریت دستی):
#       docker compose run --rm migrate npx prisma db push --accept-data-loss
#       docker compose run --rm migrate sh   (شل عیب‌یابی)
#   • اصلاح مالکیت فایل‌های ساخته‌شده برای کاربر غیر root اپ
#     (اگر فایلی با دستی‌سازی‌های بالا مالکیتش عوض شده باشد،
#     entrypoint اپ در اجرای بعدی هم chown -R می‌کند — پوشش کامل).
# ═══════════════════════════════════════════════════════════════
set -e

DATA_DIR="${DATA_DIR:-/app/data}"
APP_UID="${APP_UID:-1001}"
APP_GID="${APP_GID:-1001}"

mkdir -p "${DATA_DIR}"
export DATABASE_URL="file:${DATA_DIR}/custom.db"

case "${1:-}" in
  "")
    echo "[migrate] هم‌گام‌سازی اسکیمای دیتابیس (${DATABASE_URL}) …"
    npx prisma db push --skip-generate
    ;;
  seed)
    echo "[migrate] هم‌گام‌سازی اسکیما + Seed اولیه …"
    npx prisma db push --skip-generate
    node scripts/docker-seed.mjs
    ;;
  *)
    # اجرای مستقیم دستور دلخواه (مدیریت دستی / عیب‌یابی)
    exec "$@"
    ;;
esac

# ─── مالکیت برای کاربر اپ (اجرای بعدی non-root) ───
if [ "$(id -u)" = "0" ]; then
  chown -R ${APP_UID}:${APP_GID} "${DATA_DIR}" || true
fi

echo "[migrate] ✓ اسکیمای دیتابیس آماده است"
