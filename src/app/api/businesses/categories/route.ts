// ═════ دسته‌بندی‌های اصناف — GET /api/businesses/categories ═════
import { db } from "@/lib/db";
import { ok, fail, guardModule } from "@/lib/core/api";

export async function GET() {
  try {
    const gate = await guardModule("businesses");
    if (gate) return gate;

    const categories = await db.businessCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { businesses: { where: { isActive: true } } } } },
    });

    return ok({
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        icon: c.icon,
        color: c.color,
        description: c.description,
        count: c._count.businesses,
      })),
    });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
