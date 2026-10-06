// ═══ فیلتر مخاطبان اعلان — منطق مشترک بین پیش‌نمایش و ارسال ═══
import { db } from "@/lib/db";

export interface AudienceFilters {
  gender?: string; // male | female
  city?: string;
  interest?: string; // برچسب علاقه
  activity?: string; // active (ورود ۷روز) | new (عضویت ۷روز) | dormant (۱۴روز غایب) | power (۱۰+ ورود)
  hasAgent?: boolean; // ایجنت فعال دارد
  isVerified?: boolean; // تیک آبی دارد
}

/** ساخت شرط Prisma از روی فیلترها */
export function audienceWhere(f: AudienceFilters) {
  const where: Record<string, unknown> = { status: "ACTIVE" };
  if (f.gender) where.gender = f.gender;
  if (f.city) where.city = f.city;
  if (f.isVerified) where.isVerified = true;

  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000);

  if (f.activity === "active") where.lastLoginAt = { gte: weekAgo };
  else if (f.activity === "new") where.createdAt = { gte: weekAgo };
  else if (f.activity === "power") where.loginCount = { gte: 10 };
  else if (f.activity === "dormant") where.lastLoginAt = { lt: twoWeeksAgo };

  if (f.interest) {
    where.interests = { contains: `"${f.interest}"` };
  }

  if (f.hasAgent) {
    where.socialProfile = { agentEnabled: true };
  }

  return where;
}

/** اعتبارسنجی امن JSON فیلتر از دیتابیس */
export function parseFilters(raw: string | null | undefined): AudienceFilters {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as AudienceFilters;
    const allowed: Array<keyof AudienceFilters> = ["gender", "city", "interest", "activity", "hasAgent", "isVerified"];
    const clean: AudienceFilters = {};
    for (const k of allowed) {
      if (parsed[k] !== undefined && parsed[k] !== "" && parsed[k] !== null) {
        clean[k] = parsed[k] as never;
      }
    }
    return clean;
  } catch {
    return {};
  }
}

/** آیا فیلتری تنظیم شده؟ */
export function hasAnyFilter(f: AudienceFilters): boolean {
  return Boolean(f.gender || f.city || f.interest || f.activity || f.hasAgent || f.isVerified);
}

/** برچسب فارسی شرط برای نمایش در پنل */
export function filterLabels(f: AudienceFilters): string[] {
  const labels: string[] = [];
  if (f.gender === "male") labels.push("آقایان");
  if (f.gender === "female") labels.push("خانم‌ها");
  if (f.city) labels.push(`شهر ${f.city}`);
  if (f.interest) labels.push(`علاقه: ${f.interest}`);
  if (f.activity === "active") labels.push("کاربران فعال (۷ روز)");
  if (f.activity === "new") labels.push("اعضای جدید (۷ روز)");
  if (f.activity === "dormant") labels.push("کاربران غایب (۱۴+ روز)");
  if (f.activity === "power") labels.push("کاربران قدرتی");
  if (f.hasAgent) labels.push("دارای ایجنت فعال");
  if (f.isVerified) labels.push("تیک‌آبی‌ها");
  return labels;
}

/** بررسی تطبیق یک کاربر با فیلتر (برای تحویل تنبل سمت کاربر) */
export async function userMatchesFilters(userId: string, f: AudienceFilters): Promise<boolean> {
  if (!hasAnyFilter(f)) return true;
  const count = await db.user.count({ where: { id: userId, ...audienceWhere(f) } });
  return count > 0;
}
