// ═══ ویرایش/حذف رویداد — PATCH / DELETE /api/forums/[id]/events/[eventId] ═════
// فقط رئیس انجمن
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { MAX_DESCRIPTION, MAX_EVENT_TITLE, loadForumForUser, toEventDTO } from "@/lib/modules/forums/service";

async function guardChair(req: NextRequest, forumId: string) {
  const auth = await getUser(req);
  if (!auth) return { error: fail("احراز هویت نشده‌اید", 401) };
  const gate = await guardModule("forums");
  if (gate) return { error: gate };
  const loaded = await loadForumForUser(forumId, auth.id);
  if (!loaded) return { error: fail("انجمن یافت نشد", 404) };
  if (loaded.forum.chairId !== auth.id) return { error: fail("این عملیات فقط توسط رئیس انجمن ممکن است", 403) };
  return { auth };
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string; eventId: string }> }) {
  try {
    const { id, eventId } = await ctx.params;
    const g = await guardChair(req, id);
    if (g.error) return g.error;

    // قابلیت تقویم رویدادها باید در CMS فعال باشد
    const eventsGate = await guardModule("forums", "enableEvents");
    if (eventsGate) return eventsGate;

    const body = await parseJson<{ title?: string; description?: string; location?: string; startsAt?: string; endsAt?: string | null }>(req);
    const existing = await db.forumEvent.findUnique({ where: { id: eventId }, select: { forumId: true, startsAt: true, endsAt: true } });
    if (!existing || existing.forumId !== id) return fail("رویداد یافت نشد", 404);

    const data: Record<string, unknown> = {};
    if (body?.title !== undefined) {
      const title = body.title.trim();
      if (!title) return fail("عنوان رویداد نمی‌تواند خالی باشد");
      if (title.length > MAX_EVENT_TITLE) return fail(`عنوان حداکثر ${MAX_EVENT_TITLE} کاراکتر است`);
      data.title = title;
    }
    if (body?.description !== undefined) data.description = body.description.trim().slice(0, MAX_DESCRIPTION) || null;
    if (body?.location !== undefined) data.location = body.location.trim().slice(0, 160) || null;
    if (body?.startsAt !== undefined) {
      const d = new Date(body.startsAt);
      if (isNaN(d.getTime())) return fail("زمان شروع معتبر نیست");
      data.startsAt = d;
    }
    if (body?.endsAt !== undefined) {
      if (body.endsAt === null || body.endsAt === "") data.endsAt = null;
      else {
        const d = new Date(body.endsAt);
        if (isNaN(d.getTime())) return fail("زمان پایان معتبر نیست");
        data.endsAt = d;
      }
    }

    // اعتبارسنجی متقابل: نتیجه نهایی باید شروع ≤ پایان باشد —
    // حتی وقتی فقط یکی از دو فیلد در PATCH آمده است
    const finalStartsAt = (data.startsAt as Date | undefined) ?? existing.startsAt;
    const finalEndsAt = (data.endsAt as Date | undefined) ?? existing.endsAt;
    if (finalEndsAt && finalStartsAt && finalEndsAt < finalStartsAt) {
      return fail("زمان پایان نمی‌تواند قبل از شروع باشد");
    }

    const event = await db.forumEvent.update({
      where: { id: eventId },
      data,
      include: { createdBy: { select: { fullName: true } } },
    });
    return ok({ event: toEventDTO(event) });
  } catch (err) {
    console.error("خطای ویرایش رویداد:", err);
    return fail("خطای داخلی سرور", 500);
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string; eventId: string }> }) {
  try {
    const { id, eventId } = await ctx.params;
    const g = await guardChair(req, id);
    if (g.error) return g.error;

    // قابلیت تقویم رویدادها باید در CMS فعال باشد
    const eventsGate = await guardModule("forums", "enableEvents");
    if (eventsGate) return eventsGate;

    const existing = await db.forumEvent.findUnique({ where: { id: eventId }, select: { forumId: true } });
    if (!existing || existing.forumId !== id) return fail("رویداد یافت نشد", 404);

    await db.forumEvent.delete({ where: { id: eventId } });
    return ok({ message: "رویداد حذف شد" });
  } catch (err) {
    console.error("خطای حذف رویداد:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
