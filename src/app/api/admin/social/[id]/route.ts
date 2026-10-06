// ═══ ویرایش پروفایل شبکه/ایجنت (ادمین) — PATCH /api/admin/social/[id] ═══
// id = شناسه کاربر (userId) — تیک آبی، کشف‌پذیری، فعال/غیرفعال‌سازی ایجنت، ویرایش تنظیمات ایجنت
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getAdmin, assertWritableAdmin } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";

const AGENT_STYLES = ["professional", "friendly", "marketing", "technical", "creative"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);
    const writeGate = assertWritableAdmin(admin);
    if (writeGate) return writeGate;

    const { id } = await params;
    const user = await db.user.findUnique({ where: { id } });
    if (!user) return fail("کاربر یافت نشد", 404);

    const body = await parseJson<{
      isVerified?: boolean;
      isDiscoverable?: boolean;
      agentEnabled?: boolean;
      agentName?: string;
      agentGreeting?: string;
      agentStyle?: string;
      agentInstructions?: string;
      agentForbidden?: string;
    }>(req);
    if (!body) return fail("درخواست نامعتبر است");

    const actions: string[] = [];

    // ─── تیک آبی کاربر ───
    if (typeof body.isVerified === "boolean") {
      await db.user.update({
        where: { id },
        data: { isVerified: body.isVerified, verifiedAt: body.isVerified ? new Date() : null },
      });
      actions.push(body.isVerified ? "تیک آبی فعال شد" : "تیک آبی برداشته شد");
    }

    // ─── تنظیمات پروفایل شبکه / ایجنت ───
    const profileData: Record<string, unknown> = {};
    if (typeof body.isDiscoverable === "boolean") profileData.isDiscoverable = body.isDiscoverable;
    if (typeof body.agentEnabled === "boolean") profileData.agentEnabled = body.agentEnabled;
    if (body.agentName?.trim()) profileData.agentName = body.agentName.trim().slice(0, 40);
    if (body.agentGreeting !== undefined) profileData.agentGreeting = body.agentGreeting.slice(0, 300);
    if (body.agentStyle && AGENT_STYLES.includes(body.agentStyle)) profileData.agentStyle = body.agentStyle;
    if (body.agentInstructions !== undefined) profileData.agentInstructions = body.agentInstructions.slice(0, 2000);
    if (body.agentForbidden !== undefined) profileData.agentForbidden = body.agentForbidden.slice(0, 1000);

    if (Object.keys(profileData).length) {
      await db.socialProfile.upsert({
        where: { userId: id },
        update: profileData,
        create: { userId: id, ...profileData },
      });
      if (typeof body.agentEnabled === "boolean") actions.push(body.agentEnabled ? "ایجنت فعال شد" : "ایجنت غیرفعال شد");
      if (typeof body.isDiscoverable === "boolean") actions.push(body.isDiscoverable ? "در دایرکتوری نمایان شد" : "از دایرکتوری پنهان شد");
    }

    await logActivity({
      adminId: admin.id, actorType: "admin",
      action: "admin.social_update", entity: "social_profile", entityId: id,
      details: { actions, ...body },
    });

    return ok({ message: actions.length ? actions.join("، ") : "چیزی تغییر نکرد" });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
