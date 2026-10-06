// ═════ GET /api/finance/summary — عکس‌العمل کامل مالی برای داشبورد ═════
import { NextRequest } from "next/server";
import { ok, fail, getUser, guardModule } from "@/lib/core/api";
import { buildFinanceSnapshot } from "@/lib/modules/finance/service";

export async function GET(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("finance");
    if (gate) return gate;

    const snapshot = await buildFinanceSnapshot(auth.id);
    return ok({ snapshot });
  } catch (err) {
    console.error("خطای خلاصه مالی:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
