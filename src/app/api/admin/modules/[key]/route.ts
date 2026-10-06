// ═════ ویرایش ماژول — PATCH /api/admin/modules/[key] ═════
// بدنه: { name?, description?, isEnabled?, config?, reset? }
// ماژول‌های هسته (isCore) غیرفعال نمی‌شوند.
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getAdmin, assertWritableAdmin } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import {
  getModuleState, sanitizeModuleConfig, defaultModuleConfig, invalidateCmsCache,
} from "@/lib/modules/cms/service";

interface Body {
  name?: string;
  description?: string;
  isEnabled?: boolean;
  config?: Record<string, unknown>;
  reset?: boolean;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);
    const writeGate = assertWritableAdmin(admin);
    if (writeGate) return writeGate;

    const { key } = await params;
    const state = await getModuleState(key);
    if (!state) return fail("ماژول یافت نشد", 404);

    const body = await parseJson<Body>(req);
    if (!body) return fail("درخواست نامعتبر است");

    const data: Record<string, unknown> = {};

    // ─── نام و توضیح ───
    if (body.name !== undefined) {
      const name = body.name.trim().slice(0, 60);
      if (!name) return fail("نام ماژول نمی‌تواند خالی باشد");
      data.name = name;
    }
    if (body.description !== undefined) {
      data.description = body.description.trim().slice(0, 300) || null;
    }

    // ─── فعال/غیرفعال ───
    if (body.isEnabled !== undefined) {
      if (typeof body.isEnabled !== "boolean") return fail("مقدار وضعیت نامعتبر است");
      if (!body.isEnabled && state.isCore) {
        return fail("ماژول‌های هسته (خانه و پروفایل) قابل غیرفعال‌سازی نیستند", 400);
      }
      data.isEnabled = body.isEnabled;
    }

    // ─── کانفیگ ───
    if (body.reset) {
      // بازگردانی کانفیگ به پیش‌فرض‌های سامانه
      data.config = JSON.stringify(defaultModuleConfig(key));
    } else if (body.config && typeof body.config === "object") {
      const current = state.config;
      const { config, errors } = sanitizeModuleConfig(key, body.config);
      if (errors.length > 0) return fail(errors[0], 400);
      // ادغام: فقط کلیدهای ارسال‌شده تغییر می‌کنند
      const merged = { ...current, ...config };
      data.config = JSON.stringify(merged);
    }

    if (Object.keys(data).length === 0) return fail("چیزی برای بروزرسانی نیست");

    const updated = await db.moduleConfig.update({
      where: { key },
      data,
    });

    invalidateCmsCache();

    await logActivity({
      adminId: admin.id,
      actorType: "admin",
      action: body.reset ? "cms.module.reset" : "cms.module.update",
      entity: "moduleConfig",
      entityId: key,
      details: { ...body, key },
      level: "info",
    });

    return ok({
      module: {
        key: updated.key,
        name: updated.name,
        description: updated.description,
        icon: updated.icon,
        isEnabled: updated.isEnabled,
        isCore: updated.isCore,
        config: JSON.parse(updated.config),
        sortOrder: updated.sortOrder,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (err) {
    console.error("خطای ویرایش ماژول:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
