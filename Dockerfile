# syntax=docker/dockerfile:1
# ═══════════════════════════════════════════════════════════════
# شهریار — Dockerfile چندمرحله‌ای (Multi-Stage)
# ═══════════════════════════════════════════════════════════════
# اصول طراحی:
#  ۱) «هیچ داده امنیتی وارد ایمیج نمی‌شود» — دیتابیس، .env و
#     رسانه‌های کاربران با .dockerignore از Build Context حذف می‌شوند
#     و در مرحله‌ی runner یک ضامن حذفی هم برای اطمینان وجود دارد.
#  ۲) «داده‌ها بین دیپلوی‌ها می‌مانند» — همه‌ی داده‌های اجرایی در
#     مسیر /app/data قرار می‌گیرد که به Volume میزبان مونت می‌شود.
#  ۳)Base یکسان برای همه مراحل (node:22-bookworm-slim) → موتورهای
#     بومی Prisma و sharp در build و run دقیقاً یکسان‌اند.
#  ۴)اجرای غیر root: entrypoint با root شروع می‌کند (برای اصلاح
#     مالکیت Volume) و بلافاصله با gosu به کاربر shahryar سوییچ
#     می‌کند — الگوی استاندارد اپ‌های SQLite با bind-mount.
#  ۵)استفاده از nginx به‌عنوان reverse-proxy الزامی نیست؛ چون پورت‌های
#     80/443 روی سرور DirectAdmin اشغال‌اند، اپ روی 127.0.0.1:APP_PORT
#     سرو می‌شود و Apache/nginx خود DirectAdmin به آن پراکسی می‌کند.
#
# مراحل:
#   base     → تصویر پایه + کاربر + gosu
#   deps     → نصب وابستگی‌ها (لایه‌ی قابل‌کَش)
#   builder  → next build + بسته‌ی standalone (postbuild کامل)
#   migrator → ابزار مهاجرت/Seed (پراکسز موقت؛ در ایمیج نهایی نیست)
#   runner   → ایمیج نهایی مینیمال و امن
# ═══════════════════════════════════════════════════════════════

ARG NODE_VERSION=22

# ─────────────────────────── base ───────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
# openssl برای موتور پایگاه‌داده Prisma 6 روی Debian slim الزامی است
# (تشخیص/بارگذاری engine بدون کتابخانه‌های OpenSSL شکست می‌خورد —
# توصیه‌ی رسمی مستندات Prisma برای ایمیج‌های debian-slim).
# gosu برای سوییچ امن root → کاربر shahryar در entrypoint.
RUN apt-get update \
 && apt-get install -y --no-install-recommends gosu openssl \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --gid 1001 shahryar \
 && useradd --uid 1001 --gid shahryar --shell /usr/sbin/nologin --create-home shahryar

# ─────────────────────────── deps ───────────────────────────
# نصب وابستگی‌ها در لایه‌ی مستقل تا تغییر کد، کش npm را باطل نکند.
# postinstall (prisma generate) به prisma/schema.prisma نیاز دارد.
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

# ────────────────────────── builder ──────────────────────────
FROM deps AS builder
WORKDIR /app
COPY . .
# NODE_ENV=production → distDir = .next-prod (جداسازی از .next)
# دیتابیس build یک فایل موقتِ خالی است — هیچ داده‌ی واقعی لمس نمی‌شود.
# ⚠️ هیچ رازی (JWT_SECRET/SMS_ENC_KEY/...) اینجا تعریف نمی‌شود — کلیدها
# فقط در زمان اجرا از env_file تزریق می‌شوند و هرگز وارد ایمیج نمی‌شوند.
ENV NODE_ENV=production \
    NEXT_BUILD_DIR=.next-prod \
    DATABASE_URL=file:/build-runtime/custom.db
RUN mkdir -p /build-runtime \
 && npx prisma db push --skip-generate

# ─── گیت تایپ‌ها (جدا از next build) ───
# next.config.ts با ignoreBuildErrors:true ساخته می‌شود (تاب‌آوری build)؛
# بنابراین بررسی کامل تایپ‌ها «پیش از انتشار» اینجا به‌صورت مستقل و
# سخت‌گیرانه انجام می‌شود: شکست tsc = شکست build ایمیج = توقف دیپلوی.
# tsconfig.typecheck.json فایل‌های تولیدی سرور dev را کنار می‌گذارد تا
# نتیجه قطعی باشد (بدون false-positive از .next گذرا).
RUN npm run typecheck

RUN npm run build

# ───────────────────────── migrator ──────────────────────────
# ابزار یک‌بارمصرف مهاجرت/Seed — با node_modules کامل + CLI پرایزما.
# در هر دیپلوی پیش از اپ اجرا می‌شود تا اسکیمای دیتابیس همیشه
# با نسخه‌ی کد هم‌گام باشد (روی volume؛ بدون دست‌زدن به داده‌ها).
FROM deps AS migrator
WORKDIR /app
COPY db/schema.sql ./db/schema.sql
COPY scripts/docker-seed.mjs ./scripts/docker-seed.mjs
COPY docker/docker-migrate.sh /usr/local/bin/docker-migrate.sh
RUN chmod +x /usr/local/bin/docker-migrate.sh
ENV DATA_DIR=/app/data
ENTRYPOINT ["docker-migrate.sh"]

# ────────────────────────── runner ──────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/app/data

# بسته‌ی standalone آماده‌ی دیپلوی (شامل static، public،
# node_modules ردیابی‌شده، closure پکیج‌های runtime و...)
COPY --from=builder /app/.next-prod/standalone ./

# ⛔ ضامن امنیتی — به‌رغم .dockerignore، هیچ فایل راز/داده‌ای
# نباید در ایمیج نهایی باشد. Turbopack فایل‌های ریشه را در
# standalone «آینه» می‌کند (حتی db/env-backup حاوی راز!)، پس:
#   • پوشه‌های داده/رسانه حذف می‌شوند
#   • db/ فقط schema.sql و scripts/ فقط docker-backup.mjs نگه می‌دارند
#   • خودراستی‌آزمایی: .env نباشد، schema.sql باشد — وگرنه build می‌شکند
RUN rm -f /app/.env /app/.env.* \
 && rm -rf /app/storage /app/public/uploads /app/screenshots /app/upload \
           /app/docker-data /app/docker-sim /app/secrets /app/backups /app/docker \
           /app/download /app/downloads /app/skills /app/examples /app/tests \
 && find /app/db -mindepth 1 -maxdepth 1 ! -name 'schema.sql' -exec rm -rf '{}' + \
 && find /app/scripts -mindepth 1 -maxdepth 1 ! -name 'docker-backup.mjs' -exec rm -rf '{}' + \
 && mkdir -p /app/data /app/.next-prod/cache \
 && chown -R shahryar:shahryar /app/data /app/.next-prod/cache \
 && test ! -e /app/.env && test ! -e /app/db/env-backup \
 && test -f /app/db/schema.sql && test -f /app/server.js

COPY docker/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
COPY scripts/docker-backup.mjs /app/scripts/docker-backup.mjs
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
 && chown shahryar:shahryar /app/scripts/docker-backup.mjs

# کانتینر با root بالا می‌آید تا entrypoint مالکیت volume را
# اصلاح کند؛ سپس با gosu به کاربر shahryar سوییچ می‌شود.
EXPOSE 3000

# /api/health = پروب عمومی مخصوص مانیتورینگ (بدون احراز هویت؛
# /api/diag از ممیزی امنیتی به بعد فقط با نشست مدیر پاسخ می‌دهد)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>r.json()).then(j=>process.exit(j&&j.ok?0:1)).catch(()=>process.exit(1))"]

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
