// ═════ ورود مدیر — POST /api/admin/auth/login (فوق امنیتی) ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, setAuthCookie, userAgentFrom, detectDevice } from "@/lib/core/api";
import { verifyPassword, signJwt, generateJti } from "@/lib/core/security";
import { rateLimit, getClientIp } from "@/lib/core/rate-limit";
import { logActivity } from "@/lib/core/logger";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    // محافظت شدید برute-force: ۵ تلاش در ۱۵ دقیقه
    const rl = rateLimit(`admin-login:${ip}`, 5, 15 * 60 * 1000);
    if (!rl.allowed) {
      await logActivity({
        actorType: "admin",
        action: "admin.login_rate_limited",
        level: "error",
        ip,
        userAgent: userAgentFrom(req),
      });
      return fail(`تلاش‌های ورود بیش از حد مجاز. ${Math.ceil(rl.retryAfterSec / 60)} دقیقه دیگر تلاش کنید`, 429);
    }

    const body = await parseJson<{ username: string; password: string }>(req);
    if (!body?.username || !body?.password) {
      return fail("نام کاربری و رمز عبور الزامی است");
    }

    const admin = await db.adminUser.findUnique({ where: { username: body.username.trim() } });

    // هش رمز عبور غلط هم اجرا می‌شود تا زمان پاسخ یکسان بماند (مقاوم به Timing Attack)
    const storedHash = admin?.passwordHash || "scrypt$16384$8$1$0000$0000";
    const passwordOk = verifyPassword(body.password, storedHash);

    if (!admin || !passwordOk) {
      await logActivity({
        actorType: "admin",
        action: "admin.login_failed",
        level: "error",
        details: { username: body.username.slice(0, 30), ip },
        ip,
        userAgent: userAgentFrom(req),
      });
      return fail("نام کاربری یا رمز عبور اشتباه است", 401);
    }

    if (!admin.isActive) {
      return fail("این حساب مدیر غیرفعال شده است", 403);
    }

    // سشن مدیر — ۱۲ ساعت (امنیت بالاتر)
    const jti = generateJti();
    const token = signJwt({ sub: admin.id, jti, type: "admin", role: admin.role }, 60 * 60 * 12);
    const expiresAt = new Date(Date.now() + 60 * 60 * 12 * 1000);
    const ua = userAgentFrom(req);

    await db.adminSession.create({
      data: { jti, adminId: admin.id, ip, userAgent: ua, expiresAt },
    });

    await db.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
    });

    await logActivity({
      adminId: admin.id,
      actorType: "admin",
      action: "admin.login",
      ip,
      userAgent: ua,
      details: { device: detectDevice(ua) },
    });

    const res = ok({
      admin: { id: admin.id, username: admin.username, name: admin.name, role: admin.role },
    });
    setAuthCookie(res as never, "shahryar_admin_token", token, 60 * 60 * 12, req);
    return res;
  } catch (err) {
    console.error("خطای ورود مدیر:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
