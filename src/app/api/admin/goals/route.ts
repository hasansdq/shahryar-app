// ═════ مرورگر اهداف کاربران — GET /api/admin/goals ═════
// فیلتر/جستجو/مرتب‌سازی/صفحه‌بندی + فاست‌ها — داده‌های غیرحساس اهداف
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, getAdmin } from "@/lib/core/api";
import type { Prisma } from "@prisma/client";

const SORTS = ["newest", "oldest", "progress_desc", "progress_asc", "deadline", "most_tasks"] as const;

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "all"; // all | active | completed | archived
    const category = searchParams.get("category") || "all";
    const userId = searchParams.get("userId") || "all";
    const q = (searchParams.get("q") || "").trim();
    const sort = (SORTS as readonly string[]).includes(searchParams.get("sort") || "")
      ? searchParams.get("sort")! : "newest";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const perPage = 12;

    // ─── شرط‌های فیلتر ───
    const where: Prisma.GoalWhereInput = {};
    if (status !== "all") where.status = status;
    if (category !== "all") where.category = category;
    if (userId !== "all") where.userId = userId;
    if (q) {
      where.OR = [
        { title: { contains: q } },
        { description: { contains: q } },
        { user: { fullName: { contains: q } } },
      ];
    }

    // ─── مرتب‌سازی ───
    let orderBy: Prisma.GoalOrderByWithRelationInput[] = [{ updatedAt: "desc" }];
    if (sort === "newest") orderBy = [{ createdAt: "desc" }];
    if (sort === "oldest") orderBy = [{ createdAt: "asc" }];
    if (sort === "progress_desc") orderBy = [{ progress: "desc" }];
    if (sort === "progress_asc") orderBy = [{ progress: "asc" }];
    if (sort === "deadline") orderBy = [{ deadline: "asc" }];
    if (sort === "most_tasks") orderBy = [{ tasks: { _count: "desc" } }];

    const [rows, total, statusFacets, categoryFacets, users] = await Promise.all([
      db.goal.findMany({
        where,
        orderBy,
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true, title: true, description: true, category: true, priority: true,
          status: true, progress: true, color: true, deadline: true,
          completedAt: true, createdAt: true, updatedAt: true,
          _count: { select: { tasks: true } },
          tasks: { where: { status: "done" }, select: { id: true } },
          user: { select: { id: true, fullName: true, phone: true, status: true } },
        },
      }),
      db.goal.count({ where }),
      db.goal.groupBy({ by: ["status"], _count: { _all: true } }),
      db.goal.groupBy({ by: ["category"], _count: { _all: true } }),
      db.goal.findMany({
        distinct: ["userId"],
        select: { user: { select: { id: true, fullName: true, phone: true } } },
        orderBy: { user: { fullName: "asc" } },
      }),
    ]);

    const items = rows.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      category: g.category,
      priority: g.priority,
      status: g.status,
      progress: g.progress,
      color: g.color,
      deadline: g.deadline,
      completedAt: g.completedAt,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
      tasksCount: g._count.tasks,
      doneTasks: g.tasks.length,
      user: g.user,
    }));

    return ok({
      items,
      pagination: { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) },
      facets: {
        statuses: Object.fromEntries(statusFacets.map((s) => [s.status, s._count._all])),
        categories: categoryFacets
          .map((c) => ({ category: c.category, count: c._count._all }))
          .sort((a, b) => b.count - a.count),
      },
      users: users.map((u) => u.user).filter(Boolean),
    });
  } catch (err) {
    console.error("خطای مرورگر اهداف:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
