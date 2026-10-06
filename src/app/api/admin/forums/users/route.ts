// ═══ جستجوی کاربران برای انتخاب رئیس — GET /api/admin/forums/users?q= ═════
// جستجوی سبک (نام/شماره) — فقط برای فرم ایجاد/ویرایش انجمن در پنل CMS
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, getAdmin } from "@/lib/core/api";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);

    const q = (new URL(req.url).searchParams.get("q") || "").trim();
    if (q.length < 2) return ok({ users: [] });

    const users = await db.user.findMany({
      where: {
        status: "ACTIVE",
        OR: [{ fullName: { contains: q } }, { phone: { contains: q } }],
      },
      orderBy: { lastLoginAt: "desc" },
      take: 8,
      select: {
        id: true,
        fullName: true,
        phone: true,
        avatarUrl: true,
        avatarColor: true,
        socialProfile: { select: { headline: true } },
      },
    });

    return ok({
      users: users.map((u) => ({
        id: u.id,
        name: u.fullName || "کاربر شهریار",
        phone: u.phone,
        avatarUrl: u.avatarUrl,
        avatarColor: u.avatarColor,
        headline: u.socialProfile?.headline ?? null,
      })),
    });
  } catch (err) {
    console.error("خطای جستجوی کاربران (انجمن):", err);
    return fail("خطای داخلی سرور", 500);
  }
}
