// ═══ ویرایش/حذف دانش — PATCH / DELETE /api/forums/[id]/knowledge/[entryId] ═════
// فقط رئیس انجمن
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { MAX_KNOWLEDGE_CONTENT, MAX_KNOWLEDGE_TITLE, loadForumForUser, toKnowledgeDTO } from "@/lib/modules/forums/service";

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

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string; entryId: string }> }) {
  try {
    const { id, entryId } = await ctx.params;
    const g = await guardChair(req, id);
    if (g.error) return g.error;

    const body = await parseJson<{ title?: string; content?: string }>(req);
    const existing = await db.forumKnowledge.findUnique({ where: { id: entryId }, select: { forumId: true } });
    if (!existing || existing.forumId !== id) return fail("منبع یافت نشد", 404);

    const data: Record<string, unknown> = {};
    if (body?.title !== undefined) {
      const title = body.title.trim();
      if (!title) return fail("عنوان نمی‌تواند خالی باشد");
      if (title.length > MAX_KNOWLEDGE_TITLE) return fail(`عنوان حداکثر ${MAX_KNOWLEDGE_TITLE} کاراکتر است`);
      data.title = title;
    }
    if (body?.content !== undefined) {
      const content = body.content.trim();
      if (!content) return fail("متن نمی‌تواند خالی باشد");
      if (content.length > MAX_KNOWLEDGE_CONTENT) return fail(`متن حداکثر ${MAX_KNOWLEDGE_CONTENT.toLocaleString("fa-IR")} کاراکتر است`);
      data.content = content;
    }

    const entry = await db.forumKnowledge.update({
      where: { id: entryId },
      data,
      include: { createdBy: { select: { fullName: true } } },
    });
    return ok({ entry: toKnowledgeDTO(entry) });
  } catch (err) {
    console.error("خطای ویرایش دانش:", err);
    return fail("خطای داخلی سرور", 500);
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string; entryId: string }> }) {
  try {
    const { id, entryId } = await ctx.params;
    const g = await guardChair(req, id);
    if (g.error) return g.error;

    const existing = await db.forumKnowledge.findUnique({ where: { id: entryId }, select: { forumId: true } });
    if (!existing || existing.forumId !== id) return fail("منبع یافت نشد", 404);

    await db.forumKnowledge.delete({ where: { id: entryId } });
    return ok({ message: "منبع دانش حذف شد" });
  } catch (err) {
    console.error("خطای حذف دانش:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
