// ═══ رویدادهای انجمن — GET / POST /api/forums/[id]/events ═════
// GET: تقویم رویدادها (عمومی: دیدن برای همه | خصوصی: فقط اعضا)
// POST: ایجاد رویداد — فقط رئیس انجمن
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { MAX_DESCRIPTION, MAX_EVENT_TITLE, listEvents, loadForumForUser, toEventDTO } from "@/lib/modules/forums/service";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("forums");
    if (gate) return gate;

    const { id } = await ctx.params;
    const loaded = await loadForumForUser(id, auth.id);
    if (!loaded) return fail("انجمن یافت نشد", 404);

    const events = await listEvents(id);
    return ok(events);
  } catch (err) {
    console.error("خطای لیست رویدادها:", err);
    return fail("خطای داخلی سرور", 500);
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("forums");
    if (gate) return gate;

    const { id } = await ctx.params;
    const loaded = await loadForumForUser(id, auth.id);
    if (!loaded) return fail("انجمن یافت نشد", 404);
    if (loaded.forum.chairId !== auth.id) return fail("ایجاد رویداد فقط توسط رئیس انجمن ممکن است", 403);

    // قابلیت تقویم رویدادها باید در CMS فعال باشد
    const eventsGate = await guardModule("forums", "enableEvents");
    if (eventsGate) return eventsGate;

    const body = await parseJson<{ title?: string; description?: string; location?: string; startsAt?: string; endsAt?: string }>(req);
    const title = (body?.title || "").trim();
    const startsAtRaw = body?.startsAt || "";
    if (!title) return fail("عنوان رویداد الزامی است");
    if (title.length > MAX_EVENT_TITLE) return fail(`عنوان حداکثر ${MAX_EVENT_TITLE} کاراکتر است`);
    const startsAt = new Date(startsAtRaw);
    if (isNaN(startsAt.getTime())) return fail("زمان شروع رویداد معتبر نیست");
    const endsAt = body?.endsAt ? new Date(body.endsAt) : null;
    if (endsAt && isNaN(endsAt.getTime())) return fail("زمان پایان رویداد معتبر نیست");
    if (endsAt && endsAt < startsAt) return fail("زمان پایان نمی‌تواند قبل از شروع باشد");

    const event = await db.forumEvent.create({
      data: {
        forumId: id,
        title,
        description: (body?.description || "").trim().slice(0, MAX_DESCRIPTION) || null,
        location: (body?.location || "").trim().slice(0, 160) || null,
        startsAt,
        endsAt,
        createdById: auth.id,
      },
      include: { createdBy: { select: { fullName: true } } },
    });

    return ok({ event: toEventDTO(event) });
  } catch (err) {
    console.error("خطای ایجاد رویداد:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
