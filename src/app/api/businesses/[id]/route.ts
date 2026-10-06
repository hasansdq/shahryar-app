// ═════ جزئیات صنف + نظرات چندمعیاره + علاقه‌مندی — /api/businesses/[id] ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";

/** اعتبارسنجی امتیاز ۱ تا ۵ اختیاری */
function optRating(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.round(Number(v));
  return n >= 1 && n <= 5 ? n : null;
}

/** اعتبارسنجی آرایه تگ (حداکثر ۶ تگ، هر کدام ۴۰ کاراکتر) */
function optTags(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const tags = v
    .map((t) => String(t).trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 6);
  return tags.length > 0 ? tags : null;
}

async function recalcRating(businessId: string) {
  const agg = await db.businessReview.aggregate({
    where: { businessId },
    _avg: { rating: true },
    _count: { rating: true },
  });
  await db.business.update({
    where: { id: businessId },
    data: {
      rating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : 0,
      reviewCount: agg._count.rating,
    },
  });
}

/** خواندن آرایه JSON امن */
function parseJsonArray(s: string | null): string[] {
  if (!s) return [];
  try {
    const a = JSON.parse(s);
    return Array.isArray(a) ? a.map(String) : [];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await guardModule("businesses");
    if (gate) return gate;

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const sort = searchParams.get("sort") === "helpful"
      ? { helpfulCount: "desc" as const, createdAt: "desc" as const }
      : searchParams.get("sort") === "best"
        ? { rating: "desc" as const, helpfulCount: "desc" as const }
        : { createdAt: "desc" as const };

    const business = await db.business.findFirst({
      where: { OR: [{ id }, { slug: id }], isActive: true },
      include: {
        category: { select: { name: true, slug: true, icon: true, color: true } },
        reviews: {
          orderBy: sort,
          take: 20,
          include: { user: { select: { id: true, fullName: true, avatarColor: true } } },
        },
      },
    });
    if (!business) return fail("کسب‌وکار یافت نشد", 404);

    // افزایش بازدید
    db.business.update({ where: { id: business.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

    // ─── آمار نظرات: توزیع امتیاز + میانگین معیارها ───
    const allReviews = await db.businessReview.findMany({
      where: { businessId: business.id },
      select: { rating: true, quality: true, priceFair: true, behavior: true, speed: true },
    });
    const distribution: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
    let q = 0, qn = 0, p = 0, pn = 0, b = 0, bn = 0, s = 0, sn = 0;
    for (const r of allReviews) {
      distribution[String(r.rating)] = (distribution[String(r.rating)] || 0) + 1;
      if (r.quality) { q += r.quality; qn++; }
      if (r.priceFair) { p += r.priceFair; pn++; }
      if (r.behavior) { b += r.behavior; bn++; }
      if (r.speed) { s += r.speed; sn++; }
    }
    const criteria = {
      quality: qn > 0 ? Math.round((q / qn) * 10) / 10 : null,
      priceFair: pn > 0 ? Math.round((p / pn) * 10) / 10 : null,
      behavior: bn > 0 ? Math.round((b / bn) * 10) / 10 : null,
      speed: sn > 0 ? Math.round((s / sn) * 10) / 10 : null,
    };

    // وضعیت کاربر: علاقه‌مندی + نظر خودش + رأی‌های «مفید»
    const auth = await getUser(req);
    let isFavorite = false;
    let myReview: unknown = null;
    let votedHelpful: string[] = [];
    if (auth) {
      const fav = await db.favoriteBusiness.findUnique({
        where: { userId_businessId: { userId: auth.id, businessId: business.id } },
      });
      isFavorite = !!fav;
      const review = await db.businessReview.findUnique({
        where: { businessId_userId: { businessId: business.id, userId: auth.id } },
      });
      myReview = review
        ? {
            ...review,
            pros: parseJsonArray(review.pros),
            cons: parseJsonArray(review.cons),
          }
        : null;
      // نظراتی که این کاربر «مفید» رأی داده
      const voted = await db.businessReview.findMany({
        where: { businessId: business.id, helpfulVoters: { contains: `"${auth.id}"` } },
        select: { id: true },
      });
      votedHelpful = voted.map((v) => v.id);
    }

    return ok({
      business: {
        ...business,
        services: business.services ? JSON.parse(business.services) : [],
        workingHours: business.workingHours ? JSON.parse(business.workingHours) : null,
        gallery: business.gallery ? JSON.parse(business.gallery) : [],
        reviews: business.reviews.map((r) => ({
          ...r,
          pros: parseJsonArray(r.pros),
          cons: parseJsonArray(r.cons),
        })),
      },
      reviewStats: {
        total: allReviews.length,
        distribution,
        criteria,
      },
      isFavorite,
      myReview,
      votedHelpful,
    });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}

interface ReviewBody {
  action: "review" | "favorite" | "review-helpful";
  rating?: number;
  comment?: string;
  quality?: number;
  priceFair?: number;
  behavior?: number;
  speed?: number;
  pros?: string[];
  cons?: string[];
  wouldRecommend?: boolean;
  reviewId?: string;
}

// ثبت یا ویرایش نظر (چندمعیاره) + علاقه‌مندی + رأی مفید
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);

    const gate = await guardModule("businesses");
    if (gate) return gate;

    const { id } = await params;
    const business = await db.business.findFirst({ where: { OR: [{ id }, { slug: id }] } });
    if (!business) return fail("کسب‌وکار یافت نشد", 404);

    const body = await parseJson<ReviewBody>(req);
    if (!body?.action) return fail("درخواست نامعتبر است");

    // نظرها فقط وقتی مدیر فعال کرده باشد
    if (body.action === "review" || body.action === "review-helpful") {
      const reviewGate = await guardModule("businesses", "enableReviews");
      if (reviewGate) return reviewGate;
    }

    // ─── علاقه‌مندی ───
    if (body.action === "favorite") {
      const existing = await db.favoriteBusiness.findUnique({
        where: { userId_businessId: { userId: auth.id, businessId: business.id } },
      });
      if (existing) {
        await db.favoriteBusiness.delete({ where: { id: existing.id } });
        return ok({ isFavorite: false, message: "از علاقه‌مندی‌ها حذف شد" });
      }
      await db.favoriteBusiness.create({ data: { userId: auth.id, businessId: business.id } });
      return ok({ isFavorite: true, message: "به علاقه‌مندی‌ها اضافه شد" });
    }

    // ─── رأی «این نظر مفید بود» (toggle) ───
    if (body.action === "review-helpful") {
      const reviewId = String(body.reviewId || "");
      const review = await db.businessReview.findUnique({ where: { id: reviewId } });
      if (!review || review.businessId !== business.id) return fail("نظر یافت نشد", 404);
      if (review.userId === auth.id) return fail("به نظر خودتان نمی‌توانید رأی بدهید");

      const voters = parseJsonArray(review.helpfulVoters);
      const idx = voters.indexOf(auth.id);
      if (idx >= 0) {
        voters.splice(idx, 1);
        await db.businessReview.update({
          where: { id: reviewId },
          data: { helpfulVoters: JSON.stringify(voters), helpfulCount: { decrement: 1 } },
        });
        return ok({ voted: false, helpfulCount: Math.max(0, review.helpfulCount - 1) });
      }
      voters.push(auth.id);
      await db.businessReview.update({
        where: { id: reviewId },
        data: { helpfulVoters: JSON.stringify(voters), helpfulCount: { increment: 1 } },
      });
      return ok({ voted: true, helpfulCount: review.helpfulCount + 1 });
    }

    // ─── ثبت/ویرایش نظر چندمعیاره ───
    const rating = Math.round(Number(body.rating));
    if (rating < 1 || rating > 5) return fail("امتیاز باید بین ۱ تا ۵ باشد");
    const comment = (body.comment || "").slice(0, 700);
    const quality = optRating(body.quality);
    const priceFair = optRating(body.priceFair);
    const behavior = optRating(body.behavior);
    const speed = optRating(body.speed);
    const pros = optTags(body.pros);
    const cons = optTags(body.cons);
    const wouldRecommend = body.wouldRecommend !== false;

    if (!comment.trim() && !pros && !cons) {
      return fail("متن نظر یا حداقل یک تگ مثبت/منفی لازم است");
    }

    const existing = await db.businessReview.findUnique({
      where: { businessId_userId: { businessId: business.id, userId: auth.id } },
    });

    await db.businessReview.upsert({
      where: { businessId_userId: { businessId: business.id, userId: auth.id } },
      update: {
        rating, comment, quality, priceFair, behavior, speed,
        pros: pros ? JSON.stringify(pros) : null,
        cons: cons ? JSON.stringify(cons) : null,
        wouldRecommend,
      },
      create: {
        businessId: business.id, userId: auth.id, rating, comment,
        quality, priceFair, behavior, speed,
        pros: pros ? JSON.stringify(pros) : null,
        cons: cons ? JSON.stringify(cons) : null,
        wouldRecommend,
      },
    });

    await recalcRating(business.id);

    await logActivity({
      userId: auth.id,
      action: "business.review",
      entity: "business",
      entityId: business.id,
      details: { rating, edited: Boolean(existing), criteria: { quality, priceFair, behavior, speed } },
    });

    return ok({ message: existing ? "نظر شما به‌روزرسانی شد" : "نظر شما ثبت شد" });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}

// حذف نظر خودِ کاربر
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);

    const gate = await guardModule("businesses");
    if (gate) return gate;

    const { id } = await params;
    const business = await db.business.findFirst({ where: { OR: [{ id }, { slug: id }] } });
    if (!business) return fail("کسب‌وکار یافت نشد", 404);

    const review = await db.businessReview.findUnique({
      where: { businessId_userId: { businessId: business.id, userId: auth.id } },
    });
    if (!review) return fail("نظری برای حذف ندارید", 404);

    await db.businessReview.delete({ where: { id: review.id } });
    await recalcRating(business.id);

    await logActivity({
      userId: auth.id,
      action: "business.review_delete",
      entity: "business",
      entityId: business.id,
    });

    return ok({ message: "نظر شما حذف شد" });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
