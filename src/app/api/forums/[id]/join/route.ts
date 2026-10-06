// ═══ درخواست عضویت — POST /api/forums/[id]/join ═════
// فقط انجمن عمومی — تایید نهایی توسط رئیس انجمن انجام می‌شود
import { NextRequest } from "next/server";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { rateLimit, getClientIp } from "@/lib/core/rate-limit";
import { MAX_REQUEST_NOTE, requestMembership } from "@/lib/modules/forums/service";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("forums");
    if (gate) return gate;

    const rl = rateLimit(`forum-join:${auth.id}:${getClientIp(req)}`, 10, 3600_000);
    if (!rl.allowed) return fail("درخواست‌های زیاد؛ کمی بعد تلاش کنید", 429);

    const { id } = await ctx.params;
    const body = await parseJson<{ note?: string }>(req);
    const note = (body?.note || "").trim().slice(0, MAX_REQUEST_NOTE);

    const result = await requestMembership(id, auth.id, note);
    if (!result.ok) return fail(result.error, result.status);

    await logActivity({
      userId: auth.id,
      action: "forum.join_requested",
      entity: "forum",
      entityId: id,
      details: { hasNote: !!note },
    });

    return ok({ message: "درخواست عضویت ثبت شد و پس از تایید رئیس انجمن عضو می‌شوید" });
  } catch (err) {
    console.error("خطای درخواست عضویت:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
