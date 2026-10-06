// ═════ ارسال آزمایشی پیامک OTP — POST /api/admin/sms/test-send ═════
// ارسال واقعی به شماره دلخواه مدیر «با روش ارسال فعال»:
//   کد الگو پر → BaseServiceNumber (الگو) | خالی → SendSMS (دستی + خط ارسال)
// ═══════════════════════════════════════════════════════════════
import { NextRequest } from "next/server";
import { ok, fail, parseJson, getAdmin, assertWritableAdmin } from "@/lib/core/api";
import { normalizePhone } from "@/lib/core/security";
import { sendOtpSms } from "@/lib/core/sms";
import { isSmsReady } from "@/lib/core/sms-settings";
import { logActivity } from "@/lib/core/logger";
import { rateLimit } from "@/lib/core/rate-limit";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی مدیر لازم است", 401);
    const writeGate = assertWritableAdmin(admin);
    if (writeGate) return writeGate;

    const rl = rateLimit(`sms-testsend:${admin.id}`, 4, 5 * 60 * 1000); // ۴ ارسال در ۵ دقیقه
    if (!rl.allowed) return fail(`تست‌های زیاد. ${rl.retryAfterSec} ثانیه دیگر تلاش کنید`, 429);

    if (!(await isSmsReady())) {
      return fail(
        "پنل پیامک آماده نیست. ابتدا اعتبارنامه و روش ارسال (کد الگو یا خط ارسال) را کامل و فعال کنید"
      );
    }

    const body = await parseJson<{ to: string }>(req);
    const to = normalizePhone(body?.to || "");
    if (!to) return fail("شماره موبایل مقصد معتبر نیست");

    const code = String(crypto.randomInt(100000, 1000000));
    const result = await sendOtpSms(to, code);
    const modeLabel = result.mode === "pattern" ? "الگو (پترن)" : result.mode === "simple" ? "دستی" : "";

    await logActivity({
      action: "admin.sms_test_send",
      entity: "sms_setting",
      details: { to, ok: result.ok, mode: result.mode, error: result.error },
      level: result.ok ? "info" : "warning",
    });

    if (!result.ok) return ok({ ok: false, mode: result.mode, error: result.error });

    return ok({
      ok: true,
      mode: result.mode,
      recId: result.recId,
      message: `پیامک آزمایشی به ${to} با روش ${modeLabel} ارسال شد (کد: ${code})`,
    });
  } catch (err) {
    console.error("خطای ارسال آزمایشی:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
