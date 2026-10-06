// ═══════════════════════════════════════════════════════════════
// آپلودر کلاینت رسانه شهریار — نسخه ۲
// ═══════════════════════════════════════════════════════════════
// سه مرحله — نه بیشتر:
//  ۱) اعتبارسنجی فوری حجم/نوع (جدول مشترک با سرور در media/config)
//  ۲) ارسال با XHR و پروگرس لحظه‌ای به تنها endpoint رسمی /api/media
//  ۳) بررسی پاسخ JSON و الگوی URL کانونی → تمام
//
// آنچه عمداً حذف شد (ریشه‌ی خطاهای نسل قبل):
//  ✗ تایید HEAD بعد از POST — سرور خودش اتمیک تایید می‌کند؛
//    پاسخ 200 = فایل قطعاً روی دیسک است. هیچ درخواست دومی وجود
//    ندارد که بشکند و خطای «فایل روی سرور تایید نشد» بسازد.
//  ✗ زنجیره endpoint جایگزین + کش localStorage — یک endpoint،
//    یک مسیر، بدون حالت.
//  ✗ تلاش مجدد مخفی — خطاها صریح و قابل فهم به کاربر می‌رسند.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useUploadStore } from "./media-store";
import { toast } from "@/hooks/use-toast";
import {
  validateMediaFile,
  scopeLabel,
  type MediaScope,
} from "@/lib/media/config";
import { MEDIA_URL_PREFIX } from "@/lib/media/url";

export type { MediaScope } from "@/lib/media/config";

/** تنها endpoint آپلود سامانه */
const MEDIA_ENDPOINT = "/api/media";

export interface MediaUploadResult {
  url: string; // /files/{scope}/{سال}-{ماه}/{شناسه}.{پسوند}
  key: string;
  fileName: string;
  originalName: string;
  size: number;
  mime: string;
  scope: MediaScope;
}

/** پاسخ استاندارد API */
interface ApiEnvelope {
  success: boolean;
  data?: MediaUploadResult;
  error?: string;
}

/** الگوی URL کانونی که از سرور می‌پذیریم */
const CANONICAL_URL_RE = new RegExp(
  `^${MEDIA_URL_PREFIX}/(chat|avatar|business|city|misc|post|article)/\\d{4}-\\d{2}/[a-z0-9][a-z0-9-]{5,39}\\.[a-z0-9]{2,5}$`
);

/**
 * بارگذاری فایل با پروگرس شناور.
 * خروجی: اطلاعات فایل (شامل url) یا null در صورت خطا.
 * خطاها همیشه با toast فارسی قابل‌فهم به کاربر اعلام می‌شوند.
 */
export async function uploadMedia(
  file: File,
  scope: MediaScope
): Promise<MediaUploadResult | null> {
  const store = useUploadStore.getState();
  const id = `up-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // ── ۱) اعتبارسنجی فوری (قبل از مصرف پهنای باند) ──
  const validation = validateMediaFile(file, scope);
  if (!validation.valid) {
    toast({
      title: "فایل پذیرفته نشد",
      description: validation.error,
      variant: "destructive",
    });
    return null;
  }

  store.startUpload({
    id,
    name: file.name || "فایل",
    size: file.size,
    scopeLabel: scopeLabel(scope),
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

  // ── ۲) ارسال با پروگرس ──
  const result = await new Promise<MediaUploadResult | { __error: string }>((resolve) => {
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
      useUploadStore.getState().updateProgress(id, e.loaded, e.total, speed, eta);
    });

    xhr.addEventListener("load", () => {
      try {
        const contentType = xhr.getResponseHeader("content-type") || "";

        // پاسخ غیرJSON (مثل صفحه HTML خطای 404/500)
        if (!contentType.includes("application/json")) {
          if (xhr.status === 404) {
            resolve({ __error: "سرویس بارگذاری روی سرور در دسترس نیست؛ چند لحظه بعد دوباره تلاش کنید" });
            return;
          }
          if (xhr.status === 413) {
            resolve({ __error: "حجم فایل بیش از حد مجاز سرور است" });
            return;
          }
          if (xhr.status === 401) {
            resolve({ __error: "نشست شما منقضی شده؛ دوباره وارد شوید" });
            return;
          }
          if (xhr.status === 502 || xhr.status === 503 || xhr.status === 504) {
            resolve({ __error: "سرور در حال راه‌اندازی مجدد است؛ چند لحظه بعد دوباره تلاش کنید" });
            return;
          }
          resolve({ __error: `سرور با خطای ${xhr.status} پاسخ داد` });
          return;
        }

        const res = JSON.parse(xhr.responseText) as ApiEnvelope;

        if (!(xhr.status >= 200 && xhr.status < 300) || !res.success) {
          resolve({ __error: res.error || "بارگذاری ناموفق بود" });
          return;
        }

        // ── ۳) سلامت پاسخ: URL باید کانونی و ساختارمند باشد ──
        const data = res.data!;
        if (!data?.url || !CANONICAL_URL_RE.test(data.url)) {
          resolve({ __error: "پاسخ سرور نامعتبر بود؛ فایل ذخیره نشد" });
          return;
        }

        resolve(data);
      } catch {
        resolve({ __error: "پاسخ سرور نامعتبر بود" });
      }
    });

    xhr.addEventListener("error", () =>
      resolve({ __error: "ارتباط با سرور برقرار نشد؛ اتصال اینترنت را بررسی کنید" })
    );

    xhr.addEventListener("abort", () => resolve({ __error: "بارگذاری لغو شد" }));

    xhr.open("POST", MEDIA_ENDPOINT);
    xhr.send(formData);
  });

  if ("__error" in result) {
    return failWith(result.__error);
  }

  // موفقیت — سرور خودش اتمیک تایید کرده که فایل سالم روی دیسک است
  useUploadStore.getState().finishUpload(id, result.url);
  toast({
    title: "بارگذاری موفق",
    description: `«${file.name || "فایل"}» ثبت شد`,
  });
  setTimeout(() => useUploadStore.getState().removeItem(id), 3500);
  return result;
}
