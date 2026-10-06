// ═══════════════════════════════════════════════════════════════
// اقتصاد توکن — تنظیمات (Setting key: token_economy)
// خواندن/نوشتن با اعتبارسنجی سخت‌گیرانه و ادغام با پیش‌فرض‌ها
// ═══════════════════════════════════════════════════════════════
import { db } from "@/lib/db";
import {
  DEFAULT_TOKEN_ECONOMY,
  type TokenEconomySettings,
} from "./types";

export const TOKEN_SETTINGS_KEY = "token_economy";

/** clamp عدد صحیح به بازه */
function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** اعتبارسنجی و نرمال‌سازی ساختار تنظیمات (ورودی نامعتبر → پیش‌فرض) */
export function sanitizeTokenSettings(raw: unknown): TokenEconomySettings {
  const d = DEFAULT_TOKEN_ECONOMY;
  if (!raw || typeof raw !== "object") {
    return { ...d, zarinpal: { ...d.zarinpal } };
  }
  const r = raw as Record<string, unknown>;

  const zRaw = (r.zarinpal && typeof r.zarinpal === "object" ? r.zarinpal : {}) as Record<string, unknown>;
  const merchantId = typeof zRaw.merchantId === "string" ? zRaw.merchantId.trim() : "";
  const callbackUrl = typeof zRaw.callbackUrl === "string" ? zRaw.callbackUrl.trim() : "";

  const pricePerMillion = clampInt(r.pricePerMillion, 1_000, 100_000_000, d.pricePerMillion);
  const minChargeTokens = clampInt(
    r.minChargeTokens ?? d.minChargeTokens,
    1_000,
    500_000_000,
    d.minChargeTokens
  );
  const maxChargeTokens = clampInt(
    r.maxChargeTokens ?? d.maxChargeTokens,
    minChargeTokens,
    500_000_000,
    Math.max(d.maxChargeTokens, minChargeTokens)
  );

  return {
    enabled: r.enabled === undefined ? d.enabled : Boolean(r.enabled),
    pricePerMillion,
    imageGenTokens: clampInt(r.imageGenTokens, 0, 10_000_000, d.imageGenTokens),
    signupBonus: clampInt(r.signupBonus, 0, 100_000_000, d.signupBonus),
    dailyBonus: clampInt(r.dailyBonus, 0, 10_000_000, d.dailyBonus),
    minChargeTokens,
    maxChargeTokens,
    zarinpal: {
      merchantId: /^[0-9a-fA-F-]{0,64}$/.test(merchantId) ? merchantId : "",
      sandbox: zRaw.sandbox === undefined ? true : Boolean(zRaw.sandbox),
      description:
        typeof zRaw.description === "string" && zRaw.description.trim()
          ? zRaw.description.trim().slice(0, 100)
          : d.zarinpal.description,
      callbackUrl: /^https?:\/\/.{3,}$/.test(callbackUrl) ? callbackUrl : "",
    },
  };
}

let cache: { value: TokenEconomySettings; at: number } | null = null;
const CACHE_TTL_MS = 5_000;

/** خواندن تنظیمات با کش کوتاه — همیشه ساختار کامل برمی‌گرداند */
export async function getTokenSettings(force = false): Promise<TokenEconomySettings> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  let parsed: unknown = null;
  try {
    const row = await db.setting.findUnique({ where: { key: TOKEN_SETTINGS_KEY } });
    if (row) parsed = JSON.parse(row.value);
  } catch {
    /* تنظیمات خراب → پیش‌فرض */
  }
  const value = sanitizeTokenSettings(parsed);
  cache = { value, at: Date.now() };
  return value;
}

/** ذخیره‌سازی تنظیمات (ادغام با وضعیت فعلی) — باطل‌کردن کش */
export async function saveTokenSettings(patch: unknown): Promise<TokenEconomySettings> {
  const current = await getTokenSettings(true);
  const merged = sanitizeTokenSettings({ ...current, ...(patch as object) });
  await db.setting.upsert({
    where: { key: TOKEN_SETTINGS_KEY },
    create: { key: TOKEN_SETTINGS_KEY, value: JSON.stringify(merged), group: "tokens" },
    update: { value: JSON.stringify(merged), group: "tokens" },
  });
  cache = { value: merged, at: Date.now() };
  return merged;
}
