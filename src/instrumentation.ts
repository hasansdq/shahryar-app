// ═════ instrumentation شهریار ═════
// در راه‌اندازی سرور اجرا می‌شود — سازنده خودترمیم‌شونده مسیرهای آپلود
// را فعال می‌کند تا حذف فایل توسط سیستم snapshot پلتفرم، سرویس را نشکند.
//
// دو لایه محافظت:
//  ۱) هنگام بوت سرور: بازسازی فوری روت‌های حذف‌شده
//  ۲) نظارت دوره‌ای (هر ۳۰ ثانیه): اگر روت‌ها در میانه سشن حذف شوند
//     (مشاهدات قبلی: پلتفرم تا ۳ بار فایل روت را حذف کرده)،
//     خودکار بازسازی می‌شوند — بدون نیاز به ری‌استارت سرور
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { healUploadRoutes, startUploadRouteWatcher } = await import(
      "./lib/core/upload-selfheal"
    );

    // ۱) ترمیم فوری در بوت
    const { healed } = healUploadRoutes();
    if (healed.length > 0) {
      console.log(`[self-heal] ${healed.length} مسیر آپلود در بوت بازسازی شد`);
    }

    // ۲) نظارت دوره‌ای — فقط در حالت dev/source (در standalone ریسک صفر)
    startUploadRouteWatcher(30_000);
  } catch (err) {
    console.error("[self-heal] اجرا نشد:", err);
  }
}
