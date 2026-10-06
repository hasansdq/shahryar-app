// ═════ مدیریت کاربران (ادمین) — GET /api/admin/users ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, getAdmin } from "@/lib/core/api";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const status = searchParams.get("status") || "";
    const verified = searchParams.get("verified") === "1";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(5, parseInt(searchParams.get("limit") || "20")));

    const where: Record<string, unknown> = {};
    if (q) {
      where.OR = [
        { fullName: { contains: q } },
        { phone: { contains: q } },
        { email: { contains: q } },
      ];
    }
    if (status) where.status = status;
    if (verified) where.isVerified = true;

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true, phone: true, fullName: true, email: true, city: true,
          role: true, status: true, avatarColor: true, lastLoginAt: true,
          loginCount: true, createdAt: true,
          isVerified: true, restrictedUntil: true, restrictionReason: true,
          _count: {
            select: {
              goals: { where: { status: "active" } },
              chatSessions: true,
              memories: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.user.count({ where }),
    ]);

    return ok({
      users: users.map((u) => ({
        id: u.id, phone: u.phone, fullName: u.fullName, email: u.email, city: u.city,
        role: u.role, status: u.status, avatarColor: u.avatarColor,
        lastLoginAt: u.lastLoginAt, loginCount: u.loginCount, createdAt: u.createdAt,
        isVerified: u.isVerified, restrictedUntil: u.restrictedUntil, restrictionReason: u.restrictionReason,
        stats: {
          activeGoals: u._count.goals,
          chatSessions: u._count.chatSessions,
          memories: u._count.memories,
        },
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("خطای لیست کاربران:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
