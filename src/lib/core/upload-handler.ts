// ═════ هندلر مشترک آپلود یکپارچه — POST/GET ═════
// منطق اصلی API آپلود در این ماژول (مسیر lib — مقاوم در برابر حذف فایل)
// دو مسیر روت نازک آن را re-export می‌کنند:
//   POST /api/upload   (سازگاری با گذشته)
//   POST /api/uploads  (مسیر اصلی جدید)
// اگر یکی از روت‌ها حذف شود، کلاینت خودکار به دیگری سوئیچ می‌کند و
// سازنده خودترمیم‌شونده (upload-selfheal) فایل را در راه‌اندازی بعدی بازسازی می‌کند.
import { NextRequest } from "next/server";
import { ok, fail, getUser, getAdmin, userAgentFrom } from "@/lib/core/api";
import { rateLimit, getClientIp } from "@/lib/core/rate-limit";
import { logActivity } from "@/lib/core/logger";
import { validateUpload, saveUpload, verifyUploadUrl, scopeLabel, type UploadScope } from "@/lib/core/uploads";
import { healUploadRoutes } from "@/lib/core/upload-selfheal";

const VALID_SCOPES: UploadScope[] = ["chat", "avatar", "business", "city", "misc", "post"];

export async function POST(req: NextRequest) {
  try {
    // ترمیم لحظه‌ای روت‌های خواهر — اگر پلتفرم یکی از روت‌های نازک را
    // حذف کرده باشد، همین درخواست آن را بازسازی می‌کند (فقط ۲ stat سبک)
    healUploadRoutes();

    // احراز هویت: کاربر اپ یا مدیر سیستم
    const auth = (await getUser(req)) || (await getAdmin(req));
    if (!auth) return fail("برای بارگذاری فایل وارد شوید", 401);
    const isUserAuth = "phone" in auth; // کاربر اپ دارای phone، مدیر دارای username

    // محدودیت نرخ: حداکثر ۲۰ فایل در دقیقه
    const rl = rateLimit(`upload:${auth.id}`, 20, 60 * 1000);
    if (!rl.allowed) {
      return fail(`درخواست زیاد است. ${rl.retryAfterSec} ثانیه صبر کنید`, 429);
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const scopeRaw = String(formData.get("scope") || "misc");

    if (!(file instanceof File)) return fail("فایلی ارسال نشده است");
    const scope = (VALID_SCOPES.includes(scopeRaw as UploadScope) ? scopeRaw : "misc") as UploadScope;

    // اعتبارسنجی حجم و نوع
    const validation = validateUpload(file, scope);
    if (!validation.valid) {
      return fail(validation.error || "فایل نامعتبر است", 422);
    }

    // ذخیره امن با دسته‌بندی پوشه‌ای
    const saved = await saveUpload(file, scope);

    // ⚡ تایید نهایی: فایل باید واقعاً از مسیر عمومی قابل دریافت باشد
    // (پیشگیری قطعی از خطای 404 پس از آپلود)
    const verified = await verifyUploadUrl(saved.url);
    if (!verified.exists) {
      console.error("خطای تایید آپلود — فایل پس از ذخیره قابل دریافت نیست:", saved.url, verified.error || "");
      return fail("فایل ذخیره شد اما در سرور تایید نشد؛ لطفاً دوباره تلاش کنید", 500);
    }

    await logActivity({
      userId: isUserAuth ? auth.id : undefined,
      adminId: isUserAuth ? undefined : auth.id,
      action: "file.upload",
      entity: "upload",
      entityId: saved.fileName,
      details: {
        scope,
        size: saved.size,
        mime: saved.mime,
        url: saved.url,
        label: scopeLabel(scope),
      },
      ip: getClientIp(req),
      userAgent: userAgentFrom(req),
    });

    return ok({
      url: saved.url,
      fileName: saved.fileName,
      originalName: file.name,
      size: saved.size,
      mime: saved.mime,
      scope,
    });
  } catch (err) {
    console.error("خطای آپلود:", err);
    return fail("بارگذاری فایل ناموفق بود؛ لطفاً دوباره تلاش کنید", 500);
  }
}

/** بررسی سلامت سرویس آپلود — GET /api/upload یا /api/uploads */
export async function GET() {
  return ok({ service: "upload", status: "ready", scopes: VALID_SCOPES });
}
