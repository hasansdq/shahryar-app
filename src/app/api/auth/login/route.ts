// ═════ ورود کاربر — POST /api/auth/login ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, setAuthCookie, userAgentFrom, detectDevice } from "@/lib/core/api";
import { verifyPassword, hashPassword, normalizePhone, signJwt, generateJti } from "@/lib/core/security";
import { rateLimit, getClientIp } from "@/lib/core/rate-limit";
import { logActivity } from "@/lib/core/logger";

// هش دامی — برای برابرسازی زمان پاسخ وقتی حساب وجود ندارد
// (جلوگیری از تشخیص وجود شماره از طریق زمان پاسخ؛ الگوی مسیر admin login)
const DUMMY_HASH = hashPassword("timing-equalizer-dummy-password");

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    // دو لایه: هر IP (ضد پخش‌کردن حمله) + هر شماره (ضرب‌العداد هدفمند —
    // IP با XFF قابل چرخش است اما شماره هدف ثابت می‌ماند)
    const rl = rateLimit(`login:${ip}`, 8, 10 * 60 * 1000); // ۸ تلاش در ۱۰ دقیقه
    if (!rl.allowed) {
      return fail(`تلاش‌های ورود بیش از حد مجاز. ${rl.retryAfterSec} ثانیه دیگر تلاش کنید`, 429);
    }

    const body = await parseJson<{ phone: string; password: string }>(req);
    if (!body) return fail("درخواست نامعتبر است");

    const phone = normalizePhone(body.phone);
    if (!phone) return fail("شماره موبایل معتبر نیست");

    const rlPhone = rateLimit(`login-phone:${phone}`, 8, 10 * 60 * 1000);
    if (!rlPhone.allowed) {
      return fail(`تلاش‌های ورود برای این شماره بیش از حد مجاز است. ${rlPhone.retryAfterSec} ثانیه دیگر تلاش کنید`, 429);
    }

    const user = await db.user.findUnique({ where: { phone } });
    // مقایسه در هر دو حالت — حتی بدون حساب، scrypt روی هش دامی اجرا می‌شود
    // تا زمان پاسخ «حساب هست/نیست» یکسان بماند (user.passwordHash برای
    // کاربران فقط-OTP تهی است → همان هش دامی)
    const passwordOk = verifyPassword(body.password || "", user?.passwordHash || DUMMY_HASH);
    if (!user || !passwordOk) {
      await logActivity({
        action: "auth.login_failed",
        entity: "user",
        details: { phone },
        level: "warning",
        ip,
        userAgent: userAgentFrom(req),
      });
      return fail("شماره موبایل یا رمز عبور اشتباه است", 401);
    }

    if (user.status === "SUSPENDED") {
      return fail("حساب شما موقتاً غیرفعال شده است. با پشتیبانی تماس بگیرید", 403);
    }
    if (user.status === "DELETED") {
      return fail("این حساب حذف شده است", 403);
    }
    // محدودیت موقت حساب (هم‌ارز مسیر OTP) — سشن تازه هم بلافاصله بسته می‌شد؛
    // پیام شفاف بهتر از ورودِ بی‌خروجی است
    if (user.restrictedUntil && user.restrictedUntil > new Date()) {
      return fail("حساب شما موقتاً محدود شده است", 403);
    }

    // سشن جدید
    const jti = generateJti();
    const token = signJwt({ sub: user.id, jti, type: "user", role: user.role }, 60 * 60 * 24 * 30);
    const expiresAt = new Date(Date.now() + 60 * 60 * 24 * 30 * 1000);
    const ua = userAgentFrom(req);

    await db.session.create({
      data: { jti, userId: user.id, ip, userAgent: ua, device: detectDevice(ua), expiresAt },
    });

    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
    });

    await logActivity({
      userId: user.id,
      action: "auth.login",
      entity: "user",
      entityId: user.id,
      ip,
      userAgent: ua,
    });

    const res = ok({
      user: {
        id: user.id,
        phone: user.phone,
        fullName: user.fullName,
        avatarColor: user.avatarColor,
        avatarUrl: user.avatarUrl,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
    setAuthCookie(res as never, "shahryar_token", token, 60 * 60 * 24 * 30, req);
    return res;
  } catch (err) {
    console.error("خطای ورود:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
