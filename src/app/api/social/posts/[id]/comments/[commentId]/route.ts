// ═══ DELETE /api/social/posts/[id]/comments/[commentId] ═══
// حذف نرم دیدگاه — توسط نویسنده دیدگاه یا نویسنده پست (مالک تالار)
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, getUser, guardModule } from "@/lib/core/api";

type Ctx = { params: Promise<{ id: string; commentId: string }> };

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("social");
    if (gate) return gate;

    const { id, commentId } = await ctx.params;
    if (!id || id.length > 40 || !commentId || commentId.length > 40) return fail("شناسه نامعتبر است");

    const comment = await db.socialPostComment.findUnique({
      where: { id: commentId },
      select: { id: true, postId: true, authorId: true, deletedAt: true },
    });
    if (!comment || comment.postId !== id || comment.deletedAt) return fail("این دیدگاه یافت نشد", 404);

    const post = await db.socialPost.findUnique({ where: { id }, select: { authorId: true } });
    const canDelete = comment.authorId === auth.id || post?.authorId === auth.id;
    if (!canDelete) return fail("اجازه حذف این دیدگاه را ندارید", 403);

    await db.socialPostComment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
    await db.socialPost.update({ where: { id }, data: { commentCount: { decrement: 1 } } });
    return ok({ deleted: true });
  } catch (err) {
    console.error("خطای حذف دیدگاه:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
