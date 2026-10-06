// ═════ درخواست کد یکبارمصرف — POST /api/auth/otp ═════
// ورودی: { phone, purpose: "login" | "register", profile? }
// برای ثبت‌نام، پروفایل (نام/جنسیت/تاریخ تولد) همین‌جا اعتبارسنجی می‌شود
// ═══════════════════════════════════════════════════════════════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson } from "@/lib/core/api";
import { normalizePhone } from "@/lib/core/security";
import { rateLimit, getClientIp } from "@/lib/core/rate-limit";
import { logActivity } from "@/lib/core/logger";
import { issueOtp } from "@/lib/core/otp";
import { validateRegisterProfile, RegisterProfile } from "@/lib/core/register-profile";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = rateLimit(`otp-req:${ip}`, 10, 10 * 60 * 1000); // ۱۰ درخواست در ۱۰ دقیقه برای هر IP
    if (!rl.allowed) {
      return fail(`درخواست‌های زیاد. ${rl.retryAfterSec} ثانیه دیگر تلاش کنید`, 429);
    }

    const body = await parseJson<{
      phone: string;
      purpose: "login" | "register";
      profile?: RegisterProfile;
    }>(req);
    if (!body?.phone) return fail("شماره موبایل الزامی است");

    const phone = normalizePhone(body.phone);
    if (!phone) return fail("شماره موبایل معتبر نیست (فرمت صحیح: ۰۹xxxxxxxxx)");

    const purpose = body.purpose === "register" ? "REGISTER" : "LOGIN";
    const user = await db.user.findUnique({ where: { phone }, select: { id: true, status: true } });

    if (purpose === "LOGIN") {
      if (!user) {
        // افشا نشدن وجود حساب: پیام عمومی، سمت کلاینت مسیر ثبت‌نام را نشان می‌دهد
        return ok({ exists: false, flow: "register" });
      }
      if (user.status === "SUSPENDED") {
        return fail("حساب شما موقتاً غیرفعال شده است. با پشتیبانی تماس بگیرید", 403);
      }
      if (user.status === "DELETED") {
        return fail("این حساب حذف شده است", 403);
      }
    } else {
      if (user) {
        return fail("این شماره موبایل قبلاً ثبت‌نام کرده است. وارد شوید", 409);
      }
      // اعتبارسنجی پروفایل پیش از ارسال پیامک (هزینه اضافی نرود)
      const check = validateRegisterProfile(body.profile);
      if (!check.ok) return fail(check.error!);
    }

    const result = await issueOtp(phone, purpose, ip);
    if (!result.ok) {
      return fail(result.error!, result.status || 429, { resendInSeconds: result.resendInSeconds });
    }

    await logActivity({
      action: purpose === "LOGIN" ? "auth.otp_login_sent" : "auth.otp_register_sent",
      entity: "user",
      details: { phone, smsSent: result.smsSent === true },
      ip,
      userAgent: req.headers.get("user-agent") || "",
    });

    return ok({
      exists: purpose === "LOGIN",
      flow: purpose === "LOGIN" ? "login" : "register",
      smsSent: result.smsSent === true,
      // کد توسعه — فقط وقتی پنل پیامک هنوز پیکربندی/فعال نشده باشد
      devCode: result.devCode || null,
      expiresInSeconds: result.expiresInSeconds,
      resendInSeconds: result.resendInSeconds,
    });
  } catch (err) {
    console.error("خطای درخواست OTP:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
