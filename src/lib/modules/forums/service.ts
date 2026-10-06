// ═══════════════════════════════════════════════════════════════
// سرویس انجمن‌های شهریار — منطق دسترسی + عضویت + گفتگو + محتوا
//
// قواعد دسترسی (طبق طراحی محصول):
//  • انجمن خصوصی: فقط اعضای فعال می‌بینند — سایرین حتی از وجودش خبر ندارند (404)
//  • انجمن عمومی: همه می‌توانند «اطلاعات» را ببینند (درباره، نشریه، رویدادها، آمار)
//    و با ایجنت انجمن گفتگو کنند تا اهداف و فعالیت‌ها را برایشان پرزنت کند؛
//    اما مشارکت (تالار گفتمان، لیست اعضا، دانش) نیازمند عضویت فعال است
//  • عضویت در انجمن عمومی: درخواست + تایید رئیس | انجمن خصوصی: فقط دعوت مستقیم رئیس
//  • رئیس انجمن توسط مدیر سیستم از پنل CMS تعیین می‌شود
// ═══════════════════════════════════════════════════════════════
import { db } from "@/lib/db";
import type {
  ForumArticleDTO,
  ForumChatMessage,
  ForumDetailData,
  ForumEventDTO,
  ForumKnowledgeDTO,
  ForumMemberDTO,
  ForumMemberStatus,
  ForumSummary,
  ForumThread,
  ForumType,
  MyForumRelation,
} from "./types";

// ─── ثابت‌ها ───

export const MAX_MESSAGE = 2000;
export const MAX_FORUM_TITLE = 80;
export const MAX_DESCRIPTION = 600;
export const MAX_REQUEST_NOTE = 300;
export const MAX_KNOWLEDGE_TITLE = 120;
export const MAX_KNOWLEDGE_CONTENT = 20000;
export const MAX_ARTICLE_TITLE = 140;
export const MAX_ARTICLE_CONTENT = 200_000; // ~200KB مارک‌داون با تصاویر و ساختار کامل
export const MAX_EVENT_TITLE = 120;

/** کاربرِ انتخابی برای شکل select پرامیسا در همه کوئری‌ها */
const USER_PUBLIC = {
  id: true,
  fullName: true,
  avatarUrl: true,
  avatarColor: true,
  phone: true,
  socialProfile: { select: { headline: true } },
} as const;

type UserPublicRow = {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
  avatarColor: string;
  phone: string;
  socialProfile: { headline: string | null } | null;
};

// ─── انگاشت نوع‌های Prisma ───

interface MemberRow {
  id: string;
  userId: string;
  role: string;
  status: string;
  requestNote: string | null;
  joinedAt: Date;
  reviewedAt: Date | null;
  user: UserPublicRow;
}

interface ForumRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverImage: string | null;
  type: string;
  status: string;
  chairId: string;
  agentEnabled: boolean;
  agentName: string | null;
  agentGreeting: string | null;
  createdAt: Date;
  chair: { id: string; fullName: string | null; avatarUrl: string | null; avatarColor: string } | null;
  members?: unknown[];
  _count?: { members?: number; articles?: number; events?: number };
}

// ─── نگاشت‌ها ───

function relationOf(
  forum: { chairId: string },
  membership: { role: string; status: string } | null
): MyForumRelation {
  if (membership) {
    if (membership.status === "ACTIVE") return membership.role === "CHAIR" ? "chair" : "member";
    if (membership.status === "PENDING") return "pending";
    if (membership.status === "REJECTED") return "rejected";
    if (membership.status === "BANNED") return "banned";
  }
  return "none";
}

export function toForumSummary(row: ForumRow, membership: { role: string; status: string } | null): ForumSummary {
  const relation = relationOf(row, membership);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    coverImage: row.coverImage,
    type: row.type as ForumType,
    status: (row.status as ForumSummary["status"]) ?? "ACTIVE",
    memberCount: row._count?.members ?? 0,
    articleCount: row._count?.articles ?? 0,
    eventCount: row._count?.events ?? 0,
    chair: {
      userId: row.chairId,
      name: row.chair?.fullName ?? "کاربر شهریار",
      avatarUrl: row.chair?.avatarUrl ?? null,
      avatarColor: row.chair?.avatarColor ?? "0",
    },
    myRelation: relation,
    isMember: relation === "chair" || relation === "member",
    createdAt: row.createdAt.toISOString(),
  };
}

export function toMemberDTO(m: MemberRow, messageCount = 0): ForumMemberDTO {
  return {
    id: m.id,
    userId: m.userId,
    name: m.user.fullName || "کاربر شهریار",
    phone: m.user.phone,
    avatarUrl: m.user.avatarUrl,
    avatarColor: m.user.avatarColor,
    headline: m.user.socialProfile?.headline ?? null,
    role: m.role as ForumMemberDTO["role"],
    status: m.status as ForumMemberStatus,
    requestNote: m.requestNote,
    joinedAt: m.joinedAt.toISOString(),
    reviewedAt: m.reviewedAt ? m.reviewedAt.toISOString() : null,
    messageCount,
  };
}

export function toChatMessage(
  m: { id: string; thread: string; isFromAgent: boolean; senderId: string | null; content: string; createdAt: Date; sender: UserPublicRow | null },
  agentName: string
): ForumChatMessage {
  return {
    id: m.id,
    thread: m.thread as ForumThread,
    isFromAgent: m.isFromAgent,
    senderId: m.senderId,
    senderName: m.isFromAgent ? agentName : m.sender?.fullName || "کاربر شهریار",
    senderAvatarUrl: m.isFromAgent ? null : m.sender?.avatarUrl ?? null,
    senderAvatarColor: m.isFromAgent ? null : m.sender?.avatarColor ?? null,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  };
}

// ─── خواندن انجمن‌ها ───

const FORUM_LIST_INCLUDE = {
  chair: { select: { id: true, fullName: true, avatarUrl: true, avatarColor: true } },
  // شمارش فقط اعضای فعال (ردیف‌های PENDING/REJECTED/BANNED جزو آمار نمی‌شوند)
  _count: { select: { members: { where: { status: "ACTIVE" } }, articles: true, events: true } },
} as const;

/** تلاش برای خواندن انجمن + عضویت من — انجمن خصوصیِ غیرقابل‌مشاهده null برمی‌گرداند */
export async function loadForumForUser(
  forumId: string,
  userId: string,
  opts: { allowArchived?: boolean } = {}
): Promise<{ forum: ForumRow & { members?: unknown[] }; membership: { role: string; status: string } | null } | null> {
  const forum = await db.forum.findUnique({
    where: { id: forumId },
    include: {
      ...FORUM_LIST_INCLUDE,
      members: { where: { userId }, select: { role: true, status: true } },
    },
  });
  if (!forum) return null;
  if (!opts.allowArchived && forum.status === "ARCHIVED") return null;

  const membership = (forum.members as Array<{ role: string; status: string }>)[0] ?? null;
  const relation = relationOf(forum, membership);

  // انجمن خصوصی: اعضای فعال (رئیس/عضو) می‌بینند؛ بقیه هیچ اطلاعی ندارند
  if (forum.type === "PRIVATE" && relation !== "chair" && relation !== "member") {
    return null;
  }
  return { forum: forum as unknown as ForumRow & { members?: unknown[] }, membership };
}

/** لیست انجمن‌های قابل مشاهده برای کاربر — عمومی‌ها + خصوصی‌های عضو */
export async function listForumsForUser(userId: string): Promise<ForumSummary[]> {
  const [forums, myMemberships] = await Promise.all([
    db.forum.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { createdAt: "desc" },
      include: {
        ...FORUM_LIST_INCLUDE,
        members: { where: { userId }, select: { role: true, status: true } },
      },
    }),
    db.forumMember.findMany({
      where: { userId, status: "ACTIVE" },
      select: { forumId: true },
    }),
  ]);
  const activeIds = new Set(myMemberships.map((m) => m.forumId));

  return forums
    .filter((f) => f.type !== "PRIVATE" || activeIds.has(f.id))
    .map((f) => {
      const membership = (f.members as Array<{ role: string; status: string }>)[0] ?? null;
      return toForumSummary(f as unknown as ForumRow, membership);
    });
}

/** جزئیات انجمن + ماتریس دسترسی من */
export async function getForumDetail(forumId: string, userId: string): Promise<ForumDetailData | null> {
  const loaded = await loadForumForUser(forumId, userId);
  if (!loaded) return null;
  const { forum, membership } = loaded;

  const relation = relationOf(forum, membership);
  const isMember = relation === "chair" || relation === "member";
  const isChair = relation === "chair";
  const isPublic = forum.type === "PUBLIC";
  const agentEnabled = forum.agentEnabled;

  const [memberCount, knowledgeCount, pendingCount] = await Promise.all([
    db.forumMember.count({ where: { forumId, status: "ACTIVE" } }),
    db.forumKnowledge.count({ where: { forumId } }),
    isChair ? db.forumMember.count({ where: { forumId, status: "PENDING" } }) : Promise.resolve(0),
  ]);

  return {
    id: forum.id,
    slug: forum.slug,
    title: forum.title,
    description: forum.description,
    coverImage: forum.coverImage,
    type: forum.type as ForumType,
    status: forum.status as ForumDetailData["status"],
    chair: {
      userId: forum.chairId,
      name: forum.chair?.fullName ?? "کاربر شهریار",
      avatarUrl: forum.chair?.avatarUrl ?? null,
      avatarColor: forum.chair?.avatarColor ?? "0",
    },
    agent: {
      enabled: agentEnabled,
      name: forum.agentName?.trim() || `ایجنت ${forum.title}`,
      greeting: forum.agentGreeting?.trim() || null,
      knowledgeCount,
    },
    memberCount,
    myRelation: relation,
    isMember,
    isChair,
    // عمومی: همه اطلاعات عمومی را می‌بینند؛ ایجنت برای مهمان‌ها (غیرعضو) هم فعال است
    // تا اهداف و فعالیت‌های انجمن را برایشان پرزنت کند — بقیه مشارکت‌ها فقط با عضویت
    canView: {
      chat: isMember,
      agent: agentEnabled && (isMember || isPublic),
      members: isMember,
      articles: isMember || isPublic,
      events: isMember || isPublic,
      knowledge: isMember,
    },
    pendingCount,
    createdAt: forum.createdAt.toISOString(),
  };
}

// ─── عضویت ───

/** درخواست عضویت — فقط انجمن عمومی و فعال */
export async function requestMembership(
  forumId: string,
  userId: string,
  note?: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const forum = await db.forum.findUnique({ where: { id: forumId }, select: { type: true, status: true } });
  if (!forum || forum.status === "ARCHIVED") return { ok: false, error: "انجمن یافت نشد", status: 404 };
  if (forum.type !== "PUBLIC") {
    return { ok: false, error: "این انجمن خصوصی است؛ عضویت فقط از طریق دعوت رئیس انجمن ممکن است", status: 403 };
  }
  if (forum.status === "PAUSED") {
    return { ok: false, error: "این انجمن موقتاً غیرفعال است", status: 403 };
  }

  const existing = await db.forumMember.findUnique({ where: { forumId_userId: { forumId, userId } } });
  if (existing) {
    if (existing.status === "ACTIVE") return { ok: false, error: "شما قبلاً عضو این انجمن شده‌اید", status: 400 };
    if (existing.status === "PENDING") return { ok: false, error: "درخواست عضویت شما در انتظار بررسی رئیس انجمن است", status: 400 };
    if (existing.status === "BANNED") return { ok: false, error: "امکان عضویت مجدد در این انجمن وجود ندارد", status: 403 };
    // REJECTED → اجازه درخواست مجدد
    await db.forumMember.update({
      where: { id: existing.id },
      data: { status: "PENDING", requestNote: note?.trim() || null, updatedAt: new Date() },
    });
    return { ok: true };
  }

  // ایجاد رکورد — مقاوم به درخواست همزمان (دوکلیک/دست‌دست‌شدن با دعوت مستقیم):
  // قید یکتای forumId_userId رکورد تکراری را رد می‌کند؛ خطای P2002 را به
  // پاسخ درست تبدیل می‌کنیم نه ۵۰۰ (قبلاً بازنده رقابت ۵۰۰ می‌گرفت)
  try {
    await db.forumMember.create({
      data: { forumId, userId, role: "MEMBER", status: "PENDING", requestNote: note?.trim() || null },
    });
  } catch (err) {
    if (
      typeof err === "object" && err !== null &&
      (err as { code?: string }).code === "P2002"
    ) {
      // رکورد همین لحظه توسط درخواست دیگری ساخته شد — درخواست ثبت شد
      return { ok: true };
    }
    throw err;
  }
  return { ok: true };
}

/** اکشن رئیس روی عضو/درخواست */
export async function reviewMember(
  forumId: string,
  memberId: string,
  action: "approve" | "reject" | "ban" | "unban" | "remove"
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const member = await db.forumMember.findUnique({ where: { id: memberId }, select: { id: true, forumId: true, role: true } });
  if (!member || member.forumId !== forumId) return { ok: false, error: "عضو یافت نشد", status: 404 };
  if (member.role === "CHAIR") return { ok: false, error: "رئیس انجمن قابل تغییر نیست", status: 400 };

  const now = new Date();
  if (action === "approve") {
    await db.forumMember.update({ where: { id: member.id }, data: { status: "ACTIVE", reviewedAt: now } });
  } else if (action === "reject") {
    await db.forumMember.update({ where: { id: member.id }, data: { status: "REJECTED", reviewedAt: now } });
  } else if (action === "ban") {
    await db.forumMember.update({ where: { id: member.id }, data: { status: "BANNED", reviewedAt: now } });
  } else if (action === "unban") {
    await db.forumMember.update({ where: { id: member.id }, data: { status: "ACTIVE", reviewedAt: now } });
  } else {
    await db.forumMember.delete({ where: { id: member.id } });
  }
  return { ok: true };
}

/** افزودن مستقیم عضو توسط رئیس (جستجو با نام کاربر یا شماره) */
export async function addMemberDirect(
  forumId: string,
  query: string
): Promise<{ ok: true; name: string } | { ok: false; error: string; status: number }> {
  const q = query.trim();
  if (!q) return { ok: false, error: "عبارت جستجو خالی است", status: 400 };

  const forum = await db.forum.findUnique({ where: { id: forumId }, select: { status: true } });
  if (!forum) return { ok: false, error: "انجمن یافت نشد", status: 404 };
  if (forum.status === "PAUSED") return { ok: false, error: "این انجمن موقتاً غیرفعال است", status: 403 };

  // جستجوی نام فقط با حداقل ۳ نویسه — عبارت یک‌حرفی صدها هم‌نام دارد و
  // نتیجه دلخواه اول لیست می‌شد (افزودن شخص اشتباه)
  const isPhoneLike = /^\+?\d{10,12}$/.test(q);
  if (!isPhoneLike && q.length < 3) {
    return { ok: false, error: "برای جستجوی نام، حداقل ۳ حرف وارد کنید", status: 400 };
  }

  const user = await db.user.findFirst({
    where: isPhoneLike ? { phone: q, status: "ACTIVE" } : { OR: [{ phone: q }, { fullName: { contains: q } }], status: "ACTIVE" },
    select: { id: true, fullName: true },
  });
  if (!user) return { ok: false, error: "کاربر فعالی با این مشخصات پیدا نشد", status: 404 };

  const existing = await db.forumMember.findUnique({ where: { forumId_userId: { forumId, userId: user.id } } });
  const now = new Date();
  if (existing) {
    if (existing.status === "ACTIVE") return { ok: false, error: "این کاربر قبلاً عضو انجمن است", status: 400 };
    if (existing.status === "BANNED") return { ok: false, error: "این کاربر در انجمن مسدود شده است؛ ابتدا رفع مسدودی کنید", status: 400 };
    await db.forumMember.update({ where: { id: existing.id }, data: { status: "ACTIVE", reviewedAt: now } });
  } else {
    // مقاوم به همزمانی — P2002 یعنی همین لحظه عضو شد
    try {
      await db.forumMember.create({
        data: { forumId, userId: user.id, role: "MEMBER", status: "ACTIVE", reviewedAt: now },
      });
    } catch (err) {
      if (typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002") {
        return { ok: false, error: "این کاربر هم‌اکنون عضو انجمن شد", status: 400 };
      }
      throw err;
    }
  }
  return { ok: true, name: user.fullName || "کاربر شهریار" };
}

// ─── گفتگو ───

/**
 * تشخیص فراخوانی ایجنت در متن پیام — @agent یا @ایجنت
 * فقط به‌عنوان «مِنشنِ واقعی» — یعنی ابتدای متن یا بعد از فاصله/پرانتاز،
 * و بدون حرف/خط‌تیره/نقطه بلافاصله بعدش (آدرس‌های ایمیلی مثل
 * x@agent-site.com یا @agent-mail.net فراخوان AI حساب نمی‌شوند —
 * قبلاً \b خط تیره را مرز واژه می‌دانست و ایمیل‌های دارای «-» را می‌گرفت)
 */
const AGENT_MENTION_RE = /(?:^|[\s(«'"<])@(?:agent|ایجنت)(?![\w.\-@])/i;
export function detectAgentMention(content: string): boolean {
  return AGENT_MENTION_RE.test(content);
}

/** پیام‌های یک رشته — با صفحه‌بندی مبتنی بر تعداد اخیر
 *  در رشته‌ی AGENT: هر کاربر فقط ترد خصوصی خودش را می‌بیند (threadUserId) */
export async function listMessages(
  forumId: string,
  thread: ForumThread,
  agentName: string,
  take = 120,
  threadUserId?: string
): Promise<ForumChatMessage[]> {
  const rows = await db.forumMessage.findMany({
    where: {
      forumId,
      thread,
      // ترد خصوصی ایجنت: فقط پیام‌های متعلق به این کاربر؛
      // برای تالار گروهی (FORUM) فیلتری نیست
      ...(thread === "AGENT" && threadUserId ? { threadUserId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    include: { sender: { select: { id: true, fullName: true, avatarUrl: true, avatarColor: true, phone: true, socialProfile: { select: { headline: true } } } } },
  });
  return rows.reverse().map((m) => toChatMessage(m, agentName));
}

// ─── رویدادها ───

export function toEventDTO(
  e: {
    id: string; title: string; description: string | null; location: string | null;
    startsAt: Date; endsAt: Date | null; createdById: string; createdAt: Date;
    createdBy: { fullName: string | null } | null;
  }
): ForumEventDTO {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    location: e.location,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt ? e.endsAt.toISOString() : null,
    createdBy: e.createdById,
    createdByName: e.createdBy?.fullName ?? null,
    createdAt: e.createdAt.toISOString(),
  };
}

export async function listEvents(forumId: string): Promise<{ upcoming: ForumEventDTO[]; past: ForumEventDTO[] }> {
  const rows = await db.forumEvent.findMany({
    where: { forumId },
    orderBy: { startsAt: "desc" },
    include: { createdBy: { select: { fullName: true } } },
  });
  const now = Date.now();
  const dtos = rows.map(toEventDTO);
  return {
    upcoming: dtos.filter((e) => new Date(e.endsAt ?? e.startsAt).getTime() >= now).reverse(),
    past: dtos.filter((e) => new Date(e.endsAt ?? e.startsAt).getTime() < now),
  };
}

// ─── نشریه ───

export function toArticleDTO(
  a: {
    id: string; title: string; summary: string | null; content: string; coverImage: string | null;
    status: string; views: number; publishedAt: Date | null; createdAt: Date; updatedAt: Date;
    author: { fullName: string | null } | null;
  },
  includeContent: boolean
): ForumArticleDTO {
  return {
    id: a.id,
    title: a.title,
    summary: a.summary,
    content: includeContent ? a.content : null,
    coverImage: a.coverImage,
    status: a.status as ForumArticleDTO["status"],
    views: a.views,
    publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
    authorName: a.author?.fullName ?? null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

// ─── دانش ایجنت ───

export function toKnowledgeDTO(
  k: {
    id: string; title: string; content: string; createdAt: Date; updatedAt: Date;
    createdBy: { fullName: string | null } | null;
  }
): ForumKnowledgeDTO {
  return {
    id: k.id,
    title: k.title,
    content: k.content,
    createdByName: k.createdBy?.fullName ?? null,
    createdAt: k.createdAt.toISOString(),
    updatedAt: k.updatedAt.toISOString(),
  };
}

// ─── داشبورد رئیس انجمن ───

export async function getManageData(forumId: string) {
  const [pendingRows, memberRows, bannedRows, msgCount, agentMsgCount, articleCount, publishedCount, eventRows, knowledgeCount] =
    await Promise.all([
      db.forumMember.findMany({
        where: { forumId, status: "PENDING" },
        orderBy: { joinedAt: "asc" },
        include: { user: { select: USER_PUBLIC } },
      }),
      db.forumMember.findMany({
        where: { forumId, status: "ACTIVE" },
        // رئیس اول — CHAIR واژه‌ای جلوتر از MEMBER است (asc). قبلاً desc
        // بود که رئیس را «آخر» لیست می‌فرستاد
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
        include: { user: { select: USER_PUBLIC } },
      }),
      db.forumMember.findMany({
        where: { forumId, status: "BANNED" },
        orderBy: { reviewedAt: "desc" },
        include: { user: { select: USER_PUBLIC } },
      }),
      db.forumMessage.count({ where: { forumId, thread: "FORUM" } }),
      db.forumMessage.count({ where: { forumId, isFromAgent: true } }),
      db.forumArticle.count({ where: { forumId } }),
      db.forumArticle.count({ where: { forumId, status: "PUBLISHED" } }),
      db.forumEvent.findMany({ where: { forumId }, select: { startsAt: true, endsAt: true } }),
      db.forumKnowledge.count({ where: { forumId } }),
    ]);

  const now = Date.now();
  const upcomingEvents = eventRows.filter((e) => new Date(e.endsAt ?? e.startsAt).getTime() >= now).length;

  // تعداد پیام هر عضو در تالار — یک groupBy به‌جای N کوئری (N+1 سابق:
  // هر باز کردن داشبورد رئیس با ۱۰۰۰ عضو = ۱۰۰۰ رفت‌وبرگشت دیتابیس)
  const msgCounts = await db.forumMessage.groupBy({
    by: ["senderId"],
    where: { forumId, thread: "FORUM", senderId: { not: null } },
    _count: { _all: true },
  });
  const msgCountMap = new Map(msgCounts.map((g) => [g.senderId, g._count._all]));

  const pending = pendingRows.map((m) => toMemberDTO(m as unknown as MemberRow, 0));
  const members = memberRows.map((m) => toMemberDTO(m as unknown as MemberRow, msgCountMap.get(m.userId) || 0));

  return {
    pending,
    members,
    banned: bannedRows.map((m) => toMemberDTO(m as unknown as MemberRow, 0)),
    stats: {
      members: memberRows.length,
      pending: pendingRows.length,
      messages: msgCount,
      agentMessages: agentMsgCount,
      articles: articleCount,
      publishedArticles: publishedCount,
      events: eventRows.length,
      upcomingEvents,
      knowledge: knowledgeCount,
    },
  };
}

// ─── ساخت slug یکتا برای انجمن ───

export function slugifyForum(title: string): string {
  const base = title
    .trim()
    .replace(/[\s\u200c]+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "forum"}-${Date.now().toString(36).slice(-4)}`;
}
