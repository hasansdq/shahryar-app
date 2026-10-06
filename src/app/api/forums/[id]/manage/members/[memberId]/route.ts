// ═══ مدیریت عضو توسط رئیس — PATCH /api/forums/[id]/manage/members/[memberId] ═════
// اکشن‌ها: approve | reject | ban | unban | remove — فقط رئیس انجمن
import { NextRequest } from "next/server";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { loadForumForUser, reviewMember } from "@/lib/modules/forums/service";

const ACTIONS = ["approve", "reject", "ban", "unban", "remove"] as const;
type Action = (typeof ACTIONS)[number];

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string; memberId: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("forums");
    if (gate) return gate;

    const { id, memberId } = await ctx.params;
    const loaded = await loadForumForUser(id, auth.id);
    if (!loaded) return fail("انجمن یافت نشد", 404);
    if (loaded.forum.chairId !== auth.id) return fail("مدیریت اعضا فقط توسط رئیس انجمن ممکن است", 403);

    const body = await parseJson<{ action?: string }>(req);
    const action = body?.action as Action | undefined;
    if (!action || !ACTIONS.includes(action)) {
      return fail("اکشن نامعتبر است (approve/reject/ban/unban/remove)");
    }

    const result = await reviewMember(id, memberId, action);
    if (!result.ok) return fail(result.error, result.status);

    await logActivity({
      userId: auth.id,
      action: `forum.member_${action}`,
      entity: "forum_member",
      entityId: memberId,
      details: { forumId: id },
    }).catch(() => {});

    const labels: Record<Action, string> = {
      approve: "عضویت تایید شد",
      reject: "درخواست رد شد",
      ban: "عضو مسدود شد",
      unban: "مسدودیت برداشته شد",
      remove: "عضو حذف شد",
    };
    return ok({ message: labels[action] });
  } catch (err) {
    console.error("خطای مدیریت عضو:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
