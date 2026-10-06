// ═════ تنظیمات پنل پیامک — GET / PUT /api/admin/sms ═════
// GET: وضعیت فعلی (رمز عبور هرگز بازگشت داده نمی‌شود)
// PUT: ذخیره پیکربندی — رمز فقط وقتی ارسال شود تغییر می‌کند
// روش ارسال OTP: کد الگو (پترن) پر → الگو | خالی → دستی (نیازمند خط ارسال)
// ═══════════════════════════════════════════════════════════════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getAdmin, assertWritableAdmin } from "@/lib/core/api";
import { saveSmsSettings, isSmsEncKeyAvailable } from "@/lib/core/sms-settings";
import { logActivity } from "@/lib/core/logger";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی مدیر لازم است", 401);


    const row = await db.smsSetting.findUnique({ where: { id: "main" } });
    // ⚠️ هرگز null برنگردان — رکورد نبود یعنی «پیکربندی نشده»، نه «بی‌شکل».
    // null باعث می‌شد فرم پنل پیامکی برای همیشه در حالت اسکلتون بماند.
    // encKeyOk: در production اگر SMS_ENC_KEY از env نیامده باشد، ادمین
    // باید پیش از ذخیره/فعال‌سازی بداند (رمز ذخیره‌شده بعد از ری‌استارت
    // غیرقابل رمزگشایی می‌شود).
    return ok({
      encKeyOk: isSmsEncKeyAvailable(),
      settings: {
        username: row?.username || "",
        hasPassword: !!row?.passwordEnc,
        fromNumber: row?.fromNumber || "",
        patternCode: row?.patternCode || "",
        patternVars: row?.patternVars || "",
        otpTemplate: row?.otpTemplate || "",
        enabled: row?.enabled ?? false,
        lastTestAt: row?.lastTestAt ?? null,
        lastTestOk: row?.lastTestOk ?? null,
        updatedAt: row?.updatedAt ?? null,
      },
    });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی مدیر لازم است", 401);
    const writeGate = assertWritableAdmin(admin);
    if (writeGate) return writeGate;

    const body = await parseJson<{
      username?: string;
      password?: string; // خالی = بدون تغییر
      fromNumber?: string;
      patternCode?: string;
      patternVars?: string;
      otpTemplate?: string;
      enabled?: boolean;
    }>(req);
    if (!body) return fail("درخواست نامعتبر است");

    // رمز جدید ارسال شده → کلید رمزنگاری الزامی است (در production فقط از
    // env؛ تولید موقتی ممنوع — بعد از ری‌استارت رمزگشایی می‌شکند)
    if (body.password && !isSmsEncKeyAvailable()) {
      return fail(
        "کلید رمزنگاری پیامک (SMS_ENC_KEY) روی سرور تعریف نشده است — ابتدا در .env.docker مقدار openssl rand -hex 32 را قرار دهید و کانتینر را ری‌استارت کنید",
        500
      );
    }

    // اگر فعال‌سازی خواسته شده، اعتبارنامه کامل + حداقل یکی از دو روش ارسال لازم است
    if (body.enabled) {
      const row = await db.smsSetting.findUnique({ where: { id: "main" } });
      const username = (body.username ?? row?.username ?? "").trim();
      const patternCode = (body.patternCode ?? row?.patternCode ?? "").trim();
      const fromNumber = (body.fromNumber ?? row?.fromNumber ?? "").trim();
      const hasPass = !!body.password || !!row?.passwordEnc;

      if (!username || !hasPass) {
        return fail("برای فعال‌سازی، نام کاربری و رمز عبور پنل پیامک الزامی است");
      }
      // روش ارسال: یا کد الگو (BaseServiceNumber) یا خط ارسال (SendSMS دستی)
      if (!patternCode && !fromNumber) {
        return fail(
          "برای فعال‌سازی یکی از دو روش ارسال را کامل کنید: «کد الگو (پترن)» یا «خط ارسال» برای روش دستی"
        );
      }
      if (!patternCode && fromNumber && !/^\d{4,15}$/.test(fromNumber)) {
        return fail("خط ارسال معتبر نیست (فرمت صحیح: رقم‌های خط، مثل 50004046)");
      }
    }

    const row = await saveSmsSettings({
      username: body.username,
      password: body.password,
      fromNumber: body.fromNumber,
      patternCode: body.patternCode,
      patternVars: body.patternVars,
      otpTemplate: body.otpTemplate,
      enabled: body.enabled,
    });

    await logActivity({
      action: "admin.sms_settings_saved",
      entity: "sms_setting",
      entityId: "main",
      details: {
        enabled: row.enabled,
        hasPassword: !!row.passwordEnc,
        // روش ارسال فعال: pattern = الگو | simple = دستی
        sendMode: row.patternCode ? "pattern" : row.fromNumber ? "simple" : "none",
      },
      level: "warning",
    });

    return ok({
      settings: {
        username: row.username || "",
        hasPassword: !!row.passwordEnc,
        fromNumber: row.fromNumber || "",
        patternCode: row.patternCode || "",
        patternVars: row.patternVars || "",
        otpTemplate: row.otpTemplate || "",
        enabled: row.enabled,
        lastTestAt: row.lastTestAt,
        lastTestOk: row.lastTestOk,
        updatedAt: row.updatedAt,
      },
    });
  } catch (err) {
    console.error("خطای ذخیره تنظیمات پیامک:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
