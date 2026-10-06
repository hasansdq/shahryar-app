// ═════ اطلاعات کاربر جاری — GET /api/auth/me ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, getUser } from "@/lib/core/api";

export async function GET(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);

    const user = await db.user.findUnique({
      where: { id: auth.id },
      select: {
        id: true, phone: true, fullName: true, email: true, avatarColor: true, avatarUrl: true,
        city: true, gender: true, birthYear: true, birthDate: true, interests: true, bio: true,
        role: true, status: true, createdAt: true, lastLoginAt: true, loginCount: true,
        passwordHash: true,
      },
    });
    if (!user) return fail("کاربر یافت نشد", 404);
    const { passwordHash, ...safeUser } = user;

    // آمار سریع کاربر
    const [goalsCount, memoriesCount, messagesCount, activeSessions] = await Promise.all([
      db.goal.count({ where: { userId: user.id, status: "active" } }),
      db.aIMemory.count({ where: { userId: user.id } }),
      db.chatMessage.count({ where: { session: { userId: user.id }, role: "user" } }),
      db.session.count({ where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } } }),
    ]);

    return ok({
      user: {
        ...safeUser,
        hasPassword: !!passwordHash,
        interests: user.interests ? JSON.parse(user.interests) : [],
      },
      stats: { goalsCount, memoriesCount, messagesCount, activeSessions },
    });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
