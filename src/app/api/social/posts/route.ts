// ═══ POST /api/social/posts — انتشار پست جدید (متن + پیوست‌ها) ═══
// body: { content: string, attachments?: [{kind, url, originalName, mime, size, durationMs?, width?, height?}] }
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, getUser, guardModule, parseJson } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import {
  sanitizePostContent,
  validateAttachments,
  serializePost,
  postsInclude,
  countRecentPosts,
  isDuplicatePost,
  POSTS_PER_HOUR,
} from "@/lib/modules/social/feed-service";

export async function POST(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("social");
    if (gate) return gate;

    const body = await parseJson<{ content?: unknown; attachments?: unknown }>(req);
    if (!body) return fail("درخواست نامعتبر است");

    // ─── متن ───
    const { content, error: contentError } = sanitizePostContent(body.content);
    if (contentError) return fail(contentError);

    // ─── anti-spam ───
    const [recent, dup] = await Promise.all([countRecentPosts(auth.id), isDuplicatePost(auth.id, content)]);
    if (recent >= POSTS_PER_HOUR) {
      return fail("در یک ساعت گذشته به سقف انتشار پست رسیده‌اید؛ کمی بعد دوباره تلاش کنید", 429);
    }
    if (dup) return fail("این پست را همین چند دقیقه پیش منتشر کرده‌اید", 409);

    // ─── پیوست‌ها ───
    const { attachments, error: attachError } = await validateAttachments(body.attachments, auth.id);
    if (attachError) return fail(attachError);

    // ─── ثبت پست ───
    const post = await db.socialPost.create({
      data: {
        authorId: auth.id,
        content,
        attachments: attachments.length
          ? {
              create: attachments.map((a, i) => ({
                kind: a.kind,
                url: a.url,
                originalName: a.originalName,
                mime: a.mime,
                size: a.size,
                durationMs: a.durationMs,
                width: a.width,
                height: a.height,
                sortOrder: i,
              })),
            }
          : undefined,
      },
      include: postsInclude(auth.id),
    });

    logActivity({
      userId: auth.id,
      action: "social.post_create",
      entity: "social_post",
      entityId: post.id,
      details: { chars: content.length, attachments: attachments.length },
    }).catch(() => {});

    return ok(serializePost(post, auth.id), { status: 201 });
  } catch (err) {
    console.error("خطای انتشار پست:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
