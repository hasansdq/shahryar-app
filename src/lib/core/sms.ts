// ═════ کلاینت وب‌سرویس ملی‌پیامک (REST) ═════
// مستند رسمی: rest.payamak-panel.com — احراز هویت با نام کاربری و رمز عبور
// ارسال با الگو (خط خدماتی اشتراکی): BaseServiceNumber {text, to, bodyId}
// ارسال ساده/دستی: SendSMS {to, from, text, isFlash}
// اعتبار سنجی اتصال: GetCredit
// ═══════════════════════════════════════════════════════════════
import { getSmsConfig, resolveSendMode, type SmsSendMode } from "./sms-settings";
import { renderOtpTemplate } from "./otp-template";

// صادرات مجدد برای سازگاری مصرف‌کننده‌های فعلی
export { renderOtpTemplate, DEFAULT_OTP_TEMPLATE } from "./otp-template";

const API_BASE = "https://rest.payamak-panel.com/api/SendSMS";
const TIMEOUT_MS = 12_000;

export interface MelipayamakResult {
  value: string | number;
  retStatus: number;
  strRetStatus: string;
}

/** پیام فارسی خطاهای رایج پنل — اول بر اساس متن وضعیت، بعد کد عددی */
const STATUS_MAP: Record<string, string> = {
  UserNameAndPasswordFailed: "نام کاربری یا رمز عبور پنل پیامک نامعتبر است",
  AccountIsBlocked: "حساب پنل پیامک مسدود شده است",
  InsufficientCredit: "موجودی پنل پیامک کافی نیست",
  InvalidBodyId: "کد الگو (پترن) نامعتبر است یا با خط خدماتی تطبیق ندارد",
  InvalidData: "داده‌های ارسال‌شده نامعتبر است (شماره گیرنده، خط ارسال یا متن پیامک)",
  PublicNumber: "خط ارسال به حساب پنل شما تعلق ندارد؛ خط اختصاصی خود را وارد کنید",
  InvalidNumber: "شماره گیرنده نامعتبر است",
  ServerIsBusy: "سرور ملی‌پیامک پرمشغله است؛ چند لحظه بعد تلاش کنید",
};

const ERROR_MAP: Record<string, string> = {
  "11": "نام کاربری یا رمز عبور پنل پیامک نامعتبر است",
  "12": "حساب پنل پیامک مسدود یا غیرفعال است",
  "13": "مشخصات ارسال کامل نیست (شماره گیرنده/خط/متن)",
  "14": "خط ارسال معتبر نیست یا به این سرویس دسترسی ندارد",
  "15": "موجودی پنل پیامک کافی نیست",
  "16": "کد الگو (پترن) نامعتبر است یا با خط خدماتی تطبیق ندارد",
  "17": "شماره گیرنده در لیست سیاه است یا نامعتبر است",
  "18": "متن پیامک حاوی کلمات فیلترشده است",
  "19": "حجم درخواست زیاد است؛ چند لحظه بعد تلاش کنید",
};

function errorMessage(result: MelipayamakResult): string {
  const status = (result.strRetStatus || "").trim();
  if (status && STATUS_MAP[status]) return STATUS_MAP[status];
  const code = String(result.value ?? "");
  if (ERROR_MAP[code]) return ERROR_MAP[code];
  return `پاسخ ناموفق از پنل پیامک${status ? ` (${status})` : ` (کد ${code || result.retStatus})`}`;
}

/** درخواست POST با بدنه form-urlencoded — مطابق نمونه رسمی ملی‌پیامک */
async function call(
  method: string,
  params: Record<string, string | number | boolean | undefined>,
  creds: { username: string; password: string }
): Promise<MelipayamakResult> {
  const body = new URLSearchParams();
  body.set("username", creds.username);
  body.set("password", creds.password);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") body.set(k, String(v));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/${method}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Accept: "application/json",
      },
      body: body.toString(),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      return { value: `http_${res.status}`, retStatus: -1, strRetStatus: `HTTP ${res.status}` };
    }
    const text = await res.text();
    const json = JSON.parse(text) as {
      Value?: string | number;
      RetStatus?: number;
      StrRetStatus?: string;
      value?: string | number;
      retStatus?: number;
      strRetStatus?: string;
    };
    return {
      value: json.Value ?? json.value ?? "",
      retStatus: Number(json.RetStatus ?? json.retStatus ?? -1),
      strRetStatus: json.StrRetStatus ?? json.strRetStatus ?? "",
    };
  } catch (err) {
    const msg = err instanceof Error && err.name === "AbortError"
      ? "مهلت اتصال به پنل پیامک به پایان رسید"
      : "ارتباط با پنل پیامک برقرار نشد";
    return { value: "network", retStatus: -2, strRetStatus: msg };
  } finally {
    clearTimeout(timer);
  }
}

// ─── ارسال با الگو (BaseServiceNumber) ───

/**
 * ارسال پیامک با الگوی تایید — متغیر اول همیشه «کد» است؛
 * متغیرهای ثابت اضافی (مثل مدت اعتبار) با جداکننده ; الحاق می‌شوند.
 * مطابق مستند: POST /api/SendSMS/BaseServiceNumber با {username, password, text, to, bodyId}
 */
export async function sendPatternSms(
  phone: string,
  code: string,
  extraVars: string[] = []
): Promise<{ ok: boolean; recId?: string; error?: string }> {
  const cfg = await getSmsConfig();
  if (!cfg) return { ok: false, error: "پنل پیامک پیکربندی نشده است" };
  if (!cfg.patternCode) return { ok: false, error: "کد الگو (پترن) تعیین نشده است" };

  const text = [code, ...extraVars].join(";");
  const result = await call(
    "BaseServiceNumber",
    { text, to: phone, bodyId: cfg.patternCode },
    { username: cfg.username, password: cfg.password }
  );

  if (result.retStatus === 1) {
    return { ok: true, recId: String(result.value) };
  }
  return { ok: false, error: errorMessage(result) };
}

// ─── ارسال ساده/دستی (SendSMS) ───

/**
 * ارسال پیامک با متن دلخواه از خط ارسال — روش دستی.
 * مطابق مستند: POST /api/SendSMS/SendSMS با {username, password, to, from, text, isFlash}
 * پاسخ موفق: RetStatus=1 و Value=شناسه پیام (recId)
 */
export async function sendSimpleSms(
  phone: string,
  text: string,
  opts?: { from?: string | null; creds?: { username: string; password: string } }
): Promise<{ ok: boolean; recId?: string; error?: string }> {
  let username: string, password: string, from: string;
  if (opts?.creds) {
    username = opts.creds.username;
    password = opts.creds.password;
    from = (opts.from ?? "").trim();
  } else {
    const cfg = await getSmsConfig();
    if (!cfg) return { ok: false, error: "پنل پیامک پیکربندی نشده است" };
    username = cfg.username;
    password = cfg.password;
    from = (opts?.from ?? cfg.fromNumber ?? "").trim();
  }

  // خط فرستنده برای SendSMS الزامی است — مطابق مستند ملی‌پیامک
  if (!from) return { ok: false, error: "خط ارسال (فرستنده) تعیین نشده است؛ برای روش دستی الزامی است" };
  if (!text.trim()) return { ok: false, error: "متن پیامک خالی است" };

  const result = await call(
    "SendSMS",
    { to: phone, from, text, isFlash: false },
    { username, password }
  );

  if (result.retStatus === 1) {
    return { ok: true, recId: String(result.value) };
  }
  return { ok: false, error: errorMessage(result) };
}

// ─── ارسال‌کننده یکپارچه OTP (انتخاب خودکار روش) ───

export interface OtpSendResult {
  ok: boolean;
  mode?: SmsSendMode;
  recId?: string;
  error?: string;
}

/**
 * ارسال کد تایید با روش فعال پیکربندی‌شده:
 *   کد الگو پر → BaseServiceNumber (ارسال با الگو)
 *   کد الگو خالی → SendSMS (ارسال دستی با متن قالب + خط ارسال)
 * اگر هیچ‌کدام تعیین نشده باشد خطا برمی‌گرداند.
 */
export async function sendOtpSms(phone: string, code: string): Promise<OtpSendResult> {
  const cfg = await getSmsConfig();
  if (!cfg) return { ok: false, error: "پنل پیامک پیکربندی نشده است" };

  const mode = resolveSendMode(cfg);
  if (!mode) {
    return { ok: false, error: "هیچ روش ارسالی تعیین نشده؛ کد الگو یا خط ارسال را کامل کنید" };
  }

  if (mode === "pattern") {
    const r = await sendPatternSms(phone, code, cfg.patternVars);
    return r.ok ? { ok: true, mode, recId: r.recId } : { ok: false, mode, error: r.error };
  }

  const text = renderOtpTemplate(cfg.otpTemplate, code);
  const r = await sendSimpleSms(phone, text);
  return r.ok ? { ok: true, mode, recId: r.recId } : { ok: false, mode, error: r.error };
}

// ─── تست اتصال و اعتبار ───

/** بررسی اتصال با دریافت اعتبار — بدون ارسال پیامک */
export async function checkMelipayamakCredit(
  creds?: { username: string; password: string }
): Promise<{ ok: boolean; credit?: string; error?: string; latencyMs: number }> {
  let username: string, password: string;
  if (creds) {
    username = creds.username;
    password = creds.password;
  } else {
    const cfg = await getSmsConfig();
    if (!cfg) return { ok: false, error: "پنل پیامک پیکربندی نشده است", latencyMs: 0 };
    username = cfg.username;
    password = cfg.password;
  }

  const start = Date.now();
  const result = await call("GetCredit", {}, { username, password });
  const latencyMs = Date.now() - start;

  if (result.retStatus === 1) {
    return { ok: true, credit: String(result.value), latencyMs };
  }
  return { ok: false, error: errorMessage(result), latencyMs };
}
