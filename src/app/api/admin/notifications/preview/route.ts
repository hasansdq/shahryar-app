// ═══ پیش‌نمایش مخاطبان اعلان — POST /api/admin/notifications/preview ═══
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getAdmin, assertWritableAdmin } from "@/lib/core/api";
import { audienceWhere, filterLabels, hasAnyFilter, type AudienceFilters } from "@/lib/admin/notification-filters";

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);
    const writeGate = assertWritableAdmin(admin);
    if (writeGate) return writeGate;

    const body = await parseJson<{ filters?: AudienceFilters }>(req);
    const filters = body?.filters || {};

    const where = audienceWhere(filters);
    const [count, sample] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        orderBy: { lastLoginAt: "desc" },
        take: 5,
        select: { fullName: true, isVerified: true },
      }),
    ]);

    return ok({
      count,
      labels: filterLabels(filters),
      isFiltered: hasAnyFilter(filters),
      sample: sample.map((u) => u.fullName || "کاربر شهریار"),
    });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
