// ═════ دایرکتوری اصناف — GET /api/businesses ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, guardModule } from "@/lib/core/api";

export async function GET(req: NextRequest) {
  try {
    const gate = await guardModule("businesses");
    if (gate) return gate;

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const categorySlug = searchParams.get("category") || "";
    const district = searchParams.get("district") || "";
    const sort = searchParams.get("sort") || "featured"; // featured | rating | new | popular
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(24, Math.max(6, parseInt(searchParams.get("limit") || "12")));
    const featured = searchParams.get("featured") === "1";

    // شرط‌های جستجو
    const where: Record<string, unknown> = { isActive: true };
    if (categorySlug) {
      const cat = await db.businessCategory.findUnique({ where: { slug: categorySlug } });
      if (cat) where.categoryId = cat.id;
    }
    if (district) where.district = district;
    if (featured) where.isFeatured = true;
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { description: { contains: q } },
        { keywords: { contains: q } },
        { address: { contains: q } },
        { ownerName: { contains: q } },
      ];
    }

    // مرتب‌سازی
    let orderBy: Record<string, string>[] = [{ isFeatured: "desc" }, { rating: "desc" }];
    if (sort === "rating") orderBy = [{ rating: "desc" }, { reviewCount: "desc" }];
    if (sort === "new") orderBy = [{ createdAt: "desc" }];
    if (sort === "popular") orderBy = [{ viewCount: "desc" }];

    const [businesses, total, reviewsTotal] = await Promise.all([
      db.business.findMany({
        where,
        include: { category: { select: { name: true, slug: true, icon: true, color: true } } },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.business.count({ where }),
      db.businessReview.count(),
    ]);

    // محله‌های موجود برای فیلتر
    const districtsRaw = await db.business.findMany({
      where: { isActive: true, district: { not: null } },
      select: { district: true },
      distinct: ["district"],
    });

    return ok({
      businesses: businesses.map((b) => ({
        ...b,
        services: b.services ? JSON.parse(b.services) : [],
        workingHours: b.workingHours ? JSON.parse(b.workingHours) : null,
        gallery: b.gallery ? JSON.parse(b.gallery) : [],
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: { reviews: reviewsTotal },
      districts: districtsRaw.map((d) => d.district).filter(Boolean).sort(),
    });
  } catch (err) {
    console.error("خطای لیست اصناف:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
