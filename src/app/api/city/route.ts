// ═════ داده‌های شهری عمومی — GET /api/city ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/core/api";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    const items = await db.cityData.findMany({
      where: {
        isPublished: true,
        ...(category ? { category } : {}),
      },
      orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
      take: 30,
      select: {
        id: true, category: true, title: true, summary: true,
        content: true, source: true, isPinned: true, publishedAt: true,
      },
    });

    return ok({ items });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
