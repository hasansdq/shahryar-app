// ═══════════════════════════════════════════════════════════════
// سرویس لیدهای ایجنت — CRM مشترک ایجنت شخصی و ایجنت انجمن
//
// هر کاربری که با یک ایجنت گفتگو کند، به‌عنوان «لید» برای مالک آن
// ایجنت ثبت می‌شود. این ماژول لایه‌ی مشترک هر دو دامنه است:
//  • scope=user  → ایجنت شخصی (ownerKey: user:{ownerUserId})
//  • scope=forum → ایجنت انجمن (ownerKey: forum:{forumId})
//
// منبع پیام‌ها (ترنسکریپت لید):
//  • user  → SocialConversation + SocialMessage
//  • forum → ForumMessage(thread=AGENT, threadUserId=lead)
// ═══════════════════════════════════════════════════════════════
import { db } from "@/lib/db";

// ─── وضعیت‌های گردش کار لید ───

export const LEAD_STATUSES = ["NEW", "CONTACTED", "CONVERTED", "ARCHIVED"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "جدید",
  CONTACTED: "تماس گرفته‌شده",
  CONVERTED: "تبدیل‌شده",
  ARCHIVED: "آرشیو",
};

export function isLeadStatus(v: unknown): v is LeadStatus {
  return typeof v === "string" && (LEAD_STATUSES as readonly string[]).includes(v);
}

/** کلید یکتای مالک لید */
export function leadOwnerKey(scope: "user" | "forum", id: string): string {
  return `${scope}:${id}`;
}

// ─── انواع DTO (مشترک کلاینت/سرور) ───

/** اطلاعات کاربرِ لید در کارت فهرست و هدر جزئیات */
export interface LeadUserDTO {
  userId: string;
  name: string;
  avatarUrl: string | null;
  avatarColor: string;
  isVerified: boolean;
  headline: string | null;
  city: string | null;
  /** نام نقش در انجمن (فقط scope=forum): رئیس | عضو | مهمان */
  memberRole?: "CHAIR" | "MEMBER" | "GUEST";
}

/** پیام ترنسکریپت لید — فقط-خواندنی */
export interface LeadMessageDTO {
  id: string;
  fromUser: boolean; // true = پیام کاربر (لید) · false = پاسخ ایجنت
  content: string;
  createdAt: string;
}

/** کارت لید در فهرست */
export interface LeadSummaryDTO {
  id: string;
  user: LeadUserDTO;
  status: LeadStatus;
  note: string | null;
  messageCount: number;
  firstMessageAt: string;
  lastMessageAt: string;
  lastMessagePreview: string | null; // آخرین پیام (برای پیش‌نمایش کارت)
  wasReset: boolean; // کاربر گفتگو را بازنشانی کرده (پیامی مانده ولی آمار > 0)
}

/** آمار خلاصه‌ی لیدهای یک مالک */
export interface LeadStatsDTO {
  total: number;
  NEW: number;
  CONTACTED: number;
  CONVERTED: number;
  ARCHIVED: number;
  guests: number; // فقط forum: لیدهای غیرعضو
}

export interface LeadsListResult {
  leads: LeadSummaryDTO[];
  stats: LeadStatsDTO;
  agentEnabled: boolean; // ایجنت شخصی مالک فعال است؟ (scope=user)
}

// ─── ثبت/به‌روزرسانی لید (روی هر پیام جدید) ───

/**
 * به‌روزرسانی لید پس از هر پیام گفتگوی ایجنت.
 * لید جدید → ایجاد با timestamp پیام اول؛ لید موجود → شمارنده + آخرین تماس.
 * خطا هرگز جریان چت را نمی‌شکند (fire-and-forget-safe).
 */
export async function touchLead(opts: {
  scope: "user" | "forum";
  ownerId: string; // scope=user: شناسه مالک ایجنت · scope=forum: شناسه انجمن
  userId: string; // کاربر لید (چت‌کننده)
  at?: Date;
}): Promise<void> {
  const now = opts.at || new Date();
  const ownerKey = leadOwnerKey(opts.scope, opts.ownerId);
  try {
    // upsert اتمیک — قبلاً find→create بود که در پیام‌های همزمان (دوکلیک)
    // بازنده P2002 می‌شد و آن پیام در messageCount حساب نمی‌شد (دریفت شمارنده)
    await db.agentLead.upsert({
      where: { ownerKey_userId: { ownerKey, userId: opts.userId } },
      create: {
        scope: opts.scope,
        ownerKey,
        ownerUserId: opts.scope === "user" ? opts.ownerId : null,
        forumId: opts.scope === "forum" ? opts.ownerId : null,
        userId: opts.userId,
        messageCount: 1,
        firstMessageAt: now,
        lastMessageAt: now,
      },
      update: {
        messageCount: { increment: 1 },
        lastMessageAt: now,
      },
    });
  } catch (err) {
    console.error("[AgentLead] خطای ثبت لید:", err);
  }
}

// ─── فیلدهای مشترک کاربر لید ───

/** select یکسان کاربر لید برای فهرست و جزئیات */
export const LEAD_USER_SELECT = {
  id: true,
  fullName: true,
  avatarUrl: true,
  avatarColor: true,
  isVerified: true,
  status: true,
  createdAt: true,
  socialProfile: { select: { headline: true, city: true } },
} as const;

export type LeadUserRow = {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
  avatarColor: string;
  isVerified: boolean;
  status: string;
  createdAt: Date;
  socialProfile: { headline: string | null; city: string | null } | null;
};

/** تبدیل رکورد کاربر به DTO کارت لید */
export function toLeadUser(u: LeadUserRow): LeadUserDTO {
  return {
    userId: u.id,
    name: u.fullName || "کاربر شهریار",
    avatarUrl: u.avatarUrl,
    avatarColor: u.avatarColor,
    isVerified: u.isVerified,
    headline: u.socialProfile?.headline ?? null,
    city: u.socialProfile?.city ?? null,
  };
}
