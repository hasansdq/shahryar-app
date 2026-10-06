// ═════ تنظیمات اقتصاد توکن — GET/PUT /api/admin/tokens/settings ═════
// GET: تنظیمات فعلی (مرچنت ماسک می‌شود) | PUT: ذخیره‌ی برچسب‌خورده
import { NextRequest } from "next/server";
import { ok, fail, getAdmin, assertWritableAdmin, parseJson } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { getTokenSettings, saveTokenSettings } from "@/lib/modules/tokens/settings";
import { DEFAULT_TOKEN_ECONOMY } from "@/lib/modules/tokens/types";

function maskMerchant(id: string): string {
  if (!id) return "";
  if (id.length <= 8) return "•".repeat(id.length);
  return `${id.slice(0, 4)}${"•".repeat(id.length - 8)}${id.slice(-4)}`;
}

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);

    const s = await getTokenSettings(true);
    return ok({
      settings: {
        ...s,
        zarinpal: { ...s.zarinpal, merchantId: maskMerchant(s.zarinpal.merchantId), merchantIdSet: Boolean(s.zarinpal.merchantId) },
      },
    });
  } catch (err) {
    console.error("[admin/tokens/settings] GET خطا:", err);
    return fail("خطای داخلی سرور", 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);
    const writeGate = assertWritableAdmin(admin);
    if (writeGate) return writeGate;

    const body = await parseJson<Record<string, unknown>>(req);
    if (!body) return fail("درخواست نامعتبر است");

    // مرچنت ماسک‌شده از کلاینت آمده → تغییرش نده (فیلد password-مانند)؛
    // رشته «"» صریح = پاک‌کردن مرچنت
    const zp = (body.zarinpal ?? {}) as Record<string, unknown>;
    if (typeof zp.merchantId === "string" && /•/.test(zp.merchantId)) {
      zp.merchantId = undefined;
    }

    await saveTokenSettings({
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
      ...(body.pricePerMillion !== undefined ? { pricePerMillion: body.pricePerMillion } : {}),
      ...(body.imageGenTokens !== undefined ? { imageGenTokens: body.imageGenTokens } : {}),
      ...(body.signupBonus !== undefined ? { signupBonus: body.signupBonus } : {}),
      ...(body.dailyBonus !== undefined ? { dailyBonus: body.dailyBonus } : {}),
      ...(body.minChargeTokens !== undefined ? { minChargeTokens: body.minChargeTokens } : {}),
      ...(body.maxChargeTokens !== undefined ? { maxChargeTokens: body.maxChargeTokens } : {}),
      ...(body.zarinpal !== undefined ? { zarinpal: zp } : {}),
    });

    await logActivity({
      adminId: admin.id,
      actorType: "admin",
      action: "tokens.settings_update",
      entity: "setting",
      entityId: "token_economy",
    });

    const fresh = await getTokenSettings(true);
    return ok({
      settings: {
        ...fresh,
        zarinpal: { ...fresh.zarinpal, merchantId: maskMerchant(fresh.zarinpal.merchantId), merchantIdSet: Boolean(fresh.zarinpal.merchantId) },
      },
    });
  } catch (err) {
    console.error("[admin/tokens/settings] PUT خطا:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
