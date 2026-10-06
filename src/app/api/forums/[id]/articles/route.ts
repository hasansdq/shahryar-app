// ═══ نشریه انجمن — GET / POST /api/forums/[id]/articles ═════
// GET  ?all=1 (رئیس: شامل پیش‌نویس‌ها) — مقالات منتشرشده برای عموم انجمن‌های عمومی
// POST ایجاد مقاله — فقط رئیس انجمن (پیش‌نویس یا انتشار)
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { verifiedMediaUrl } from "@/lib/media/verify";
import { MAX_ARTICLE_TITLE, MAX_ARTICLE_CONTENT, MAX_DESCRIPTION, loadForumForUser, toArticleDTO } from "@/lib/modules/forums/service";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("forums");
    if (gate) return gate;

    const { id } = await ctx.params;
    const loaded = await loadForumForUser(id, auth.id);
    if (!loaded) return fail("انجمن یافت نشد", 404);

    const isChair = loaded.forum.chairId === auth.id;
    const wantsAll = new URL(req.url).searchParams.get("all") === "1";
    const isMember = !!loaded.membership && loaded.membership.status === "ACTIVE";

    // مقالات منتشرشده: در انجمن عمومی همه می‌بینند؛ در خصوصی فقط اعضا
    if (loaded.forum.type === "PRIVATE" && !isMember) return fail("دسترسی ندارید", 403);

    const articles = await db.forumArticle.findMany({
      where: isChair && wantsAll ? { forumId: id } : { forumId: id, status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      include: { author: { select: { fullName: true } } },
    });

    return ok({
      articles: articles.map((a) => toArticleDTO(a, false)),
      isChair,
    });
  } catch (err) {
    console.error("خطای لیست مقالات:", err);
    return fail("خطای داخلی سرور", 500);
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("forums");
    if (gate) return gate;

    const { id } = await ctx.params;
    const loaded = await loadForumForUser(id, auth.id);
    if (!loaded) return fail("انجمن یافت نشد", 404);
    if (loaded.forum.chairId !== auth.id) return fail("نوشتن در نشریه فقط توسط رئیس انجمن ممکن است", 403);

    // قابلیت نشریه انجمن باید در CMS فعال باشد
    const articlesGate = await guardModule("forums", "enableArticles");
    if (articlesGate) return articlesGate;

    const body = await parseJson<{ title?: string; summary?: string; content?: string; coverImage?: string | null; publish?: boolean }>(req);
    const title = (body?.title || "").trim();
    const content = (body?.content || "").trim();
    if (!title) return fail("عنوان مقاله الزامی است");
    if (title.length > MAX_ARTICLE_TITLE) return fail(`عنوان حداکثر ${MAX_ARTICLE_TITLE} کاراکتر است`);
    if (!content) return fail("متن مقاله خالی است");
    if (content.length > MAX_ARTICLE_CONTENT) {
      return fail(`متن مقاله بیش از حد بزرگ است (حداکثر ${Math.round(MAX_ARTICLE_CONTENT / 1000)} هزار کاراکتر)`);
    }

    // تصویر شاخص — فقط رسانه تاییدشده سامانه (فایل واقعاً موجود روی دیسک)
    const coverImage = body?.coverImage ? await verifiedMediaUrl(String(body.coverImage)) : null;

    const publish = body?.publish !== false; // پیش‌فرض: انتشار
    const article = await db.forumArticle.create({
      data: {
        forumId: id,
        authorId: auth.id,
        title,
        summary: (body?.summary || "").trim().slice(0, MAX_DESCRIPTION) || null,
        content,
        coverImage,
        status: publish ? "PUBLISHED" : "DRAFT",
        publishedAt: publish ? new Date() : null,
      },
      include: { author: { select: { fullName: true } } },
    });

    return ok({ article: toArticleDTO(article, true) });
  } catch (err) {
    console.error("خطای ایجاد مقاله:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
