// ═════ تنظیمات عمومی برنامه (ادمین) — GET/PUT /api/admin/settings ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getAdmin, assertWritableAdmin } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";

// پیش‌فرض‌های برنامه و امنیت — یک‌بار در اولین GET در دیتابیس seed می‌شوند
const DEFAULT_APP = {
  appName: "شهریار",
  city: "رفسنجان",
  province: "کرمان",
  supportPhone: "",
  allowRegistration: true,
  maintenanceMode: false,
  version: "1.0.0",
};
const DEFAULT_SECURITY = {
  maxLoginAttempts: 8,
  lockoutMinutes: 15,
  sessionDays: 30,
  minPasswordLength: 8,
};

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);


    // seed پیش‌فرض‌ها اگر هنوز وجود ندارند (رفع skeleton دائمی تب تنظیمات)
    for (const [key, group, value] of [
      ["app_settings", "app", DEFAULT_APP],
      ["security_settings", "security", DEFAULT_SECURITY],
    ] as const) {
      await db.setting.upsert({
        where: { key },
        update: {},
        create: { key, group, value: JSON.stringify(value) },
      });
    }

    const settings = await db.setting.findMany({
      orderBy: { group: "asc" },
    });

    const grouped: Record<string, Record<string, unknown>> = {};
    for (const s of settings) {
      try {
        grouped[s.group] = grouped[s.group] || {};
        grouped[s.group][s.key] = JSON.parse(s.value);
      } catch {}
    }

    return ok({ settings: grouped });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);
    const writeGate = assertWritableAdmin(admin);
    if (writeGate) return writeGate;

    const body = await parseJson<{
      app?: Record<string, unknown>;
      security?: Record<string, unknown>;
    }>(req);
    if (!body) return fail("درخواست نامعتبر است");

    const map: Record<string, { group: string; value: unknown }> = {};
    if (body.app) map.app_settings = { group: "app", value: body.app };
    if (body.security) map.security_settings = { group: "security", value: body.security };

    for (const [key, cfg] of Object.entries(map)) {
      const current = await db.setting.findUnique({ where: { key } });
      const merged: unknown = current
        ? { ...(JSON.parse(current.value) as Record<string, unknown>), ...(cfg.value as Record<string, unknown>) }
        : cfg.value;
      await db.setting.upsert({
        where: { key },
        update: { value: JSON.stringify(merged) },
        create: { key, group: cfg.group, value: JSON.stringify(merged) },
      });
    }

    await logActivity({
      adminId: admin.id, actorType: "admin",
      action: "admin.settings_update", entity: "setting", level: "warning",
    });

    return ok({ message: "تنظیمات ذخیره شد" });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
