// ═════ کاوشگر مصرف دقیق توکن — GET /api/tokens/usage ═════
// تحلیل بازه (نمودارها) + رکوردهای ریز مصرف با متادیتای کامل
// (مثل صورتحساب API): فیلتر بازه/ویژگی/بخش + صفحه‌بندی
import { NextRequest } from "next/server";
import { ok, fail, getUser } from "@/lib/core/api";
import { getUserUsageAnalytics, getUserUsageRecords } from "@/lib/modules/tokens/usage";

export async function GET(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);

    const url = new URL(req.url);
    const rangeDays = Math.min(90, Math.max(7, Number(url.searchParams.get("range")) || 30));
    const feature = url.searchParams.get("feature") || undefined;
    const section = url.searchParams.get("section") || undefined;
    const page = Number(url.searchParams.get("page")) || 1;

    const [records, analytics] = await Promise.all([
      getUserUsageRecords({
        userId: auth.id,
        rangeDays,
        feature: feature || undefined,
        section: section || undefined,
        page,
        pageSize: 15,
      }),
      getUserUsageAnalytics(auth.id, rangeDays),
    ]);
    return ok({ ...records, analytics });
  } catch (err) {
    console.error("[tokens/usage] خطا:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
