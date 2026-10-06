// ═════ تایید کد یکبارمصرف — POST /api/auth/otp/verify ═════
// ورود: { phone, purpose: "login", code } → ورود کامل یا بلیت مرحله رمز
// ثبت‌نام: { phone, purpose: "register", code, profile } → ساخت حساب + ورود
// ═══════════════════════════════════════════════════════════════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson } from "@/lib/core/api";
import { normalizePhone, convertPersianDigits } from "@/lib/core/security";
import { rateLimit, getClientIp } from "@/lib/core/rate-limit";
import { verifyOtp } from "@/lib/core/otp";
import { completeLogin, issueOtpTicket } from "@/lib/core/auth-session";
import { validateRegisterProfile, RegisterProfile } from "@/lib/core/register-profile";

const AVATAR_COLORS = ["0", "1", "2", "3", "4", "5"];

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = rateLimit(`otp-verify:${ip}`, 20, 10 * 60 * 1000);
    if (!rl.allowed) {
      return fail(`تلاش‌های زیاد. ${rl.retryAfterSec} ثانیه دیگر تلاش کنید`, 429);
    }

    const body = await parseJson<{
      phone: string;
      purpose: "login" | "register";
      code: string;
      profile?: RegisterProfile;
    }>(req);
    if (!body?.phone || !body?.code) return fail("شماره موبایل و کد تایید الزامی است");

    const phone = normalizePhone(body.phone);
    if (!phone) return fail("شماره موبایل معتبر نیست");

    const code = convertPersianDigits(String(body.code)).replace(/\D/g, "");
    if (code.length !== 6) return fail("کد تایید باید ۶ رقم باشد");

    const purpose = body.purpose === "register" ? "REGISTER" : "LOGIN";

    // ─── مسیر ثبت‌نام ───
    if (purpose === "REGISTER") {
      const existing = await db.user.findUnique({
        where: { phone },
        select: { id: true, status: true },
      });
      if (existing && existing.status !== "DELETED") {
        return fail("این شماره قبلاً ثبت‌نام کرده است. وارد شوید", 409);
      }

      const check = validateRegisterProfile(body.profile);
      if (!check.ok) return fail(check.error!);

      const verified = await verifyOtp(phone, "REGISTER", code);
      if (!verified.ok) return fail(verified.error, 401);

      const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
      let user;
      try {
        if (existing) {
          // بازپس‌گیری حساب حذف‌شده (soft-deleted) — شماره آزاد می‌شود.
          // مالک جدید نباید محتوای اجتماعی مالک قبلی را به ارث ببرد:
          // پست‌های قبلی حذف نرم، پروفایل اجتماعی/سشن‌های قبلی پاک می‌شوند
          await db.session.updateMany({ where: { userId: existing.id }, data: { revokedAt: new Date() } });
          await db.socialPost.updateMany({ where: { authorId: existing.id, deletedAt: null }, data: { deletedAt: new Date() } });
          await db.socialProfile.deleteMany({ where: { userId: existing.id } });
          user = await db.user.update({
            where: { id: existing.id },
            data: {
              status: "ACTIVE",
              fullName: check.value.fullName,
              gender: check.value.gender,
              birthDate: check.value.birthDate,
              birthYear: check.value.birthYear,
              avatarColor,
              passwordHash: null,
            },
            select: {
              id: true, phone: true, fullName: true, avatarColor: true, avatarUrl: true, role: true, createdAt: true,
            },
          });
        } else {
          user = await db.user.create({
            data: {
              phone,
              passwordHash: null, // بدون رمز — کاربر بعداً از تب امنیت فعال می‌کند
              fullName: check.value.fullName,
              gender: check.value.gender,
              birthDate: check.value.birthDate,
              birthYear: check.value.birthYear,
              avatarColor,
            },
            select: {
              id: true, phone: true, fullName: true, avatarColor: true, avatarUrl: true, role: true, createdAt: true,
            },
          });
        }
      } catch {
        return fail("این شماره هم‌اکنون ثبت‌نام شد. وارد شوید", 409);
      }

      return completeLogin(req, user, "auth.register_otp");
    }

    // ─── مسیر ورود ───
    const user = await db.user.findUnique({
      where: { phone },
      select: {
        id: true, phone: true, fullName: true, avatarColor: true, avatarUrl: true, role: true, createdAt: true,
        passwordHash: true, status: true, restrictedUntil: true,
      },
    });
    if (!user) return fail("حسابی با این شماره یافت نشد. ابتدا ثبت‌نام کنید", 404);

    if (user.status === "SUSPENDED") return fail("حساب شما موقتاً غیرفعال شده است. با پشتیبانی تماس بگیرید", 403);
    if (user.status === "DELETED") return fail("این حساب حذف شده است", 403);
    if (user.restrictedUntil && user.restrictedUntil > new Date()) {
      return fail("حساب شما موقتاً محدود شده است", 403);
    }

    const verified = await verifyOtp(phone, "LOGIN", code);
    if (!verified.ok) return fail(verified.error, 401);

    // مرحله دوم: کاربرانی که رمز عبور فعال کرده‌اند
    if (user.passwordHash) {
      const ticket = issueOtpTicket(user.id, phone, "LOGIN");
      return ok({ step: "password", ticket, phone });
    }

    const { passwordHash: _ph, ...safeUser } = user;
    return completeLogin(req, safeUser, "auth.login_otp");
  } catch (err) {
    console.error("خطای تایید OTP:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
