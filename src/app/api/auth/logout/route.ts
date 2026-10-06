// ═════ خروج کاربر — POST /api/auth/logout ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, clearAuthCookie, getCookie, getUser, userAgentFrom } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { getClientIp } from "@/lib/core/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (user) {
      await db.session.updateMany({
        where: { jti: user.jti },
        data: { revokedAt: new Date() },
      });
      await logActivity({
        userId: user.id,
        action: "auth.logout",
        ip: getClientIp(req),
        userAgent: userAgentFrom(req),
      });
    }
    const res = ok({ message: "با موفقیت خارج شدید" });
    clearAuthCookie(res as never, "shahryar_token", req);
    return res;
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
