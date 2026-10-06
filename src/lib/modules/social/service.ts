// ═══════════════════════════════════════════════════════════════
// سرویس شبکه اجتماعی شهریار — اعتبارسنجی، پاک‌سازی، سریالایز
// ═══════════════════════════════════════════════════════════════
import { db } from "@/lib/db";
import {
  BANNER_THEME_KEYS,
  type SkillItem,
  type EducationItem,
  type ExperienceItem,
  type LinkItem,
  type PersonCardData,
} from "./types";

// ─── پارس امن JSON ───

function safeParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function parseSkills(raw: string | null | undefined): SkillItem[] {
  const arr = safeParse<unknown[]>(raw, []);
  return (arr as Array<Record<string, unknown>>)
    .filter((s) => s && typeof s.name === "string" && s.name.trim())
    .map((s) => ({
      name: String(s.name).trim(),
      level: Math.min(4, Math.max(1, Number(s.level) || 1)),
    }));
}

export function parseInterests(raw: string | null | undefined): string[] {
  const arr = safeParse<unknown[]>(raw, []);
  return arr.filter((i): i is string => typeof i === "string" && Boolean(i.trim())).map((i) => i.trim());
}

export function parseEducation(raw: string | null | undefined): EducationItem[] {
  const arr = safeParse<unknown[]>(raw, []);
  return (arr as Array<Record<string, unknown>>)
    .filter((e) => e && typeof e.school === "string" && e.school.trim())
    .map((e) => ({
      degree: String(e.degree || "").trim().slice(0, 60),
      field: String(e.field || "").trim().slice(0, 60),
      school: String(e.school || "").trim().slice(0, 80),
      startYear: e.startYear ? String(e.startYear).slice(0, 4) : undefined,
      endYear: e.endYear ? String(e.endYear).slice(0, 4) : undefined,
      note: e.note ? String(e.note).trim().slice(0, 200) : undefined,
    }));
}

export function parseExperience(raw: string | null | undefined): ExperienceItem[] {
  const arr = safeParse<unknown[]>(raw, []);
  return (arr as Array<Record<string, unknown>>)
    .filter((x) => x && typeof x.role === "string" && x.role.trim())
    .map((x) => ({
      role: String(x.role).trim().slice(0, 80),
      company: String(x.company || "").trim().slice(0, 80),
      description: x.description ? String(x.description).trim().slice(0, 600) : undefined,
      startYear: x.startYear ? String(x.startYear).slice(0, 4) : undefined,
      endYear: x.endYear ? String(x.endYear).slice(0, 4) : undefined,
      current: Boolean(x.current),
    }));
}

export function parseLinks(raw: string | null | undefined): LinkItem[] {
  const arr = safeParse<unknown[]>(raw, []);
  return (arr as Array<Record<string, unknown>>)
    .filter((l) => l && typeof l.url === "string" && /^https?:\/\/.+/i.test(String(l.url).trim()))
    .map((l) => ({
      label: String(l.label || "وب‌سایت").trim().slice(0, 40),
      url: String(l.url).trim().slice(0, 300),
    }));
}

// ─── اعتبارسنجی و پاک‌سازی ورودی PUT /api/social/profile ───

export interface ProfileInput {
  headline?: string | null;
  bio?: string | null;
  city?: string | null;
  bannerUrl?: string | null;
  bannerTheme?: string;
  skills?: Array<{ name?: unknown; level?: unknown }>;
  interests?: unknown[];
  education?: unknown[];
  experience?: unknown[];
  links?: unknown[];
  isDiscoverable?: boolean;
  agent?: {
    enabled?: boolean;
    name?: string | null;
    greeting?: string | null;
    style?: string;
    instructions?: string | null;
    forbidden?: string | null;
    useProfile?: boolean;
    suggestHandoff?: boolean;
    questions?: unknown[];
  };
}

export interface SanitizedProfile {
  headline: string | null;
  bio: string | null;
  city: string | null;
  bannerUrl: string | null;
  bannerTheme: string;
  skills: string;
  interests: string;
  education: string;
  experience: string;
  links: string;
  isDiscoverable: boolean;
  // فقط وقتی input.agent ارسال شده باشد مقدار می‌گیرند (وگرنه دست‌نخورده می‌مانند)
  agentEnabled?: boolean;
  agentName?: string | null;
  agentGreeting?: string | null;
  agentStyle?: string;
  agentInstructions?: string | null;
  agentForbidden?: string | null;
  agentUseProfile?: boolean;
  agentSuggestHandoff?: boolean;
  agentQuestions?: string;
}

// ─── تنظیمات ایجنت — سبک‌های شخصیت ───

export const AGENT_STYLE_KEYS = ["professional", "friendly", "marketing", "technical", "creative"] as const;
export type AgentStyle = (typeof AGENT_STYLE_KEYS)[number];

/** سؤال‌های پیشنهادی ایجنت — پارس امن */
export function parseAgentQuestions(raw: string | null | undefined): string[] {
  const arr = safeParse<unknown[]>(raw, []);
  return arr
    .filter((q): q is string => typeof q === "string" && Boolean(q.trim()))
    .map((q) => q.trim().slice(0, 80))
    .slice(0, 4);
}

/** اعتبارسنجی و پاک‌سازی تنظیمات ایجنت — فقط وقتی آبجکت agent ارسال شده باشد */
export function sanitizeAgentSettings(agent: ProfileInput["agent"] | undefined): {
  data: Partial<
    Pick<
      SanitizedProfile,
      | "agentEnabled" | "agentName" | "agentGreeting" | "agentStyle"
      | "agentInstructions" | "agentForbidden" | "agentUseProfile" | "agentSuggestHandoff" | "agentQuestions"
    >
  >;
  errors: string[];
} {
  const errors: string[] = [];
  // agent ارسال نشده → هیچ فیلدی تغییر نمی‌کند (undefined در update/duplicate عمدی است)
  if (agent === undefined || agent === null || typeof agent !== "object") {
    return { data: {}, errors };
  }
  const a = agent;

  const name = typeof a.name === "string" ? a.name.trim().slice(0, 40) : "";
  const greeting = typeof a.greeting === "string" ? a.greeting.trim().slice(0, 300) : "";
  const instructions = typeof a.instructions === "string" ? a.instructions.trim().slice(0, 1500) : "";
  const forbidden = typeof a.forbidden === "string" ? a.forbidden.trim().slice(0, 600) : "";

  if (a.name && name.length === 0) errors.push("نام ایجنت نامعتبر است");
  if (typeof a.greeting === "string" && a.greeting.length > 300) errors.push("پیام خوش‌آمدگویی حداکثر ۳۰۰ کاراکتر است");
  if (typeof a.instructions === "string" && a.instructions.length > 1500) errors.push("دستورالعمل اختصاصی حداکثر ۱۵۰۰ کاراکتر است");
  if (typeof a.forbidden === "string" && a.forbidden.length > 600) errors.push("موضوعات ممنوعه حداکثر ۶۰۰ کاراکتر است");

  const questions: string[] = (Array.isArray(a.questions) ? a.questions : [])
    .filter((q): q is string => typeof q === "string" && Boolean(q.trim()))
    .map((q) => q.trim().slice(0, 80))
    .slice(0, 4);

  return {
    data: {
      agentEnabled: a.enabled !== false,
      agentName: name || null,
      agentGreeting: greeting || null,
      agentStyle: AGENT_STYLE_KEYS.includes(a.style as AgentStyle) ? (a.style as AgentStyle) : "professional",
      agentInstructions: instructions || null,
      agentForbidden: forbidden || null,
      agentUseProfile: a.useProfile !== false,
      agentSuggestHandoff: a.suggestHandoff !== false,
      agentQuestions: JSON.stringify(questions),
    },
    errors,
  };
}

/** URL رسانه‌ی کانونی سامانه (بنر) */
const CANONICAL_MEDIA_RE = /^\/(files|uploads)\/[a-z0-9][a-z0-9/_-]*\.[a-z0-9]{2,5}$/i;

export function sanitizeBannerUrl(url: unknown): string | null {
  if (typeof url !== "string" || !url.trim()) return null;
  const v = url.trim().slice(0, 300);
  return CANONICAL_MEDIA_RE.test(v) ? v : null;
}

export function sanitizeProfileInput(input: ProfileInput): {
  data: Partial<SanitizedProfile>;
  errors: string[];
} {
  const errors: string[] = [];

  const str = (v: unknown, max: number): string | null => {
    if (v === undefined || v === null) return null;
    if (typeof v !== "string") return null;
    const t = v.trim();
    if (!t) return null;
    if (t.length > max) errors.push(`متن بیش از حد مجاز (${max} کاراکتر)`);
    return t.slice(0, max);
  };

  // ─── به‌روزرسانی جزئی: فقط فیلدهای «ارسال‌شده» تغییر می‌کنند ───
  // (ویرایشگر کامل همه را می‌فرستد؛ پنل ایجنت فقط agent — بقیه دست‌نخورده می‌مانند)
  const data: Partial<SanitizedProfile> = {};

  if (input.headline !== undefined) data.headline = str(input.headline, 80);
  if (input.bio !== undefined) data.bio = str(input.bio, 800);
  if (input.city !== undefined) data.city = str(input.city, 40);
  if (input.bannerUrl !== undefined) data.bannerUrl = sanitizeBannerUrl(input.bannerUrl);
  if (input.bannerTheme !== undefined) {
    data.bannerTheme =
      typeof input.bannerTheme === "string" && BANNER_THEME_KEYS.includes(input.bannerTheme)
        ? input.bannerTheme
        : "aurora";
  }
  if (input.isDiscoverable !== undefined) data.isDiscoverable = input.isDiscoverable !== false;

  if (input.skills !== undefined) {
    const rawSkills = Array.isArray(input.skills) ? input.skills.slice(0, 20) : [];
    const skills: SkillItem[] = [];
    const seenSkills = new Set<string>();
    for (const s of rawSkills) {
      if (!s || typeof s !== "object") continue;
      const name = String((s as Record<string, unknown>).name || "").trim().slice(0, 40);
      if (!name) continue;
      const key = name.toLowerCase();
      if (seenSkills.has(key)) continue;
      seenSkills.add(key);
      const level = Math.min(4, Math.max(1, Number((s as Record<string, unknown>).level) || 1));
      skills.push({ name, level });
    }
    data.skills = JSON.stringify(skills);
  }

  if (input.interests !== undefined) {
    const interests: string[] = (Array.isArray(input.interests) ? input.interests : [])
      .filter((i): i is string => typeof i === "string" && Boolean(i.trim()))
      .map((i) => i.trim().slice(0, 40))
      .slice(0, 15);
    data.interests = JSON.stringify(interests);
  }

  if (input.education !== undefined) {
    data.education = JSON.stringify(parseEducation(JSON.stringify(Array.isArray(input.education) ? input.education.slice(0, 10) : [])));
  }
  if (input.experience !== undefined) {
    data.experience = JSON.stringify(parseExperience(JSON.stringify(Array.isArray(input.experience) ? input.experience.slice(0, 10) : [])));
  }
  if (input.links !== undefined) {
    data.links = JSON.stringify(parseLinks(JSON.stringify(Array.isArray(input.links) ? input.links.slice(0, 6) : [])));
  }

  const agent = sanitizeAgentSettings(input.agent);
  Object.assign(data, agent.data);

  return { data, errors: [...errors, ...agent.errors] };
}

// ─── سریالایز برای API ───

type ProfileWithUser = {
  id: string;
  userId: string;
  headline: string | null;
  bio: string | null;
  city: string | null;
  bannerUrl: string | null;
  bannerTheme: string;
  skills: string | null;
  interests: string | null;
  education: string | null;
  experience: string | null;
  links: string | null;
  isDiscoverable: boolean;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; fullName: string | null; avatarUrl: string | null; avatarColor: string; status: string; isVerified: boolean };
};

/** تبدیل رکورد DB به کارت دایرکتوری (بدون داده‌های خصوصی) */
export function toPersonCard(profile: ProfileWithUser, endorsementCount: number, hasAgent: boolean, knowledgeCount: number): PersonCardData {
  return {
    userId: profile.userId,
    name: profile.user.fullName || "کاربر شهریار",
    avatarUrl: profile.user.avatarUrl,
    avatarColor: profile.user.avatarColor,
    isVerified: profile.user.isVerified,
    headline: profile.headline,
    city: profile.city,
    bannerTheme: profile.bannerTheme,
    bannerUrl: profile.bannerUrl,
    skills: parseSkills(profile.skills).slice(0, 8),
    interests: parseInterests(profile.interests).slice(0, 6),
    endorsementCount,
    hasAgent,
    knowledgeCount,
    viewCount: profile.viewCount,
    updatedAt: profile.updatedAt.toISOString(),
  };
}

// ─── آمار ایجنت ───

export interface AgentStats {
  items: number;
  totalChars: number;
  lastUpdatedAt: Date | null;
}

export async function getAgentStats(userId: string): Promise<AgentStats> {
  const agg = await db.knowledgeItem.aggregate({
    where: { userId },
    _count: { _all: true },
    _sum: { charCount: true },
    _max: { updatedAt: true },
  });
  return {
    items: agg._count._all,
    totalChars: agg._sum.charCount || 0,
    lastUpdatedAt: agg._max.updatedAt || null,
  };
}

// ─── دایرکتوری افراد ───

export interface DirectoryResult {
  people: PersonCardData[];
  suggestions: PersonCardData[];
  stats: { total: number; withAgent: number };
}

export async function getDirectory(
  viewerId: string,
  opts: { q?: string; skill?: string; sort?: string }
): Promise<DirectoryResult> {
  const q = (opts.q || "").trim().slice(0, 60);
  const skill = (opts.skill || "").trim().slice(0, 40);

  // پروفایل‌های قابل‌کشف + کاربر فعال
  const profiles = await db.socialProfile.findMany({
    where: { isDiscoverable: true, user: { status: "ACTIVE" } },
    include: { user: { select: { id: true, fullName: true, avatarUrl: true, avatarColor: true, status: true, isVerified: true } } },
    orderBy: { updatedAt: "desc" },
    take: 300,
  });

  // آمار ایجنت همه‌ی کاربران یکجا
  const knowledgeAgg = await db.knowledgeItem.groupBy({
    by: ["userId"],
    where: { user: { status: "ACTIVE" } },
    _count: { _all: true },
  });
  const knowledgeMap = new Map(knowledgeAgg.map((k) => [k.userId, k._count._all]));

  // تأییدهای مهارت گروهی
  const endorseAgg = await db.skillEndorsement.groupBy({
    by: ["profileId"],
    _count: { _all: true },
  });
  // نگاشت profileId → userId
  const profileIdToUser = new Map(profiles.map((p) => [p.id, p.userId]));
  const endorseMap = new Map<string, number>();
  for (const e of endorseAgg) {
    const uid = profileIdToUser.get(e.profileId);
    if (uid) endorseMap.set(uid, (endorseMap.get(uid) || 0) + e._count._all);
  }

  let cards = profiles
    .filter((p) => p.userId !== viewerId)
    .map((p) => {
      const knowledgeCount = knowledgeMap.get(p.userId) || 0;
      // ایجنت «فعال» = دانش دارد و مالک آن را خاموش نکرده
      const hasAgent = knowledgeCount > 0 && p.agentEnabled !== false;
      return toPersonCard(p, endorseMap.get(p.userId) || 0, hasAgent, knowledgeCount);
    });

  // ─── جستجو ───
  if (q) {
    const needle = q.toLowerCase();
    cards = cards.filter((c) => {
      const hay = [
        c.name,
        c.headline || "",
        c.city || "",
        c.skills.map((s) => s.name).join(" "),
        c.interests.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }
  if (skill) {
    const needle = skill.toLowerCase();
    cards = cards.filter((c) => c.skills.some((s) => s.name.toLowerCase().includes(needle)));
  }

  // ─── مرتب‌سازی ───
  const sort = opts.sort || "relevant";
  if (sort === "new") {
    cards.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } else if (sort === "popular") {
    cards.sort((a, b) => b.endorsementCount - a.endorsementCount || b.updatedAt.localeCompare(a.updatedAt));
  } else {
    // relevant: ایجنت‌دارها اول، بعد بیشترین تأیید
    cards.sort(
      (a, b) =>
        Number(b.hasAgent) - Number(a.hasAgent) ||
        b.endorsementCount - a.endorsementCount ||
        b.updatedAt.localeCompare(a.updatedAt)
    );
  }

  // ─── پیشنهادها: اشتراک مهارت/علاقه با من ───
  const me = await db.socialProfile.findUnique({ where: { userId: viewerId } });
  const mySkills = new Set(parseSkills(me?.skills).map((s) => s.name.toLowerCase()));
  const myInterests = new Set(parseInterests(me?.interests).map((i) => i.toLowerCase()));
  let suggestions = cards
    .map((c) => {
      let score = 0;
      for (const s of c.skills) if (mySkills.has(s.name.toLowerCase())) score += 2;
      for (const i of c.interests) if (myInterests.has(i.toLowerCase())) score += 1;
      return { c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.c);

  if (suggestions.length < 4) {
    // fallback: محبوب‌ترین‌ها
    const existing = new Set(suggestions.map((s) => s.userId));
    for (const c of [...cards].sort((a, b) => b.endorsementCount - a.endorsementCount)) {
      if (suggestions.length >= 4) break;
      if (!existing.has(c.userId)) {
        suggestions.push(c);
        existing.add(c.userId);
      }
    }
  }
  suggestions = suggestions.slice(0, 4);

  return {
    people: cards,
    suggestions,
    stats: {
      total: cards.length,
      withAgent: cards.filter((c) => c.hasAgent).length,
    },
  };
}
