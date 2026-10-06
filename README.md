# شهریار — دستیار هوشمند شهر رفسنجان

وب‌اپلیکیشن SaaS کامل با Next.js 16 + TypeScript + Tailwind CSS 4 + shadcn/ui + Prisma/SQLite.

## پیش‌نیازها

- **Node.js ≥ 20.9** (توصیه‌شده: 20 LTS یا 22 LTS)
- **npm ≥ 10**

بررسی نسخه:

```bash
node -v   # باید v20.9.0 یا بالاتر باشد
npm -v    # باید v10 یا بالاتر باشد
```

## راه‌اندازی سریع (سه دستور استاندارد)

```bash
# ۱) نصب وابستگی‌ها (به‌طور خودکار Prisma Client هم تولید می‌شود)
npm install

# ۲) ساخت نسخه‌ی production
npm run build

# ۳) اجرای سرور production
npm run start
```

سرور روی `http://localhost:3000` بالا می‌آید (با `PORT` قابل تغییر است).

### حالت توسعه

```bash
npm run dev
```

سرور توسعه روی `http://localhost:3000` اجرا می‌شود. خروجی build پوشه‌ی `.next-prod` است تا سرور dev در حال اجرا خراب نشود.

## تنظیمات (اختیاری)

پیش‌فرض‌ها بدون هیچ تنظیمی کار می‌کنند. برای سفارشی‌سازی:

```bash
cp .env.example .env
```

| متغیر | پیش‌فرض | توضیح |
|-------|---------|-------|
| `DATABASE_URL` | حل‌شده خودکار به `db/custom.db` | مسیر دیتابیس SQLite |
| `PORT` | `3000` | پورت سرور |
| `HOSTNAME` | `0.0.0.0` | آدرس اتصال |

> بدون فایل `.env` هم برنامه مسیر دیتابیس را هوشمندانه نسبت به ریشه‌ی پروژه حل می‌کند.

## اسکریپت‌های npm

| دستور | کار |
|-------|-----|
| `npm run dev` | سرور توسعه (hot-reload) |
| `npm run build` | ساخت production + آماده‌سازی بسته‌ی standalone برای دیپلوی |
| `npm run start` | اجرای سرور production با Node خالص |
| `npm run lint` | بررسی ESLint |
| `npm run db:push` | اعمال اسکیمای Prisma روی دیتابیس |
| `npm run db:generate` | تولید مجدد Prisma Client |

## ساختار پروژه

```
├── prisma/schema.prisma    # اسکیمای دیتابیس (۱۷ مدل)
├── db/custom.db            # دیتابیس SQLite (همراه پروژه)
├── db/schema.sql           # DDL خودشفایی برای محیط‌های دیپلوی
├── src/app/                # صفحات و API routes
│   ├── api/                # ۳۰+ endpoint احراز هویت، چت AI، اصناف، مدیریت
│   └── shah-ad/            # پنل مدیریت
├── src/lib/modules/ai/     # موتور هوشیار (پرامپت، حافظه، خواندن اسناد)
├── scripts/postbuild.mjs   # آماده‌سازی بسته standalone بعد از build
└── scripts/start.mjs       # لانچر سرور production مستقل از bun
```

## نکات فنی مهم

### جداسازی build از dev
خروجی `npm run build` در `.next-prod` قرار می‌گیرد (نه `.next`) تا اجرای همزمان سرور dev و build امکان‌پذیر باشد.

### بسته standalone خودکفا
`npm run build` یک بسته‌ی کاملاً مستقل در `.next-prod/standalone` می‌سازد:
- همه‌ی symlinkها به فایل واقعی تبدیل می‌شوند (سازگاری با هر محیط دیپلوی)
- دیتابیس، رسانه‌ها و `public/` داخل بسته کپی می‌شوند
- پکیج‌های runtime (`pdf-parse`، `mammoth`، `xlsx`) با تمام وابستگی‌ها همراه بسته می‌شوند

### خودشفایی دیتابیس
در محیط‌های دیپلوی فقط‌خواندنی، دیتابیس به‌طور خودکار به لایه‌ی قابل‌نوشتن کپی شده و اسکیمای ناقص با `db/schema.sql` ترمیم می‌شود.

### احراز هویت
توکن JWT در کوکی `shahryar_token` (HttpOnly) ذخیره می‌شود. برای تست API:

```bash
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"09151112233","password":"..."}'
curl -b cookies.txt http://localhost:3000/api/auth/me
```

## دیپلوی روی هر هاست Node.js

خروجی `.next-prod/standalone` یک بسته‌ی مستقل است:

```bash
# روی سرور مقصد فقط به این‌ها نیاز دارید:
node .next-prod/standalone/server.js
# متغیرها: PORT=3000 HOSTNAME=0.0.0.0 NODE_ENV=production
```

## 🐳 دیپلوی با Docker (توصیه‌شده برای سرور مجازی)

برای استقرار روی سرور با **DirectAdmin** (پورت‌های ۸۰/۴۴۳ اشغال) پروژه کاملاً داکرایز شده است:

```bash
cp .env.docker.example .env.docker   # رازها را تنظیم کنید (JWT_SECRET و...)
bash docker/deploy.sh                # استقرار + مهاجرت + بررسی سلامت
```

- **هیچ داده‌ی امنیتی وارد ایمیج نمی‌شود** (دیتابیس، `.env`، رسانه‌ها و کلیدها فقط در Volume/محیط اجرا)
- **داده‌ها بین دیپلوی‌ها می‌مانند** — همه در `docker-data/` (بدون `down -v`!)
- اپ روی `127.0.0.1:3100` سرو می‌شود و Apache/nginx خود DirectAdmin به آن پراکسی می‌کند
- بکاپ سازگار SQLite (`VACUUM INTO`) + رسانه‌ها: `bash docker/backup.sh`

راهنمای کامل (پراکسی DirectAdmin، SSL، به‌روزرسانی، بازیابی، عیب‌یابی): **[DOCKER-DEPLOY.md](./DOCKER-DEPLOY.md)**

## حساب‌های پیش‌فرض (محیط توسعه)

| نقش | شناسه | رمز |
|-----|-------|-----|
| کاربر | `09151112233` | `Shahryar1404` |
| مدیر | `hasansdq` | ` Hasan78484@` |

> قبل از انتشار عمومی، رمز مدیر را از پنل `/shah-ad` تغییر دهید.
