// ═════ آمار و تحلیل اهداف — GET /api/goals/stats ═════
import { NextRequest } from "next/server";
import { ok, fail, getUser, guardModule } from "@/lib/core/api";
import { buildGoalStats } from "@/lib/modules/goals/service";

export async function GET(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("goals", "enableAnalytics");
    if (gate) return gate;

    const stats = await buildGoalStats(auth.id);
    return ok({ stats });
  } catch (err) {
    console.error("خطای آمار اهداف:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
