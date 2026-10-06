// ═══ مدیریت تک انجمن (CMS) — GET / PATCH / DELETE /api/admin/forums/[id] ═════
// GET: جزئیات + آخرین فعالیت‌ها | PATCH: عنوان/نوع/وضعیت/رئیس/ایجنت | DELETE: حذف کامل
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getAdmin, assertWritableAdmin } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { MAX_DESCRIPTION, MAX_FORUM_TITLE } from "@/lib/modules/forums/service";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);


    const { id } = await ctx.params;
    const forum = await db.forum.findUnique({
      where: { id },
      include: {
        chair: { select: { id: true, fullName: true, phone: true, avatarUrl: true, avatarColor: true } },
        _count: { select: { members: true, messages: true, events: true, articles: true, knowledge: true } },
      },
    });
    if (!forum) return fail("انجمن یافت نشد", 404);

    const [activeMembers, pendingMembers, recentMessages] = await Promise.all([
      db.forumMember.count({ where: { forumId: id, status: "ACTIVE" } }),
      db.forumMember.count({ where: { forumId: id, status: "PENDING" } }),
      db.forumMessage.findMany({
        where: { forumId: id },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { sender: { select: { fullName: true } } },
      }),
    ]);

    return ok({
      forum: {
        id: forum.id,
        slug: forum.slug,
        title: forum.title,
        description: forum.description,
        coverImage: forum.coverImage,
        type: forum.type,
        status: forum.status,
        agentEnabled: forum.agentEnabled,
        agentName: forum.agentName,
        agentGreeting: forum.agentGreeting,
        agentInstructions: forum.agentInstructions,
        chair: {
          id: forum.chair.id,
          name: forum.chair.fullName || "کاربر شهریار",
          phone: forum.chair.phone,
          avatarUrl: forum.chair.avatarUrl,
          avatarColor: forum.chair.avatarColor,
        },
        stats: {
          members: activeMembers,
          pending: pendingMembers,
          messages: forum._count.messages,
          events: forum._count.events,
          articles: forum._count.articles,
          knowledge: forum._count.knowledge,
        },
        createdAt: forum.createdAt.toISOString(),
      },
      recentMessages: recentMessages.map((m) => ({
        id: m.id,
        thread: m.thread,
        isFromAgent: m.isFromAgent,
        senderName: m.isFromAgent ? "ایجنت انجمن" : m.sender?.fullName || "کاربر شهریار",
        content: m.content.slice(0, 160),
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("خطای جزئیات انجمن (ادمین):", err);
    return fail("خطای داخلی سرور", 500);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);
    const writeGate = assertWritableAdmin(admin);
    if (writeGate) return writeGate;

    const { id } = await ctx.params;
    const forum = await db.forum.findUnique({ where: { id }, select: { id: true, chairId: true, title: true } });
    if (!forum) return fail("انجمن یافت نشد", 404);

    const body = await parseJson<{
      title?: string;
      description?: string;
      type?: string;
      status?: string;
      chairId?: string;
      coverImage?: string;
      agentEnabled?: boolean;
      agentName?: string;
      agentGreeting?: string;
      agentInstructions?: string;
    }>(req);

    const data: Record<string, unknown> = {};
    if (body?.title !== undefined) {
      const title = body.title.trim();
      if (!title) return fail("عنوان نمی‌تواند خالی باشد");
      if (title.length > MAX_FORUM_TITLE) return fail(`عنوان حداکثر ${MAX_FORUM_TITLE} کاراکتر است`);
      data.title = title;
    }
    if (body?.description !== undefined) data.description = body.description.trim().slice(0, MAX_DESCRIPTION) || null;
    if (body?.type !== undefined) data.type = body.type === "PRIVATE" ? "PRIVATE" : "PUBLIC";
    if (body?.status !== undefined) {
      if (!["ACTIVE", "PAUSED", "ARCHIVED"].includes(body.status)) return fail("وضعیت نامعتبر است");
      data.status = body.status;
    }
    if (body?.coverImage !== undefined) data.coverImage = body.coverImage.trim() || null;
    if (body?.agentEnabled !== undefined) data.agentEnabled = !!body.agentEnabled;
    if (body?.agentName !== undefined) data.agentName = body.agentName.trim().slice(0, 60) || null;
    if (body?.agentGreeting !== undefined) data.agentGreeting = body.agentGreeting.trim().slice(0, 400) || null;
    if (body?.agentInstructions !== undefined) data.agentInstructions = body.agentInstructions.trim().slice(0, 2000) || null;

    // تغییر رئیس انجمن — نقش‌های عضویت هم به‌روز می‌شوند
    if (body?.chairId !== undefined && body.chairId.trim() && body.chairId !== forum.chairId) {
      const newChair = await db.user.findUnique({ where: { id: body.chairId.trim() }, select: { id: true, status: true } });
      if (!newChair || newChair.status !== "ACTIVE") return fail("کاربر انتخاب‌شده یافت نشد یا فعال نیست", 404);
      data.chairId = newChair.id;

      await db.forumMember.updateMany({ where: { forumId: id, role: "CHAIR" }, data: { role: "MEMBER" } }).catch(() => {});
      await db.forumMember.upsert({
        where: { forumId_userId: { forumId: id, userId: newChair.id } },
        update: { role: "CHAIR", status: "ACTIVE", reviewedAt: new Date() },
        create: { forumId: id, userId: newChair.id, role: "CHAIR", status: "ACTIVE", reviewedAt: new Date() },
      });
    }

    if (Object.keys(data).length === 0) return fail("تغییری ارسال نشده است");

    await db.forum.update({ where: { id }, data });

    await logActivity({
      action: "admin.forum_updated",
      entity: "forum",
      entityId: id,
      details: { fields: Object.keys(data) },
      level: "warning",
    });

    return ok({ message: "انجمن به‌روزرسانی شد" });
  } catch (err) {
    console.error("خطای ویرایش انجمن (ادمین):", err);
    return fail("خطای داخلی سرور", 500);
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);
    const writeGate = assertWritableAdmin(admin);
    if (writeGate) return writeGate;

    const { id } = await ctx.params;
    const forum = await db.forum.findUnique({ where: { id }, select: { id: true, title: true } });
    if (!forum) return fail("انجمن یافت نشد", 404);

    // حذف آبشاری: اعضا، پیام‌ها، رویدادها، مقالات و دانش (Cascade در اسکیما)
    await db.forum.delete({ where: { id } });

    await logActivity({
      action: "admin.forum_deleted",
      entity: "forum",
      entityId: id,
      details: { title: forum.title },
      level: "warning",
    });

    return ok({ message: `انجمن «${forum.title}» و تمام داده‌هایش حذف شد` });
  } catch (err) {
    console.error("خطای حذف انجمن (ادمین):", err);
    return fail("خطای داخلی سرور", 500);
  }
}
