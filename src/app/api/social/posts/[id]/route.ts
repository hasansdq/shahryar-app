// ═══ PATCH /api/social/posts/[id] — ویرایش متن + پین/آن‌پین ═══
// ═══ DELETE /api/social/posts/[id] — حذف نرم (نویسنده یا مدیر) ═══
import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ok, fail, getUser, guardModule, parseJson } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { sanitizePostContent, setPinned, serializePost, postsInclude, validateAttachments } from "@/lib/modules/social/feed-service";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("social");
    if (gate) return gate;

    const { id } = await ctx.params;
    if (!id || id.length > 40) return fail("شناسه پست نامعتبر است");

    const post = await db.socialPost.findUnique({ where: { id }, select: { id: true, authorId: true, deletedAt: true } });
    if (!post || post.deletedAt) return fail("این پست یافت نشد", 404);
    if (post.authorId !== auth.id) return fail("فقط نویسنده پست می‌تواند آن را ویرایش کند", 403);

    const body = await parseJson<{ content?: unknown; pinned?: unknown; attachments?: unknown }>(req);
    if (!body) return fail("درخواست نامعتبر است");

    // ─── گام ۱: اعتبارسنجی کامل قبل از هر نوشتن ───
    // قبلاً پین «قبل» از اعتبارسنجی متن/پیوست اعمال می‌شد و اگر اعتبارسنجی
    // شکست می‌خورد، اثر جانبی پین با پاسخ خطا باقی می‌ماند (به‌روزرسانی نیمه‌کاره)
    let newContent: string | null = null;
    if (body.content !== undefined) {
      const { content, error } = sanitizePostContent(body.content);
      if (error) return fail(error);
      newContent = content;
    }
    let newAttachments: Awaited<ReturnType<typeof validateAttachments>>["attachments"] | null = null;
    if (body.attachments !== undefined) {
      const { attachments, error: attachError } = await validateAttachments(body.attachments, auth.id);
      if (attachError) return fail(attachError);
      newAttachments = attachments;
    }

    // ─── گام ۲: اعمال تغییرات — متن و پیوست‌ها در یک تراکنش batch ───
    // تراکنش آرایه‌ای (یک رفت‌وبرگشت، قفل کوتاه) — تراکنش interactive
    // در SQLite زیر بار موازی به timeout می‌رسد
    const txOps: Prisma.PrismaPromise<unknown>[] = [];
    if (newContent !== null) {
      txOps.push(
        db.socialPost.update({
          where: { id: post.id },
          data: { content: newContent!, editedAt: new Date() },
        })
      );
    }
    if (newAttachments !== null) {
      // پیوست‌ها immutable هستند — مجموعه جدید جایگزین کامل مجموعه قبلی می‌شود
      txOps.push(db.socialPostAttachment.deleteMany({ where: { postId: post.id } }));
      if (newAttachments.length) {
        txOps.push(
          db.socialPostAttachment.createMany({
            data: newAttachments.map((a, i) => ({
              postId: post.id,
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
          })
        );
      }
    }
    if (txOps.length) await db.$transaction(txOps);

    if (newContent !== null) {
      logActivity({
        userId: auth.id,
        action: "social.post_edit",
        entity: "social_post",
        entityId: post.id,
        details: { chars: newContent.length },
      }).catch(() => {});
    }

    // ─── گام ۳: پین/آن‌پین (تراکنش مستقل خودش) — بعد از اعتبارسنجی‌ها ───
    let pinError: string | null = null;
    if (typeof body.pinned === "boolean") {
      try {
        await setPinned(post.id, body.pinned);
      } catch {
        pinError = "پین پست انجام نشد";
      }
    }

    if (pinError) return fail(pinError);

    const fresh = await db.socialPost.findUnique({ where: { id: post.id }, include: postsInclude(auth.id) });
    return ok(fresh ? serializePost(fresh, auth.id) : null);
  } catch (err) {
    console.error("خطای ویرایش پست:", err);
    return fail("خطای داخلی سرور", 500);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("social");
    if (gate) return gate;

    const { id } = await ctx.params;
    if (!id || id.length > 40) return fail("شناسه پست نامعتبر است");

    const post = await db.socialPost.findUnique({ where: { id }, select: { authorId: true, deletedAt: true } });
    if (!post || post.deletedAt) return fail("این پست یافت نشد", 404);

    // مدیر سامانه نیز می‌تواند حذف کند (ادمین از روت خودش می‌آید؛ اینجا فقط نویسنده)
    if (post.authorId !== auth.id) return fail("فقط نویسنده پست می‌تواند آن را حذف کند", 403);

    await db.socialPost.update({
      where: { id },
      data: { deletedAt: new Date(), isPinned: false, pinnedAt: null },
    });
    logActivity({
      userId: auth.id,
      action: "social.post_delete",
      entity: "social_post",
      entityId: id,
    }).catch(() => {});
    return ok({ deleted: true });
  } catch (err) {
    console.error("خطای حذف پست:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
