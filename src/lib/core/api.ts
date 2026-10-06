// ═══════════════════════════════════════════════════════════════
// ابزارهای پاسخ API و احراز هویت مبتنی بر JWT
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyJwt } from "./security";

// ─── پاسخ‌های استاندارد ───

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init);
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error: message, ...extra }, { status });
}

// ─── کوکی‌های امن ───

/**
 * تشخیص زمینه امن (HTTPS) برای تنظیم ویژگی‌های کوکی.
 *
 * چرا مهم است: پیش‌نمایش z.ai اپ را داخل iframe ای با دامنه متفاوت
 * (preview-*.space-z.ai) نمایش می‌دهد — یعنی زمینه «سایت متقاطع».
 * کوکی‌های SameSite=Lax در iframe متقاطع توسط مرورگر ارسال نمی‌شوند؛
 * نتیجه‌اش این بوده: لاگین/ثبت‌نام 200 برمی‌گردد اما همه درخواست‌های بعدی
 * (داشبورد، اهداف، چت...) 401 می‌شوند و کاربر به صفحه ورود پرتاب می‌شود.
 *
 * راه‌حل: اگر درخواست از زمینه HTTPS آمده باشد (هدر Origin یا Referer یا
 * X-Forwarded-Proto) کوکی با SameSite=None + Secure تنظیم می‌شود که در
 * iframe متقاطع هم کار می‌کند. در HTTP محلی همان Lax قبلی می‌ماند.
 */
function detectCookieContext(req?: NextRequest): { secure: boolean; sameSite: "lax" | "strict" | "none" } {
  if (req) {
    // پراکسی z.ai/Caddy ممکن است پروتکل واقعی مرورگر را اعلام کند
    const proto = req.headers.get("x-forwarded-proto");
    if (proto?.includes("https")) return { secure: true, sameSite: "none" };

    // مرورگر در درخواست‌های POST/PATCH/PUT همیشه Origin می‌فرستد؛
    // در GET هم Referer در دسترس است — هر دو منبع قابل اعتمادِ «https بودن»
    const origin = req.headers.get("origin");
    if (origin && origin.startsWith("https://")) return { secure: true, sameSite: "none" };
    const referer = req.headers.get("referer");
    if (referer && referer.startsWith("https://")) return { secure: true, sameSite: "none" };

    // خود URL درخواست (پروتکل مستقیم سرور)
    try {
      if (new URL(req.url).protocol === "https:") return { secure: true, sameSite: "none" };
    } catch {
      // URL نامعتبر — از مسیرهای بعدی استفاده کن
    }
  }

  // در production اگر هیچ سیگنالی نبود، محتاطانه SameSite=None + Secure
  // (پیش‌نمایش z.ai همیشه HTTPS است؛ SameSite=Lax در آنجا کار نمی‌کند)
  if (process.env.NODE_ENV === "production") {
    return { secure: true, sameSite: "none" };
  }
  return { secure: false, sameSite: "lax" };
}

export function setAuthCookie(res: NextResponse, name: string, token: string, maxAgeSec: number, req?: NextRequest) {
  const ctx = detectCookieContext(req);
  res.cookies.set(name, token, {
    httpOnly: true,
    secure: ctx.secure,
    sameSite: ctx.sameSite,
    path: "/",
    maxAge: maxAgeSec,
  });
}

export function clearAuthCookie(res: NextResponse, name: string, req?: NextRequest) {
  const ctx = detectCookieContext(req);
  res.cookies.set(name, "", {
    httpOnly: true,
    secure: ctx.secure,
    sameSite: ctx.sameSite,
    path: "/",
    maxAge: 0,
  });
}

export function getCookie(req: NextRequest, name: string): string | null {
  const cookie = req.cookies.get(name);
  if (cookie) return cookie.value;
  // fallback به هدر Authorization
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

// ─── احراز هویت کاربر ───

export interface AuthUser {
  id: string;
  phone: string;
  fullName: string | null;
  avatarColor: string;
  role: string;
  status: string;
  jti: string;
}

/**
 * استخراج و اعتبارسنجی کاربر از توکن + بررسی سشن معتبر در دیتابیس
 */
export async function getUser(req: NextRequest): Promise<AuthUser | null> {
  const token = getCookie(req, "shahryar_token");
  if (!token) return null;
  const payload = verifyJwt(token);
  if (!payload || payload.type !== "user") return null;

  const session = await db.session.findUnique({
    where: { jti: payload.jti },
    include: {
      user: {
        select: { id: true, phone: true, fullName: true, avatarColor: true, role: true, status: true, restrictedUntil: true },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  if (session.user.status !== "ACTIVE") return null;
  // محدودیت موقت — تا زمان مشخص‌شده دسترسی قطع است
  if (session.user.restrictedUntil && session.user.restrictedUntil > new Date()) return null;

  // به‌روزرسانی آخرین استفاده (غیرمنتظر — fail-safe)
  db.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  return { ...session.user, jti: payload.jti };
}

// ─── احراز هویت مدیر ───

export interface AuthAdmin {
  id: string;
  username: string;
  name: string;
  role: string;
  jti: string;
}

export async function getAdmin(req: NextRequest): Promise<AuthAdmin | null> {
  const token = getCookie(req, "shahryar_admin_token");
  if (!token) return null;
  const payload = verifyJwt(token);
  if (!payload || payload.type !== "admin") return null;

  const session = await db.adminSession.findUnique({
    where: { jti: payload.jti },
    include: {
      admin: {
        select: { id: true, username: true, name: true, role: true, isActive: true },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  if (!session.admin.isActive) return null;

  return { ...session.admin, jti: payload.jti };
}

// ─── گیت نقش ادمین (RBAC) ───

/**
 * گیت نوشتن برای پنل ادمین — نقش VIEWER فقط اجازه «مشاهده» دارد.
 * همه‌ی روت‌های تغییردهنده (POST/PATCH/PUT/DELETE) ادمین باید بعد از
 * getAdmin این گیت را صدا بزنند؛ وگرنه ادمینِ فقط-بیننده می‌تواند
 * انجمن بسازد، کاربر را مسدود کند یا تنظیمات سیستم را تغییر دهد.
 * (استثنا: تغییر رمزِ خودِ ادمین — auth/change-password)
 */
export function assertWritableAdmin(admin: AuthAdmin): ReturnType<typeof fail> | null {
  if (admin.role === "VIEWER") {
    return fail("نقش «بیننده» فقط اجازه مشاهده دارد؛ تغییر داده‌ها ممکن نیست", 403);
  }
  return null;
}

// ─── ابزار عمومی ───

export async function parseJson<T = Record<string, unknown>>(req: NextRequest | Request): Promise<T | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

// ─── گیت ماژول‌های اپ (CMS) ───
// روت‌های ماژول‌دار باید بعد از getUser این تابع را صدا بزنند:
//   const gate = await guardModule("finance");
//   if (gate) return gate;
// اگر ماژول فعال باشد null برمی‌گرداند؛ وگرنه پاسخ 403 فارسی آماده است.

/**
 * بررسی فعال‌بودن ماژول (و اختیاری: یک فلگ boolean از کانفیگش).
 * configKey فقط برای فلگ‌های boolean است؛ محدودیت‌های عددی
 * (مثل maxAccounts/maxActiveGoals) در روت مربوطه اعمال می‌شوند.
 */
export async function guardModule(
  moduleKey: string,
  configKey?: string
): Promise<ReturnType<typeof fail> | null> {
  const { getModuleState } = await import("@/lib/modules/cms/service");
  const state = await getModuleState(moduleKey);
  if (!state) return null; // ماژول تعریف‌نشده = محدودیتی نیست
  if (!state.isEnabled) {
    return fail(`بخش «${state.name}» توسط مدیریت سامانه غیرفعال شده است`, 403);
  }
  if (configKey && state.config[configKey] === false) {
    return fail("این قابلیت توسط مدیریت سامانه غیرفعال شده است", 403);
  }
  return null;
}

export function userAgentFrom(req: NextRequest): string {
  return req.headers.get("user-agent") || "";
}

export function detectDevice(ua: string): string {
  if (/mobile|android|iphone/i.test(ua)) return "موبایل";
  if (/tablet|ipad/i.test(ua)) return "تبلت";
  return "دسکتاپ";
}
