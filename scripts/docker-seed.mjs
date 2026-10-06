#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// شهریار — docker-seed.mjs (Seed نصب تازه؛ فقط برای ایمیج migrator)
// ═══════════════════════════════════════════════════════════════
// نسخه‌ی Node خالصِ scripts/seed.ts (بدون TypeScript) تا در ایمیج
// migrator بدون ابزار اضافه اجرا شود. تنها داده‌های «سیستمی» را
// می‌سازد؛ داده‌های ماژول‌های CMS (کانفیگ ماژول‌ها، دسته‌های اهداف،
// قالب‌های مالی) در زمان اجرا به‌صورت تنبل seed می‌شوند.
//
// رازها هرگز hard-code نیستند — از env خوانده می‌شوند:
//   SEED_ADMIN_USERNAME  (پیش‌فرض: hasansdq)
//   SEED_ADMIN_NAME      (پیش‌فرض: حسن صادقی)
//   SEED_ADMIN_PASSWORD  (الزامی — بدون آن اجرا نمی‌شود)
//   DATABASE_URL         (توسط سرویس compose تزریق می‌شود)
// ═══════════════════════════════════════════════════════════════
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// ─── هش رمز عبور — عیناً همان الگوریتم src/lib/core/security.ts ───
// فرمت: scrypt$N$r$p$salt$hash  (N=16384, r=8, p=1, keylen=64)
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const N = 16384,
    r = 8,
    p = 1;
  const derived = crypto.scryptSync(password, salt, 64, { N, r, p }).toString("hex");
  return `scrypt$${N}$${r}$${p}$${salt}$${derived}`;
}

// ─── slug سازگار با scripts/seed.ts ───
function slugify(text) {
  return (
    text
      .trim()
      .replace(/[\s\u200c]+/g, "-")
      .replace(/[^\p{L}\p{N}-]/gu, "")
      .toLowerCase() || `item-${Date.now()}`
  );
}

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME || "hasansdq";
  const name = process.env.SEED_ADMIN_NAME || "حسن صادقی";
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!password) {
    console.error("✗ SEED_ADMIN_PASSWORD در متغیرهای محیطی تنظیم نشده است.");
    console.error("  در .env.docker مقدار دهید و سپس اجرا کنید:");
    console.error("  docker compose run --rm seed");
    process.exit(1);
  }
  if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    console.error("✗ رمز مدیر حداقل ۸ کاراکتر و شامل حرف و عدد باشد.");
    process.exit(1);
  }

  console.log("🌱 شروع Seed اولیه شهریار…\n");

  // ─── ۱. مدیر سیستم ───
  const admin = await db.adminUser.upsert({
    where: { username },
    update: {},
    create: { username, passwordHash: hashPassword(password), name, role: "SUPER_ADMIN" },
  });
  console.log(`✅ مدیر سیستم: ${admin.username}`);

  // ─── ۲. دسته‌بندی‌های اصناف ───
  const categories = [
    { name: "رستوران و فست‌فود", icon: "UtensilsCrossed", color: "#d97706", description: "رستوران‌ها، کافه‌ها و فست‌فودهای رفسنجان", sortOrder: 1 },
    { name: "خرید و فروشگاه", icon: "ShoppingBag", color: "#0e8a5a", description: "فروشگاه‌ها، سوپرمارکت‌ها و مراکز خرید", sortOrder: 2 },
    { name: "سلامت و درمان", icon: "HeartPulse", color: "#e11d48", description: "داروخانه‌ها، مطب‌ها و کلینیک‌ها", sortOrder: 3 },
    { name: "آموزش", icon: "GraduationCap", color: "#7c3aed", description: "مؤسسات آموزشی، مدارس و آموزشگاه‌ها", sortOrder: 4 },
    { name: "خدمات فنی", icon: "Wrench", color: "#0891b2", description: "تعمیرگاه‌ها و خدمات فنی و مهندسی", sortOrder: 5 },
    { name: "کشاورزی و پسته", icon: "Leaf", color: "#16a34a", description: "پسته، کشاورزی و محصولات باغی رفسنجان", sortOrder: 6 },
    { name: "زیبایی و آرایش", icon: "Sparkles", color: "#db2777", description: "آرایشگاه‌ها و سالن‌های زیبایی", sortOrder: 7 },
    { name: "پوشاک", icon: "Shirt", color: "#4f46e5", description: "گالری‌های پوشاک و بوتیک‌ها", sortOrder: 8 },
    { name: "دیجیتال و موبایل", icon: "Smartphone", color: "#0f766e", description: "موبایل‌فروشی‌ها و خدمات دیجیتال", sortOrder: 9 },
    { name: "حمل و نقل", icon: "Car", color: "#b45309", description: "تاکسی، باربری و خدمات حمل‌ونقل", sortOrder: 10 },
  ];
  for (const cat of categories) {
    await db.businessCategory.upsert({
      where: { slug: slugify(cat.name) },
      update: { icon: cat.icon, color: cat.color, description: cat.description, sortOrder: cat.sortOrder },
      create: { ...cat, slug: slugify(cat.name) },
    });
  }
  console.log(`✅ ${categories.length} دسته‌بندی صنف ثبت شد`);

  // ─── ۳. پایگاه دانش شهری ───
  const cityData = [
    {
      category: "news", title: "جشنواره برداشت پسته رفسنجان برگزار می‌شود",
      content: "سی‌ودومین جشنواره برداشت پسته رفسنجان با حضور تولیدکنندگان و صادرکنندگان در محل نمایشگاه دائمی پسته برگزار می‌شود. در این رویداد محصولات باغداران، ماشین‌آلات فرآوری و فرصت‌های سرمایه‌گذاری معرفی خواهد شد. شهروندان می‌توانند از برنامه‌های جانبی شامل بازارچه محلی و کارگاه‌های آموزشی بازدید کنند.",
      summary: "رویداد بزرگ اقتصادی رفسنجان در نمایشگاه دائمی پسته", isPinned: true,
    },
    {
      category: "announcement", title: "تغییر ساعات کاری ادارات در فصل تابستان",
      content: "با توجه به گرمای هوا، ساعات کاری ادارات دولتی شهر رفسنجان از ساعت ۷:۳۰ تا ۱۳:۳۰ تعیین شد. شهروندان برای انجام امور اداری از قبیل ثبت‌احوال، مالیات و خدمات شهرداری می‌توانند در این بازه مراجعه کنند. کارتابل‌های الکترونیکی به صورت شبانه‌روزی فعال هستند.",
      summary: "ساعات جدید ادارات از ۷:۳۰ تا ۱۳:۳۰",
    },
    {
      category: "event", title: "برنامه‌های هفته فرهنگی رفسنجان",
      content: "هفته فرهنگی رفسنجان با اجرای موسیقی محلی، نمایشگاه صنایع دستی و مسابقات ورزشی سنتی در پارک شهر و خانه فرهنگ برگزار می‌شود. برنامه‌ها از ساعت ۱۷ آغاز می‌شوند و ورود برای همه شهروندان آزاد است.",
      summary: "موسیقی محلی، صنایع دستی و ورزش‌های سنتی در پارک شهر",
    },
    {
      category: "service", title: "سامانه صدای شهروند رفسنجان فعال شد",
      content: "شهروندان رفسنجان می‌توانند مشکلات شهری مانند چراغ‌های معیوب، آسفالت آسیب‌دیده و انباشت آب را از طریق سامانه صدای شهروند به شهرداری گزارش دهند. پس از ثبت گزارش، کد پیگیری دریافت شده و روند رسیدگی به صورت شفاف پیگیری می‌شود.",
      summary: "گزارش مشکلات شهری با کد پیگیری شفاف",
    },
    {
      category: "tip", title: "راهنمای صرفه‌جویی آب در فصل گرم",
      content: "رفسنجان در منطقه خشک و کم‌باران قرار دارد. استفاده از قطره‌چکان در باغات پسته، جمع‌آوری آب سرد ابتدای دوش، آبیاری در ساعات خنک شبانه و بازرسی نشتی شیرآلات می‌تواند تا ۳۰ درصد در مصرف آب صرفه‌جویی ایجاد کند. هوشیار، دستیار هوشمند شهریار، همیشه آماده ارائه راهکارهای بیشتر است.",
      summary: "راهکارهای عملی کاهش مصرف آب در خانه و باغ",
    },
    {
      category: "event", title: "مسابقات والیبال جام پسته",
      content: "مسابقات والیبال جام پسته با حضور تیم‌های شهرستانی در سالن ورزشی انقلاب رفسنجان برگزار می‌شود. علاقه‌مندان می‌توانند با در نظر گرفتن ظرفیت سالن از ساعت ۱۶ برای تماشای مسابقات حضور یابند.",
      summary: "رقابت تیم‌های شهرستانی در سالن انقلاب",
    },
  ];
  for (const item of cityData) {
    const exists = await db.cityData.findFirst({ where: { title: item.title } });
    if (!exists) await db.cityData.create({ data: item });
  }
  console.log(`✅ ${cityData.length} رکورد پایگاه دانش شهری ثبت شد`);

  // ─── ۴. تنظیمات پیش‌فرض سیستم ───
  const defaultSettings = [
    {
      key: "ai_system_prompt",
      group: "ai",
      value: JSON.stringify({
        persona: "هوشیار",
        tone: "صمیمی، گرم و همراهانه مثل یک رفیق باهوش",
        rules: [
          "همیشه فارسی روان و محاوره‌ای اما محترمانه پاسخ بده",
          "شهر کاربر رفسنجان است؛ راهنمایی‌ها را با شرایط محلی این شهر تطبیق بده",
          "اگر سوالی درباره اصناف یا خدمات شهر پرسیده شد، از پایگاه دانش اصناف استفاده کن",
          "برای مسائل عملی، راهکارهای گام‌به‌گام و اجرایی ارائه بده",
          "به اهداف و برنامه‌های کاربر اشاره کن و او را همراهی کن",
          "هرگز اطلاعات غلط نساز؛ اگر چیزی را نمی‌دانی صادقانه بگو",
          "پاسخ‌ها را کوتاه، ساختارمند و کاربردی نگه دار مگر اینکه جزئیات خواسته شده باشد",
        ],
      }),
    },
    {
      key: "ai_settings",
      group: "ai",
      value: JSON.stringify({
        defaultMode: "chat",
        thinkingEnabled: true,
        webSearchEnabled: true,
        imageGenEnabled: true,
        memoryEnabled: true,
        memoryExtractionInterval: 4,
        maxHistoryMessages: 24,
        temperature: 0.8,
        dailyMessageLimit: 150,
      }),
    },
    {
      key: "app_settings",
      group: "app",
      value: JSON.stringify({
        appName: "شهریار",
        city: "رفسنجان",
        province: "کرمان",
        supportPhone: "034-34300000",
        allowRegistration: true,
        maintenanceMode: false,
        version: "1.0.0",
        buildDate: new Date().toISOString().slice(0, 10),
      }),
    },
    {
      key: "security_settings",
      group: "security",
      value: JSON.stringify({
        maxLoginAttempts: 5,
        lockoutMinutes: 15,
        sessionDays: 30,
        minPasswordLength: 8,
      }),
    },
  ];
  for (const s of defaultSettings) {
    await db.setting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }
  console.log(`✅ ${defaultSettings.length} تنظیم پیش‌فرض سیستم ثبت شد`);

  // ─── ۵. لاگ راه‌اندازی ───
  await db.activityLog.create({
    data: {
      actorType: "system",
      action: "system.seed",
      entity: "database",
      details: JSON.stringify({ categories: categories.length, cityData: cityData.length }),
      level: "info",
    },
  });

  console.log("\n🎉 Seed اولیه با موفقیت انجام شد!");
  console.log("──────────────────────────────");
  console.log(`🔐 ورود مدیر: ${username} / (رمز تعیین‌شده در SEED_ADMIN_PASSWORD)`);
  console.log("📍 مسیر پنل: /shah-ad");
  console.log("──────────────────────────────");
}

main()
  .catch((e) => {
    console.error("❌ خطای Seed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
