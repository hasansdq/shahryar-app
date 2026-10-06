// ═════ مدیریت کاربر (ادمین) — GET/PATCH/DELETE /api/admin/users/[id] ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getAdmin, assertWritableAdmin } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);


    const { id } = await params;
    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true, phone: true, fullName: true, email: true, city: true,
        gender: true, birthYear: true, bio: true, role: true, status: true,
        isVerified: true, verifiedAt: true, restrictedUntil: true, restrictionReason: true,
        avatarColor: true, avatarUrl: true, createdAt: true, lastLoginAt: true, loginCount: true,
        sessions: {
          where: { revokedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { lastUsedAt: "desc" },
          take: 5,
          select: { id: true, ip: true, device: true, lastUsedAt: true, createdAt: true },
        },
        socialProfile: {
          select: {
            id: true, headline: true, isDiscoverable: true, viewCount: true,
            agentEnabled: true, agentName: true, agentStyle: true,
          },
        },
        _count: {
          select: { goals: true, chatSessions: true, memories: true, reviews: true, knowledgeItems: true },
        },
      },
    });
    if (!user) return fail("کاربر یافت نشد", 404);

    const [goalStats, recentChats] = await Promise.all([
      db.goal.groupBy({ by: ["status"], where: { userId: id }, _count: true }),
      db.chatSession.findMany({
        where: { userId: id },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, title: true, mode: true, messageCount: true, updatedAt: true },
      }),
    ]);

    return ok({
      user: {
        ...user,
        activeSessions: user.sessions.length,
        sessions: user.sessions,
        counts: {
          goals: user._count.goals,
          chatSessions: user._count.chatSessions,
          memories: user._count.memories,
          reviews: user._count.reviews,
        },
        goalStats,
        recentChats,
      },
    });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);
    const writeGate = assertWritableAdmin(admin);
    if (writeGate) return writeGate;

    const { id } = await params;
    const user = await db.user.findUnique({ where: { id } });
    if (!user) return fail("کاربر یافت نشد", 404);

    const body = await parseJson<{
      status?: string; role?: string; fullName?: string; city?: string;
      revokeSessions?: boolean;
      isVerified?: boolean;
      restrictedUntil?: string | null;
      restrictionReason?: string | null;
    }>(req);
    if (!body) return fail("درخواست نامعتبر است");

    const data: Record<string, unknown> = {};
    if (body.status && ["ACTIVE", "SUSPENDED", "DELETED"].includes(body.status)) data.status = body.status;
    if (body.role && ["USER", "ADMIN"].includes(body.role)) data.role = body.role;
    if (body.fullName?.trim()) data.fullName = body.fullName.trim().slice(0, 60);
    if (body.city) data.city = body.city;
    if (typeof body.isVerified === "boolean") {
      data.isVerified = body.isVerified;
      data.verifiedAt = body.isVerified ? new Date() : null;
    }
    if (body.restrictedUntil !== undefined) {
      data.restrictedUntil = body.restrictedUntil ? new Date(body.restrictedUntil) : null;
      data.restrictionReason = body.restrictedUntil ? (body.restrictionReason || "").slice(0, 200) || "محدودیت مدیریتی" : null;
    }

    if (Object.keys(data).length) {
      await db.user.update({ where: { id }, data });
    }

    // ابطال همه سشن‌ها در صورت نیاز
    if (body.revokeSessions) {
      await db.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await logActivity({
      adminId: admin.id, actorType: "admin",
      action: "admin.user_update", entity: "user", entityId: id,
      details: { ...data, revokeSessions: body.revokeSessions },
      level: body.status === "SUSPENDED" ? "warning" : "info",
    });

    return ok({ message: "کاربر به‌روزرسانی شد" });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);
    const writeGate = assertWritableAdmin(admin);
    if (writeGate) return writeGate;

    const { id } = await params;
    const user = await db.user.findUnique({ where: { id } });
    if (!user) return fail("کاربر یافت نشد", 404);

    // حذف نرم — حفظ حریم خصوصی
    await db.user.update({
      where: { id },
      data: {
        status: "DELETED",
        fullName: "کاربر حذف‌شده",
        passwordHash: "deleted",
        email: null,
        bio: null,
      },
    });
    await db.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await db.aIMemory.deleteMany({ where: { userId: id } });

    await logActivity({
      adminId: admin.id, actorType: "admin",
      action: "admin.user_delete", entity: "user", entityId: id,
      level: "warning", details: { phone: user.phone },
    });

    return ok({ message: "کاربر حذف شد (حذف نرم)" });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
