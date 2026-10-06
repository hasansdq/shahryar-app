// ═════ مرحله دوم ورود: رمز عبور — POST /api/auth/otp/password ═════
// ورودی: { ticket, password } — بلیت از تایید OTP صادر شده (۵ دقیقه اعتبار)
// ═══════════════════════════════════════════════════════════════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson } from "@/lib/core/api";
import { verifyPassword } from "@/lib/core/security";
import { rateLimit, getClientIp } from "@/lib/core/rate-limit";
import { logActivity } from "@/lib/core/logger";
import { completeLogin, readOtpTicket } from "@/lib/core/auth-session";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const body = await parseJson<{ ticket: string; password: string }>(req);
    if (!body?.ticket || !body?.password) return fail("اطلاعات ارسال نشده است");

    const ticket = readOtpTicket(body.ticket);
    if (!ticket) {
      return fail("مهلت تایید کد به پایان رسیده است. دوباره وارد شوید", 401, { step: "expired" });
    }

    // ضد بروت‌فورس روی رمز: ۵ تلاش در ۱۵ دقیقه برای هر کاربر
    const rl = rateLimit(`otp-pass:${ticket.userId}`, 5, 15 * 60 * 1000);
    if (!rl.allowed) {
      return fail(`تلاش‌های رمز عبور بیش از حد مجاز. ${rl.retryAfterSec} ثانیه دیگر تلاش کنید`, 429);
    }

    const user = await db.user.findUnique({
      where: { id: ticket.userId },
      select: {
        id: true, phone: true, fullName: true, avatarColor: true, avatarUrl: true, role: true, createdAt: true,
        passwordHash: true, status: true, restrictedUntil: true,
      },
    });
    if (!user || !user.passwordHash) return fail("حساب یا رمز عبور یافت نشد", 404);

    if (user.status !== "ACTIVE") return fail("دسترسی این حساب محدود است", 403);
    if (user.restrictedUntil && user.restrictedUntil > new Date()) {
      return fail("حساب شما موقتاً محدود شده است", 403);
    }

    if (!verifyPassword(body.password, user.passwordHash)) {
      await logActivity({
        action: "auth.otp_password_failed",
        entity: "user",
        entityId: user.id,
        level: "warning",
        ip,
        userAgent: req.headers.get("user-agent") || "",
      });
      return fail("رمز عبور اشتباه است", 401);
    }

    const { passwordHash: _ph, ...safeUser } = user;
    return completeLogin(req, safeUser, "auth.login_otp_password");
  } catch (err) {
    console.error("خطای مرحله رمز عبور:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
