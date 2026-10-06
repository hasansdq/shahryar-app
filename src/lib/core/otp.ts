// ═════ موتور کد یکبارمصرف (OTP) شهریار ═════
// کد ۶ رقمی تصادفی رمزنگاری‌شده + انقضای ۳ دقیقه + ضد بروت‌فورس
// ─ سیاست‌ها ─────────────────────────────────────────────────
//   انقضا: ۳ دقیقه | ارسال مجدد: ۹۰ ثانیه فاصله
//   حداکثر ۵ تلاش بررسی برای هر کد | حداکثر ۵ ارسال در ساعت برای هر شماره
// ═══════════════════════════════════════════════════════════════
import crypto from "crypto";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "./security";
import { canSendOtp, getSmsConfig } from "./sms-settings";
import { sendOtpSms } from "./sms";

export const OTP_TTL_SEC = 3 * 60; // اعتبار کد
export const OTP_RESEND_SEC = 90; // فاصله ارسال مجدد
const MAX_ATTEMPTS = 5; // حداکثر تلاش ناموفق هر کد
const HOURLY_LIMIT = 5; // حداکثر ارسال در ساعت برای هر شماره

export type OtpPurpose = "LOGIN" | "REGISTER";

export interface IssueResult {
  ok: boolean;
  error?: string;
  status?: number;
  devCode?: string; // فقط وقتی پنل پیامک پیکربندی نشده باشد (حالت توسعه)
  smsSent?: boolean;
  expiresInSeconds?: number;
  resendInSeconds?: number;
}

/** پاکسازی دوره‌ای کدهای کهنه — بدون بلاک‌کردن مسیر اصلی */
function cleanupOld() {
  db.otpCode.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } } }).catch(() => {});
}

/** صدور و ارسال کد برای شماره + هدف مشخص */
export async function issueOtp(phone: string, purpose: OtpPurpose, ip?: string): Promise<IssueResult> {
  cleanupOld();

  // نرخ ارسال: حداکثر ۵ کد در ساعت برای هر شماره
  const hourlyCount = await db.otpCode.count({
    where: { phone, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (hourlyCount >= HOURLY_LIMIT) {
    return { ok: false, error: "تعداد درخواست کد برای این شماره زیاد است. یک ساعت دیگر تلاش کنید", status: 429 };
  }

  // فاصله ارسال مجدد — آخرین کد صادرشده برای همین شماره/هدف
  const last = await db.otpCode.findFirst({
    where: { phone, purpose, createdAt: { gt: new Date(Date.now() - OTP_RESEND_SEC * 1000) } },
    orderBy: { createdAt: "desc" },
  });
  if (last) {
    const wait = Math.ceil((last.createdAt.getTime() + OTP_RESEND_SEC * 1000 - Date.now()) / 1000);
    return {
      ok: false,
      error: `کد قبلی ارسال شده؛ ${wait} ثانیه دیگر می‌توانید دوباره درخواست دهید`,
      status: 429,
      resendInSeconds: wait,
    };
  }

  // تولید کد ۶ رقمی امن
  const code = String(crypto.randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + OTP_TTL_SEC * 1000);

  // ابطال کدهای قبلی همین شماره/هدف (فقط آخرین کد معتبر می‌ماند)
  await db.otpCode.updateMany({
    where: { phone, purpose, consumed: false },
    data: { consumed: true },
  });

  await db.otpCode.create({
    data: { phone, purpose, codeHash: hashPassword(code), expiresAt, ip: ip || null },
  });

  // ارسال پیامک واقعی — یا حالت توسعه وقتی پنل پیکربندی/فعال نشده
  // روش ارسال خودکار انتخاب می‌شود: کد الگو پر → الگو | خالی → دستی (SendSMS)
  //
  // ⚠️ امنیتی (fail-closed): اگر پنل پیامک آماده نباشد، در production
  // کد هرگز به کلاینت برنمی‌گردد (در غیر این صورت هر کسی می‌توانست با
  // درخواست OTP برای شماره قربانی، devCode را از پاسخ بخواند و وارد
  // حسابش شود). کد توسعه فقط در development (یا با env OTP_DEV_CODE=1)
  // و صرفاً در لاگ سرور در دسترس است.
  const cfg = await getSmsConfig();
  if (!canSendOtp(cfg)) {
    const devMode = process.env.NODE_ENV !== "production" && process.env.OTP_DEV_CODE !== "0";
    if (devMode) {
      console.warn(`[OTP][DEV] پنل پیامک آماده نیست — کد توسعه برای ${phone}: ${code}`);
      return { ok: true, devCode: code, smsSent: false, expiresInSeconds: OTP_TTL_SEC, resendInSeconds: OTP_RESEND_SEC };
    }
    if (process.env.NODE_ENV === "production") {
      // کد در لاگ production هم چاپ نمی‌شود — فقط رخداد ثبت می‌شود
      console.warn(`[OTP] پنل پیامک پیکربندی نشده — ارسال کد برای ${phone.slice(0, 4)}*** ناموفق`);
    }
    return {
      ok: false,
      error: "سرویس پیامک سامانه در دسترس نیست؛ لطفاً بعداً تلاش کنید یا با پشتیبانی تماس بگیرید",
      status: 503,
    };
  }

  const sent = await sendOtpSms(phone, code);
  if (!sent.ok) {
    return { ok: false, error: `ارسال پیامک ناموفق: ${sent.error}`, status: 502 };
  }

  return { ok: true, smsSent: true, expiresInSeconds: OTP_TTL_SEC, resendInSeconds: OTP_RESEND_SEC };
}

export type VerifyReason =
  | "not_found" // کدی برای این شماره صادر نشده
  | "expired" // منقضی
  | "attempts" // تلاش‌های ناموفق بیش از حد
  | "wrong"; // کد اشتباه

/** بررسی کد — در صورت موفقیت کد مصرف می‌شود */
export async function verifyOtp(
  phone: string,
  purpose: OtpPurpose,
  code: string
): Promise<{ ok: true } | { ok: false; reason: VerifyReason; error: string }> {
  const otp = await db.otpCode.findFirst({
    where: { phone, purpose, consumed: false },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    return { ok: false, reason: "not_found", error: "کدی برای این شماره صادر نشده است. دوباره درخواست دهید" };
  }
  if (otp.expiresAt < new Date()) {
    await db.otpCode.update({ where: { id: otp.id }, data: { consumed: true } });
    return { ok: false, reason: "expired", error: "کد منقضی شده است. کد جدید درخواست کنید" };
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    await db.otpCode.update({ where: { id: otp.id }, data: { consumed: true } });
    return { ok: false, reason: "attempts", error: "تلاش‌های ناموفق زیاد بوده است. کد جدید درخواست کنید" };
  }

  if (!verifyPassword(code, otp.codeHash)) {
    await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    const left = MAX_ATTEMPTS - otp.attempts - 1;
    return {
      ok: false,
      reason: "wrong",
      error: left > 0 ? `کد وارد شده اشتباه است (${left} تلاش باقی مانده)` : "کد وارد شده اشتباه است؛ لطفاً کد جدید درخواست کنید",
    };
  }

  await db.otpCode.update({ where: { id: otp.id }, data: { consumed: true } });
  return { ok: true };
}
