// ═════ ویرایش/حذف منبع دانش — PATCH / DELETE /api/social/knowledge/[id] ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";

const MAX_TITLE = 80;
const MAX_CONTENT = 60000;

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("social");
    if (gate) return gate;

    const { id } = await ctx.params;
    const body = await parseJson<{ title?: string; content?: string }>(req);
    if (!body) return fail("درخواست نامعتبر است");

    const item = await db.knowledgeItem.findUnique({ where: { id } });
    if (!item || item.userId !== auth.id) return fail("منبع دانش یافت نشد", 404);

    const data: { title?: string; content?: string; charCount?: number } = {};
    if (body.title !== undefined) {
      const title = body.title.trim().slice(0, MAX_TITLE);
      if (!title) return fail("عنوان نمی‌تواند خالی باشد");
      data.title = title;
    }
    if (body.content !== undefined) {
      const content = body.content.trim();
      if (!content) return fail("محتوای دانش خالی است");
      if (content.length > MAX_CONTENT) {
        return fail(`محتوای هر منبع حداکثر ${MAX_CONTENT.toLocaleString("fa-IR")} کاراکتر می‌تواند باشد`);
      }
      data.content = content;
      data.charCount = content.length;
    }
    if (Object.keys(data).length === 0) return fail("چیزی برای به‌روزرسانی ارسال نشده است");

    const updated = await db.knowledgeItem.update({ where: { id }, data });

    await logActivity({
      userId: auth.id,
      action: "social.knowledge.update",
      entity: "knowledge-item",
      entityId: id,
    });

    return ok({ id: updated.id, updatedAt: updated.updatedAt.toISOString() });
  } catch (err) {
    console.error("خطای PATCH دانش:", err);
    return fail("خطای داخلی سرور", 500);
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("social");
    if (gate) return gate;

    const { id } = await ctx.params;
    const item = await db.knowledgeItem.findUnique({ where: { id } });
    if (!item || item.userId !== auth.id) return fail("منبع دانش یافت نشد", 404);

    await db.knowledgeItem.delete({ where: { id } });

    await logActivity({
      userId: auth.id,
      action: "social.knowledge.delete",
      entity: "knowledge-item",
      entityId: id,
      details: { title: item.title },
    });

    return ok({ deleted: true });
  } catch (err) {
    console.error("خطای DELETE دانش:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
