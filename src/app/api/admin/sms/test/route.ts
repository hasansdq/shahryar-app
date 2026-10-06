// ═══ تست اتصال پنل ملی‌پیامک — POST /api/admin/sms/test ═══
// دو حالت:
//   بدنه خالی/ناقص {} → تست اعتبارنامه ذخیره‌شده (GetCredit واقعی)
//   {username, password} → تست اعتبارنامه تازه قبل از ذخیره
// مطابق مستند رسمی: POST https://rest.payamak-panel.com/api/SendSMS/GetCredit
// ═══════════════════════════════════════════════════════════════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getAdmin, assertWritableAdmin } from "@/lib/core/api";
import { decryptSecret, recordSmsTest } from "@/lib/core/sms-settings";
import { checkMelipayamakCredit } from "@/lib/core/sms";
import { logActivity } from "@/lib/core/logger";
import { rateLimit } from "@/lib/core/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی مدیر لازم است", 401);
    const writeGate = assertWritableAdmin(admin);
    if (writeGate) return writeGate;

    const rl = rateLimit(`sms-test:${admin.id}`, 6, 5 * 60 * 1000); // ۶ تست در ۵ دقیقه
    if (!rl.allowed) return fail(`تست‌های زیاد. ${rl.retryAfterSec} ثانیه دیگر تلاش کنید`, 429);

    const body = (await parseJson<{ username?: string; password?: string }>(req)) || {};
    const freshUser = (body.username || "").trim();
    const freshPass = (body.password || "").trim();

    let creds: { username: string; password: string };
    let mode: "fresh" | "saved" = "saved";

    if (freshUser && freshPass) {
      // حالت ۱: تست اعتبارنامه تازه تایپ‌شده (قبل از ذخیره)
      creds = { username: freshUser, password: body.password! };
      mode = "fresh";
    } else {
      // حالت ۲: تست اعتبارنامه ذخیره‌شده — نیازمند نام کاربری + رمز ذخیره‌شده
      const row = await db.smsSetting.findUnique({ where: { id: "main" } });
      const savedUser = (row?.username || "").trim();
      const savedPass = row?.passwordEnc ? decryptSecret(row.passwordEnc) : null;
      if (!savedUser || !savedPass) {
        return fail("ابتدا نام کاربری و رمز عبور پنل پیامک را ذخیره کنید");
      }
      creds = { username: savedUser, password: savedPass };
    }

    const result = await checkMelipayamakCredit(creds);

    // ثبت نتیجه در بنر وضعیت + لاگ فعالیت با تفکیک حالت
    await recordSmsTest(result.ok);
    await logActivity({
      action: mode === "fresh" ? "admin.sms_test_fresh" : "admin.sms_test_saved",
      entity: "sms_setting",
      entityId: "main",
      details: {
        ok: result.ok,
        username: creds.username,
        error: result.error,
        latencyMs: result.latencyMs,
      },
      level: result.ok ? "info" : "warning",
    });

    if (!result.ok) {
      return ok({ ok: false, error: result.error, latencyMs: result.latencyMs });
    }

    return ok({
      ok: true,
      credit: result.credit,
      latencyMs: result.latencyMs,
      message: `اتصال برقرار است — اعتبار پنل: ${result.credit} تومان`,
    });
  } catch (err) {
    console.error("خطای تست اتصال پیامک:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
