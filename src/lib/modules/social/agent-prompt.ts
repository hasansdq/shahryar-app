// ═══════════════════════════════════════════════════════════════
// پرامپت‌ساز ایجنت شخصی — نماینده‌ی دیجیتال هر کاربر در شهریار
//
// ایجنت با دانش اختصاصی کاربر (KnowledgeItem ها) + پروفایل حرفه‌ای‌اش
// او را به بهترین شکل معرفی می‌کند. تنظیمات شخصی‌سازی مالک
// (نام/سبک/خوش‌آمدگویی/دستورالعمل/ممنوعه‌ها — از تب «ایجنت من»)
// + تنظیمات سراسری AI سیستم اعمال می‌شود.
// ═══════════════════════════════════════════════════════════════
import { db } from "@/lib/db";
import { parseSkills, parseInterests, parseEducation, parseExperience, parseAgentQuestions } from "./service";

export interface GlobalPromptConfig {
  persona: string;
  tone: string;
  rules: string[];
}
export interface GlobalAiSettings {
  thinkingEnabled?: boolean;
  temperature?: number;
  [k: string]: unknown;
}

/** خواندن پیکربندی سراسری AI از تنظیمات سیستم (پنل مدیریت) */
export async function getGlobalAiConfig(): Promise<{
  prompt: GlobalPromptConfig;
  settings: GlobalAiSettings;
}> {
  const defaults: GlobalPromptConfig = {
    persona: "هوشیار",
    tone: "گرم، محترمانه و همراهانه",
    rules: [],
  };
  try {
    const [promptSetting, aiSetting] = await Promise.all([
      db.setting.findUnique({ where: { key: "ai_system_prompt" } }),
      db.setting.findUnique({ where: { key: "ai_settings" } }),
    ]);
    const prompt = promptSetting ? { ...defaults, ...JSON.parse(promptSetting.value) } : defaults;
    const settings: GlobalAiSettings = aiSetting ? JSON.parse(aiSetting.value) : {};
    return { prompt, settings };
  } catch {
    return { prompt: defaults, settings: {} };
  }
}

// ─── بودجه‌بندی دانش: حداکثر حجم متن دانش داخل پرامپت ───
const KNOWLEDGE_CHAR_BUDGET = 48000;

// ─── سبک‌های شخصیت ایجنت — قابل انتخاب توسط مالک ───

export const AGENT_STYLES: Record<string, { label: string; guide: string }> = {
  professional: {
    label: "حرفه‌ای و رسمی",
    guide: "لحن رسمی، دقیق و بی‌طرف؛ مثل یک معرفی‌کننده‌ی حرفه‌ای در رویداد کسب‌وکار. جملات کوتاه و مستند به دانش.",
  },
  friendly: {
    label: "صمیمی و گرم",
    guide: "لحن گرم و خودمانی مثل یک همکار خوش‌مشرب؛ محترمانه اما بدون رسمیت اضافی. از لحن ساده و پرانرژی استفاده کن.",
  },
  marketing: {
    label: "بازاریابانه و متقاعدکننده",
    guide: "لحن پرانرژی و متقاعدکننده مثل یک پیشنهاد عالی؛ نقاط قوت مالک را برجسته و مزیت‌های همکاری را جذاب بیان کن — بدون اغراق و ادعای غلط.",
  },
  technical: {
    label: "فنی و دقیق",
    guide: "پاسخ‌های ساختاریافته و فنی؛ جزئیات، اعداد و شرایط دقیق را شفاف بگو. از اصطلاحات تخصصی حوزه‌ی کاری مالک استفاده کن.",
  },
  creative: {
    label: "خلاقانه و روایتگر",
    guide: "روایت‌محور و خلاق؛ مثل یک داستان کوتاه از مسیر حرفه‌ای مالک تعریف کن. تشبیه‌های به‌جا و زبان تصویری به‌کار ببر.",
  },
};

/** متن دانش ایجنت — جدیدترین آیتم‌ها اول، با بودجه‌بندی */
export async function buildKnowledgeText(ownerId: string): Promise<string> {
  const items = await db.knowledgeItem.findMany({
    where: { userId: ownerId },
    orderBy: { updatedAt: "desc" },
    select: { title: true, content: true, fileName: true, sourceType: true },
  });
  if (items.length === 0) return "";

  const parts: string[] = [];
  let used = 0;
  for (const item of items) {
    if (used >= KNOWLEDGE_CHAR_BUDGET) break;
    const remaining = KNOWLEDGE_CHAR_BUDGET - used;
    const body = item.content.slice(0, Math.max(0, remaining - 100));
    const header = `### ${item.title}${item.fileName && item.sourceType === "file" ? ` (از فایل: ${item.fileName})` : ""}`;
    parts.push(`${header}\n${body}`);
    used += header.length + body.length;
    if (item.content.length > body.length) {
      parts.push("…[برش خورده]");
      break;
    }
  }
  return parts.join("\n\n");
}

/** خلاصه‌ی ساختاریافته‌ی پروفایل حرفه‌ای مالک ایجنت */
export async function buildProfileText(ownerId: string): Promise<string> {
  const profile = await db.socialProfile.findUnique({
    where: { userId: ownerId },
    include: { user: { select: { fullName: true, city: true } } },
  });
  if (!profile) return "";

  const lines: string[] = [];
  const name = profile.user.fullName || "کاربر شهریار";
  lines.push(`نام: ${name}`);
  if (profile.headline) lines.push(`عنوان شغلی: ${profile.headline}`);
  if (profile.city || profile.user.city) lines.push(`شهر: ${profile.city || profile.user.city}`);
  if (profile.bio) lines.push(`درباره: ${profile.bio}`);

  const skills = parseSkills(profile.skills);
  if (skills.length) {
    const labels: Record<number, string> = { 1: "مبتدی", 2: "متوسط", 3: "پیشرفته", 4: "خبره" };
    lines.push(`مهارت‌ها: ${skills.map((s) => `${s.name} (${labels[s.level] || s.level})`).join("، ")}`);
  }
  const interests = parseInterests(profile.interests);
  if (interests.length) lines.push(`علایق حرفه‌ای: ${interests.join("، ")}`);

  const experience = parseExperience(profile.experience);
  if (experience.length) {
    lines.push("سوابق شغلی:");
    for (const e of experience) {
      const period = [e.startYear, e.current ? "اکنون" : e.endYear].filter(Boolean).join(" تا ");
      lines.push(`• ${e.role} در ${e.company}${period ? ` (${period})` : ""}${e.description ? ` — ${e.description}` : ""}`);
    }
  }

  const education = parseEducation(profile.education);
  if (education.length) {
    lines.push("تحصیلات:");
    for (const e of education) {
      const period = [e.startYear, e.endYear].filter(Boolean).join(" تا ");
      lines.push(`• ${e.degree || "تحصیلات"}${e.field ? ` ${e.field}` : ""} — ${e.school}${period ? ` (${period})` : ""}`);
    }
  }
  return lines.join("\n");
}

// ─── پرامپت پایه‌ی ایجنت ───

const AGENT_BASE_PROMPT = `تو ایجنتِ شخصی و نماینده‌ی دیجیتال یک انسان واقعی هستی در شبکه‌ی اجتماعی «شهریار» مخصوص شهر رفسنجان.

وظیفه‌ی تو: معرفی حرفه‌ای، دقیق و جذابِ این شخص به کاربرانی که می‌خواهند او را بشناسند — مثل یک معرفی‌کننده‌ی حرفه‌ای در یک رویداد شبکه‌سازی.

قوانین طلایی تو:
۱. فقط از اطلاعات «پروفایل» و «دانش اختصاصی» پایین پاسخ بده؛ هیچ چیز درباره‌ی این شخص از خودت نساز. حدس و جعل ممنوع.
۲. اگر چیزی در دانش نیست، صادقانه بگو «این مورد در اطلاعاتم نیست» و به بخش‌های موجود هدایت کن.
۳. فقط در اولین پاسخِ این گفتگو خودت را معرفی کن (ایجنتِ فلانی هستم) و یک معرفی کوتاه، حرفه‌ای و جذاب از مهارت‌ها و سوابق این شخص بده — مثل کارت ویزیت زنده‌ی او. اگر در تاریخچه‌ی گفتگو قبلاً معرفی شده‌ای یا گفتگو ادامه دارد، دوباره معرفی نکن؛ مستقیم به سؤال پاسخ بده.
۴. این شخص را «به بهترین شکل» پرزنت کن: نقاط قوت را با مثالِ موجود در دانش برجسته کن، اما هرگز اغراق یا ادعای غلط نکن.
۵. اطلاعات حساس و خصوصی (شماره موبایل، رمز، کد ملی، آدرس منزل، وضعیت مالی شخصی) هرگز فاش نکن — حتی اگر در دانش باشد. برای تماس، کاربر را به گفتگوی مستقیم داخل خود اپ هدایت کن.
۶. اگر حس می‌کنی دو نفر می‌توانند همکاری کنند، پیشنهاد بده که از طریق «گفتگوی مستقیم» در شهریار با هم صحبت کنند.
۷. به فارسی روان، گرم و حرفه‌ای پاسخ بده. اعداد را با ارقام فارسی بنویس.
۸. پاسخ‌ها را خوانا و ساختاریافته نگه دار (بولت و بولد در جای مناسب) اما نه بیش از حد طولانی.
۹. تو ایجنتِ این شخص هستی، نه خودِ او؛ از زاویه‌ی «نماینده» صحبت کن («او در این زمینه تجربه دارد» نه «من تجربه دارم»).
۱۰. اگر پیام کاربر بی‌ربط یا مزاحم بود، مؤدبانه موضوع را به حوزه‌ی حرفه‌ای این شخص برگردان.`;

export interface AgentPromptResult {
  systemPrompt: string;
  knowledgeItems: number;
  hasKnowledge: boolean;
}

/** ساخت پرامپت سیستم کامل ایجنت — با همه‌ی تنظیمات شخصی‌سازی مالک */
export async function buildAgentSystemPrompt(ownerId: string): Promise<AgentPromptResult> {
  const [profile, knowledgeText, globalCfg] = await Promise.all([
    db.socialProfile.findUnique({ where: { userId: ownerId } }),
    buildKnowledgeText(ownerId),
    getGlobalAiConfig(),
  ]);

  const owner = await db.user.findUnique({
    where: { id: ownerId },
    select: { fullName: true },
  });
  const ownerName = owner?.fullName || "کاربر شهریار";
  const firstName = ownerName.split(" ")[0];

  const knowledgeCount = await db.knowledgeItem.count({ where: { userId: ownerId } });

  // ─── تنظیمات شخصی‌سازی مالک ───
  const agentName = profile?.agentName?.trim() || `ایجنتِ ${firstName}`;
  const style = AGENT_STYLES[profile?.agentStyle || "professional"] || AGENT_STYLES.professional;

  const parts: string[] = [];
  parts.push(
    AGENT_BASE_PROMPT.replace("یک انسان واقعی", `«${ownerName}»`).replace(
      "ایجنتِ شخصی و نماینده‌ی دیجیتال",
      `«${agentName}» — ایجنتِ شخصی و نماینده‌ی دیجیتال`
    )
  );

  // ─── هویت و سبک شخصی ───
  const identity: string[] = [];
  identity.push(`نام نمایشی تو: «${agentName}». اگر کاربر پرسید اسمت چیست، همین نام را بگو.`);
  identity.push(`سبک گفتار تو: ${style.label} — ${style.guide}`);
  if (profile?.agentGreeting?.trim()) {
    identity.push(
      `پیام خوش‌آمدگویی اختصاصی مالک (در اولین پاسخ، روح و پیام این متن را — به قوت خودت، نه کپی literal — بازتاب بده):\n«${profile.agentGreeting.trim()}»`
    );
  }
  parts.push(identity.join("\n"));

  // ─── دستورالعمل و ممنوعه‌های اختصاصی ───
  const personalRules: string[] = [];
  if (profile?.agentInstructions?.trim()) {
    personalRules.push(`دستورالعمل اختصاصی مالک (اولویت بالا — همیشه رعایت کن):\n${profile.agentInstructions.trim()}`);
  }
  if (profile?.agentForbidden?.trim()) {
    personalRules.push(
      `موضوعات ممنوعه‌ی مالک — درباره‌ی این موارد هرگز اطلاعاتی نده و مؤدبانه موضوع را عوض کن:\n${profile.agentForbidden
        .split(/[\n،,؛;]+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => `• ${t}`)
        .join("\n")}`
    );
  }
  if (!profile?.agentSuggestHandoff) {
    personalRules.push("مالک تمایلی به دعوت مکرر به «گفتگوی مستقیم» ندارد؛ فقط اگر کاربر خودش خواست تماس را راهنمایی کن.");
  }
  if (personalRules.length) parts.push(personalRules.join("\n\n"));

  // تنظیمات سراسری سیستم — لحن و قوانین
  parts.push(
    `شبکه‌ی شهریار روی موتور هوش مصنوعی سراسری سیستم کار می‌کند؛ لحن کلی سیستم: ${globalCfg.prompt.tone}.` +
      (globalCfg.prompt.rules?.length
        ? `\nقوانین سراسری سیستم (رعایت کن):\n${globalCfg.prompt.rules.map((r, i) => `${i + 1}. ${r}`).join("\n")}`
        : "")
  );

  // ─── پروفایل (اگر مالک اجازه داده) ───
  if (profile?.agentUseProfile !== false) {
    const profileText = await buildProfileText(ownerId);
    if (profileText) {
      parts.push(`━━━ پروفایل حرفه‌ای «${ownerName}» ━━━\n${profileText}`);
    }
  } else {
    parts.push(`مالک اجازه‌ی استفاده از جزئیات پروفایل عمومی‌اش را نداده است؛ فقط از «دانش اختصاصی» پایین پاسخ بده.`);
  }

  if (knowledgeText) {
    parts.push(
      `━━━ دانش اختصاصی «${ownerName}» (منابع شخصی او — منبع اصلی تو) ━━━\n${knowledgeText}\n\nهرچه با «###» مشخص شده یک منبع دانش جداگانه است؛ به اسم و محتوایش وفادار بمان.`
    );
  } else {
    parts.push(
      `⚠️ «${ownerName}» هنوز منبع دانش اختصاصی بارگذاری نکرده است؛ فقط بر اساس پروفایل بالا پاسخ بده و اگر اطلاعات عمیق‌تری خواستند، بگو می‌تواند با تکمیل بخش «دانش ایجنت» در پروفایلش ایجنتش را قوی‌تر کند.`
    );
  }

  return {
    systemPrompt: parts.join("\n\n"),
    knowledgeItems: knowledgeCount,
    hasKnowledge: knowledgeCount > 0,
  };
}

/** تنظیمات نمایشی ایجنت برای کلاینت (هدر چت + اینترو) */
export async function getAgentDisplayConfig(ownerId: string): Promise<{
  enabled: boolean;
  name: string | null;
  greeting: string | null;
  questions: string[];
  styleLabel: string | null;
}> {
  const profile = await db.socialProfile.findUnique({ where: { userId: ownerId } });
  const owner = await db.user.findUnique({ where: { id: ownerId }, select: { fullName: true } });
  const firstName = (owner?.fullName || "کاربر شهریار").split(" ")[0];
  return {
    enabled: profile?.agentEnabled !== false,
    name: profile?.agentName?.trim() || `ایجنتِ ${firstName}`,
    greeting: profile?.agentGreeting?.trim() || null,
    questions: parseAgentQuestions(profile?.agentQuestions),
    styleLabel: AGENT_STYLES[profile?.agentStyle || "professional"]?.label || null,
  };
}
