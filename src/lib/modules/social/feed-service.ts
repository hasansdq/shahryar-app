// ═══════════════════════════════════════════════════════════════
// سرویس فید شهریار — پست‌ها، پیوست‌ها، لایک، کامنت، پین
// منطق مشترک بین routeهای API + اعتبارسنجی سخت‌گیرانه
// ═══════════════════════════════════════════════════════════════
import { db } from "@/lib/db";
import { verifyMedia } from "@/lib/media/verify";
import {
  ATTACHMENT_KINDS,
  REPORT_REASONS,
  POST_CONTENT_MAX,
  COMMENT_CONTENT_MAX,
  ATTACHMENTS_MAX,
  type AttachmentKind,
  type ReportReason,
  type FeedAttachmentDTO,
  type FeedCommentDTO,
  type FeedPostDTO,
} from "./feed-types";

// re-export برای استفاده routeها
export {
  ATTACHMENT_KINDS,
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  POST_CONTENT_MAX,
  COMMENT_CONTENT_MAX,
  ATTACHMENTS_MAX,
} from "./feed-types";
export type { AttachmentKind, ReportReason, FeedAttachmentDTO, FeedCommentDTO, FeedPostDTO } from "./feed-types";

// ─── ثابت‌های سرور ───

export const POST_CONTENT_MIN = 1; // متن اجباری (پست فقط-پیوست مجاز نیست — پیوست حتماً توضیح دارد)
export const FEED_PAGE_SIZE = 10; // پیش‌فرض
export const FEED_PAGE_MAX = 30;
export const POSTS_PER_HOUR = 15; // anti-spam
export const COMMENTS_PER_HOUR = 40;

// ─── پاکسازی و اعتبارسنجی ───

/** متن پست — trim، حذف کاراکترهای کنترلی، سقف طول */
export function sanitizePostContent(raw: unknown): { content: string; error?: string } {
  if (typeof raw !== "string") return { content: "", error: "متن پست الزامی است" };
  // حذف کاراکترهای کنترلی (به‌جز \n و \t) — جلوگیری از محتوای عجیب
  const cleaned = raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
  if (cleaned.length < POST_CONTENT_MIN) return { content: "", error: "متن پست خالی است" };
  if (cleaned.length > POST_CONTENT_MAX) {
    return { content: "", error: `متن پست حداکثر ${POST_CONTENT_MAX} کاراکتر می‌تواند باشد` };
  }
  // سقف خطوط — جلوگیری از دیوار متن بی‌شکل
  const lines = cleaned.split("\n");
  if (lines.length > 120) return { content: "", error: "متن پست بیش از حد طولانی است (سقف ۱۲۰ خط)" };
  return { content: cleaned };
}

/** متن کامنت — تک‌خطی‌سازی سبک + سقف طول */
export function sanitizeCommentContent(raw: unknown): { content: string; error?: string } {
  if (typeof raw !== "string") return { content: "", error: "متن دیدگاه الزامی است" };
  const cleaned = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (!cleaned) return { content: "", error: "متن دیدگاه خالی است" };
  if (cleaned.length > COMMENT_CONTENT_MAX) {
    return { content: "", error: `متن دیدگاه حداکثر ${COMMENT_CONTENT_MAX} کاراکتر می‌تواند باشد` };
  }
  return { content: cleaned };
}

export interface RawAttachmentInput {
  kind?: unknown;
  url?: unknown;
  originalName?: unknown;
  mime?: unknown;
  size?: unknown;
  durationMs?: unknown;
  width?: unknown;
  height?: unknown;
}

export interface ValidatedAttachment {
  kind: AttachmentKind;
  url: string;
  originalName: string;
  mime: string;
  size: number;
  durationMs: number | null;
  width: number | null;
  height: number | null;
}

/**
 * اعتبارسنجی پیوست‌های پست — سخت‌گیرانه:
 *  ۱) سقف تعداد
 *  ۲) kind معتبر
 *  ۳) URL رسانه‌ای سامانه (فضای‌نام جدید /files یا قدیمی /uploads) + فایل
 *     واقعاً روی دیسک (verifyMedia) — خروجی همیشه URL کانونی /files می‌شود
 *  ۴) سازگاری mime با kind (مثلاً kind=audio باید mime صوتی داشته باشد)
 *  ۵) سقف‌های عددی
 */
export async function validateAttachments(
  raw: unknown,
  userId: string
): Promise<{ attachments: ValidatedAttachment[]; error?: string }> {
  if (raw === undefined || raw === null) return { attachments: [] };
  if (!Array.isArray(raw)) return { attachments: [], error: "ساختار پیوست‌ها نامعتبر است" };
  if (raw.length === 0) return { attachments: [] };
  if (raw.length > ATTACHMENTS_MAX) {
    return { attachments: [], error: `حداکثر ${ATTACHMENTS_MAX} پیوست برای هر پست مجاز است` };
  }

  // scopeهای مجاز: پیوست پست (کانونی) + URLهای قدیمی هر scope سامانه (سازگاری)
  const out: ValidatedAttachment[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i] as RawAttachmentInput;
    if (!item || typeof item !== "object") return { attachments: [], error: `پیوست ${i + 1} نامعتبر است` };

    const kind = String(item.kind || "");
    if (!(ATTACHMENT_KINDS as readonly string[]).includes(kind)) {
      return { attachments: [], error: `نوع پیوست «${kind.slice(0, 20)}» شناخته نشد` };
    }
    const url = typeof item.url === "string" ? item.url : "";

    // فایل باید واقعاً روی دیسک باشد — ضامن بدون-۴۰۴ (هر دو فضای‌نام)
    const verified = await verifyMedia(url);
    if (!verified.exists || !verified.url) {
      return { attachments: [], error: `فایل پیوست ${i + 1} روی سرور یافت نشد؛ دوباره بارگذاری کنید` };
    }

    const mime = typeof item.mime === "string" ? item.mime.slice(0, 100) : "application/octet-stream";
    // سازگاری mime با kind اعلام‌شده
    const kindOk =
      (kind === "image" && mime.startsWith("image/")) ||
      (kind === "video" && mime.startsWith("video/")) ||
      (kind === "audio" && mime.startsWith("audio/")) ||
      kind === "file";
    if (!kindOk) {
      return { attachments: [], error: `نوع فایل پیوست ${i + 1} با دسته‌بندی آن هم‌خوانی ندارد` };
    }

    const num = (v: unknown, max: number): number | null => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n) : null;
    };

    out.push({
      kind: kind as AttachmentKind,
      url: verified.url,
      originalName: typeof item.originalName === "string" ? item.originalName.trim().slice(0, 120) || "فایل" : "فایل",
      mime,
      size: num(item.size, 200 * 1024 * 1024) || verified.size || 0,
      durationMs: num(item.durationMs, 24 * 3600 * 1000),
      width: num(item.width, 20000),
      height: num(item.height, 20000),
    });
  }

  // هر فایل حداکثر یک‌بار — جلوگیری از تکرار عمدی
  const urls = new Set(out.map((a) => a.url));
  if (urls.size !== out.length) {
    return { attachments: [], error: "یک فایل چندبار پیوست شده است" };
  }

  // جلوگیری از اتلاف: اگر همه پیوست‌ها بدون متن هستند ولی متن خالی — در route اصلی چک می‌شود
  void userId;
  return { attachments: out };
}

// ─── سریالایز ───

/** ردیف پست با include استاندارد — سازگار با findMany/create/update */
export type PostRow = {
  id: string;
  content: string;
  createdAt: Date;
  editedAt: Date | null;
  isPinned: boolean;
  likeCount: number;
  commentCount: number;
  authorId: string;
  attachments: Array<{
    id: string;
    kind: string;
    url: string;
    originalName: string;
    mime: string;
    size: number;
    durationMs: number | null;
    width: number | null;
    height: number | null;
  }>;
  likes: Array<{ id: string }>;
  reports: Array<{ id: string }>;
  author: {
    id: string;
    fullName: string | null;
    avatarUrl: string | null;
    avatarColor: string;
    isVerified: boolean;
    status: string;
    socialProfile: { headline: string | null; city: string | null; agentEnabled: boolean } | null;
  };
};

/** کوئری پایه پست‌ها با نویسنده + پیوست + وضعیت لایک/گزارش من */
export function postsInclude(viewerId: string) {
  return {
    author: {
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        avatarColor: true,
        isVerified: true,
        status: true,
        socialProfile: { select: { headline: true, city: true, agentEnabled: true } },
      },
    },
    attachments: { orderBy: { sortOrder: "asc" as const } },
    likes: { where: { userId: viewerId }, select: { id: true } },
    reports: { where: { reporterId: viewerId }, select: { id: true } },
  };
}

async function fetchPostsRaw(args: {
  viewerId: string;
  authorId?: string;
  cursor?: string | null; // recent: ISO createdAt · popular: "L{likeCount}|{ISO}"
  take: number;
  orderBy?: "recent" | "popular";
}): Promise<PostRow[]> {
  // پست‌های نویسنده فعال — حساب‌های SUSPENDED/DELETED از فید شهری حذف
  // می‌شوند (سازگار با گیت پروفایل و مسیر authorId که ۴۰۴ می‌دهد)
  const where: Record<string, unknown> = { deletedAt: null, author: { status: "ACTIVE" } };
  if (args.authorId) where.authorId = args.authorId;

  if (args.orderBy === "popular") {
    // ─── cursor مركب (likeCount, createdAt) ───
    // قبلاً cursor فقط createdAt بود در حالی که مرتب‌سازی با likeCount است:
    // صفحه ۲ همه‌ی پست‌های جدیدترِ خارج از صفحه ۱ را برای همیشه رد می‌کرد
    // و پست‌های صفحه ۱ با تاریخ قدیمی‌تر دوباره تکرار می‌شدند
    const m = /^L(\d+)\|(.+)$/.exec(args.cursor || "");
    if (m) {
      const likes = Number(m[1]);
      const d = new Date(m[2]);
      if (Number.isFinite(likes) && !Number.isNaN(d.getTime())) {
        where.OR = [
          { likeCount: { lt: likes } },
          { likeCount: likes, createdAt: { lt: d } },
        ];
      }
    }
  } else if (args.cursor) {
    const d = new Date(args.cursor);
    if (!Number.isNaN(d.getTime())) {
      where.createdAt = { lt: d };
    }
  }

  const rows = await db.socialPost.findMany({
    where,
    orderBy: args.orderBy === "popular" ? [{ likeCount: "desc" }, { createdAt: "desc" }] : { createdAt: "desc" },
    take: args.take,
    include: postsInclude(args.viewerId),
  });
  return rows as unknown as PostRow[];
}

export function serializePost(row: PostRow, viewerId: string): FeedPostDTO {
  const profile = row.author.socialProfile;
  const headline = profile?.headline ?? null;
  const city = profile?.city ?? null;
  const hasAgent = Boolean(profile?.agentEnabled);
  return {
    id: row.id,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt ? row.editedAt.toISOString() : null,
    isPinned: row.isPinned,
    likeCount: row.likeCount,
    commentCount: row.commentCount,
    likedByMe: row.likes.length > 0,
    isMine: row.authorId === viewerId,
    canPin: row.authorId === viewerId,
    reportedByMe: row.reports.length > 0,
    attachments: row.attachments.map((a) => ({
      id: a.id,
      kind: a.kind as AttachmentKind,
      url: a.url,
      originalName: a.originalName,
      mime: a.mime,
      size: a.size,
      durationMs: a.durationMs,
      width: a.width,
      height: a.height,
    })),
    author: {
      userId: row.author.id,
      name: row.author.fullName || "کاربر شهریار",
      avatarUrl: row.author.avatarUrl,
      avatarColor: row.author.avatarColor,
      isVerified: row.author.isVerified,
      headline,
      city,
      hasAgent,
    },
  };
}

/** فید عمومی یا فید پروفایل یک کاربر — با cursor pagination */
export async function getFeed(args: {
  viewerId: string;
  authorId?: string;
  cursor?: string | null;
  take?: number;
  orderBy?: "recent" | "popular";
}): Promise<{ posts: FeedPostDTO[]; nextCursor: string | null }> {
  const take = Math.min(Math.max(args.take || FEED_PAGE_SIZE, 1), FEED_PAGE_MAX);
  const rows = await fetchPostsRaw({
    viewerId: args.viewerId,
    authorId: args.authorId,
    cursor: args.cursor,
    take: take + 1, // یکی اضافه برای تشخیص صفحه بعد
    orderBy: args.orderBy,
  });
  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  const last = page.length > 0 ? page[page.length - 1] : null;
  // cursor مرتب‌سازی popular باید مركب باشد (likeCount + createdAt) — ساخت
  // cursor فقط با createdAt باعث حذف/تکرار پست‌ها در صفحه‌های بعدی می‌شد
  const nextCursor = hasMore && last
    ? args.orderBy === "popular"
      ? `L${last.likeCount}|${last.createdAt.toISOString()}`
      : last.createdAt.toISOString()
    : null;
  return {
    posts: page.map((r) => serializePost(r, args.viewerId)),
    nextCursor,
  };
}

// ─── پین — فقط نویسنده، حداکثر یک پست پین‌شده ───

export async function setPinned(postId: string, pinned: boolean): Promise<void> {
  const post = await db.socialPost.findUnique({
    where: { id: postId },
    select: { authorId: true, isPinned: true, deletedAt: true },
  });
  if (!post || post.deletedAt) throw new Error("NOT_FOUND");

  if (pinned) {
    // تراکنش آرایه‌ای (batch) — یک رفت‌وبرگشت با قفل کوتاه؛ تراکنش
    // interactive در SQLite زیر بار موازی به timeout می‌رسد
    await db.$transaction([
      // پین قبلی نویسنده برداشته می‌شود — یک پین فعال per profile
      db.socialPost.updateMany({
        where: { authorId: post.authorId, isPinned: true, id: { not: postId } },
        data: { isPinned: false, pinnedAt: null },
      }),
      db.socialPost.update({ where: { id: postId }, data: { isPinned: true, pinnedAt: new Date() } }),
    ]);
  } else {
    await db.socialPost.update({ where: { id: postId }, data: { isPinned: false, pinnedAt: null } });
  }
}

// ─── anti-spam ───

export async function countRecentPosts(userId: string): Promise<number> {
  const since = new Date(Date.now() - 3600 * 1000);
  return db.socialPost.count({ where: { authorId: userId, createdAt: { gte: since } } });
}

export async function countRecentComments(userId: string): Promise<number> {
  const since = new Date(Date.now() - 3600 * 1000);
  return db.socialPostComment.count({ where: { authorId: userId, createdAt: { gte: since } } });
}

/** پست تکراری دقیق در ۵ دقیقه اخیر (double-submit) */
export async function isDuplicatePost(userId: string, content: string): Promise<boolean> {
  const since = new Date(Date.now() - 5 * 60 * 1000);
  const dup = await db.socialPost.findFirst({
    where: { authorId: userId, content, createdAt: { gte: since } },
    select: { id: true },
  });
  return Boolean(dup);
}
