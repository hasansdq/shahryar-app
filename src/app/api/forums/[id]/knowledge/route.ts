// ═══ دانش ایجنت انجمن — GET / POST /api/forums/[id]/knowledge ═════
// GET: منابع دانش (اعضا: خواندن | رئیس: مدیریت) — POST: فقط رئیس
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import {
  MAX_KNOWLEDGE_CONTENT,
  MAX_KNOWLEDGE_TITLE,
  loadForumForUser,
  toKnowledgeDTO,
} from "@/lib/modules/forums/service";

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
    if (!isMember) return fail("دانش انجمن فقط برای اعضای فعال قابل مشاهده است", 403);

    const knowledge = await db.forumKnowledge.findMany({
      where: { forumId: id },
      orderBy: { updatedAt: "desc" },
      include: { createdBy: { select: { fullName: true } } },
    });

    return ok({
      knowledge: knowledge.map(toKnowledgeDTO),
      isChair: loaded.forum.chairId === auth.id,
    });
  } catch (err) {
    console.error("خطای لیست دانش:", err);
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
    if (loaded.forum.chairId !== auth.id) return fail("افزودن دانش فقط توسط رئیس انجمن ممکن است", 403);

    // سقف تعداد منابع — مشابه ماژول اجتماعی برای جلوگیری از پرامپت غول‌پیکر
    const count = await db.forumKnowledge.count({ where: { forumId: id } });
    if (count >= 20) return fail("حداکثر ۲۰ منبع دانش برای هر انجمن مجاز است", 400);

    const body = await parseJson<{ title?: string; content?: string }>(req);
    const title = (body?.title || "").trim();
    const content = (body?.content || "").trim();
    if (!title) return fail("عنوان منبع الزامی است");
    if (title.length > MAX_KNOWLEDGE_TITLE) return fail(`عنوان حداکثر ${MAX_KNOWLEDGE_TITLE} کاراکتر است`);
    if (!content) return fail("متن منبع خالی است");
    if (content.length > MAX_KNOWLEDGE_CONTENT) return fail(`متن منبع حداکثر ${MAX_KNOWLEDGE_CONTENT.toLocaleString("fa-IR")} کاراکتر است`);

    const entry = await db.forumKnowledge.create({
      data: { forumId: id, title, content, createdById: auth.id },
      include: { createdBy: { select: { fullName: true } } },
    });

    return ok({ entry: toKnowledgeDTO(entry) });
  } catch (err) {
    console.error("خطای افزودن دانش:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
