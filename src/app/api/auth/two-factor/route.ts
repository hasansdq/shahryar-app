// ═════ مدیریت رمز دومرحله‌ای — PUT (فعال‌سازی) / DELETE (غیرفعال‌سازی) ═════
// فعال‌سازی: فقط وقتی رمزی ندارد — ورودی: { password, confirmPassword }
// غیرفعال‌سازی: فقط با رمز فعلی — ورودی: { currentPassword }
// ═══════════════════════════════════════════════════════════════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, userAgentFrom } from "@/lib/core/api";
import { hashPassword, verifyPassword, isStrongPassword } from "@/lib/core/security";
import { logActivity } from "@/lib/core/logger";
import { rateLimit, getClientIp } from "@/lib/core/rate-limit";

/** فعال‌سازی رمز دومرحله‌ای برای حساب بدون رمز */
export async function PUT(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);

    const rl = rateLimit(`tfa-enable:${auth.id}`, 5, 15 * 60 * 1000);
    if (!rl.allowed) return fail("تلاش‌های زیاد. بعداً تلاش کنید", 429);

    const body = await parseJson<{ password: string; confirmPassword: string }>(req);
    if (!body?.password) return fail("رمز عبور را وارد کنید");
    if (body.password !== body.confirmPassword) return fail("تکرار رمز عبور با رمز یکسان نیست");

    const user = await db.user.findUnique({ where: { id: auth.id }, select: { id: true, passwordHash: true } });
    if (!user) return fail("کاربر یافت نشد", 404);
    if (user.passwordHash) return fail("رمز عبور قبلاً برای حساب شما فعال شده است", 409);

    const check = isStrongPassword(body.password);
    if (!check.ok) return fail(check.message!);

    await db.user.update({ where: { id: auth.id }, data: { passwordHash: hashPassword(body.password) } });

    await logActivity({
      userId: auth.id,
      action: "user.2fa_enabled",
      level: "warning",
      ip: getClientIp(req),
      userAgent: userAgentFrom(req),
    });

    return ok({ message: "رمز عبور دومرحله‌ای فعال شد. از این پس پس از کد پیامکی، رمز عبور هم پرسیده می‌شود" });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}

/** غیرفعال‌سازی رمز دومرحله‌ای — با تایید رمز فعلی */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);

    const rl = rateLimit(`tfa-disable:${auth.id}`, 5, 15 * 60 * 1000);
    if (!rl.allowed) return fail("تلاش‌های زیاد. بعداً تلاش کنید", 429);

    const body = await parseJson<{ currentPassword: string }>(req);
    if (!body?.currentPassword) return fail("رمز عبور فعلی الزامی است");

    const user = await db.user.findUnique({ where: { id: auth.id }, select: { id: true, passwordHash: true } });
    if (!user) return fail("کاربر یافت نشد", 404);
    if (!user.passwordHash) return fail("رمز عبور برای حساب شما فعال نیست", 409);

    if (!verifyPassword(body.currentPassword, user.passwordHash)) {
      return fail("رمز عبور فعلی اشتباه است", 401);
    }

    await db.user.update({ where: { id: auth.id }, data: { passwordHash: null } });

    // سشن‌های دیگر باطل شود (تنها سشن فعلی می‌ماند)
    await db.session.updateMany({
      where: { userId: auth.id, jti: { not: auth.jti }, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await logActivity({
      userId: auth.id,
      action: "user.2fa_disabled",
      level: "warning",
      ip: getClientIp(req),
      userAgent: userAgentFrom(req),
    });

    return ok({ message: "رمز عبور دومرحله‌ای غیرفعال شد؛ ورود فقط با کد پیامکی انجام می‌شود" });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
