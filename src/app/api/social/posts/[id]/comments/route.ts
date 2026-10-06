// ═══ GET  /api/social/posts/[id]/comments — فهرست دیدگاه‌ها ═══
// ═══ POST /api/social/posts/[id]/comments — ثبت دیدگاه ═══
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, getUser, guardModule, parseJson } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { sanitizeCommentContent, countRecentComments, COMMENTS_PER_HOUR, FeedCommentDTO } from "@/lib/modules/social/feed-service";

type Ctx = { params: Promise<{ id: string }> };

const COMMENTS_PAGE = 20;

function serializeComment(row: {
  id: string;
  content: string;
  createdAt: Date;
  authorId: string;
  author: { id: string; fullName: string | null; avatarUrl: string | null; avatarColor: string; isVerified: boolean; socialProfile: { headline: string | null } | null };
}, viewerId: string, postAuthorId: string): FeedCommentDTO {
  return {
    id: row.id,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    isMine: row.authorId === viewerId,
    canDelete: row.authorId === viewerId || postAuthorId === viewerId,
    author: {
      userId: row.author.id,
      name: row.author.fullName || "کاربر شهریار",
      avatarUrl: row.author.avatarUrl,
      avatarColor: row.author.avatarColor,
      isVerified: row.author.isVerified,
      headline: row.author.socialProfile?.headline ?? null,
    },
  };
}

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("social");
    if (gate) return gate;

    const { id } = await ctx.params;
    if (!id || id.length > 40) return fail("شناسه پست نامعتبر است");

    const post = await db.socialPost.findUnique({ where: { id }, select: { deletedAt: true, authorId: true } });
    if (!post || post.deletedAt) return fail("این پست یافت نشد", 404);

    const cursor = req.nextUrl.searchParams.get("cursor");
    const rows = await db.socialPostComment.findMany({
      where: { postId: id, deletedAt: null, ...(cursor && !Number.isNaN(new Date(cursor).getTime()) ? { createdAt: { lt: new Date(cursor) } } : {}) },
      orderBy: { createdAt: "desc" },
      take: COMMENTS_PAGE + 1,
      include: {
        author: {
          select: {
            id: true, fullName: true, avatarUrl: true, avatarColor: true, isVerified: true,
            socialProfile: { select: { headline: true } },
          },
        },
      },
    });
    const hasMore = rows.length > COMMENTS_PAGE;
    const page = hasMore ? rows.slice(0, COMMENTS_PAGE) : rows;
    // نمایش قدیمی→جدید (طبیعی‌تر برای گفتگو) — کلاینت برمی‌گرداند
    return ok({
      comments: page.map((r) => serializeComment(r, auth.id, post.authorId)).reverse(),
      nextCursor: hasMore && page.length ? page[page.length - 1].createdAt.toISOString() : null,
    });
  } catch (err) {
    console.error("خطای فهرست دیدگاه‌ها:", err);
    return fail("خطای داخلی سرور", 500);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("social");
    if (gate) return gate;

    const { id } = await ctx.params;
    if (!id || id.length > 40) return fail("شناسه پست نامعتبر است");

    const post = await db.socialPost.findUnique({ where: { id }, select: { deletedAt: true, authorId: true } });
    if (!post || post.deletedAt) return fail("این پست یافت نشد", 404);

    const body = await parseJson<{ content?: unknown }>(req);
    const { content, error } = sanitizeCommentContent(body?.content);
    if (error) return fail(error);

    // anti-spam
    const recent = await countRecentComments(auth.id);
    if (recent >= COMMENTS_PER_HOUR) {
      return fail("در یک ساعت گذشته به سقف ثبت دیدگاه رسیده‌اید؛ کمی بعد دوباره تلاش کنید", 429);
    }

    const created = await db.socialPostComment.create({
      data: { postId: id, authorId: auth.id, content },
      include: {
        author: {
          select: {
            id: true, fullName: true, avatarUrl: true, avatarColor: true, isVerified: true,
            socialProfile: { select: { headline: true } },
          },
        },
      },
    });
    await db.socialPost.update({ where: { id }, data: { commentCount: { increment: 1 } } });

    logActivity({
      userId: auth.id,
      action: "social.comment_create",
      entity: "social_post",
      entityId: id,
      details: { chars: content.length },
    }).catch(() => {});

    return ok(serializeComment(created, auth.id, post.authorId), { status: 201 });
  } catch (err) {
    console.error("خطای ثبت دیدگاه:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
