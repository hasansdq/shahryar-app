// ═════ مدیریت اصناف (ادمین) — GET/POST /api/admin/businesses ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getAdmin, assertWritableAdmin } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { verifiedMediaUrl, verifiedGalleryJson } from "@/lib/media/verify";

/** slug سازگار با فارسی */
function slugify(text: string): string {
  return text.trim().replace(/[\s\u200c]+/g, "-").replace(/[^\p{L}\p{N}-]/gu, "").toLowerCase() || `biz-${Date.now()}`;
}

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);


    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const category = searchParams.get("category") || "";
    const status = searchParams.get("status") || ""; // active | inactive
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(5, parseInt(searchParams.get("limit") || "20")));

    const where: Record<string, unknown> = {};
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { ownerName: { contains: q } },
        { phone: { contains: q } },
        { address: { contains: q } },
      ];
    }
    if (category) {
      const cat = await db.businessCategory.findUnique({ where: { slug: category } });
      if (cat) where.categoryId = cat.id;
    }
    if (status === "active") where.isActive = true;
    if (status === "inactive") where.isActive = false;

    const [businesses, total] = await Promise.all([
      db.business.findMany({
        where,
        include: { category: { select: { name: true, slug: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.business.count({ where }),
    ]);

    return ok({
      businesses: businesses.map((b) => ({
        ...b,
        services: b.services ? JSON.parse(b.services) : [],
        workingHours: b.workingHours ? JSON.parse(b.workingHours) : null,
        gallery: b.gallery ? JSON.parse(b.gallery) : [],
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("خطای لیست اصناف ادمین:", err);
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
      name: string; description?: string; categoryId: string; ownerName?: string;
      phone?: string; phone2?: string; email?: string; address?: string; district?: string;
      latitude?: number; longitude?: number; website?: string; instagram?: string;
      telegram?: string; whatsapp?: string; services?: string[]; keywords?: string;
      imageUrl?: string; gallery?: Array<{ url: string; name?: string }>; workingHours?: string; isVerified?: boolean; isFeatured?: boolean; isActive?: boolean;
    }>(req);

    if (!body?.name?.trim() || !body?.categoryId) {
      return fail("نام و دسته‌بندی کسب‌وکار الزامی است");
    }

    const category = await db.businessCategory.findUnique({ where: { id: body.categoryId } });
    if (!category) return fail("دسته‌بندی یافت نشد", 404);

    // یکتایی نام
    const dup = await db.business.findFirst({ where: { name: body.name.trim() } });
    if (dup) return fail("کسب‌وکاری با این نام قبلاً ثبت شده است");

    // تصویر و گالری — فقط فایل‌های موجود در مخزن کانونی؛ URL کانونی ذخیره می‌شود
    const imageUrl = await verifiedMediaUrl(body.imageUrl);
    const gallery = await verifiedGalleryJson(body.gallery);

    const business = await db.business.create({
      data: {
        name: body.name.trim(),
        slug: `${slugify(body.name)}-${Date.now().toString(36).slice(-4)}`,
        description: body.description?.slice(0, 2000),
        categoryId: body.categoryId,
        ownerName: body.ownerName?.slice(0, 100),
        phone: body.phone, phone2: body.phone2, email: body.email,
        address: body.address, district: body.district,
        latitude: body.latitude, longitude: body.longitude,
        website: body.website, instagram: body.instagram,
        telegram: body.telegram, whatsapp: body.whatsapp,
        services: body.services?.length ? JSON.stringify(body.services.filter(Boolean).slice(0, 20)) : null,
        keywords: body.keywords || `${body.name} ${category.name}`.trim(),
        imageUrl,
        gallery,
        workingHours: body.workingHours ? JSON.stringify({ display: body.workingHours }) : null,
        isVerified: body.isVerified ?? false,
        isFeatured: body.isFeatured ?? false,
        isActive: body.isActive ?? true,
      },
    });

    await logActivity({
      adminId: admin.id, actorType: "admin",
      action: "admin.business_create", entity: "business", entityId: business.id,
      details: { name: business.name },
    });

    return ok({ business });
  } catch (err) {
    console.error("خطای ثبت صنف:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
