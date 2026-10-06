// ═══════════════════════════════════════════════════════════════
// درگاه پرداخت زرین‌پال — Payment Gateway REST v4
//
// جریان خرید:
//  1) request.json → authority (شناسه ۳۶کاراکتری)
//  2) ریدایرکت کاربر به /pg/StartPay/{authority}
//  3) بازگشت به callback با Authority و Status
//  4) verify.json → code=100 موفق | 101 قبلاً تأییدشده | بقیه خطا
//
// نکته‌ها:
//  • مبالغ API به «ریال»اند؛ بسته‌ها به تومان ذخیره می‌شوند (×۱۰)
//  • sandbox: مرچنت ۳۶کاراکتری آزمایشی + پایه sandbox.zarinpal.com
//  • timeout کوتاه و پیام خطای فارسی دقیق
// ═══════════════════════════════════════════════════════════════

export interface ZarinpalConfig {
  merchantId: string;
  sandbox: boolean;
}

export interface ZarinpalRequestResult {
  ok: boolean;
  authority?: string;
  redirectUrl?: string;
  error?: string;
}

export interface ZarinpalVerifyResult {
  ok: boolean;
  refId?: string;
  cardPan?: string;
  alreadyVerified?: boolean;
  error?: string;
}

const REQUEST_TIMEOUT_MS = 15_000;

function baseUrl(sandbox: boolean): string {
  return sandbox ? "https://sandbox.zarinpal.com" : "https://www.zarinpal.com";
}

async function zarinpalFetch(url: string, body: object): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** اعتبارسنجی مرچنت — ۳۶ کاراکتر UUID */
export function isValidMerchantId(merchantId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(merchantId.trim());
}

/**
 * درخواست پرداخت — مبلغ به «ریال»
 * خروجی موفق: authority + redirectUrl آماده هدایت کاربر
 */
export async function zarinpalRequest(params: {
  config: ZarinpalConfig;
  amountRial: number;
  callbackUrl: string;
  description: string;
  mobile?: string;
}): Promise<ZarinpalRequestResult> {
  const { config, amountRial, callbackUrl, description } = params;
  if (!isValidMerchantId(config.merchantId)) {
    return { ok: false, error: "شناسه پذیرنده زرین‌پال تنظیم نشده است (۳۶ کاراکتر)" };
  }
  if (!Number.isFinite(amountRial) || amountRial < 1000) {
    return { ok: false, error: "مبلغ پرداخت نامعتبر است (حداقل ۱۰۰ ریال)" };
  }
  if (!/^https?:\/\/.{3,}/.test(callbackUrl)) {
    return { ok: false, error: "آدرس بازگشت (Callback) نامعتبر است" };
  }

  const json = await zarinpalFetch(`${baseUrl(config.sandbox)}/pg/v4/payment/request.json`, {
    merchant_id: config.merchantId.trim(),
    amount: Math.round(amountRial),
    callback_url: callbackUrl,
    description: description.slice(0, 500),
    ...(params.mobile ? { metadata: { mobile: params.mobile } } : {}),
  });

  if (!json) return { ok: false, error: "ارتباط با درگاه زرین‌پال برقرار نشد — بعداً تلاش کنید" };

  const data = json.data as Record<string, unknown> | undefined;
  const authority = typeof data?.authority === "string" ? data.authority : undefined;
  const code = Number(data?.code);

  if (authority && (code === 100 || code === 101) && authority.length >= 30) {
    return {
      ok: true,
      authority,
      redirectUrl: `${baseUrl(config.sandbox)}/pg/StartPay/${authority}`,
    };
  }

  // خطای رسمی زرین‌پال
  const errors = json.errors as Array<Record<string, unknown>> | Record<string, unknown> | undefined;
  let detail = `درگاه پرداخت درخواست را نپذیرفت (کد ${code || "؟"})`;
  if (Array.isArray(errors) && errors[0]) {
    detail = `خطای زرین‌پال ${errors[0].code ?? ""}: ${errors[0].message ?? "نامشخص"}`;
  } else if (errors && !Array.isArray(errors) && (errors as { message?: string }).message) {
    detail = `خطای زرین‌پال: ${(errors as { message?: string }).message}`;
  }
  return { ok: false, error: detail };
}

/**
 * تأیید پرداخت — دقیقاً همان مبلغ درخواست باید ارسال شود.
 * code=100 موفق | code=101 قبلاً تأیید شده (idempotent)
 */
export async function zarinpalVerify(params: {
  config: ZarinpalConfig;
  amountRial: number;
  authority: string;
}): Promise<ZarinpalVerifyResult> {
  const { config, amountRial, authority } = params;
  if (!config.merchantId) return { ok: false, error: "شناسه پذیرنده تنظیم نشده است" };

  const json = await zarinpalFetch(`${baseUrl(config.sandbox)}/pg/v4/payment/verify.json`, {
    merchant_id: config.merchantId.trim(),
    amount: Math.round(amountRial),
    authority,
  });

  if (!json) return { ok: false, error: "ارتباط با درگاه برای تأیید پرداخت برقرار نشد" };

  const data = json.data as Record<string, unknown> | undefined;
  const code = Number(data?.code);
  const refId = data?.ref_id !== undefined ? String(data.ref_id) : undefined;
  const cardPan = typeof data?.card_pan === "string" ? (data.card_pan as string) : undefined;

  if (code === 100) return { ok: true, refId, cardPan };
  if (code === 101) return { ok: true, refId, cardPan, alreadyVerified: true };

  const errors = json.errors as Array<Record<string, unknown>> | undefined;
  const detail = Array.isArray(errors) && errors[0]
    ? `تأیید پرداخت ناموفق — ${errors[0].message ?? code}`
    : `تأیید پرداخت ناموفق (کد ${code ?? "؟"})`;
  return { ok: false, error: detail };
}

/** استنتاج آدرس بازگشت از هدرهای درخواست (پشت پروکسی Caddy) */
export function resolveCallbackUrl(
  req: Request,
  configuredUrl: string,
  path = "/api/tokens/verify"
): string {
  if (configuredUrl) return configuredUrl;
  const h = req.headers;
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  const host =
    h.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    h.get("host") ||
    new URL(req.url).host;
  return `${proto}://${host}${path}`;
}
