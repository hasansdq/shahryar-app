// ═══════════════════════════════════════════════════════════════
// لاگر فعالیت شهریار
// ثبت ساختاریافته رویدادها در دیتابیس + کنسول
// ═══════════════════════════════════════════════════════════════
import { db } from "@/lib/db";

export interface LogInput {
  userId?: string | null;
  adminId?: string | null;
  actorType?: "user" | "admin" | "system";
  action: string;
  entity?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  level?: "info" | "warning" | "error";
  ip?: string;
  userAgent?: string;
}

/**
 * ثبت فعالیت در سیستم
 * خطای لاگ هرگز نباید مسیر اصلی را متوقف کند
 */
export async function logActivity(input: LogInput): Promise<void> {
  try {
    await db.activityLog.create({
      data: {
        userId: input.userId ?? undefined,
        adminId: input.adminId ?? undefined,
        actorType: input.actorType ?? "user",
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        details: input.details ? JSON.stringify(input.details).slice(0, 2000) : undefined,
        level: input.level ?? "info",
        ip: input.ip,
        userAgent: input.userAgent?.slice(0, 250),
      },
    });
    if (process.env.NODE_ENV !== "production") {
      console.log(`[LOG] ${input.level ?? "info"} | ${input.action} | user:${input.userId ?? "-"} | admin:${input.adminId ?? "-"}`);
    }
  } catch (err) {
    console.error("خطای ثبت لاگ:", err);
  }
}
