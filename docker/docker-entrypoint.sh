#!/bin/sh
# ═══════════════════════════════════════════════════════════════
# شهریار — docker-entrypoint.sh (مرحله‌ی runner)
# ═══════════════════════════════════════════════════════════════
# مسئولیت‌ها:
#  ۱) آماده‌سازی مسیر داده‌ی ماندگار (/app/data ← Volume میزبان)
#  ۲) تضمین وجود فایل دیتابیس (حتی بدون سرویس migrate، اپ هرگز
#     به مسیر اشتباه fallback نمی‌کند) + schema.sql برای خودشفایی
#  ۳) انتقال کانفیگ هوش مصنوعی از پوشه‌ی secrets (اگر مونت شده
#     باشد) به مسیری که SDK می‌خواند — بدون ورود به ایمیج
#  ۴) اصلاح مالکیت Volume و سوییچ به کاربر غیر root با gosu
# ═══════════════════════════════════════════════════════════════
set -e

DATA_DIR="${DATA_DIR:-/app/data}"
APP_USER="${APP_USER:-shahryar}"

# ─── پیش‌فرض‌های مسیر (قابل‌بازنویسی با env کانتینر) ───
export DATABASE_URL="${DATABASE_URL:-file:${DATA_DIR}/custom.db}"
export MEDIA_DIR="${MEDIA_DIR:-${DATA_DIR}/media}"

# ─── ضامن رازهای الزامی (فقط production، قبل از هر کاری) ───
# بررسی کلید اینجا «به زمان اجرا» منتقل شده است، نه build — کلید واقعی
# هرگز وارد ایمیج نمی‌شود؛ فقط از env_file (.env.docker) تزریق می‌شود.
# fail-closed: بدون کلیدِ معتبر، اپ اصلاً بالا نمی‌آید (به‌جای آنکه
# لاگین‌ها/پیامک‌ها به‌صورت پنهان شکست بخورند).
if [ "${NODE_ENV:-}" = "production" ]; then
  # JWT_SECRET: حداقل ۱۶ کاراکتر و نه مقدار پیش‌فرض CHANGE_ME
  case "${JWT_SECRET:-}" in
    ""|CHANGE_ME*)
      echo "[entrypoint] ✗ JWT_SECRET تنظیم نشده/نامعتبر است." >&2
      echo "             در .env.docker مقدار  openssl rand -hex 32  را قرار دهید و دوباره اجرا کنید." >&2
      exit 1
      ;;
  esac
  if [ "${#JWT_SECRET}" -lt 16 ]; then
    echo "[entrypoint] ✗ JWT_SECRET بسیار کوتاه است (حداقل ۱۶ کاراکتر)." >&2
    exit 1
  fi
  # SMS_ENC_KEY: دقیقاً ۶۴ کاراکتر hex (۳۲ بایت) — کلید رمزنگاری
  # اعتبارنامه‌ی پنل پیامک؛ باید بین ری‌استارت‌ها ثابت بماند.
  case "${SMS_ENC_KEY:-}" in
    ""|CHANGE_ME*)
      echo "[entrypoint] ✗ SMS_ENC_KEY تنظیم نشده/نامعتبر است." >&2
      echo "             در .env.docker مقدار  openssl rand -hex 32  را برای SMS_ENC_KEY قرار دهید" >&2
      echo "             (بدون آن، ذخیره‌ی تنظیمات پیامک و ثبت‌نام با کد پیامکی کار نمی‌کند)." >&2
      exit 1
      ;;
  esac
  if ! echo "${SMS_ENC_KEY}" | grep -qE '^[0-9a-fA-F]{64}$'; then
    echo "[entrypoint] ✗ SMS_ENC_KEY باید دقیقاً ۶۴ کاراکتر hex باشد (خروجی openssl rand -hex 32)." >&2
    exit 1
  fi
  echo "[entrypoint] ✓ رازهای الزامی production (JWT_SECRET / SMS_ENC_KEY) موجودند"
fi

if [ "$(id -u)" = "0" ]; then
  # ─── آماده‌سازی داده‌ی ماندگار ───
  mkdir -p "${DATA_DIR}/media" "${DATA_DIR}/backups"

  # دیتابیس نبود → فایل خالی (migrate جداول را می‌سازد؛ در نبودش
  # هم خودشفاییِ runtime با schema.sql جداول را ایجاد می‌کند)
  [ -f "${DATA_DIR}/custom.db" ] || touch "${DATA_DIR}/custom.db"

  # schema.sql کنار دیتابیس (نخستین کاندیدای خودشفاییِ runtime)
  [ -f "${DATA_DIR}/schema.sql" ] || cp /app/db/schema.sql "${DATA_DIR}/schema.sql"

  # ─── کانفیگ هوش مصنوعی (اختیاری، فقط runtime) ───
  # secrets/z-ai-config روی میزبان → /run/secrets-shahryar (read-only)
  if [ -f /run/secrets-shahryar/z-ai-config ]; then
    cp /run/secrets-shahryar/z-ai-config /app/.z-ai-config
    chown ${APP_USER}:${APP_USER} /app/.z-ai-config
    chmod 600 /app/.z-ai-config
    echo "[entrypoint] کانفیگ هوش مصنوعی از secrets بارگذاری شد"
  fi

  # ─── مالکیت Volume (bind-mount ممکن است root-owned باشد) ───
  chown -R ${APP_USER}:${APP_USER} "${DATA_DIR}"

  # ─── سوییچ به کاربر غیر root ───
  if command -v gosu >/dev/null 2>&1 && id "${APP_USER}" >/dev/null 2>&1; then
    exec gosu "${APP_USER}" "$0" "$@"
  fi
  # fallback: محیط‌های بدون gosu (مثلاً شبیه‌سازی محلی) — ادامه با کاربر فعلی
  echo "[entrypoint] gosu/کاربر ${APP_USER} در دسترس نیست — ادامه با کاربر فعلی"
fi

exec "$@"
