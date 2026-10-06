// ═════ ویرایش پروفایل — PATCH /api/auth/profile ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, userAgentFrom } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { convertPersianDigits } from "@/lib/core/security";
import { getClientIp } from "@/lib/core/rate-limit";
import { verifiedMediaUrl } from "@/lib/media/verify";

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);

    const body = await parseJson<{
      fullName?: string; email?: string; city?: string; gender?: string;
      birthYear?: number | string; interests?: string[]; bio?: string; avatarUrl?: string;
    }>(req);
    if (!body) return fail("درخواست نامعتبر است");

    const data: Record<string, unknown> = {};

    // تصویر پروفایل — فقط فایل موجود در مخزن کانونی؛ همیشه URL کانونی ذخیره می‌شود
    if (body.avatarUrl !== undefined) {
      if (body.avatarUrl) {
        const canonicalUrl = await verifiedMediaUrl(body.avatarUrl);
        if (!canonicalUrl) {
          return fail("فایل تصویر روی سرور یافت نشد؛ لطفاً دوباره بارگذاری کنید", 422);
        }
        data.avatarUrl = canonicalUrl;
      } else {
        data.avatarUrl = null;
      }
    }

    if (body.fullName !== undefined) {
      const name = body.fullName.trim();
      if (name.length < 3) return fail("نام حداقل ۳ حرف باشد");
      if (name.length > 60) return fail("نام حداکثر ۶۰ حرف باشد");
      data.fullName = name;
    }
    if (body.email !== undefined) {
      if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
        return fail("ایمیل معتبر نیست");
      }
      data.email = body.email || null;
    }
    if (body.city !== undefined) data.city = body.city || "رفسنجان";
    if (body.gender !== undefined) {
      data.gender = ["male", "female"].includes(body.gender) ? body.gender : null;
    }
    if (body.birthYear !== undefined) {
      const year = parseInt(convertPersianDigits(String(body.birthYear)));
      if (isNaN(year) || year < 1300 || year > 1405) return fail("سال تولد نامعتبر است");
      data.birthYear = year;
    }
    if (body.interests !== undefined) {
      const list = Array.isArray(body.interests)
        ? body.interests.filter((i) => typeof i === "string" && i.trim()).slice(0, 15)
        : [];
      data.interests = JSON.stringify(list);
    }
    if (body.bio !== undefined) {
      data.bio = (body.bio || "").slice(0, 500);
    }

    const updated = await db.user.update({
      where: { id: auth.id },
      data,
      select: { id: true, fullName: true, email: true, city: true, gender: true, birthYear: true, interests: true, bio: true },
    });

    await logActivity({
      userId: auth.id,
      action: "user.profile_update",
      details: { fields: Object.keys(data) },
      ip: getClientIp(req),
      userAgent: userAgentFrom(req),
    });

    return ok({ user: { ...updated, interests: updated.interests ? JSON.parse(updated.interests) : [] } });
  } catch (err) {
    console.error("خطای ویرایش پروفایل:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
