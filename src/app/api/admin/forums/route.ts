// ═══ مدیریت انجمن‌ها (CMS) — GET / POST /api/admin/forums ═════
// GET : لیست همه انجمن‌ها با آمار کامل + جستجو
// POST: ایجاد انجمن — تنها مسیر ایجاد انجمن در کل سیستم
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getAdmin, assertWritableAdmin } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { MAX_DESCRIPTION, MAX_FORUM_TITLE, slugifyForum } from "@/lib/modules/forums/service";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);


    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    const forums = await db.forum.findMany({
      where: q
        ? { OR: [{ title: { contains: q } }, { description: { contains: q } }] }
        : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        chair: { select: { id: true, fullName: true, phone: true, avatarUrl: true, avatarColor: true } },
        _count: { select: { members: true, messages: true, events: true, articles: true, knowledge: true } },
      },
    });

    // آمار هر انجمن با جزئیات دقیق‌تر (اعضای فعال / در انتظار)
    const withStats = await Promise.all(
      forums.map(async (f) => {
        const [activeMembers, pendingMembers] = await Promise.all([
          db.forumMember.count({ where: { forumId: f.id, status: "ACTIVE" } }),
          db.forumMember.count({ where: { forumId: f.id, status: "PENDING" } }),
        ]);
        return {
          id: f.id,
          slug: f.slug,
          title: f.title,
          description: f.description,
          coverImage: f.coverImage,
          type: f.type,
          status: f.status,
          agentEnabled: f.agentEnabled,
          agentName: f.agentName,
          chair: {
            id: f.chair.id,
            name: f.chair.fullName || "کاربر شهریار",
            phone: f.chair.phone,
            avatarUrl: f.chair.avatarUrl,
            avatarColor: f.chair.avatarColor,
          },
          stats: {
            members: activeMembers,
            pending: pendingMembers,
            allMemberRows: f._count.members,
            messages: f._count.messages,
            events: f._count.events,
            articles: f._count.articles,
            knowledge: f._count.knowledge,
          },
          createdAt: f.createdAt.toISOString(),
        };
      })
    );

    const overview = {
      total: withStats.length,
      public: withStats.filter((f) => f.type === "PUBLIC").length,
      private: withStats.filter((f) => f.type === "PRIVATE").length,
      active: withStats.filter((f) => f.status === "ACTIVE").length,
      members: withStats.reduce((s, f) => s + f.stats.members, 0),
      messages: withStats.reduce((s, f) => s + f.stats.messages, 0),
      articles: withStats.reduce((s, f) => s + f.stats.articles, 0),
      events: withStats.reduce((s, f) => s + f.stats.events, 0),
    };

    return ok({ forums: withStats, overview });
  } catch (err) {
    console.error("خطای لیست انجمن‌ها (ادمین):", err);
    return fail("خطای داخلی سرور", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);
    const writeGate = assertWritableAdmin(admin);
    if (writeGate) return writeGate;

    const body = await parseJson<{
      title?: string;
      description?: string;
      type?: string;
      chairId?: string;
      coverImage?: string;
      agentName?: string;
      agentGreeting?: string;
      agentInstructions?: string;
    }>(req);

    const title = (body?.title || "").trim();
    const chairId = (body?.chairId || "").trim();
    const type = body?.type === "PRIVATE" ? "PRIVATE" : "PUBLIC";
    if (!title) return fail("عنوان انجمن الزامی است");
    if (title.length > MAX_FORUM_TITLE) return fail(`عنوان حداکثر ${MAX_FORUM_TITLE} کاراکتر است`);
    if (!chairId) return fail("انتخاب رئیس انجمن الزامی است");

    const chair = await db.user.findUnique({ where: { id: chairId }, select: { id: true, status: true, fullName: true } });
    if (!chair || chair.status !== "ACTIVE") return fail("کاربر انتخاب‌شده یافت نشد یا فعال نیست", 404);

    const forum = await db.forum.create({
      data: {
        slug: slugifyForum(title),
        title,
        description: (body?.description || "").trim().slice(0, MAX_DESCRIPTION) || null,
        coverImage: (body?.coverImage || "").trim() || null,
        type,
        status: "ACTIVE",
        chairId,
        agentName: (body?.agentName || "").trim().slice(0, 60) || null,
        agentGreeting: (body?.agentGreeting || "").trim().slice(0, 400) || null,
        agentInstructions: (body?.agentInstructions || "").trim().slice(0, 2000) || null,
      },
    });

    // رئیس انجمن به‌صورت خودکار عضو فعال با نقش CHAIR می‌شود
    await db.forumMember.create({
      data: { forumId: forum.id, userId: chairId, role: "CHAIR", status: "ACTIVE", reviewedAt: new Date() },
    });

    await logActivity({
      action: "admin.forum_created",
      entity: "forum",
      entityId: forum.id,
      details: { title, type, chairId },
      level: "warning",
    });

    return ok({ forumId: forum.id, message: `انجمن «${title}» ایجاد شد` });
  } catch (err) {
    console.error("خطای ایجاد انجمن:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
