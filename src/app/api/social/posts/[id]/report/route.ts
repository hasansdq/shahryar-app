// ═══ POST /api/social/posts/[id]/report — گزارش تخلف پست ═══
// ═══ DELETE /api/social/posts/[id]/report — برداشتن گزارش ═══
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, getUser, guardModule, parseJson } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { REPORT_REASONS, type ReportReason } from "@/lib/modules/social/feed-service";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("social");
    if (gate) return gate;

    const { id } = await ctx.params;
    if (!id || id.length > 40) return fail("شناسه پست نامعتبر است");

    const post = await db.socialPost.findUnique({ where: { id }, select: { deletedAt: true } });
    if (!post || post.deletedAt) return fail("این پست یافت نشد", 404);

    const body = await parseJson<{ reason?: unknown; note?: unknown }>(req);
    const reason = String(body?.reason || "");
    if (!(REPORT_REASONS as readonly string[]).includes(reason)) {
      return fail("دلیل گزارش نامعتبر است");
    }
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : null;

    // هر کاربر هر پست یک‌بار — upsert که reason قابل به‌روزرسانی باشد
    await db.socialPostReport.upsert({
      where: { postId_reporterId: { postId: id, reporterId: auth.id } },
      create: { postId: id, reporterId: auth.id, reason: reason as ReportReason, note, status: "open" },
      update: { reason: reason as ReportReason, note, status: "open" },
    });

    logActivity({
      userId: auth.id,
      action: "social.post_report",
      entity: "social_post",
      entityId: id,
      details: { reason },
    }).catch(() => {});

    return ok({ reported: true });
  } catch (err) {
    console.error("خطای گزارش پست:", err);
    return fail("خطای داخلی سرور", 500);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("social");
    if (gate) return gate;

    const { id } = await ctx.params;
    await db.socialPostReport.deleteMany({ where: { postId: id, reporterId: auth.id } });
    return ok({ reported: false });
  } catch (err) {
    console.error("خطای حذف گزارش:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
