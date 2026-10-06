// ═════ اطلاعات مدیر جاری — GET /api/admin/auth/me ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, getAdmin } from "@/lib/core/api";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);

    const full = await db.adminUser.findUnique({
      where: { id: admin.id },
      select: {
        id: true, username: true, name: true, role: true,
        isActive: true, lastLoginAt: true, loginCount: true, createdAt: true,
      },
    });

    return ok({ admin: full });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
