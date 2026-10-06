// ═══ اعضای انجمن — GET /api/forums/[id]/members ═════
// فقط اعضای فعال انجمن می‌توانند فهرست کامل اعضا را ببینند
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, getUser, guardModule } from "@/lib/core/api";
import { loadForumForUser, toMemberDTO } from "@/lib/modules/forums/service";

const USER_PUBLIC = {
  id: true,
  fullName: true,
  avatarUrl: true,
  avatarColor: true,
  phone: true,
  socialProfile: { select: { headline: true } },
} as const;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("forums");
    if (gate) return gate;

    const { id } = await ctx.params;
    const loaded = await loadForumForUser(id, auth.id);
    if (!loaded) return fail("انجمن یافت نشد", 404);

    const isMember = !!loaded.membership && loaded.membership.status === "ACTIVE";
    if (!isMember) return fail("فهرست اعضا فقط برای اعضای فعال انجمن قابل مشاهده است", 403);

    const isChair = loaded.forum.chairId === auth.id;
    const members = await db.forumMember.findMany({
      where: { forumId: id, status: "ACTIVE" },
      // رئیس اول (CHAIR واژه‌ای جلوتر از MEMBER — asc)
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
      include: { user: { select: USER_PUBLIC } },
    });

    // شمارش پیام‌های تالار برای هر عضو — گروهی برای کارایی
    const counts = await db.forumMessage.groupBy({
      by: ["senderId"],
      where: { forumId: id, thread: "FORUM", senderId: { not: null } },
      _count: { _all: true },
    });
    const countMap = new Map(counts.map((c) => [c.senderId, c._count._all]));

    // شماره موبایل و یادداشت درخواست عضویت فقط برای رئیس انجمن ارسال
    // می‌شود — برای اعضای عادی هر دو فیلد در پاسخ API تهی است (یادداشت
    // متن خصوصی خطاب به رئیس است و قبلاً به همه اعضا می‌رسید)
    return ok({
      members: members.map((m) => {
        const dto = toMemberDTO(m as unknown as Parameters<typeof toMemberDTO>[0], countMap.get(m.userId) || 0);
        return isChair ? dto : { ...dto, phone: null, requestNote: null };
      }),
      isChair,
    });
  } catch (err) {
    console.error("خطای لیست اعضا:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
