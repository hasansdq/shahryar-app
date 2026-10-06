// ═══ لیست انجمن‌های من — GET /api/forums ═════
// انجمن‌های عمومی (همه) + انجمن‌های خصوصیِ عضو — همراه وضعیت عضویت من
import { NextRequest } from "next/server";
import { ok, fail, getUser, guardModule } from "@/lib/core/api";
import { listForumsForUser } from "@/lib/modules/forums/service";

export async function GET(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("forums");
    if (gate) return gate;

    const forums = await listForumsForUser(auth.id);
    return ok({ forums });
  } catch (err) {
    console.error("خطای لیست انجمن‌ها:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
