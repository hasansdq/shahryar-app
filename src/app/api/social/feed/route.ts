// ═══ GET /api/social/feed — فید پست‌های شهریار ═══
// پارامترها: cursor (ISO) | authorId (فیلتر پروفایل) | take | sort=recent|popular
import { NextRequest } from "next/server";
import { ok, fail, getUser, guardModule } from "@/lib/core/api";
import { getFeed, FEED_PAGE_MAX } from "@/lib/modules/social/feed-service";

export async function GET(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("social");
    if (gate) return gate;

    const sp = req.nextUrl.searchParams;
    const authorId = sp.get("authorId");
    const cursor = sp.get("cursor");
    const sort = sp.get("sort") === "popular" ? "popular" : "recent";
    const take = Math.min(Math.max(parseInt(sp.get("take") || "", 10) || 10, 1), FEED_PAGE_MAX);

    // فیلتر پروفایل: نویسنده باید وجود داشته باشد و ACTIVE باشد
    if (authorId) {
      if (authorId.length > 40) return fail("شناسه کاربر نامعتبر است");
      const { db } = await import("@/lib/db");
      const u = await db.user.findUnique({
        where: { id: authorId },
        select: { status: true, id: true, socialProfile: { select: { isDiscoverable: true } } },
      });
      if (!u || u.status !== "ACTIVE") return fail("این کاربر یافت نشد", 404);
      // پروفایل مخفی: فید عمومی هم نباید از پشت دیوار ۴۰۳ پروفایل بیرون بزند
      if (u.socialProfile?.isDiscoverable === false && auth.id !== authorId) {
        return fail("این کاربر در دایرکتوری شهریار مخفی شده است", 403);
      }
    }

    const feed = await getFeed({ viewerId: auth.id, authorId: authorId || undefined, cursor, take, orderBy: sort });
    return ok(feed);
  } catch (err) {
    console.error("خطای فید:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
