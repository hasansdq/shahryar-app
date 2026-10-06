// ═════ تغییر اعتبارنامه مدیر — POST /api/admin/auth/change-password ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getAdmin, clearAuthCookie, userAgentFrom } from "@/lib/core/api";
import { verifyPassword, hashPassword, isStrongPassword } from "@/lib/core/security";
import { logActivity } from "@/lib/core/logger";
import { rateLimit, getClientIp } from "@/lib/core/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);

    const rl = rateLimit(`admin-chpass:${admin.id}`, 5, 30 * 60 * 1000);
    if (!rl.allowed) return fail("تلاش‌های زیاد. بعداً تلاش کنید", 429);

    const body = await parseJson<{
      currentPassword: string; newPassword: string;
      newUsername?: string; newName?: string;
    }>(req);
    if (!body?.currentPassword || !body?.newPassword) {
      return fail("رمز فعلی و جدید الزامی است");
    }

    const adminUser = await db.adminUser.findUnique({ where: { id: admin.id } });
    if (!adminUser || !verifyPassword(body.currentPassword, adminUser.passwordHash)) {
      return fail("رمز عبور فعلی اشتباه است", 401);
    }

    const check = isStrongPassword(body.newPassword);
    if (!check.ok) return fail(check.message!);

    // تغییر نام کاربری اختیاری
    const data: Record<string, unknown> = { passwordHash: hashPassword(body.newPassword) };
    if (body.newUsername?.trim() && body.newUsername.trim() !== adminUser.username) {
      const exists = await db.adminUser.findUnique({ where: { username: body.newUsername.trim() } });
      if (exists) return fail("این نام کاربری قبلاً استفاده شده است");
      data.username = body.newUsername.trim();
    }
    if (body.newName?.trim()) {
      data.name = body.newName.trim().slice(0, 60);
    }

    await db.adminUser.update({ where: { id: admin.id }, data });

    // ابطال همه سشن‌ها — ورود مجدد الزامی
    await db.adminSession.updateMany({
      where: { adminId: admin.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await logActivity({
      adminId: admin.id,
      actorType: "admin",
      action: "admin.credentials_change",
      level: "warning",
      details: { usernameChanged: !!data.username },
      ip: getClientIp(req),
      userAgent: userAgentFrom(req),
    });

    const res = ok({ message: "اعتبارنامه با موفقیت تغییر کرد. لطفاً دوباره وارد شوید" });
    clearAuthCookie(res as never, "shahryar_admin_token", req);
    return res;
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
