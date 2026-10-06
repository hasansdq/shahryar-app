// ═════ تست اتصال درگاه زرین‌پال — POST /api/admin/tokens/gateway-test ═════
// درخواست پرداخت آزمایشی ۱,۰۰۰ تومانی — موفقیت یعنی مرچنت و شبکه سالم‌اند
// (سفارشی ثبت نمی‌شود؛ authority صرفا دور ریخته می‌شود)
import { NextRequest } from "next/server";
import { ok, fail, getAdmin, assertWritableAdmin } from "@/lib/core/api";
import { getTokenSettings } from "@/lib/modules/tokens/settings";
import { zarinpalRequest, resolveCallbackUrl } from "@/lib/modules/tokens/zarinpal";

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);
    const writeGate = assertWritableAdmin(admin);
    if (writeGate) return writeGate;

    const settings = await getTokenSettings(true);
    const result = await zarinpalRequest({
      config: {
        merchantId: settings.zarinpal.merchantId,
        sandbox: settings.zarinpal.sandbox,
      },
      amountRial: 10_000, // ۱,۰۰۰ تومان — حداقل مبلغ معتبر
      callbackUrl: resolveCallbackUrl(req, settings.zarinpal.callbackUrl),
      description: "تست اتصال درگاه — شهریار",
    });

    return ok({
      ok: result.ok,
      sandbox: settings.zarinpal.sandbox,
      message: result.ok
        ? `اتصال برقرار است ✓ (محیط ${settings.zarinpal.sandbox ? "آزمایشی" : "واقعی"} — درخواست پرداخت آزمایشی پذیرفته شد)`
        : result.error || "درگاه پاسخ معتبر نداد",
    });
  } catch (err) {
    console.error("[admin/tokens/gateway-test] خطا:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
