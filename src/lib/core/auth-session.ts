// ═════ ساخت سشن کاربر و بلیت دومرحله‌ای ═════
// الگوی مشترک برای همه مسیرهای ورود (OTP / رمز دومرحله‌ای / ثبت‌نام)
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, setAuthCookie, userAgentFrom, detectDevice } from "./api";
import { signJwt, verifyJwt, generateJti } from "./security";
import { logActivity } from "./logger";
import type { OtpPurpose } from "./otp";

const SESSION_TTL_SEC = 60 * 60 * 24 * 30; // ۳۰ روز
const TICKET_TTL_SEC = 5 * 60; // بلیت مرحله رمز: ۵ دقیقه

export interface PublicUser {
  id: string;
  phone: string;
  fullName: string | null;
  avatarColor: string;
  avatarUrl: string | null;
  role: string;
  createdAt: Date;
}

/** ورود کامل: ساخت سشن + توکن + کوکی + به‌روزرسانی آمار ورود */
export async function completeLogin(
  req: NextRequest,
  user: { id: string; phone: string; fullName: string | null; avatarColor: string; avatarUrl: string | null; role: string; createdAt: Date },
  action: string
): Promise<NextResponse> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const ua = userAgentFrom(req);
  const jti = generateJti();
  const token = signJwt({ sub: user.id, jti, type: "user", role: user.role }, SESSION_TTL_SEC);

  await db.session.create({
    data: {
      jti,
      userId: user.id,
      ip,
      userAgent: ua,
      device: detectDevice(ua),
      expiresAt: new Date(Date.now() + SESSION_TTL_SEC * 1000),
    },
  });

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
  });

  await logActivity({ userId: user.id, action, entity: "user", entityId: user.id, ip, userAgent: ua });

  const res = ok({ user });
  setAuthCookie(res as never, "shahryar_token", token, SESSION_TTL_SEC, req);
  return res;
}

/** صدور بلیت کوتاه‌عمر پس از تایید OTP برای کاربران دارای رمز دومرحله‌ای */
export function issueOtpTicket(userId: string, phone: string, purpose: OtpPurpose): string {
  return signJwt({ sub: userId, jti: `ticket-${Date.now()}`, type: "otp-ticket", role: purpose }, TICKET_TTL_SEC);
}

/** اعتبارسنجی بلیت — خروجی شناسه کاربر یا null */
export function readOtpTicket(token: string): { userId: string; purpose: string } | null {
  const payload = verifyJwt(token);
  if (!payload || payload.type !== "otp-ticket") return null;
  return { userId: payload.sub, purpose: payload.role || "LOGIN" };
}

/** پاسخ استاندارد خطا */
export const authFail = (message: string, status = 400) => fail(message, status);
