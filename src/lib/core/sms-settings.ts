// ═════ مدیریت تنظیمات پنل پیامک (ملی‌پیامک) ═════
// ذخیره امن با AES-256-GCM — کلید از env
//
// ⚠️ قواعد کلید (SMS_ENC_KEY):
//  • production: کلید باید از محیط (env_file داکر = .env.docker) بیاید.
//    تولید خودکار «ممنوع» است — کلید تصادفیِ موقتی بعد از ری‌استارت عوض
//    می‌شود و رمز ذخیره‌شده‌ی پنل پیامک برای همیشه غیرقابل‌خواندن می‌شود.
//    (نوشتن در /app/.env هم برای کاربر اپ قابل‌نوشتن نیست و ماندگار هم نیست.)
//  • development: اگر نبود، یک‌بار تولید و در .env محلی ذخیره می‌شود.
//  • ضامن‌ها: deploy.sh و docker-entrypoint.sh در production بدون کلیدِ
//    معتبر متوقف می‌شوند؛ اینجا هم به‌عنوان آخرین لایه fail-closed خطا
//    می‌دهیم (encrypt → پیام شفاف به ادمین) یا null برمی‌گردانیم
//    (decrypt → پنل «پیکربندی‌نشده» فرض می‌شود و جریان OTP بدون کرش
//    با پیام «سرویس پیامک در دسترس نیست» ادامه می‌یابد).
// ═══════════════════════════════════════════════════════════════
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { db } from "@/lib/db";

const SETTING_ID = "main";
const ENV_KEY = "SMS_ENC_KEY";
const ENV_FILE = path.join(process.cwd(), ".env");

/** آیا کلید رمزنگاری معتبر (۶۴ کاراکتر hex = ۳۲ بایت) در env موجود است؟ */
export function isSmsEncKeyAvailable(): boolean {
  const raw = process.env[ENV_KEY];
  return !!(raw && /^[0-9a-f]{64}$/i.test(raw));
}

/**
 * کلید ۳۲ بایتی رمزنگاری — از env.
 *  • production بدون کلید معتبر → خطای شفاف (fail-closed؛ هیچ کلید موقتی
 *    ساخته نمی‌شود که بعد از ری‌استارت رمزگشایی را برای همیشه بشکند).
 *  • dev بدون کلید → تولید یک‌بار و ذخیره در .env محلی.
 */
function getEncKey(): Buffer {
  const raw = process.env[ENV_KEY];
  if (raw && /^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[sms] SMS_ENC_KEY در محیط production تنظیم نشده است — کلید ۳۲بایتی hex (خروجی openssl rand -hex 32) را در .env.docker تعریف و کانتینر را ری‌استارت کنید. تا پیش از آن، ذخیره/خواندن اعتبارنامه‌ی پنل پیامک ممکن نیست"
    );
  }

  // تولید کلید جدید و افزودن به .env (یک‌بار) — فقط dev
  const key = crypto.randomBytes(32).toString("hex");
  try {
    let content = "";
    if (fs.existsSync(ENV_FILE)) content = fs.readFileSync(ENV_FILE, "utf8");
    if (!content.endsWith("\n") && content) content += "\n";
    content += `${ENV_KEY}=${key}\n`;
    fs.writeFileSync(ENV_FILE, content, { encoding: "utf8" });
    process.env[ENV_KEY] = key;
  } catch (err) {
    console.error("خطا در ذخیره کلید رمزنگاری پیامک:", err);
    // fallback: کلید فقط در حافظه (تا ری‌استارت بعدی)
    process.env[ENV_KEY] = key;
  }
  return Buffer.from(key, "hex");
}

/** رمزنگاری متن با AES-256-GCM — خروجی: iv:tag:cipher (hex) */
export function encryptSecret(plain: string): string {
  const key = getEncKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

/** رمزگشایی — ناموفق یعنی کلید عوض شده یا داده خراب */
export function decryptSecret(stored: string): string | null {
  try {
    const [ivHex, tagHex, encHex] = stored.split(":");
    if (!ivHex || !tagHex || !encHex) return null;
    const key = getEncKey();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const dec = Buffer.concat([decipher.update(Buffer.from(encHex, "hex")), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}

export interface SmsConfig {
  username: string;
  password: string;
  fromNumber: string | null;
  patternCode: string | null; // null/خالی = ارسال دستی (SendSMS)
  patternVars: string[]; // مقادیر ثابت اضافی بعد از کد — فقط حالت الگو
  otpTemplate: string | null; // متن پیامک دستی — فقط حالت دستی
  enabled: boolean;
  lastTestAt: Date | null;
  lastTestOk: boolean | null;
}

/** روش ارسال OTP — الگو (BaseServiceNumber) یا دستی (SendSMS) */
export type SmsSendMode = "pattern" | "simple";

/**
 * تعیین روش ارسال بر اساس پیکربندی:
 *   کد الگو پر باشد → "pattern" | خط ارسال پر باشد → "simple" | هیچ‌کدام → null
 * مطابق مستند ملی‌پیامک: BaseServiceNumber به bodyId، SendSMS به خط فرستنده (from) نیاز دارد.
 */
export function resolveSendMode(cfg: Pick<SmsConfig, "patternCode" | "fromNumber"> | null): SmsSendMode | null {
  if (!cfg) return null;
  if (cfg.patternCode) return "pattern";
  if (cfg.fromNumber) return "simple";
  return null;
}

/** خواندن پیکربندی — null یعنی اعتبارنامه (نام کاربری/رمز) پیکربندی نشده */
export async function getSmsConfig(): Promise<SmsConfig | null> {
  const row = await db.smsSetting.findUnique({ where: { id: SETTING_ID } });
  if (!row) return null;

  const username = (row.username || "").trim();
  const password = row.passwordEnc ? decryptSecret(row.passwordEnc) : null;

  // پیکربندی «پایه» = اعتبارنامه پنل؛ روش ارسال (الگو/دستی) جداگانه تعیین می‌شود
  if (!username || !password) return null;

  return {
    username,
    password,
    fromNumber: (row.fromNumber || "").trim() || null,
    patternCode: (row.patternCode || "").trim() || null,
    patternVars: (row.patternVars || "")
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean),
    otpTemplate: (row.otpTemplate || "").trim() || null,
    enabled: row.enabled,
    lastTestAt: row.lastTestAt,
    lastTestOk: row.lastTestOk,
  };
}

/**
 * آیا پنل برای ارسال واقعی OTP آماده است؟
 * اعتبارنامه + فعال‌بودن + حداقل یکی از دو روش (کد الگو یا خط ارسال)
 */
export function canSendOtp(cfg: SmsConfig | null): boolean {
  return !!cfg && cfg.enabled && resolveSendMode(cfg) !== null;
}

/** نسخه async برای مسیرهای مستقل (تست اتصال و ...) */
export async function isSmsReady(): Promise<boolean> {
  const cfg = await getSmsConfig();
  return canSendOtp(cfg);
}

/** ذخیره تنظیمات — رمز فقط وقتی ارسال شود عوض می‌شود */
export async function saveSmsSettings(input: {
  username?: string;
  password?: string;
  fromNumber?: string;
  patternCode?: string;
  patternVars?: string;
  otpTemplate?: string;
  enabled?: boolean;
}) {
  const data: Record<string, unknown> = {};
  if (input.username !== undefined) data.username = input.username.trim() || null;
  if (input.password !== undefined && input.password !== "") {
    data.passwordEnc = encryptSecret(input.password);
  }
  if (input.fromNumber !== undefined) data.fromNumber = input.fromNumber.trim() || null;
  if (input.patternCode !== undefined) data.patternCode = input.patternCode.trim() || null;
  if (input.patternVars !== undefined) data.patternVars = input.patternVars.trim() || null;
  if (input.otpTemplate !== undefined) data.otpTemplate = input.otpTemplate.trim() || null;
  if (input.enabled !== undefined) data.enabled = input.enabled;

  return db.smsSetting.upsert({
    where: { id: SETTING_ID },
    update: data,
    create: { id: SETTING_ID, ...data },
  });
}

/** ثبت نتیجه تست اتصال */
export async function recordSmsTest(ok: boolean) {
  await db.smsSetting.update({
    where: { id: SETTING_ID },
    data: { lastTestAt: new Date(), lastTestOk: ok },
  }).catch(() => {});
}
