// ═════ سازنده خودترمیم‌شونده مسیرهای آپلود ═════
// مشاهده شد که سیستم snapshot پلتفرم در مرز ری‌استارت سشن، فایل
// src/app/api/upload/route.ts را از working tree حذف می‌کند (۳ بار تکرار شد)
// و یک بار هم در میانه سشن. این ماژول در سه لایه از سرویس محافظت می‌کند:
//  ۱) instrumentation در بوت سرور → healUploadRoutes()
//  ۲) نظارت دوره‌ای هر ۳۰ ثانیه → startUploadRouteWatcher()
//  ۳) هر درخواست آپلود → healUploadRoutes() سبک (در upload-handler)
// تا سرویس آپلود هرگز از دسترس خارج نشود.
import { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";

/** محتوای روت نازک — re-export هندلرها + config مستقیم (الزام Next.js) */
const THIN_ROUTE = `// ═════ آپلود یکپارچه — POST /api/upload(s) ═════
// روت نازک: منطق اصلی در src/lib/core/upload-handler.ts
// (این فایل به‌صورت خودکار توسط upload-selfheal بازسازی شده است)
export { POST, GET } from "@/lib/core/upload-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
`;

const ROUTE_PATHS = [
  "src/app/api/upload/route.ts",
  "src/app/api/uploads/route.ts",
];

/** بازسازی روت‌های آپلود در صورت حذف — فقط در محیط dev/source (وجود src/app) */
export function healUploadRoutes(): { healed: string[]; skipped: string[] } {
  const healed: string[] = [];
  const skipped: string[] = [];
  const srcRoot = path.join(process.cwd(), "src", "app");
  if (!existsSync(srcRoot)) return { healed, skipped: ["no-src"] }; // حالت standalone — ریسک صفر

  for (const rel of ROUTE_PATHS) {
    const abs = path.join(process.cwd(), rel);
    if (existsSync(abs)) {
      skipped.push(rel);
      continue;
    }
    try {
      mkdirSync(path.dirname(abs), { recursive: true });
      writeFileSync(abs, THIN_ROUTE, "utf8");
      healed.push(rel);
      console.log(`[self-heal] مسیر آپلود بازسازی شد: ${rel}`);
    } catch (err) {
      console.error(`[self-heal] خطا در بازسازی ${rel}:`, err);
    }
  }
  return { healed, skipped };
}

/** نظارت دوره‌ای روی وجود روت‌ها — حذف میانه‌سشن هم خودکار ترمیم می‌شود */
export function startUploadRouteWatcher(intervalMs = 30_000): void {
  const srcRoot = path.join(process.cwd(), "src", "app");
  if (!existsSync(srcRoot)) return; // حالت standalone — نیازی نیست

  // جلوگیری از ثبت چند watcher در صورت فراخوانی مجدد
  if ((globalThis as { __uploadRouteWatcher?: ReturnType<typeof setInterval> }).__uploadRouteWatcher) {
    return;
  }

  const timer = setInterval(() => {
    try {
      healUploadRoutes();
    } catch {
      /* خطای گذرا — تیک بعدی دوباره تلاش می‌کند */
    }
  }, intervalMs);

  // watcher نباید فرآیند را زنده نگه دارد (خاموشی تمیز سرور)
  timer.unref?.();
  (globalThis as { __uploadRouteWatcher?: ReturnType<typeof setInterval> }).__uploadRouteWatcher = timer;
  console.log(`[self-heal] نظارت دوره‌ای مسیرهای آپلود فعال شد (هر ${Math.round(intervalMs / 1000)} ثانیه)`);
}
