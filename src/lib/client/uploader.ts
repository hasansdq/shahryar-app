// ═════ موتور آپلود کلاینت شهریار ═════
// XHR با پروگرس لحظه‌ای + محاسبه سرعت و ETA
// استفاده در همه بخش‌ها: چت هوشیار، پروفایل، گالری اصناف، دانش شهری
//
// زنجیره اطمینان (ضامن «بدون 404» در رابط کاربری):
//  ۱) اعتبارسنجی حجم/نوع قبل از ارسال — بازخورد فوری بدون اتلاف پهنای باند
//  ۲) ارسال با پروگرس لحظه‌ای به POST /api/uploads (fallback خودکار به /api/upload)
//  ۳) بررسی سلامت پاسخ سرور (URL باید الگوی داخلی /uploads/ داشته باشد)
//  ۴) تایید نهایی HEAD — فایل باید واقعاً قابل دریافت باشد؛ فقط بعد از آن
//     موفقیت اعلام و URL به رابط کاربری داده می‌شود
//
// تابلوئیژنس: اگر مسیر اول 404 برگرداند (مثلاً فایل روت توسط سیستم پلتفرم
// حذف شده باشد)، خودکار به مسیر دوم سوئیچ می‌شود و کاربر متوجه هیچ‌چیز نمی‌شود.

"use client";

import { useUploadStore } from "./upload-store";
import { toast } from "@/hooks/use-toast";

export interface UploadResult {
  url: string;
  fileName: string;
  originalName: string;
  size: number;
  mime: string;
  scope: string;
}

export type UploadScopeClient = "chat" | "avatar" | "business" | "city" | "misc" | "post";

const SCOPE_LABELS: Record<string, string> = {
  chat: "پیوست گفتگو",
  avatar: "تصویر پروفایل",
  business: "تصویر کسب‌وکار",
  city: "تصویر دانش شهری",
  misc: "فایل",
  post: "پیوست پست شهریار",
};

/** دو مسیر آپلود — اصلی و پشتیبان (هر دو به یک هندلر مشترک وصل‌اند) */
const UPLOAD_ENDPOINTS = ["/api/uploads", "/api/upload"] as const;
const ENDPOINT_CACHE_KEY = "shahryar-upload-endpoint";

/** مسیر کاری ذخیره‌شده از آخرین موفقیت (در حافظه + localStorage) */
let cachedEndpoint: string | null = null;

function getCachedEndpoint(): string | null {
  if (cachedEndpoint) return cachedEndpoint;
  if (typeof window !== "undefined") {
    try {
      cachedEndpoint = window.localStorage.getItem(ENDPOINT_CACHE_KEY);
    } catch {
      /* حالت private browsing */
    }
  }
  return cachedEndpoint && (UPLOAD_ENDPOINTS as readonly string[]).includes(cachedEndpoint)
    ? cachedEndpoint
    : null;
}

function setCachedEndpoint(ep: string) {
  cachedEndpoint = ep;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(ENDPOINT_CACHE_KEY, ep);
    } catch {
      /* ignore */
    }
  }
}

/** ترتیب امتحان مسیرها: کش‌شده اول، بعد بقیه */
function endpointOrder(): string[] {
  const cached = getCachedEndpoint();
  const rest = UPLOAD_ENDPOINTS.filter((e) => e !== cached);
  return cached ? [cached, ...rest] : [...UPLOAD_ENDPOINTS];
}

/** سقف حجم هر بخش — باید با سرور (UPLOAD_LIMITS) هم‌راستا باشد */
const CLIENT_LIMITS: Record<UploadScopeClient, number> = {
  chat: 10 * 1024 * 1024,
  avatar: 3 * 1024 * 1024,
  business: 6 * 1024 * 1024,
  city: 6 * 1024 * 1024,
  misc: 6 * 1024 * 1024,
  post: 30 * 1024 * 1024,
};

/** الگوی mime مجاز هر بخش — ساده‌شده برای کلاینت (سرور مرجع نهایی است) */
const CLIENT_ALLOWED: Record<UploadScopeClient, RegExp> = {
  chat: /^(image\/(png|jpe?g|webp|gif|avif)|application\/pdf|text\/plain|text\/csv|application\/msword|application\/vnd\.(openxmlformats-officedocument\.(wordprocessingml(\.document)?|presentationml(\.presentation)?|spreadsheetml(\.sheet)?)|ms-excel|ms-powerpoint|oasis\.opendocument\.spreadsheet)|application\/zip|application\/x-rar-compressed)$/,
  avatar: /^image\/(png|jpe?g|webp|gif|avif)$/,
  business: /^image\/(png|jpe?g|webp|gif|avif)$/,
  city: /^image\/(png|jpe?g|webp|gif|avif)$/,
  misc: /^(image\/(png|jpe?g|webp|gif|avif)|application\/pdf)$/,
  // پیوست پست — تصویر/ویدیو/صوت/فایل — هم‌راستا با سرور
  post: /^image\/(png|jpe?g|webp|gif|avif)$|^video\/(mp4|webm|quicktime|x-matroska|ogg)$|^audio\/(mpeg|mp3|mp4|wav|wave|x-wav|webm|ogg|aac|flac|x-m4a|m4a|mpga)$|^application\/(pdf|zip|x-rar-compressed|msword|vnd\.(openxmlformats-officedocument\.(wordprocessingml(\.document)?|presentationml(\.presentation)?|spreadsheetml(\.sheet)?)|ms-excel|ms-powerpoint)|vnd\.oasis\.opendocument\.(spreadsheet|text|presentation))$|^text\/(plain|csv)$/,
};

const TYPE_HINT: Record<string, string> = {
  chat: "تصویر، PDF، Word، Excel یا ZIP",
  avatar: "PNG، JPG، WebP یا GIF",
  business: "PNG، JPG، WebP یا GIF",
  city: "PNG، JPG، WebP یا GIF",
  misc: "تصویر یا PDF",
  post: "تصویر، ویدیو، صوت، PDF یا فایل آفیس",
};

/** تبدیل عدد به فارسی */
const fa = (n: number | string) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);

/** ۱) اعتبارسنجی قبل از ارسال — پیام خطا یا null */
function preValidate(file: File, scope: UploadScopeClient): string | null {
  if (file.size === 0) return "فایل خالی است";
  const max = CLIENT_LIMITS[scope];
  if (file.size > max) {
    return `حجم فایل بیشتر از ${fa(Math.round(max / (1024 * 1024)))} مگابایت مجاز نیست`;
  }
  if (file.type && !CLIENT_ALLOWED[scope].test(file.type)) {
    return `این نوع فایل مجاز نیست (${TYPE_HINT[scope]})`;
  }
  return null;
}

/** ۴) تایید نهایی — فایل باید از مسیر عمومی قابل دریافت باشد
 *  با تلاش مجدد: اختلالات گذرای سرور (مثلاً لحظاتی از rebuild)
 *  نباید به خطای کاربر تبدیل شود — ۳ تلاش با فاصله قبل از اعلام شکست
 */
async function verifyFileAccessible(url: string): Promise<boolean> {
  const MAX_ATTEMPTS = 3;
  const RETRY_DELAY_MS = 1200;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { method: "HEAD", cache: "no-store" });
      if (res.ok) return true;
      // 404 قطعی است — تلاش مجدد بی‌فایده
      if (res.status === 404 && attempt >= 2) return false;
    } catch {
      /* خطای شبکه — تلاش بعدی */
    }
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
  return false;
}

type AttemptOutcome =
  | { kind: "success"; data: UploadResult }
  | { kind: "endpoint-missing" } // 404 غیرJSON — مسیر روی سرور نیست، مسیر بعدی امتحان شود
  | { kind: "error"; message: string };

/** ارسال یک‌باره فایل به یک مسیر مشخص با پروگرس روی آیتم استور */
function attemptUpload(
  endpoint: string,
  file: File,
  scope: UploadScopeClient,
  itemId: string
): Promise<AttemptOutcome> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("scope", scope);

    // محاسبه سرعت و زمان باقی‌مانده
    let lastLoaded = 0;
    let lastTime = Date.now();

    xhr.upload.addEventListener("progress", (e) => {
      if (!e.lengthComputable) return;
      const now = Date.now();
      const dt = (now - lastTime) / 1000;
      let speed = 0;
      if (dt > 0.25) {
        speed = Math.max(0, (e.loaded - lastLoaded) / dt);
        lastLoaded = e.loaded;
        lastTime = now;
      }
      const eta = speed > 0 ? (e.total - e.loaded) / speed : Infinity;
      useUploadStore.getState().updateProgress(itemId, e.loaded, e.total, speed, eta);
    });

    xhr.addEventListener("load", async () => {
      try {
        const contentType = xhr.getResponseHeader("content-type") || "";

        // پاسخ غیرJSON (مثل صفحه HTML خطای 404) → تشخیص نوع خطا بر اساس کد وضعیت
        if (!contentType.includes("application/json")) {
          if (xhr.status === 404) {
            resolve({ kind: "endpoint-missing" });
            return;
          }
          const reason =
            xhr.status === 413 ? "حجم فایل بیش از حد مجاز سرور است" :
            xhr.status === 401 ? "نشست شما منقضی شده؛ دوباره وارد شوید" :
            `سرور با خطای ${fa(xhr.status)} پاسخ داد`;
          resolve({ kind: "error", message: reason });
          return;
        }

        const res = JSON.parse(xhr.responseText);
        if (!(xhr.status >= 200 && xhr.status < 300 && res.success)) {
          resolve({ kind: "error", message: res.error || "بارگذاری ناموفق بود" });
          return;
        }

        const data = res.data as UploadResult;

        // ۳) سلامت URL — فقط الگوی داخلی /uploads/ پذیرفته می‌شود
        if (!data?.url || !/^\/uploads\/[a-z]+\/\d{1,4}-\d{1,4}\/[A-Za-z0-9._-]+$/.test(data.url)) {
          resolve({ kind: "error", message: "پاسخ سرور نامعتبر بود؛ فایل ذخیره نشد" });
          return;
        }

        resolve({ kind: "success", data });
      } catch {
        resolve({ kind: "error", message: "پاسخ سرور نامعتبر بود" });
      }
    });

    xhr.addEventListener("error", () =>
      resolve({ kind: "error", message: "ارتباط با سرور برقرار نشد؛ اتصال اینترنت را بررسی کنید" })
    );

    xhr.addEventListener("abort", () => resolve({ kind: "error", message: "بارگذاری لغو شد" }));

    xhr.open("POST", endpoint);
    xhr.send(formData);
  });
}

/**
 * بارگذاری فایل با نمایش پروگرس شناور و پیام حرفه‌ای
 * تلاش روی مسیرهای موجود با سوئیچ خودکار؛ فقط در صورت تایید کامل،
 * اطلاعات فایل شامل url برگردانده می‌شود — وگرنه null
 */
export async function uploadFile(file: File, scope: UploadScopeClient): Promise<UploadResult | null> {
  const store = useUploadStore.getState();
  const id = `up-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const label = SCOPE_LABELS[scope] || "فایل";

  // ۱) اعتبارسنجی فوری — بدون شروع آپلود
  const preError = preValidate(file, scope);
  if (preError) {
    toast({
      title: "فایل پذیرفته نشد",
      description: preError,
      variant: "destructive",
    });
    return null;
  }

  store.startUpload({
    id,
    name: file.name,
    size: file.size,
    scopeLabel: label,
    isImage: file.type.startsWith("image/"),
  });

  const failWith = (msg: string) => {
    useUploadStore.getState().failUpload(id, msg);
    toast({
      title: "خطا در بارگذاری",
      description: msg,
      variant: "destructive",
    });
    setTimeout(() => useUploadStore.getState().removeItem(id), 7000);
    return null;
  };

  // ۲) تلاش روی مسیرها به ترتیب — سوئیچ خودکار در صورت 404 مسیر
  let lastResult: AttemptOutcome | null = null;
  for (const endpoint of endpointOrder()) {
    const outcome = await attemptUpload(endpoint, file, scope, id);
    lastResult = outcome;

    if (outcome.kind === "success") {
      // ۴) تایید نهایی — فایل باید واقعاً قابل دریافت باشد (HEAD)
      const accessible = await verifyFileAccessible(outcome.data.url);
      if (!accessible) {
        return failWith("فایل روی سرور تایید نشد؛ لطفاً دوباره تلاش کنید");
      }

      setCachedEndpoint(endpoint); // مسیر کاری را برای دفعات بعد نگه دار
      useUploadStore.getState().finishUpload(id, outcome.data.url);
      toast({
        title: "بارگذاری موفق",
        description: `«${file.name}» با موفقیت آپلود و تایید شد`,
      });
      // حذف خودکار آیتم موفق بعد از ۳.۵ ثانیه
      setTimeout(() => useUploadStore.getState().removeItem(id), 3500);
      return outcome.data;
    }

    if (outcome.kind === "endpoint-missing") {
      continue; // این مسیر روی سرور نیست → مسیر بعدی
    }

    return failWith(outcome.message); // خطای واقعی → توقف
  }

  // همه مسیرها 404 بودند — سرویس آپلود واقعاً در دسترس نیست
  return failWith("سرویس بارگذاری روی سرور در دسترس نیست؛ چند لحظه بعد دوباره تلاش کنید");
}
