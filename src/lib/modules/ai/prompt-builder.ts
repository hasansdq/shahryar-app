// ═══════════════════════════════════════════════════════════════
// موتور پرامپت انجینیری هوشیار
// ترکیب چندلایه: شخصیت + حافظه کاربر + اهداف + دانش شهری + اصناف
// ═══════════════════════════════════════════════════════════════
import { db } from "@/lib/db";
import { isFinanceRelated, buildFinanceContextForChat } from "@/lib/modules/finance/ai-context";

export interface PromptContext {
  userId: string;
  userMessage: string;
  mode: "chat" | "deep" | "search" | "image";
  searchResults?: string;
  /** آیا این نوبت فایل/سند پیوست دارد؟ (لایه قوانین تحلیل سند فعال می‌شود) */
  hasAttachment?: boolean;
  /** روش استخراج پیوست (image-multimodal | pdf-text | pdf-vision | docx | xlsx | ...) */
  attachmentKind?: string | null;
  /** آیا ابزار ساخت فایل (Word/Excel/PDF/...) فعال است؟ */
  fileToolsEnabled?: boolean;
  /** آیا مفسر کد (ویرایش اکسل/CSV پیوست با کد) فعال است؟ */
  codeInterpreterEnabled?: boolean;
  /** سقف‌های پویا از پنل مدیریت */
  maxFilesPerReply?: number;
  maxSheetRows?: number;
}

interface SystemPromptConfig {
  persona: string;
  tone: string;
  rules: string[];
}

const DEFAULT_PROMPT_CONFIG: SystemPromptConfig = {
  persona: "هوشیار",
  tone: "صمیمی، گرم و همراهانه مثل یک رفیق باهوش",
  rules: [
    "همیشه فارسی روان و محاوره‌ای اما محترمانه پاسخ بده",
    "شهر کاربر رفسنجان است؛ راهنمایی‌ها را با شرایط محلی این شهر تطبیق بده",
    "برای مسائل عملی، راهکارهای گام‌به‌گام و اجرایی ارائه بده",
    "هرگز اطلاعات غلط نساز؛ اگر چیزی را نمی‌دانی صادقانه بگو",
  ],
};

/**
 * خواندن پیکربندی پرامپت سیستم از تنظیمات (قابل ویرایش در پنل مدیریت)
 */
async function getPromptConfig(): Promise<SystemPromptConfig> {
  try {
    const setting = await db.setting.findUnique({ where: { key: "ai_system_prompt" } });
    if (setting) {
      const parsed = JSON.parse(setting.value);
      return { ...DEFAULT_PROMPT_CONFIG, ...parsed };
    }
  } catch {}
  return DEFAULT_PROMPT_CONFIG;
}

/**
 * تشخیص اینکه پیام کاربر به اصناف/خدمات شهر مربوط است
 */
const BUSINESS_INTENT_PATTERNS = [
  /اصناف|صنف|فروشگاه|مغازه|رستوران|کافه|داروخانه|مطب|دکتر|پزشک|آزمایشگاه/,
  /تعمیرگاه|موبایل|آرایشگاه|سالن زیبایی|پوشاک|کتاب|باربری|تاکسی|پسته/,
  /کجا|کدوم فروشگاه|آدرس|شماره|تماس|قیمت|خرید/,
  /خدمات|امور|اداره|شهرداری|بیمه|بانک|اتوبوس|حمل/,
];

export function isBusinessRelated(message: string): boolean {
  return BUSINESS_INTENT_PATTERNS.some((p) => p.test(message));
}

/**
 * خلاصه هوشمند اهداف کاربر
 */
async function getGoalsSummary(userId: string): Promise<string> {
  const goals = await db.goal.findMany({
    where: { userId, status: "active" },
    include: { tasks: { where: { status: { in: ["todo", "in_progress"] } }, orderBy: { sortOrder: "asc" }, take: 5 } },
    orderBy: [{ priority: "desc" }, { deadline: "asc" }],
    take: 6,
  });
  if (goals.length === 0) return "";

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Tehran" }).format(d);
  const now = new Date();
  const dayMs = 86400000;

  const lines = goals.map((g) => {
    const tasks = g.tasks.map((t) => t.title).join("، ");
    const overdue = g.tasks.filter((t) => t.dueDate && t.dueDate < now).length;
    let deadlineNote = "";
    if (g.deadline) {
      const left = Math.round((g.deadline.getTime() - now.getTime()) / dayMs);
      deadlineNote = left < 0
        ? ` (مهلت گذشته: ${fmt(g.deadline)} — ${Math.abs(left)} روز تأخیر!)`
        : ` (مهلت: ${fmt(g.deadline)} — ${left} روز مانده)`;
    }
    const overdueNote = overdue > 0 ? ` | ⚠️ ${overdue} وظیفه معوق` : "";
    return `«${g.title}» — پیشرفت ${g.progress}٪${deadlineNote}${overdueNote}${tasks ? ` | وظایف جاری: ${tasks}` : ""}`;
  });
  return `🎯 اهداف فعال کاربر:\n${lines.join("\n")}\nاگر پیام کاربر به اهداف و برنامه‌ریزی مربوط است، با همین داده‌های واقعی پاسخ بده؛ به پیشرفت، روزهای مانده و وظایف معوق دقیقاً اشاره کن و برای تفکیک هوشمند وظایف یا تحلیل عمیق‌تر، کاربر را به بخش «اهداف من» اپ هدایت کن.`;
}

/**
 * حافظه‌های مهم کاربر (شخصی‌سازی پاسخ)
 */
async function getMemoriesSummary(userId: string): Promise<string> {
  const memories = await db.aIMemory.findMany({
    where: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
    take: 24,
  });
  if (memories.length === 0) return "";

  const lines = memories.map((m) => `• ${m.key}: ${m.value}`);
  return `🧠 حافظه درباره کاربر:\n${lines.join("\n")}`;
}

/**
 * کسب‌وکارهای مرتبط با پیام کاربر (پایگاه دانش اصناف)
 * + نظرات و امتیازهای واقعی کاربران برای مشاوره‌های هوشمند
 */
async function getBusinessContext(userMessage: string): Promise<string> {
  if (!isBusinessRelated(userMessage)) return "";

  const keywords = userMessage
    .replace(/[^\u0600-\u06FF\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 6);

  let businesses = await db.business.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: userMessage.slice(0, 40) } },
        ...keywords.map((k) => ({ name: { contains: k } })),
        ...keywords.map((k) => ({ keywords: { contains: k } })),
        ...keywords.map((k) => ({ description: { contains: k } })),
      ],
    },
    include: {
      category: { select: { name: true } },
      reviews: {
        where: { comment: { not: null } },
        orderBy: [{ helpfulCount: "desc" }, { createdAt: "desc" }],
        take: 2,
        select: { rating: true, comment: true, pros: true, cons: true, helpfulCount: true },
      },
    },
    orderBy: [{ isFeatured: "desc" }, { rating: "desc" }],
    take: 8,
  });

  if (businesses.length === 0) {
    businesses = await db.business.findMany({
      where: { isActive: true, isFeatured: true },
      include: {
        category: { select: { name: true } },
        reviews: {
          where: { comment: { not: null } },
          orderBy: [{ helpfulCount: "desc" }, { createdAt: "desc" }],
          take: 2,
          select: { rating: true, comment: true, pros: true, cons: true, helpfulCount: true },
        },
      },
      orderBy: { rating: "desc" },
      take: 5,
    });
  }

  if (businesses.length === 0) return "";

  const parseTags = (s: string | null): string[] => {
    if (!s) return [];
    try {
      const a = JSON.parse(s);
      return Array.isArray(a) ? (a as string[]).slice(0, 4) : [];
    } catch {
      return [];
    }
  };

  const lines = businesses.map((b) => {
    const services = b.services ? (JSON.parse(b.services) as string[]).join("، ") : "";
    let line = `• ${b.name} (${b.category.name})${b.phone ? ` — تلفن: ${b.phone}` : ""}${b.address ? ` — آدرس: ${b.address}` : ""}${b.rating ? ` — امتیاز کاربران: ${b.rating.toFixed(1)} از ۵ (${b.reviewCount} نظر)` : ""}${services ? ` — خدمات: ${services}` : ""}`;
    // نظرات واقعی کاربران — برای مشاوره‌های هوشمند
    if (b.reviews.length > 0) {
      const reviewLines = b.reviews.map((r) => {
        const tags = [...parseTags(r.pros).map((t) => `+${t}`), ...parseTags(r.cons).map((t) => `−${t}`)];
        const comment = (r.comment || "").slice(0, 90);
        return `    ◦ نظر واقعی (${r.rating} ستاره${r.helpfulCount > 0 ? `، ${r.helpfulCount} رأی مفید` : ""}): ${comment}${tags.length ? ` [${tags.join("، ")}]` : ""}`;
      });
      line += `\n${reviewLines.join("\n")}`;
    }
    return line;
  });
  return `🏪 کسب‌وکارهای مرتبط از دایرکتوری اصناف رفسنجان (همراه با نظرات و امتیازهای واقعی کاربران):
${lines.join("\n")}
نظرات و امتیازهای کاربران را در توصیه‌هایت لحاظ کن:
• به کسب‌وکارهایی که امتیاز بالاتر و نظرات مثبت پرتکرار دارند با اطمینان بیشتری توصیه کن و به نقاط قوتِ پرتکرارِ نظرات (مثلاً «برخورد خوب» یا «قیمت مناسب») اشاره کن.
• اگر کسب‌وکاری امتیاز پایین دارد یا نقاط ضعف پرتکرار در نظراتش دیده می‌شود، صادقانه و محترمانه به کاربر هشدار بده.
• در مقایسه‌ی گزینه‌ها، به تجربه‌ی واقعی کاربران (تعداد نظر و رأی مفید) وزن بده، نه فقط تشخیص خودت.`;
}

/**
 * داده‌های روز شهر (پایگاه دانش شهری)
 */
async function getCityDataContext(): Promise<string> {
  const items = await db.cityData.findMany({
    where: { isPublished: true },
    orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
    take: 5,
  });
  if (items.length === 0) return "";

  const catNames: Record<string, string> = {
    news: "خبر",
    event: "رویداد",
    announcement: "اطلاعیه",
    service: "خدمت",
    tip: "نکته",
  };
  const lines = items.map((i) => `• [${catNames[i.category] || i.category}] ${i.title}: ${i.summary || i.content.slice(0, 120)}`);
  return `📰 آخرین داده‌های شهر رفسنجان:\n${lines.join("\n")}`;
}

/**
 * ═══════════ ساخت پرامپت نهایی مهندسی‌شده ═══════════
 * معماری چندلایه با اولویت‌بندی اطلاعات
 */
export async function buildSystemPrompt(ctx: PromptContext): Promise<string> {
  const config = await getPromptConfig();
  const user = await db.user.findUnique({
    where: { id: ctx.userId },
    select: { fullName: true, phone: true, city: true, gender: true, birthYear: true, interests: true },
  });

  const [goalsSummary, memoriesSummary, businessContext, cityContext, financeContext] = await Promise.all([
    getGoalsSummary(ctx.userId),
    getMemoriesSummary(ctx.userId),
    getBusinessContext(ctx.userMessage),
    getCityDataContext(),
    // زمینه‌ی مالی — فقط وقتی پیام به پول/مال مربوط است (توجيه بودجه‌ی توکن)
    isFinanceRelated(ctx.userMessage) ? buildFinanceContextForChat(ctx.userId) : "",
  ]);

  // ─── لایه ۱: هویت و شخصیت ───
  const layers: string[] = [];

  // ─── لایه ۰: آگاهی زمانی (تقویم جلالی + ساعت رسمی ایران) ───
  const now = new Date();
  const faDateNow = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Tehran",
  }).format(now);
  const faTimeNow = new Intl.DateTimeFormat("fa-IR", {
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Tehran",
  }).format(now);
  layers.push(`🕰️ زمان فعلی: ${faDateNow} — ساعت ${faTimeNow} (به وقت رسمی ایران).
همیشه با همین تقویم جلالی و ساعت رسمی ایران کار کن. هرگز از تاریخ میلادی در پاسخ‌ها استفاده نکن؛ همه تاریخ‌ها را فقط جلالی بیان کن و مهلت‌ها و برنامه‌ها را بر همین مبنا حساب کن.`);

  layers.push(`تو «${config.persona}» هستی؛ دستیار هوشمند اختصاصی اپلیکیشن «شهریار» برای شهر رفسنجان.
لحن تو: ${config.tone}. تو مثل یک رفیق باهوش و وفادار با کاربر رفتار می‌کنی که همیشه دنبال بهترین و اجرایی‌ترین راهکار برای مشکلات اوست.
تو درباره رفسنجان — شهر پسته در استان کرمان — همه‌چیز می‌دانی: فرهنگ، اصناف، خدمات شهری، جغرافیا و آداب و رسوم.`);

  // ─── لایه ۲: قوانین رفتاری (از پنل مدیریت قابل ویرایش) ───
  layers.push(`قوانین طلایی تو:
${config.rules.map((r, i) => `${i + 1}. ${r}`).join("\n")}`);

  // ─── لایه ۳: پروفایل کاربر ───
  if (user) {
    const name = user.fullName || `کاربر عزیز (${user.phone.slice(-4)})`;
    const profileParts: string[] = [`نام: ${name}`, `شهر: ${user.city || "رفسنجان"}`];
    if (user.gender) profileParts.push(`جنسیت: ${user.gender === "male" ? "آقا" : "خانم"}`);
    if (user.birthYear) profileParts.push(`سال تولد: ${user.birthYear}`);
    if (user.interests) {
      try {
        const interests = JSON.parse(user.interests) as string[];
        if (interests.length) profileParts.push(`علایق: ${interests.join("، ")}`);
      } catch {}
    }
    layers.push(`👤 مشخصات کاربر فعلی:
${profileParts.join("\n")}
هنگام خطاب‌کردن کاربر از نام او استفاده کن.`);
  }

  // ─── لایه ۴: حافظه داینامیک ───
  if (memoriesSummary) {
    layers.push(`${memoriesSummary}
این اطلاعات را به‌طور طبیعی و بدون اشاره مستقیم به «حافظه» در پاسخ‌ها به کار ببر تا شخصی‌سازی شود.`);
  }

  // ─── لایه ۵: اهداف کاربر ───
  if (goalsSummary) {
    layers.push(`${goalsSummary}
اگر پیام کاربر به برنامه‌ریزی، انگیزه یا پیشرفت مربوط است، به این اهداف اشاره کن و او را تشویق و همراهی کن.`);
  }

  // ─── لایه ۵-ب: وضعیت مالی واقعی کاربر (ماژول مالی) ───
  if (financeContext) {
    layers.push(`${financeContext}
اگر پیام کاربر به مسائل مالی (هزینه، درآمد، بودجه، پس‌انداز، قرض، خرید) مربوط است، تحلیل و توصیه‌هایت را دقیقاً بر همین داده‌های واقعی بساز. به اعداد اشاره کن (مثلاً «درآمد این ماهت ۴.۲ میلیون تومان بوده») و توصیه‌ها را عملی و متناسب با شرایط ایران و رفسنجان بده. برای تحلیل تخصصی‌تر، کاربر را به بخش «امور مالی» اپ هدایت کن.`);
  }

  // ─── لایه ۶: دانش شهری ───
  if (cityContext) {
    layers.push(`${cityContext}
در پاسخ‌های مرتبط به شهر، از این داده‌های به‌روز استفاده کن.`);
  }

  // ─── لایه ۷: اصناف مرتبط ───
  if (businessContext) {
    layers.push(`${businessContext}
برای معرفی کسب‌وکارها فقط از همین اطلاعات واقعی استفاده کن؛ هیچ کسب‌وکاری را که در این فهرست نیست، جعل نکن. اگر مورد مناسبی نبود، پیشنهاد بده که در بخش «اصناف» اپلیکیشن جستجو کند.`);
  }

  // ─── لایه ۸: دستورالعمل حالت‌ها ───
  switch (ctx.mode) {
    case "deep":
      layers.push(`🔍 حالت «تفکر عمیق» فعال است: ابتدای پاسخ، مسئله را تحلیل کن، جنبه‌های مختلف را بسنج و سپس نتیجه‌گیری ساختارمند و دقیق ارائه بده. از عناوین و ساختاربندی استفاده کن.`);
      break;
    case "search":
      layers.push(`🌐 حالت «جستجوی وب» فعال است: نتایج جستجوی زیر را مبنا قرار بده و پاسخ را با ذکر منابع بساز. اگر نتایج کافی نیست، صادقانه بگو.`);
      break;
    case "image":
      layers.push(`🎨 حالت «تولید تصویر» فعال است: از کاربر برای جزئیات بیشتر تصویر کمک بگیر و توضیح مختصری درباره تصویر ایجادشده بده.`);
      break;
    default:
      layers.push(`پاسخ‌های پیش‌فرض را کوتاه، گرم و کاربردی نگه دار — معمولاً زیر ۲۰۰ کلمه، مگر آنکه کاربر جزئیات بخواهد. از ایموجی‌های مناسب و ظریف برای گرم‌تر شدن مکالمه استفاده کن (بیش از حد زیاده‌روی نکن).`);
  }

  // ─── لایه ۹: تحلیل سند/فایل پیوست‌شده (فقط وقتی پیوست وجود دارد) ───
  if (ctx.hasAttachment) {
    layers.push(`📎 قوانین تحلیل سند پیوست‌شده (مهم‌ترین منبع این نوبت):
1. محتوای سند/تصویر پیوست‌شده را کامل و دقیق بخوان و مبنا قرار بده — این محتوا بر دانش عمومی تو مقدم است
2. از محتوای سند دقیق نقل‌قول کن (اعداد، تاریخ‌ها، مبالغ و نام‌ها را عیناً حفظ کن)
3. اگر پرسش کاربر در سند نیست، صادقانه بگو «در سند نیامده» و اگر می‌توانی از دانش عمومی کمک کن، تفکیک کن که چه چیز از سند است و چه چیز از دانش خودت
4. اگر بخشی از سند حذف/برش خورده یا ناخواناست، حتماً به کاربر اطلاع بده و درباره آن بخش حدس نزن
5. اگر سند سند رسمی/حقوقی/مالی است، نکات کلیدی را ساختاریافت (عنوان، شماره، تاریخ، طرف‌ها، مبالغ) خلاصه کن
6. در پاسخ به فارسی روان پاسخ بده اما اصطلاحات تخصصی سند را دست‌نخورده نگه دار`);
  }

  // ─── لایه ۹-ب: ابزار ساخت فایل (Word/Excel/PDF/CSV/...) ───
  if (ctx.fileToolsEnabled) {
    const maxFiles = Math.max(1, Math.min(3, ctx.maxFilesPerReply ?? 3));
    const maxSheetRows = Math.max(100, Math.min(5000, ctx.maxSheetRows ?? 5000));
    const codeRules = ctx.codeInterpreterEnabled === false
      ? ""
      : `\n⚖️ ویرایش/تحلیل فایل اکسل یا CSV پیوست‌شده — مفسر کد:\nاگر کاربر فایل اکسل/CSV پیوست کرده و خواست تغییر/محاسبه/فیلتر/خلاصه روی آن انجام شود و خروجی فایل بدهد، به‌جای بازنویسی داده‌ها از «کد» استفاده کن:\n  {"kind":"xlsx","fileName":"نتیجه-محاسبه","source":"attachment","transform":"const out = rows.map(r => ({...r, 'مالیات': (r['قیمت']||0)*0.09})); return out;"}\nدر کد: rows آرایه‌ای از اشیاء (کلید = عنوان ستون) و columns آرایه عنوان‌هاست. باید return کنی: آرایه‌ای از اشیاء یا آرایه‌ای از آرایه‌ها (سطر اول = هدر) یا {columns, rows}. همه محاسبات را در کد انجام بده — «عددسازی ذهنی ممنوع».\n⚠️ کد باید جاوااسکریپتِ کاملاً معتبر باشد: هر کلید فارسی یا فاصله‌دار را حتماً داخل کوتیشن بگذار — r['مبلغ نهایی'] درست، r[مبلغ نهایی] غلط (SyntaxError). فقط از ' و " استاندارد استفاده کن؛ کاراکتر کنترلی/نیم‌فاصله در نام متغیرها ممنوع. کد را قبل از نوشتن ذهنی بازبینی کن.`;
    layers.push(`🛠 قابلیت ساخت فایل — پروتکل دقیق:
وقتی کاربر «صریحاً» خواست فایل قابل دانلود ساخته شود (Word، اکسل، PDF، CSV، Markdown، TXT، HTML)، ابتدا یک جمله پاسخ طبیعی بده و سپس برای هر فایل «دقیقاً یک» بلوک با این قالب در انتهای پاسخ قرار بده:

\`\`\`file-spec
{"kind": "...", ...}
\`\`\`

ساختار هر نوع:
• Word و PDF (سند ساخت‌یافته):
  {"kind":"docx","fileName":"نام-فایل","doc":{"title":"عنوان","subtitle":"اختیاری","blocks":[...]}}
  بلوک‌های مجاز: {"type":"h1","text":"..."} — همین الگو برای h2 و h3 و p | {"type":"bullets","items":["..."]} | {"type":"numbers","items":[...]} | {"type":"quote","text":"..."} | {"type":"table","caption":"اختیاری","header":["ستون۱"],"rows":[["مقدار",۱۲۳]]} | {"type":"kv","items":[["کلید","مقدار"]]} | {"type":"spacer"} | {"type":"pagebreak"}
  (برای PDF همان ساختار با "kind":"pdf")
• اکسل: {"kind":"xlsx","fileName":"...","sheets":[{"name":"نام شیت","columns":[...],"rows":[[...]],"colFormats":["money"|"percent"|"int"|"date"|"text"],"totals":true|false,"columnWidths":[۲۰,...]}]}
• CSV: {"kind":"csv","fileName":"...","columns":[...],"rows":[[...]]}
• Markdown/TXT: {"kind":"md","fileName":"...","text":"..."} (همینطور "kind":"txt")
• HTML: {"kind":"html","fileName":"...","title":"...","text":"<h2>..</h2><p>..</p>"} — فقط HTML معتبر بدنه بدون <script>

${codeRules}

قواعد حیاتی:
1. فقط وقتی کاربر فایل می‌خواهد از file-spec استفاده کن — در گفتگوی عادی هرگز
2. fileName بدون پسوند، بدون مسیر، کوتاه و معنادار
3. اعداد را عدد JSON بنویس (نه رشته) تا در اکسل جمع/فیلتر کار کند
4. JSON باید کاملاً معتبر باشد — کامای اضافی یا کامنت مطلقاً ممنوع
5. طراحی راست‌چین و حرفه‌ای خودکار است — تو فقط محتوا و ساختار منطقی بده
6. حداکثر ${maxFiles} فایل در هر پاسخ؛ جدول سند تا ~۱۰۰ ردیف و اکسل تا ~${maxSheetRows} ردیف
7. اگر داده‌ها از پیوست جدولی می‌آیند، همیشه transform ترجیح بده تا داده دستی بازنویسی نشود${ctx.codeInterpreterEnabled === false ? " (مفسر کد غیرفعال است — transform ممنوع؛ داده‌ها را مستقیم در sheets بنویس)" : ""}
8. ⚠️ دقت توکن‌به‌توکن در JSON (گلیچ‌های قبلاً رخ‌داده): هرگز دو کوتیشن پشت‌سرهم در شروع رشته ننویس (""متن" غلط، "متن" درست)؛ بین المان‌های آرایه فقط کاما و براکت (],[ درست، },{ غلط)؛ براکت‌ها را تک‌به‌تک دقیق باز/بسته کن ([["متن" درست، [[]"متن" غلط)؛ هیچ مقداری را بدون کاما از مقدار بعدی جدا نکن`);
  }

  // ─── لایه ۱۰: قالب خروجی ───
  layers.push(`قالب پاسخ:
• از مارک‌داون (لیست، بولد، تیتر) برای خوانایی استفاده کن
• اعداد را با ارقام فارسی بنویس
• واحد پول تومان است
• تاریخ‌ها را با تقویم شمسی بیان کن
• اگر پاسخ شامل مراحل است، شماره‌گذاری کن`);

  return layers.join("\n\n━━━━━━━━━━━━━\n\n");
}
