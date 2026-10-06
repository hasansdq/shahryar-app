// ═══ جزئیات انجمن — GET /api/forums/[id] ═════
// انجمن خصوصیِ غیرقابل‌مشاهده 404 برمی‌گرداند (بدون افشای وجود انجمن)
import { NextRequest } from "next/server";
import { ok, fail, getUser, guardModule } from "@/lib/core/api";
import { getForumDetail } from "@/lib/modules/forums/service";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("forums");
    if (gate) return gate;

    const { id } = await ctx.params;
    const detail = await getForumDetail(id, auth.id);
    if (!detail) return fail("انجمن یافت نشد", 404);

    return ok({ forum: detail });
  } catch (err) {
    console.error("خطای جزئیات انجمن:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
