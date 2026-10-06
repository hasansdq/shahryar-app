// ═════ مدیریت پایگاه دانش شهری (ادمین) — GET/POST /api/admin/city-data ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getAdmin, assertWritableAdmin } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { verifiedMediaUrl } from "@/lib/media/verify";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);


    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || "";

    const items = await db.cityData.findMany({
      where: category ? { category } : {},
      orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
      take: 100,
    });

    const stats = await db.cityData.groupBy({
      by: ["category"],
      _count: true,
    });

    return ok({ items, stats });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);
    const writeGate = assertWritableAdmin(admin);
    if (writeGate) return writeGate;

    const body = await parseJson<{
      category: string; title: string; content: string; summary?: string;
      source?: string; imageUrl?: string; isPinned?: boolean; isPublished?: boolean;
    }>(req);

    if (!body?.title?.trim() || !body?.content?.trim()) {
      return fail("عنوان و محتوا الزامی است");
    }

    const category = ["news", "event", "announcement", "service", "tip"].includes(body.category || "")
      ? body.category! : "news";

    // تصویر — فقط فایل موجود در مخزن کانونی؛ URL کانونی ذخیره می‌شود
    const imageUrl = await verifiedMediaUrl(body.imageUrl);

    const item = await db.cityData.create({
      data: {
        category,
        title: body.title.trim().slice(0, 200),
        content: body.content.slice(0, 5000),
        summary: body.summary?.slice(0, 300),
        source: body.source?.slice(0, 100),
        imageUrl,
        isPinned: body.isPinned ?? false,
        isPublished: body.isPublished ?? true,
      },
    });

    await logActivity({
      adminId: admin.id, actorType: "admin",
      action: "admin.citydata_create", entity: "cityData", entityId: item.id,
      details: { title: item.title },
    });

    return ok({ item });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
