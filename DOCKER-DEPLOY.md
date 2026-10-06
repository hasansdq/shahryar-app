# 🐳 شهریار — راهنمای کامل استقرار با Docker روی سرور DirectAdmin

این راهنما، استقرار امن وب‌اپلیکیشن شهریار را روی **سرور مجازی دارای کنترل‌پنل DirectAdmin** (که پورت‌های ۸۰ و ۴۴۳ آن اشغال است) به‌صورت کاملاً داکرایز شده شرح می‌دهد.

## 📐 معماری استقرار

```
                          اینترنت
                             │
                    ┌────────▼─────────┐
                    │  DirectAdmin     │  ← پورت‌های 80/443 (اشغال‌شده)
                    │  Apache / nginx  │     SSL هم همین‌جا终结 می‌شود
                    │  (reverse-proxy) │
                    └────────┬─────────┘
                             │  پراکسی داخلی (پیکربندی از پنل DA — §۵)
                             ▼
                 127.0.0.1:3100  (APP_PORT)
                             │
              ┌──────────────▼───────────────┐
              │   کانتینر Docker: shahryar   │
              │   shahryar-app (Next.js)     │  restart: unless-stopped
              │   غیر root (کاربر shahryar) │
              │   ایمیج بدون هیچ راز/داده‌ای │
              └──────────────┬───────────────┘
                             │  /app/data  (bind mount)
                             ▼
                   ./docker-data/  روی سرور
                   ├── custom.db    ← دیتابیس SQLite (ماندگار)
                   ├── schema.sql   ← خودشفایی اسکیما
                   ├── media/       ← رسانه‌های آپلودی کاربران (ماندگار)
                   └── backups/     ← اسنپ‌شات‌های خودکار
```

**چرا این طراحی؟** چون ۸۰/۴۴۳ در اختیار DirectAdmin است، اپ داخل Docker روی `127.0.0.1:3100` سرو می‌شود و همان Apache/nginx ای که DirectAdmin مدیریتش می‌کند، ترافیک دامنه‌ی شما را پراکسی می‌کند. نتیجه: دامنه + SSL رایگان Let's Encrypt از خود DirectAdmin، بدون هیچ تداخلی با سایت‌های دیگر همان سرور.

## 🔐 تضمین‌های امنیتی (چرا هیچ داده‌ای وارد ایمیج نمی‌شود)

| مورد | وضعیت | مکانیزم |
|------|--------|---------|
| دیتابیس (`custom.db`) | ⛔ در ایمیج نیست | `.dockerignore` (`db/*` فقط schema.sql) + ضامن حذف در مرحله‌ی `runner` |
| فایل `.env` / `.env.docker` | ⛔ در ایمیج نیست | `.dockerignore` + ضامن حذف؛ فقط `env_file` در زمان اجرا |
| **`db/env-backup` (نسخه پشتیبان رازها)** | ⛔ در ایمیج نیست | Turbopack فایل‌های ریشه را در standalone آینه می‌کند — با `db/*` بلاک و در runner با find حذف می‌شود |
| رسانه‌های کاربران (`storage/media`، `public/uploads`) | ⛔ در ایمیج نیست | `.dockerignore` + ضامن حذف؛ همه در Volume `docker-data/media` |
| اسکرین‌شات‌ها/خروجی‌های تست | ⛔ در ایمیج نیست | `.dockerignore` (حجم ایمیج کوچک می‌ماند) |
| کلید JWT (`JWT_SECRET`) | ⛔ در ایمیج نیست | فقط `.env.docker` روی سرور (خارج از گیت و ایمیج) |
| کانفیگ هوش مصنوعی (`.z-ai-config`) | ⛔ در ایمیج نیست | پوشه‌ی `secrets/` → مونت runtime → کپی به `/app/.z-ai-config` |
| هش رمزهای کاربران/مدیر | ⛔ در ایمیج نیست | داخل دیتابیس → Volume |
| کد اپ + اسکیمای DDL | ✅ در ایمیج است | خطر امنیتی ندارد (schema.sql فقط `CREATE TABLE IF NOT EXISTS` است) |

رازها فقط از دو کانال runtime وارد می‌شوند: **env_file** (`JWT_SECRET`) و **bind-mount** پوشه‌ی `secrets/` — هر دو روی سرورِ شما می‌مانند و اگر ایمیج را به هر کسی بدهید، هیچ سری با خودش نمی‌برد. ضامن نهایی در `Dockerfile` حتی «خودش را آزمایش می‌کند»: اگر `.env` یا `env-backup` در ایمیج مانده باشد یا `schema.sql`/`server.js` غایب باشد، خود build می‌شکند.

## 🗄 تضمین ماندگاری داده بین دیپلوی‌ها

همه‌ی داده‌های پویا فقط در **یک مسیر** زندگی می‌کنند: `docker-data/` (که به `/app/data` مونت شده):

- `docker-data/custom.db` — کل دیتابیس (کاربران، اهداف، مالی، گفتگوها، تنظیمات CMS و…)
- `docker-data/media/` — همه‌ی فایل‌های آپلودی
- `docker-data/backups/` — اسنپ‌شات‌های خودکار

به‌روزرسانی یعنی: **ایمیج جدید ساخته شود، کانتینر جایگزین شود، Volume دست‌نخورده بماند.** اسکریپت `docker/deploy.sh` دقیقاً همین کار را می‌کند؛ قبل از هر دیپلوی هم بکاپ خودکار می‌گیرد و سرویس `migrate` قبل از بالا آمدن اپ، اسکیمای دیتابیس را با نسخه‌ی جدید کد هم‌گام می‌کند (تغییرات افزایشی خودکار؛ تغییرات مخرب **متوقف می‌شوند** تا داده‌ای نابود نشود).

> ⛔ **تنها راه از دست دادن داده:** اجرای `docker compose down -v` یا حذف دستی پوشه‌ی `docker-data/`. هرگز این کار را نکنید.

---

## ۱) پیش‌نیازها روی سرور

- سرور مجازی با DirectAdmin و دسترسی **root** (SSH)
- حداقل ۲ گیگابایت RAM و ۵ گیگابایت فضای خالی
- Docker Engine ≥ 24 و Docker Compose v2 (§۲ نصب می‌شود)

بررسی وجود:

```bash
docker --version && docker compose version
```

## ۲) نصب Docker (اگر نبود)

### CentOS / AlmaLinux / Rocky (رایج‌ترین برای DirectAdmin)

```bash
dnf -y install dnf-plugins-core
dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
dnf -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
docker run --rm hello-world   # تست
```

### Ubuntu / Debian

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
docker run --rm hello-world   # تست
```

> نگران تداخل با DirectAdmin نباشید — Docker فقط پورت‌هایی را اشغال می‌کند که خودتان تعریف کنید (اینجا: ۳۱۰۰ روی loopback). فایروال csf در DirectAdmin به‌طور پیش‌فرض loopback را مسدود نمی‌کند.

## ۳) آوردن پروژه روی سرور

```bash
# گزینه الف) از گیت (توصیه‌شده)
git clone <آدرس-ریپوی-شهریار> ~/shahryar
cd ~/shahryar

# گزینه ب) انتقال مستقیم از ماشین فعلی (بدون داده‌های حساس — آنها جداگانه می‌روند)
rsync -av --exclude node_modules --exclude .next --exclude .next-prod \
      --exclude docker-data --exclude docker-sim --exclude .env --exclude secrets \
      --exclude storage --exclude public/uploads --exclude screenshots --exclude upload \
      --exclude 'db/env-backup' --exclude 'db/storage-backup.tar.gz' --exclude 'db/*.db' \
      --exclude backups \
      ./ user@SERVER:~/shahryar/
```

## ۴) اولین استقرار

### ۴-۱) پیکربندی رازها

```bash
cd ~/shahryar
cp .env.docker.example .env.docker
nano .env.docker
```

- **دو کلید حیاتی** را بسازید و جایگزین کنید (هر کدام یک‌بار اجرا؛ خروجی‌های متفاوت):

```bash
openssl rand -hex 32   # → JWT_SECRET  (امضای توکن نشست‌ها)
openssl rand -hex 32   # → SMS_ENC_KEY (رمزنگاری اعتبارنامه‌ی پنل پیامک)
```

> ⚠️ **SMS_ENC_KEY** باید بین ری‌استارت‌ها «ثابت» بماند — اگر بعداً عوض
> شود، رمز پنل پیامک ذخیره‌شده قابل رمزگشایی نیست و باید دوباره وارد شود.
> بدون این کلید، ذخیره‌ی تنظیمات پیامک و ثبت‌نام با کد پیامکی کار نمی‌کند.
> `deploy.sh` و `docker-entrypoint.sh` هر دو بدون این دو کلید متوقف می‌شوند.

- `APP_PORT` را در صورت نیاز تغییر دهید (پیش‌فرض ۳۱۰۰).
- اگر نصب **تازه** است (نه مهاجرت از سرور قبلی) مقادیر Seed را هم تنظیم کنید؛ در غیر این صورت خالی بگذارید.

> نکته: همه‌ی دستورات `docker compose` این راهنما باید با `--env-file .env.docker`
> اجرا شوند (در غیر این صورت Compose فایل `.env` را می‌خواند و
> `APP_PORT`/`APP_BIND` شما نادیده گرفته می‌شود). اسکریپت‌های `docker/`
> این کار را خودکار انجام می‌دهند؛ اگر دستی اجرا کردید همین پرچم را بگذارید.

### ۴-۲) کانفیگ هوش مصنوعی (اختیاری)

قابلیت‌های AI (هوشیار) به فایل کانفیگ سرویس مدل نیاز دارند. فایلی با این ساختار JSON بسازید:

```bash
mkdir -p secrets
nano secrets/z-ai-config
```

```json
{
  "baseUrl": "https://آدرس-سرویس-مدل/v1",
  "apiKey": "کلید-شما",
  "chatId": "",
  "userId": ""
}
```

> این فایل فقط در زمان اجرا مونت می‌شود و هرگز وارد ایمیج نمی‌شود. اگر نسازید، اپ کاملاً کار می‌کند ولی پاسخ‌های هوشیار با پیام خطای مهربانانه مواجه می‌شوند.

> ⚠️ **راستی‌آزمایی پس از استقرار:** «بالا آمدن سایت» سلامت قابلیت‌های AI را ثابت
> نمی‌کند — چت متنی می‌تواند از اندپوینت اختصاصی شما بیاید، اما **جستجوی وب،
> تولید تصویر و بینایی** همیشه به سرویس پیش‌فرض (ZAI) وابسته‌اند. بعد از
> هر استقرار/به‌روزرسانی، از «پنل مدیریت ← هوش مصنوعی ← سلامت سرویس‌های AI»
> آزمون سرویس‌ها را اجرا کنید (جزئیات در §۶-۱).

### ۴-۳) انتقال داده‌های موجود (فقط مهاجرت از سرور قبلی)

اگر می‌خواهید دیتای فعلی (کاربران، اهداف، مالی، رسانه‌ها) منتقل شود:

```bash
# روی سرور، داخل پوشه‌ی پروژه:
mkdir -p docker-data

# از ماشین فعلی، دیتابیس را کپی کنید:
scp db/custom.db user@SERVER:~/shahryar/docker-data/custom.db

# رسانه‌های آپلودی (معماری جدید — storage/media):
rsync -av storage/media/ user@SERVER:~/shahryar/docker-data/media/

# رسانه‌های قدیمی (اگر دارید — public/uploads):
# اپ زمان اجرا پوشه‌های قدیمی (avatars/، posts/، businesses/، …) را داخل
# همین volume می‌جوید و از مسیر کانونی /files سرو می‌کند:
rsync -av public/uploads/ user@SERVER:~/shahryar/docker-data/media/

# مالکیت (کانتینر با کاربر 1001 می‌نویسد؛ entrypoint خودش هم اصلاح می‌کند):
chown -R 1001:1001 ~/shahryar/docker-data
```

### ۴-۴) اجرا

```bash
bash docker/deploy.sh          # مهاجرت داده‌ی موجود
bash docker/deploy.sh --seed   # یا: نصب تازه با Seed اولیه
```

اسکریپت: بکاپ (اگر داده موجود باشد) → build ایمیج → (در حالت seed: Seed) → اجرای کانتینرها (اول migrate بعد app) → بررسی سلامت. در پایان باید `✅ استقرار موفق` را ببینید.

تست سریع:

```bash
curl http://127.0.0.1:3100/api/health   # {"ok":true,"db":"up"}
```

---

## ۵) اتصال از طریق DirectAdmin (پورت‌های ۸۰/۴۴۳ اشغال‌اند)

اپ شما الان روی `127.0.0.1:3100` سرو می‌شود. برای اینکه با دامنه و SSL از اینترنت در دسترس باشد، وب‌سرورِ خود DirectAdmin را پراکسی می‌کنیم. **در DirectAdmin برای هر دامنه یک بار**:

### گام اول: ایجاد دامنه در DirectAdmin

از پنل DA یک دامنه/ساب‌دامنه (مثلاً `app.yourdomain.ir`) برای کاربر مربوطه بسازید. هنوز DocumentRoot آن مهم نیست — فقط باید وجود داشته باشد تا کانفیگ وب‌سرورش ساخته شود.

### گام دوم (سناریو A): وب‌سرور پیش‌رو Apache — «Custom HTTPD Config»

1. وارد DirectAdmin به‌عنوان **admin** شوید → **Admin Tools → Customize httpd.conf** (یا «Custom HTTPD Configurations»).
2. دامنه‌ی خود را انتخاب کنید → فیلد ورودیِ کانفیگ سفارشی → این بلوک را بچسبانید:

```apache
ProxyRequests Off
ProxyPreserveHost On
ProxyTimeout 300

# WebSocket / streaming (چت هوشیار)
<Location />
    ProxyPass http://127.0.0.1:3100/ retry=0
    ProxyPassReverse http://127.0.0.1:3100/
</Location>

RequestHeader set X-Forwarded-Proto "https"
RequestHeader set X-Real-IP "expr=%{REMOTE_ADDR}"

# سقف بدنه‌ی درخواست: بزرگ‌ترین پیوست مجاز اپ ۳۰ مگابایت است
# (پیوست پست) — ۴۰ مگ برای حاشیه‌ی multipart. اگر این خط را
# نگذارید و DirectAdmin محدودیتی تعیین کرده باشد، آپلودهای
# بزرگ با خطای ۴۱۳ رد می‌شوند.
LimitRequestBody 41943040
```

3. ذخیره → rewrite httpd: در همان پنل «Rewrite Configs» یا از SSH: `systemctl reload httpd` (در برخی بیلدها `service httpd restart`).

تست: `curl -I http://app.yourdomain.ir` باید هدرهای Next.js را برگرداند.

### گام دوم (سناریو B): بیلد nginx_apache یا nginx — «Custom nginx Config»

اگر CustomBuild شما `nginx` یا `nginx_apache` است:

1. admin → **Customize nginx.conf** (در nginx_apache برای هر دامنه: «Custom HTTPD Config → nginx»).
2. در بلوک `server` دامنه اضافه کنید:

```nginx
location / {
    proxy_pass http://127.0.0.1:3100;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    # بزرگ‌ترین پیوست مجاز اپ ۳۰ مگابایت است (پیوست پست) —
    # ۴۰ مگ برای حاشیه‌ی multipart؛ بدون این خط nginx پیش‌فرض
    # ۱ مگ است و همه‌ی آپلودها ۴۱۳ می‌خورند:
    client_max_body_size 40m;
    # استریم پاسخ هوشیار:
    proxy_buffering off;
    proxy_read_timeout 300s;
    # WebSocket در آینده:
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

3. reload: `systemctl reload nginx` (یا از پنل DA).

### گام سوم: SSL (Let's Encrypt از خود DirectAdmin)

پنل DirectAdmin → **SSL Certificates** برای دامنه → «Free & automatic certificate from Let's Encrypt» → تیک دامنه و www → نصب. DirectAdmin تمدید خودکار آن را دارد. ترافیک اینترنت HTTPS می‌شود و پراکسیِ داخلی روی HTTP سالم است (روی loopback).

### سناریو C: بدون دامنه — دسترسی مستقیم IP:PORT

در `.env.docker` مقدار `APP_BIND=0.0.0.0` بگذارید و `bash docker/deploy.sh --no-backup`. سپس پورت را در فایروال DirectAdmin (csf) باز کنید: `csf -a 3100/tcp` سپس `csf -r`. اپ روی `http://SERVER_IP:3100` در دسترس است. (توصیه: فقط برای تست — SSL و دامنه از طریق سناریو A/B امن‌تر و حرفه‌ای‌تر است.)

---

## ۶) به‌روزرسانی/دیپلوی مجدد (داده‌ها می‌مانند!)

هر بار که کد جدید شد (git pull یا rsync جدید):

```bash
cd ~/shahryar
bash docker/deploy.sh
```

مکانیزم (به‌ترتیب): بکاپ خودکار → build ایمیج جدید (در همین حین postbuild اسکیمای خودشفایی را هم از prisma بازتولید و راستی‌آزمایی می‌کند؛ **گیت تایپ‌ها**: مرحله‌ی builder پیش از بسته‌بندی، `npm run typecheck` را اجرا می‌کند — خطای تایپ = توقف build = توقف دیپلوی) → `docker compose up -d` (کانتینر app جایگزین می‌شود؛ **volume `docker-data/` هرگز لمس نمی‌شود**) → سرویس `migrate` اسکیمای دیتابیس را با کد جدید هم‌گام می‌کند → بررسی سلامت.

> ⚠️ **اگر بکاپ ناموفق باشد، دیپلوی متوقف می‌شود** — ادامه‌ی دیپلوی بدون
> نقطه‌ی بازگشت یعنی ریسک از دست رفتن داده. اگر عمداً می‌خواهید رد شوید:
> `bash docker/deploy.sh --no-backup` (مسئولیت با شما).

### ۶-۱) راستی‌آزمایی سرویس‌های AI بعد از هر دیپلوی

سلامت عمومی (`/api/health` سبز) فقط یعنی اپ و دیتابیس زنده‌اند. قابلیت‌های
AI لایه‌ی جداگانه‌ای دارند که باید جداگانه تست شوند:

1. وارد **پنل مدیریت ← هوش مصنوعی** شوید — کارت **«سلامت سرویس‌های AI»** بالای صفحه است.
2. مسیریابی فعلی هر قابلیت را ببینید: چت متنی (اختصاصی یا ZAI)، جستجوی وب، بینایی، تولید تصویر.
3. اگر زرد/قرمز است (مثل «کانفیگ ZAI یافت نشد») → `secrets/z-ai-config` را بسازید/مونت کنید (§۴-۲) و `bash docker/deploy.sh` دوباره بزنید.
4. دکمه‌ی **«اجرای آزمون سرویس‌ها»** را بزنید — هر سرویس با کوچک‌ترین فراخوانی ممکن زنده تست می‌شود و نتیجه + زمان پاسخ + خطای دقیق نمایش داده می‌شود.
5. تست تولید تصویر هزینه‌بر است — فقط با فعال‌کردن چک‌باکس مربوط اجرا کنید.

```bash
# معادل CLI (بدون پنل):
curl -X POST http://127.0.0.1:3100/api/admin/ai-status \
  -H "Cookie: shahryar_admin=<توکن-نشست-ادمین>" -H "Content-Type: application/json" -d '{}'
```

- خروجی‌زدن کاربران حین جایگزینی چند ثانیه است (پنجره‌ی بسته بودن). اگر بخواهید بدون قطعی محسوس: `docker compose build` را قبل از `up -d` اجرا کنید (deploy.sh همین‌طور است).
- اگر migrate با خطای «destructive change» متوقف شد: تغییر اسکیما مخرب تشخیص داده شده (مثلاً حذف ستون). برای بررسی: `docker compose logs migrate`. اگر مطمئن هستید عمدی است، دستی اجرا کنید:
  `docker compose run --rm migrate npx prisma db push --accept-data-loss`

## ۷) بکاپ و بازیابی

### بکاپ (دیتابیس سازگار + رسانه‌ها — بدون توقف سرویس)

```bash
bash docker/backup.sh              # بکاپ زمان‌دار
bash docker/backup.sh weekly       # بکاپ با برچسب weekly
```

بکاپ دیتابیس با `VACUUM INTO` از داخل کانتینرِ در حال اجرا گرفته می‌شود — اسنپ‌شاتی «consistent» حتی وسط تراکنش‌های فعال. فایل‌ها در `backups/` (۲۰ نسخه‌ی آخر نگه داشته می‌شود).

### بکاپ خودکار شبانه (cron)

```bash
crontab -e
# هر شب ساعت ۳:
0 3 * * * cd /root/shahryar && bash docker/backup.sh nightly >> backups/cron.log 2>&1
```

### بازیابی

```bash
docker compose stop app            # توقف موقت اپ
cp backups/db-<timestamp>.db docker-data/custom.db
tar xzf backups/media-<timestamp>.tar.gz -C docker-data   # اگر بکاپ media دارید
docker compose start app           # بالا آمدن دوباره
curl http://127.0.0.1:3100/api/health
```

> نکته: پس از بازیابی، مالکیت را اصلاح کنید اگر دستی کپی کردید: `chown -R 1001:1001 docker-data` (entrypoint در هر اجرا خودش هم این کار را می‌کند).

## ۸) فرمان‌های مدیریتی روزمره

> ⚠️ در همه‌ی دستورات `docker compose`، پرچم `--env-file .env.docker` را
> بگذارید تا `APP_PORT`/`APP_BIND` تعریف‌شده در تنظیمات شما اعمال شود
> (اسکریپت‌های `docker/` خودکار می‌گذارند):

```bash
docker compose --env-file .env.docker ps                        # وضعیت کانتینرها
docker compose --env-file .env.docker logs -f app               # لاگ زنده‌ی اپ
docker compose --env-file .env.docker logs --tail=100 migrate   # لاگ آخرین مهاجرت
docker compose --env-file .env.docker restart app               # ری‌استارت تمیز
docker compose --env-file .env.docker exec app sh               # شل داخل کانتینر (ابزار عیب‌یابی)
docker inspect --format '{{.State.Health.Status}}' shahryar-app   # وضعیت سلامت
docker compose --env-file .env.docker down                      # ⚠️ توقف کامل — بدون -v ! (دیتا می‌ماند)
docker compose --env-file .env.docker up -d                     # بالا آوردن دوباره
curl http://127.0.0.1:3100/api/health    # پروب سلامت خارجی
```

> نکته: لاگ‌های کانتینر با چرخش خودکار (سه فایل ۱۰ مگابایتی) نگه
> داشته می‌شوند تا دیسک VPS پر نشود.

## ۹) عیب‌یابی

| نشانه | علت محتمل | راه‌حل |
|-------|-----------|--------|
| `unhealthy` در `docker compose ps` | اپ بالا نیامده یا دیتابیس جواب نمی‌دهد | `docker compose logs --tail=100 app` — معمولاً راز/مسیر دیتابیس؛ سلامت واقعی: `curl http://127.0.0.1:3100/api/health` |
| `Permission denied` روی دیتابیس | مالکیت volume | `chown -R 1001:1001 docker-data` سپس `docker compose restart app` |
| ۵۰۲/۵۰۴ از دامنه | پراکسی DA درست نیست | §۵ را بازبینی کنید؛ `curl http://127.0.0.1:3100/api/health` باید روی خود سرور ۲۰۰ بدهد |
| خطای آپلود بزرگ (۴۱۳) | سقف بدنه‌ی پراکسی | در کانفیگ nginx: `client_max_body_size 40m;` (§۵-B) و در Apache: `LimitRequestBody 41943040` (§۵-A) |
| هوشیار خطا می‌دهد | `secrets/z-ai-config` ناصحیح | فرمت JSON را §۴-۲ ببینید؛ `docker compose exec app cat /app/.z-ai-config \| head -c 80`؛ سپس آزمون §۶-۱ |
| کانتینر با پیام JWT_SECRET/SMS_ENC_KEY بالا نیامد | `.env.docker` ناقص | هر دو کلید ۶۴ کاراکتری (خروجی `openssl rand -hex 32`) لازم است — §۴-۱؛ سپس `docker compose --env-file .env.docker up -d` |
| پیامک/ثبت‌نام بعد از ری‌استارت از کار افتاد | SMS_ENC_KEY عوض شده/حذف شده | کلید قبلی را برگردانید؛ اگر گم شده، رمز پنل پیامک را در CMS دوباره ذخیره کنید |
| دیپلوی روی مرحله‌ی بکاپ متوقف شد | بکاپ ناموفق (دیسک پر؟ کانتینر ناسالم؟) | `bash docker/backup.sh pre-deploy` را دستی ببینید؛ بعد از رفع، دوباره `deploy.sh` (یا عمداً `--no-backup`) |
| همه کاربران بیرون افتادند | JWT_SECRET عوض شده | طبیعی است — دوباره لاگین می‌کنند (داده‌ها سالم‌اند) |
| بعد از ریبوت سرور بالا نیامد | Docker غیرفعال است | `systemctl enable --now docker` (کانتینر خودش برمی‌گردد: restart policy) |
| migrate خطای destructive | تغییر اسکیما مخرب | §۶ — بررسی و در صورت اطمینان `--accept-data-loss` |
| پرداخت زرین‌پال به درگاه وصل نمی‌شود | Merchant ID یا هدرهای پراکسی | Merchant ID را در CMS وارد کنید؛ پراکسی باید `Host` و `X-Forwarded-Proto` را پاس دهد (کانفیگ‌های §۵ همین کار را می‌کنند) |

## 🔒 چک‌لیست امنیتی نهایی

- [ ] `JWT_SECRET` تصادفی ۶۴ کاراکتری (نه پیش‌فرض)
- [ ] `SMS_ENC_KEY` تصادفی ۶۴ کاراکتری (ثابت — هرگز بعد از نخستین دیپلوی عوض نشود)
- [ ] `SEED_ADMIN_PASSWORD` پس از Seed از `.env.docker` حذف/خالی شده
- [ ] `APP_BIND=127.0.0.1` مانده (دسترسی فقط از پراکسی DirectAdmin)
- [ ] `secrets/z-ai-config` با مجوز `600` (`chmod 600 secrets/z-ai-config`)
- [ ] `.env.docker` و `secrets/` و `docker-data/` هرگز commit نمی‌شوند (در .gitignore هستند)
- [ ] بکاپ شبانه‌ی cron فعال و `backups/` دوره‌ای به خارج از سرور rsync می‌شود
- [ ] `docker compose down -v` ممنوع — فقط `down` یا `stop`

