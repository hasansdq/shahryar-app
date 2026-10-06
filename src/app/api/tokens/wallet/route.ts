// ═════ خلاصه کیف پول توکن — GET /api/tokens/wallet ═════
// موجودی، آمار کل، قیمت‌گذاری، تحلیل مصرف ۳۰روزه و تراکنش‌های اخیر
import { NextRequest } from "next/server";
import { ok, fail, getUser } from "@/lib/core/api";
import { getWalletSummary } from "@/lib/modules/tokens/service";

export async function GET(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);

    const summary = await getWalletSummary(auth.id);
    return ok(summary);
  } catch (err) {
    console.error("[tokens/wallet] خطا:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
