// ═══════════════════════════════════════════════════════════════
// ماژول شهریار — انواع مشترک شبکه اجتماعی (سرور + کلاینت)
// ═══════════════════════════════════════════════════════════════

/** مهارت با سطح تسلط ۱ تا ۴ */
export interface SkillItem {
  name: string;
  level: number; // 1=مبتدی 2=متوسط 3=پیشرفته 4=خبره
}

export const SKILL_LEVEL_LABELS: Record<number, string> = {
  1: "مبتدی",
  2: "متوسط",
  3: "پیشرفته",
  4: "خبره",
};

/** سابقه‌ی تحصیل */
export interface EducationItem {
  degree: string; // مقطع
  field: string; // رشته
  school: string; // مؤسسه/دانشگاه
  startYear?: string;
  endYear?: string;
  note?: string;
}

/** سابقه‌ی شغلی */
export interface ExperienceItem {
  role: string;
  company: string;
  description?: string;
  startYear?: string;
  endYear?: string;
  current?: boolean;
}

/** لینک خارجی (وب‌سایت، نمونه‌کار...) */
export interface LinkItem {
  label: string;
  url: string;
}

// ─── تم‌های بنر پروفایل — هویت بصری قابل انتخاب ───

export interface BannerTheme {
  label: string;
  /** گرادیان CSS — آینه‌شده برای شروع خوانش RTL (بالا-راست) */
  gradient: string;
}

export const BANNER_THEMES: Record<string, BannerTheme> = {
  aurora: {
    label: "شفق قطبی",
    gradient: "linear-gradient(225deg, oklch(0.32 0.11 266) 0%, oklch(0.45 0.16 258) 55%, oklch(0.60 0.15 243) 100%)",
  },
  royal: {
    label: "سلطنتی",
    gradient: "linear-gradient(225deg, oklch(0.30 0.10 295) 0%, oklch(0.42 0.15 285) 55%, oklch(0.58 0.13 275) 100%)",
  },
  sunset: {
    label: "غروب",
    gradient: "linear-gradient(225deg, oklch(0.38 0.13 30) 0%, oklch(0.52 0.16 45) 55%, oklch(0.68 0.14 70) 100%)",
  },
  emerald: {
    label: "زمرد",
    gradient: "linear-gradient(225deg, oklch(0.32 0.09 165) 0%, oklch(0.46 0.12 158) 55%, oklch(0.62 0.12 150) 100%)",
  },
  ocean: {
    label: "اقیانوس",
    gradient: "linear-gradient(225deg, oklch(0.30 0.08 230) 0%, oklch(0.45 0.10 215) 55%, oklch(0.60 0.10 205) 100%)",
  },
  rose: {
    label: "سرخابی",
    gradient: "linear-gradient(225deg, oklch(0.36 0.12 350) 0%, oklch(0.50 0.15 345) 55%, oklch(0.66 0.12 340) 100%)",
  },
  midnight: {
    label: "نیمه‌شب",
    gradient: "linear-gradient(225deg, oklch(0.22 0.03 260) 0%, oklch(0.34 0.05 255) 55%, oklch(0.48 0.07 250) 100%)",
  },
  peach: {
    label: "هلویی",
    gradient: "linear-gradient(225deg, oklch(0.42 0.08 25) 0%, oklch(0.62 0.10 35) 55%, oklch(0.80 0.09 55) 100%)",
  },
};

export const BANNER_THEME_KEYS = Object.keys(BANNER_THEMES);

/** استایل گرادیان بنر از کلید تم (با fallback) */
export function bannerGradient(theme: string | null | undefined, fallback = "aurora"): string {
  return BANNER_THEMES[theme || fallback]?.gradient || BANNER_THEMES[fallback].gradient;
}

// ─── اشکال عمومی API ───

/** کارت دایرکتوری افراد */
export interface PersonCardData {
  userId: string;
  name: string;
  avatarUrl: string | null;
  avatarColor: string;
  isVerified?: boolean; // تیک آبی (تأیید مدیر)
  headline: string | null;
  city: string | null;
  bannerTheme: string;
  bannerUrl: string | null;
  skills: SkillItem[];
  interests: string[];
  endorsementCount: number;
  hasAgent: boolean; // دانش ایجنت دارد
  knowledgeCount: number;
  viewCount: number;
  updatedAt: string;
}

/** پروفایل عمومی کامل (نمای دیالوگ پروفایل) */
export interface PublicProfileData extends PersonCardData {
  bio: string | null;
  education: EducationItem[];
  experience: ExperienceItem[];
  links: LinkItem[];
  skillEndorsements: Record<string, number>; // نام مهارت → تعداد تأیید
  myEndorsements: string[]; // مهارت‌هایی که من تأیید کرده‌ام
  isMe: boolean;
  joinedAt: string;
  agentInfo: {
    enabled: boolean;
    name: string | null;
    greeting: string | null;
    questions: string[];
  };
}

// ─── تنظیمات شخصی‌سازی ایجنت (تب «ایجنت من») ───

export type AgentStyleKey = "professional" | "friendly" | "marketing" | "technical" | "creative";

export const AGENT_STYLE_OPTIONS: Array<{ key: AgentStyleKey; label: string; description: string }> = [
  {
    key: "professional",
    label: "حرفه‌ای و رسمی",
    description: "معرفی‌کننده‌ی رسمی رویداد کسب‌وکار — دقیق، مستند، بی‌اغراق",
  },
  {
    key: "friendly",
    label: "صمیمی و گرم",
    description: "همکار خوش‌مشرب — گرم و خودمانی، بدون خشکی رسمی",
  },
  {
    key: "marketing",
    label: "بازاریابانه",
    description: "پیشنهاددهنده‌ی متقاعدکننده — پرانرژی و مزیت‌محور",
  },
  {
    key: "technical",
    label: "فنی و دقیق",
    description: "کارشناس فنی — جزئیات، اعداد و شرایط دقیق",
  },
  {
    key: "creative",
    label: "خلاقانه",
    description: "روایتگر — داستان‌محور با زبان تصویری و تشبیه‌های به‌جا",
  },
];

export interface AgentSettings {
  enabled: boolean;
  name: string;
  greeting: string;
  style: AgentStyleKey;
  instructions: string;
  forbidden: string;
  useProfile: boolean;
  suggestHandoff: boolean;
  questions: string[];
}

export const AGENT_SETTINGS_DEFAULTS: AgentSettings = {
  enabled: true,
  name: "",
  greeting: "",
  style: "professional",
  instructions: "",
  forbidden: "",
  useProfile: true,
  suggestHandoff: true,
  questions: [],
};

/** پیام گفتگوی اجتماعی */
export interface SocialChatMessage {
  id: string;
  senderType: "user" | "agent";
  senderId: string | null;
  senderName: string | null; // نام فرستنده (برای پیام‌های کاربر)
  content: string;
  createdAt: string;
}

/** خلاصه‌ی گفتگو در فهرست گفتگوها */
export interface ConversationSummary {
  id: string;
  type: "dm" | "agent";
  /** در DM: طرف مقابل؛ در agent-chat: صاحب ایجنت (وقتی خودم مالکم: کاربر چت‌کننده) */
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar: string | null;
  otherUserAvatarColor: string;
  otherHeadline: string | null;
  /** نقش من در این گفتگو */
  myRole: "participant" | "agent-owner";
  lastMessage: string;
  lastMessageAt: string;
  messageCount: number;
}
