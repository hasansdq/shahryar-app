// ═════ خروج مدیر — POST /api/admin/auth/logout ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, clearAuthCookie, getAdmin, userAgentFrom } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { getClientIp } from "@/lib/core/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (admin) {
      await db.adminSession.updateMany({
        where: { jti: admin.jti },
        data: { revokedAt: new Date() },
      });
      await logActivity({
        adminId: admin.id,
        actorType: "admin",
        action: "admin.logout",
        ip: getClientIp(req),
        userAgent: userAgentFrom(req),
      });
    }
    const res = ok({ message: "با موفقیت خارج شدید" });
    clearAuthCookie(res as never, "shahryar_admin_token", req);
    return res;
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
