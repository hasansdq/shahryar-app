// ═════ دریافت پاداش روزانه — POST /api/tokens/daily-bonus ═════
// هر کاربر یک‌بار در شبانه‌روز؛ idempotent
import { NextRequest } from "next/server";
import { ok, fail, getUser } from "@/lib/core/api";
import { claimDailyBonus, isDailyBonusAvailable } from "@/lib/modules/tokens/service";

export async function POST(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);

    const available = await isDailyBonusAvailable(auth.id);
    if (!available) {
      return fail("پاداش روزانه‌ی امروز را قبلاً دریافت کرده‌اید — فردا دوباره سر بزنید", 400);
    }

    const res = await claimDailyBonus(auth.id);
    return ok(res);
  } catch (err) {
    console.error("[tokens/daily-bonus] خطا:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
