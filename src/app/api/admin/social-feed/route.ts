// ═══ مدیریت فید شهریار — GET /api/admin/social-feed ═══
// نمای کلی آمار فید + لیست پست‌ها (فیلتر: همه/گزارش‌شده/حذف‌شده/پین‌شده) + گزارش‌های باز
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, getAdmin } from "@/lib/core/api";

const PAGE_SIZE = 12;

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const filter = searchParams.get("filter") || "all"; // all | reported | deleted | pinned | recent
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));

    // ─── آمار کلی فید ───
    const dayAgo = new Date(Date.now() - 86400000);
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const [
      postsTotal, postsToday, postsWeek, likesTotal, commentsTotal,
      deletedTotal, pinnedTotal, openReports, activeAuthors, attachmentsTotal,
    ] = await Promise.all([
      db.socialPost.count({ where: { deletedAt: null } }),
      db.socialPost.count({ where: { deletedAt: null, createdAt: { gte: dayAgo } } }),
      db.socialPost.count({ where: { deletedAt: null, createdAt: { gte: weekAgo } } }),
      db.socialPostLike.count(),
      db.socialPostComment.count({ where: { deletedAt: null } }),
      db.socialPost.count({ where: { deletedAt: { not: null } } }),
      db.socialPost.count({ where: { deletedAt: null, isPinned: true } }),
      db.socialPostReport.count({ where: { status: "open" } }),
      db.socialPost.groupBy({ by: ["authorId"], where: { deletedAt: null, createdAt: { gte: weekAgo } }, _count: { authorId: true } }),
      db.socialPostAttachment.count(),
    ]);

    // ─── فیلتر لیست ───
    const where: Record<string, unknown> = {};
    if (filter === "deleted") where.deletedAt = { not: null };
    else where.deletedAt = null;
    if (filter === "pinned") where.isPinned = true;
    if (filter === "reported") {
      where.reports = { some: { status: "open" } };
      where.deletedAt = null;
    }
    if (q) {
      where.OR = [{ content: { contains: q } }, { author: { fullName: { contains: q } } }];
    }

    const [posts, total] = await Promise.all([
      db.socialPost.findMany({
        where,
        // گزارش‌شده‌ها اولِ صفحه؛ در بقیه حالت‌ها جدیدترین
        orderBy: filter === "reported" ? { createdAt: "desc" } : { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true, content: true, createdAt: true, deletedAt: true, editedAt: true,
          isPinned: true, likeCount: true, commentCount: true,
          attachments: { select: { kind: true, url: true, originalName: true, mime: true, size: true } },
          reports: { where: { status: "open" }, select: { id: true, reason: true, note: true, createdAt: true, reporter: { select: { fullName: true } } } },
          author: {
            select: {
              id: true, fullName: true, phone: true, avatarUrl: true, avatarColor: true,
              isVerified: true, status: true,
            },
          },
        },
      }),
      db.socialPost.count({ where }),
    ]);

    // ─── گزارش‌های باز جدا (برای تب گزارش‌ها) ───
    const openReportsList = await db.socialPostReport.findMany({
      where: { status: "open" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true, reason: true, note: true, createdAt: true,
        reporter: { select: { id: true, fullName: true } },
        post: {
          select: {
            id: true, content: true, deletedAt: true, createdAt: true,
            author: { select: { id: true, fullName: true, phone: true, status: true } },
          },
        },
      },
    });

    return ok({
      overview: {
        postsTotal, postsToday, postsWeek, likesTotal, commentsTotal,
        deletedTotal, pinnedTotal, openReports: openReports,
        activeAuthors7d: activeAuthors.length,
        attachmentsTotal,
      },
      posts: posts.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        deletedAt: p.deletedAt?.toISOString() || null,
        editedAt: p.editedAt?.toISOString() || null,
        reports: p.reports.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
        // گزارش‌های کل (شامل بسته‌شده) برای نمایش badge
        reportCount: p.reports.length,
      })),
      reports: openReportsList.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        post: {
          ...r.post,
          createdAt: r.post.createdAt.toISOString(),
          deletedAt: r.post.deletedAt?.toISOString() || null,
        },
      })),
      pagination: { page, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) },
    });
  } catch (err) {
    console.error("خطای مدیریت فید:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
