// ═════ تغییر رمز عبور — POST /api/auth/change-password ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, userAgentFrom } from "@/lib/core/api";
import { hashPassword, verifyPassword, isStrongPassword } from "@/lib/core/security";
import { logActivity } from "@/lib/core/logger";
import { rateLimit, getClientIp } from "@/lib/core/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);

    const ip = getClientIp(req);
    const rl = rateLimit(`chpass:${auth.id}`, 5, 15 * 60 * 1000);
    if (!rl.allowed) return fail("تلاش‌های زیاد. بعداً تلاش کنید", 429);

    const body = await parseJson<{ currentPassword: string; newPassword: string }>(req);
    if (!body?.currentPassword || !body?.newPassword) {
      return fail("رمز فعلی و جدید الزامی است");
    }

    const user = await db.user.findUnique({ where: { id: auth.id } });
    if (!user) return fail("کاربر یافت نشد", 404);
    if (!user.passwordHash) {
      return fail("رمز عبور برای حساب شما فعال نیست. از بخش «امنیت حساب» فعال کنید", 409);
    }
    if (!verifyPassword(body.currentPassword, user.passwordHash)) {
      return fail("رمز عبور فعلی اشتباه است", 401);
    }

    const check = isStrongPassword(body.newPassword);
    if (!check.ok) return fail(check.message!);

    await db.user.update({
      where: { id: auth.id },
      data: { passwordHash: hashPassword(body.newPassword) },
    });

    // ابطال همه سشن‌ها به‌جز سشن فعلی
    await db.session.updateMany({
      where: { userId: auth.id, jti: { not: auth.jti }, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await logActivity({
      userId: auth.id,
      action: "user.password_change",
      level: "warning",
      ip,
      userAgent: userAgentFrom(req),
    });

    return ok({ message: "رمز عبور با موفقیت تغییر کرد" });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
