// ═══ پنل مدیریت رئیس انجمن — GET / PATCH /api/forums/[id]/manage ═════
// GET  : داشبورد مدیریت — درخواست‌ها، اعضا، آمار
// PATCH: ویرایش توضیح انجمن + تنظیمات ایجنت (نام/خوش‌آمدگویی/دستورالعمل/فعال‌بودن)
// فقط رئیس انجمن (یا مدیر سامانه از مسیر admin)
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { MAX_DESCRIPTION, getManageData, loadForumForUser } from "@/lib/modules/forums/service";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("forums");
    if (gate) return gate;

    const { id } = await ctx.params;
    const loaded = await loadForumForUser(id, auth.id);
    if (!loaded) return fail("انجمن یافت نشد", 404);
    if (loaded.forum.chairId !== auth.id) return fail("پنل مدیریت فقط برای رئیس انجمن قابل دسترسی است", 403);

    const data = await getManageData(id);
    return ok(data);
  } catch (err) {
    console.error("خطای داشبورد مدیریت انجمن:", err);
    return fail("خطای داخلی سرور", 500);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("forums");
    if (gate) return gate;

    const { id } = await ctx.params;
    const loaded = await loadForumForUser(id, auth.id);
    if (!loaded) return fail("انجمن یافت نشد", 404);
    if (loaded.forum.chairId !== auth.id) return fail("این تنظیمات فقط توسط رئیس انجمن قابل تغییر است", 403);

    const body = await parseJson<{
      description?: string;
      agentEnabled?: boolean;
      agentName?: string;
      agentGreeting?: string;
      agentInstructions?: string;
    }>(req);

    const data: Record<string, unknown> = {};
    if (body?.description !== undefined) {
      data.description = body.description.trim().slice(0, MAX_DESCRIPTION) || null;
    }
    if (body?.agentEnabled !== undefined) data.agentEnabled = !!body.agentEnabled;
    if (body?.agentName !== undefined) data.agentName = body.agentName.trim().slice(0, 60) || null;
    if (body?.agentGreeting !== undefined) data.agentGreeting = body.agentGreeting.trim().slice(0, 400) || null;
    if (body?.agentInstructions !== undefined) {
      data.agentInstructions = body.agentInstructions.trim().slice(0, 2000) || null;
    }

    if (Object.keys(data).length === 0) return fail("تغییری ارسال نشده است");

    await db.forum.update({ where: { id }, data });

    await logActivity({
      userId: auth.id,
      action: "forum.settings_updated",
      entity: "forum",
      entityId: id,
      details: { fields: Object.keys(data) },
    }).catch(() => {});

    return ok({ message: "تنظیمات انجمن به‌روزرسانی شد" });
  } catch (err) {
    console.error("خطای ویرایش تنظیمات انجمن:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
