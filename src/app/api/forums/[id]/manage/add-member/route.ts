// ═══ افزودن مستقیم عضو — POST /api/forums/[id]/manage/add-member ═════
// رئیس انجمن با نام یا شماره موبایل کاربر را مستقیم عضو می‌کند (بدون درخواست)
import { NextRequest } from "next/server";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { rateLimit } from "@/lib/core/rate-limit";
import { addMemberDirect, loadForumForUser } from "@/lib/modules/forums/service";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("forums");
    if (gate) return gate;

    const rl = rateLimit(`forum-addmember:${auth.id}`, 30, 3600_000);
    if (!rl.allowed) return fail("افزودن‌های زیاد؛ کمی صبر کنید", 429);

    const { id } = await ctx.params;
    const loaded = await loadForumForUser(id, auth.id);
    if (!loaded) return fail("انجمن یافت نشد", 404);
    if (loaded.forum.chairId !== auth.id) return fail("افزودن عضو فقط توسط رئیس انجمن ممکن است", 403);

    const body = await parseJson<{ query?: string }>(req);
    const query = (body?.query || "").trim();
    if (!query) return fail("نام یا شماره موبایل کاربر را وارد کنید");

    const result = await addMemberDirect(id, query);
    if (!result.ok) return fail(result.error, result.status);

    return ok({ message: `«${result.name}» عضو انجمن شد` });
  } catch (err) {
    console.error("خطای افزودن عضو:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
