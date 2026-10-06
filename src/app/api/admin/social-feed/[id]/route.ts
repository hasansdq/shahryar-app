// ═══ PATCH /api/admin/social-feed/[id] — اقدام مدیریتی روی پست ═══
// body: { action: "delete" | "restore" | "unpin" }  یا  { reportId, reportAction: "resolve" | "dismiss", resolutionNote? }
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, getAdmin, parseJson, assertWritableAdmin } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);
    const writeGate = assertWritableAdmin(admin);
    if (writeGate) return writeGate;

    const { id } = await ctx.params;
    if (!id || id.length > 40) return fail("شناسه نامعتبر است");

    const post = await db.socialPost.findUnique({ where: { id }, select: { id: true, deletedAt: true, isPinned: true } });
    if (!post) return fail("این پست یافت نشد", 404);

    const body = await parseJson<{ action?: unknown; reportId?: unknown; reportAction?: unknown; resolutionNote?: unknown }>(req);
    if (!body) return fail("درخواست نامعتبر است");

    // ─── اقدام روی پست ───
    const action = typeof body.action === "string" ? body.action : null;
    if (action === "delete") {
      if (post.deletedAt) return fail("این پست قبلاً حذف شده است");
      await db.socialPost.update({ where: { id }, data: { deletedAt: new Date(), isPinned: false, pinnedAt: null } });
      // همه گزارش‌های باز این پست خودکار resolve می‌شوند
      await db.socialPostReport.updateMany({
        where: { postId: id, status: "open" },
        data: { status: "resolved", resolvedById: admin.id, resolvedAt: new Date(), resolutionNote: "پست حذف شد" },
      });
      logActivity({ adminId: admin.id, actorType: "admin", action: "social.admin_post_delete", entity: "social_post", entityId: id }).catch(() => {});
      return ok({ deleted: true });
    }
    if (action === "restore") {
      if (!post.deletedAt) return fail("این پست حذف‌شده نیست");
      await db.socialPost.update({ where: { id }, data: { deletedAt: null } });
      logActivity({ adminId: admin.id, actorType: "admin", action: "social.admin_post_restore", entity: "social_post", entityId: id }).catch(() => {});
      return ok({ restored: true });
    }
    if (action === "unpin") {
      await db.socialPost.update({ where: { id }, data: { isPinned: false, pinnedAt: null } });
      logActivity({ adminId: admin.id, actorType: "admin", action: "social.admin_post_unpin", entity: "social_post", entityId: id }).catch(() => {});
      return ok({ unpinned: true });
    }

    // ─── اقدام روی گزارش ───
    const reportId = typeof body.reportId === "string" ? body.reportId : null;
    const reportAction = typeof body.reportAction === "string" ? body.reportAction : null;
    if (reportId && (reportAction === "resolve" || reportAction === "dismiss")) {
      const report = await db.socialPostReport.findUnique({ where: { id: reportId } });
      if (!report || report.postId !== id) return fail("این گزارش یافت نشد", 404);
      if (report.status !== "open") return fail("این گزارش قبلاً بررسی شده است");
      await db.socialPostReport.update({
        where: { id: reportId },
        data: {
          status: reportAction,
          resolvedById: admin.id,
          resolvedAt: new Date(),
          resolutionNote: typeof body.resolutionNote === "string" ? body.resolutionNote.trim().slice(0, 500) || null : null,
        },
      });
      logActivity({
        adminId: admin.id, actorType: "admin", action: `social.report_${reportAction}`,
        entity: "social_post_report", entityId: reportId, details: { postId: id },
      }).catch(() => {});
      return ok({ reportAction });
    }

    return fail("اقدام نامعتبر است");
  } catch (err) {
    console.error("خطای اقدام مدیریتی فید:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
