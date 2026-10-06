// ═══════════════════════════════════════════════════════════════
// هسته امنیتی شهریار
// JWT (HS256) + هش رمز عبور scrypt + ابزارهای امنیتی
// بدون وابستگی خارجی — مبتنی بر crypto داخلی Node
// ═══════════════════════════════════════════════════════════════
import crypto from "crypto";

// ─── کلید امضای توکن ───
// JWT_SECRET الزامی است؛ در production بدون آن هر عملیات امضا/اعتبارسنجی
// fail-closed خطا می‌دهد تا هیچ استقراری با کلید عمومیِ سورس‌کد امضا نکند
// (جعل توکن/بلیت OTP).
//
// ⚠️ چرا «تنبل» (lazy) است و نه در زمان import ماژول:
//  • مرحله‌ی build ایمیج Docker با NODE_ENV=production و «بدون JWT_SECRET»
//    اجرا می‌شود (کلید واقعی فقط در زمان اجرا از env_file تزریق می‌شود و
//    هرگز وارد ایمیج نمی‌شود). ارزیابی در زمان لود ماژول یعنی شکست build.
//  • با الگوی تنبل، بررسی کلید به نخستین signJwt/verifyJwt واقعی (زمان
//    اجرا) منتقل می‌شود — دقیقاً همان‌جایی که کلید لازم است.
//  • ضامن‌های تکمیلی: docker-entrypoint.sh در production بدون کلیدِ معتبر
//    کانتینر را متوقف می‌کند و deploy.sh پیش از build مقدار را می‌سنجد.
const DEV_FALLBACK_SECRET = "shahryar-rafssanjan-secret-key-2026-secure-hmac";
let cachedSecret: string | null = null;

function getSecret(): string {
  if (cachedSecret !== null) return cachedSecret;
  const secret = process.env.JWT_SECRET;
  if (secret && secret.trim().length >= 16) {
    cachedSecret = secret.trim();
    return cachedSecret;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[security] JWT_SECRET در محیط production تنظیم نشده است — متغیر محیطی JWT_SECRET (حداقل ۳۲ کاراکتر تصادفی) را تنظیم کنید"
    );
  }
  if (!secret) {
    // فقط dev: هشدار واضح — کلید پیش‌فرض عمومی است و نباید در استقرار واقعی بماند
    console.warn("[security] JWT_SECRET تنظیم نشده؛ کلید توسعه‌ای عمومی استفاده می‌شود (فقط برای dev)");
  }
  cachedSecret = DEV_FALLBACK_SECRET;
  return cachedSecret;
}
const TOKEN_TTL = 60 * 60 * 24 * 30; // ۳۰ روز (ثانیه) — توکن کاربر عادی

// ═══════════════ هش رمز عبور (scrypt) ═══════════════

/**
 * هش امن رمز عبور با scrypt و نمک تصادفی
 * فرمت خروجی: scrypt$N$r$p$salt$hash
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const N = 16384, r = 8, p = 1;
  const derived = crypto.scryptSync(password, salt, 64, { N, r, p }).toString("hex");
  return `scrypt$${N}$${r}$${p}$${salt}$${derived}`;
}

/**
 * اعتبارسنجی رمز عبور با مقایسه زمان-ثابت
 */
export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [algo, N, r, p, salt, hash] = stored.split("$");
    if (algo !== "scrypt") return false;
    const derived = crypto.scryptSync(password, salt, 64, {
      N: parseInt(N), r: parseInt(r), p: parseInt(p),
    });
    const hashBuf = Buffer.from(hash, "hex");
    if (hashBuf.length !== derived.length) return false;
    return crypto.timingSafeEqual(hashBuf, derived);
  } catch {
    return false;
  }
}

// ═══════════════ JWT (HS256) ═══════════════

export interface JwtPayload {
  sub: string;        // شناسه کاربر/مدیر
  jti: string;        // شناسه یکتای توکن
  type: "user" | "admin" | "otp-ticket"; // بلیت کوتاه‌عمر مرحله رمز دومرحله‌ای
  role?: string;
  iat: number;
  exp: number;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded + "=".repeat((4 - (padded.length % 4)) % 4), "base64");
}

function hmacSign(data: string): string {
  // خواندن تنبل کلید — بررسی JWT_SECRET به نخستین استفادهٔ واقعی (runtime)
  // منتقل شده تا مرحلهٔ build (بدون env) هرگز نشکند؛ کلید پس از اولین
  // خواندن موفق کش می‌شود.
  return base64url(crypto.createHmac("sha256", getSecret()).update(data).digest());
}

/**
 * ساخت توکن JWT امضاشده با HS256
 */
export function signJwt(payload: Omit<JwtPayload, "iat" | "exp">, ttlSeconds: number = TOKEN_TTL): string {
  const now = Math.floor(Date.now() / 1000);
  const full: JwtPayload = { ...payload, iat: now, exp: now + ttlSeconds };
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(full));
  const sig = hmacSign(`${header}.${body}`);
  return `${header}.${body}.${sig}`;
}

/**
 * اعتبارسنجی و رمزگشایی توکن JWT
 */
export function verifyJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expected = hmacSign(`${header}.${body}`);
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    const payload = JSON.parse(base64urlDecode(body).toString("utf-8")) as JwtPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ═══════════════ اعتبارسنجی موبایل ایرانی ═══════════════

/**
 * اعتبارسنجی شماره موبایل ایران
 * قبول فرمت‌های: 09xxxxxxxxx / +989xxxxxxxxx / 989xxxxxxxxx / 9xxxxxxxxx
 * خروجی نرمال‌شده: 09xxxxxxxxx
 */
export function normalizePhone(input: string): string | null {
  if (!input || typeof input !== "string") return null;
  let phone = input.trim().replace(/[\s\-()]/g, "");
  phone = convertPersianDigits(phone);
  if (/^(\+98|98|0)?9\d{9}$/.test(phone)) {
    const core = phone.replace(/^(\+98|98|0)/, "");
    return `0${core}`;
  }
  return null;
}

/**
 * تبدیل ارقام فارسی/عربی به انگلیسی
 */
export function convertPersianDigits(input: string): string {
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  const ar = "٠١٢٣٤٥٦٧٨٩";
  return input.replace(/[۰-۹٠-٩]/g, (d) => {
    const fi = fa.indexOf(d);
    if (fi >= 0) return String(fi);
    return String(ar.indexOf(d));
  });
}

/**
 * اعتبارسنجی قوی رمز عبور:
 * حداقل ۸ کاراکتر، حداقل یک حرف و یک عدد
 */
export function isStrongPassword(password: string): { ok: boolean; message?: string } {
  if (!password || password.length < 8) {
    return { ok: false, message: "رمز عبور باید حداقل ۸ کاراکتر باشد" };
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return { ok: false, message: "رمز عبور باید شامل حرف و عدد باشد" };
  }
  return { ok: true };
}

// ═══════════════ توکن CSRF و شناسه یکتا ═══════════════

export function generateJti(): string {
  return crypto.randomUUID();
}

export function randomToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}
