// ═══ مقاله نشریه — GET / PATCH / DELETE /api/forums/[id]/articles/[articleId] ═════
// GET: خواندن مقاله (+ شمارش بازدید) — PATCH/DELETE: فقط رئیس انجمن
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { verifiedMediaUrl } from "@/lib/media/verify";
import { MAX_ARTICLE_TITLE, MAX_ARTICLE_CONTENT, MAX_DESCRIPTION, loadForumForUser, toArticleDTO } from "@/lib/modules/forums/service";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string; articleId: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("forums");
    if (gate) return gate;

    const { id, articleId } = await ctx.params;
    const loaded = await loadForumForUser(id, auth.id);
    if (!loaded) return fail("انجمن یافت نشد", 404);

    const isChair = loaded.forum.chairId === auth.id;
    const article = await db.forumArticle.findUnique({
      where: { id: articleId },
      include: { author: { select: { fullName: true } } },
    });
    if (!article || article.forumId !== id) return fail("مقاله یافت نشد", 404);

    // پیش‌نویس فقط برای رئیس
    if (article.status === "DRAFT" && !isChair) return fail("مقاله یافت نشد", 404);
    // انجمن خصوصی: فقط اعضا
    if (loaded.forum.type === "PRIVATE" && !isChair && (!loaded.membership || loaded.membership.status !== "ACTIVE")) {
      return fail("دسترسی ندارید", 403);
    }

    await db.forumArticle.update({ where: { id: articleId }, data: { views: { increment: 1 } } }).catch(() => {});

    return ok({ article: toArticleDTO({ ...article, views: article.views + 1 }, true) });
  } catch (err) {
    console.error("خطای خواندن مقاله:", err);
    return fail("خطای داخلی سرور", 500);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string; articleId: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("forums");
    if (gate) return gate;

    const { id, articleId } = await ctx.params;
    const loaded = await loadForumForUser(id, auth.id);
    if (!loaded) return fail("انجمن یافت نشد", 404);
    if (loaded.forum.chairId !== auth.id) return fail("ویرایش نشریه فقط توسط رئیس انجمن ممکن است", 403);

    // قابلیت نشریه انجمن باید در CMS فعال باشد
    const articlesGate = await guardModule("forums", "enableArticles");
    if (articlesGate) return articlesGate;

    const body = await parseJson<{ title?: string; summary?: string; content?: string; coverImage?: string | null; publish?: boolean; unpublish?: boolean }>(req);
    const existing = await db.forumArticle.findUnique({ where: { id: articleId }, select: { forumId: true } });
    if (!existing || existing.forumId !== id) return fail("مقاله یافت نشد", 404);

    const data: Record<string, unknown> = {};
    if (body?.title !== undefined) {
      const title = body.title.trim();
      if (!title) return fail("عنوان مقاله نمی‌تواند خالی باشد");
      if (title.length > MAX_ARTICLE_TITLE) return fail(`عنوان حداکثر ${MAX_ARTICLE_TITLE} کاراکتر است`);
      data.title = title;
    }
    if (body?.summary !== undefined) data.summary = body.summary.trim().slice(0, MAX_DESCRIPTION) || null;
    if (body?.content !== undefined) {
      const content = body.content.trim();
      if (!content) return fail("متن مقاله نمی‌تواند خالی باشد");
      if (content.length > MAX_ARTICLE_CONTENT) {
        return fail(`متن مقاله بیش از حد بزرگ است (حداکثر ${Math.round(MAX_ARTICLE_CONTENT / 1000)} هزار کاراکتر)`);
      }
      data.content = content;
    }
    // تصویر شاخص — رشته خالی/نال = حذف؛ در غیر این صورت فقط رسانه تاییدشده
    if (body?.coverImage !== undefined) {
      data.coverImage = body.coverImage ? await verifiedMediaUrl(String(body.coverImage)) : null;
    }
    if (body?.publish === true) {
      data.status = "PUBLISHED";
      data.publishedAt = new Date();
    }
    if (body?.unpublish === true) data.status = "DRAFT";

    const article = await db.forumArticle.update({
      where: { id: articleId },
      data,
      include: { author: { select: { fullName: true } } },
    });
    return ok({ article: toArticleDTO(article, true) });
  } catch (err) {
    console.error("خطای ویرایش مقاله:", err);
    return fail("خطای داخلی سرور", 500);
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string; articleId: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("forums");
    if (gate) return gate;

    const { id, articleId } = await ctx.params;
    const loaded = await loadForumForUser(id, auth.id);
    if (!loaded) return fail("انجمن یافت نشد", 404);
    if (loaded.forum.chairId !== auth.id) return fail("حذف مقاله فقط توسط رئیس انجمن ممکن است", 403);

    // قابلیت نشریه انجمن باید در CMS فعال باشد
    const articlesGate = await guardModule("forums", "enableArticles");
    if (articlesGate) return articlesGate;

    const existing = await db.forumArticle.findUnique({ where: { id: articleId }, select: { forumId: true } });
    if (!existing || existing.forumId !== id) return fail("مقاله یافت نشد", 404);

    await db.forumArticle.delete({ where: { id: articleId } });
    return ok({ message: "مقاله حذف شد" });
  } catch (err) {
    console.error("خطای حذف مقاله:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
