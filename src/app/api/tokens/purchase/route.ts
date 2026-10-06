// ═════ شروع شارژ دلخواه توکن — POST /api/tokens/purchase ═════
// کاربر «مقدار توکن» را وارد می‌کند → قیمت از مبلغ هر ۱M توکن
// محاسبه می‌شود → سفارش + درخواست پرداخت زرین‌پال → آدرس ریدایرکت
import { NextRequest } from "next/server";
import { ok, fail, getUser, parseJson } from "@/lib/core/api";
import { db } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/core/rate-limit";
import { getTokenSettings } from "@/lib/modules/tokens/settings";
import { chargePriceToman } from "@/lib/modules/tokens/types";
import { zarinpalRequest, resolveCallbackUrl } from "@/lib/modules/tokens/zarinpal";
import { logActivity } from "@/lib/core/logger";

interface Body {
  tokens?: number;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);

    // محدودساز نرخ — جلوگیری از بمباران درگاه
    const ip = getClientIp(req);
    const rl = rateLimit(`tokens-purchase:${auth.id}:${ip}`, 6, 60_000);
    if (!rl.allowed) return fail("درخواست‌های بیش از حد؛ کمی صبر کنید", 429);

    const body = await parseJson<Body>(req);
    const tokens = Math.round(Number(body?.tokens));
    if (!Number.isFinite(tokens) || tokens < 1) return fail("مقدار توکن نامعتبر است");

    const settings = await getTokenSettings();
    if (!settings.enabled) return fail("شارژ توکن در حال حاضر غیرفعال است", 403);

    if (tokens < settings.minChargeTokens) {
      return fail(`حداقل مقدار شارژ ${settings.minChargeTokens.toLocaleString("fa-IR")} توکن است`, 400);
    }
    if (tokens > settings.maxChargeTokens) {
      return fail(`حداکثر مقدار شارژ ${settings.maxChargeTokens.toLocaleString("fa-IR")} توکن است`, 400);
    }

    // قیمت پویا: توکن × (مبلغ هر ۱M ÷ ۱٬۰۰۰٬۰۰۰)
    const priceToman = chargePriceToman(tokens, settings.pricePerMillion);
    if (priceToman < 1000) {
      return fail("مبلغ محاسبه‌شده کمتر از حد مجاز درگاه است — مقدار توکن را بیشتر کنید", 400);
    }

    const callbackUrl = resolveCallbackUrl(req, settings.zarinpal.callbackUrl);
    const amountRial = priceToman * 10; // تومان → ریال

    const zp = await zarinpalRequest({
      config: {
        merchantId: settings.zarinpal.merchantId,
        sandbox: settings.zarinpal.sandbox,
      },
      amountRial,
      callbackUrl,
      description: `${settings.zarinpal.description} — ${tokens.toLocaleString("fa-IR")} توکن`,
      mobile: auth.phone,
    });
    if (!zp.ok || !zp.authority || !zp.redirectUrl) {
      return fail(zp.error || "درگاه پرداخت در دسترس نیست", 502);
    }

    // سفارش pending — پس از verify موفق اعتبار می‌گیرد
    const order = await db.paymentOrder.create({
      data: {
        userId: auth.id,
        packageId: null,
        packageTitle: `شارژ دلخواه — ${tokens.toLocaleString("fa-IR")} توکن`,
        tokens,
        bonusTokens: 0,
        priceToman,
        status: "pending",
        gateway: "zarinpal",
        authority: zp.authority,
      },
    });

    await logActivity({
      userId: auth.id,
      action: "tokens.purchase_start",
      entity: "payment_order",
      entityId: order.id,
      details: { tokens, priceToman, pricePerMillion: settings.pricePerMillion },
      ip,
    });

    return ok({ orderId: order.id, redirectUrl: zp.redirectUrl, priceToman, tokens });
  } catch (err) {
    console.error("[tokens/purchase] خطا:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
