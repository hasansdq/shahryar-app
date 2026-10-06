// ═════ دسته‌بندی‌های فعال اهداف — GET /api/goal-categories ═════
// برای انتخابگر دسته در فرم هدف — مدیریت‌شده از پنل CMS
import { NextRequest } from "next/server";
import { ok, fail, getUser } from "@/lib/core/api";
import { listActiveGoalCategories } from "@/lib/modules/cms/service";

export async function GET(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);

    const categories = await listActiveGoalCategories();
    return ok({ categories });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
