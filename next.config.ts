import type { NextConfig } from "next";

// ═════ جداسازی خروجی build از وضعیت dev server ═════
// مشکل ریشه‌ای کشف‌شده: `next build` پوشه .next را پاک و بازنویسی می‌کند —
// همان پوشه‌ای که dev server در حال اجرا برای state خودش استفاده می‌کند.
// نتیجه: حین/پس از build، سرور dev خراب می‌شود (خطای
// "Failed to find Server Action"، 404/500 های متناوب) و آپلودهای
// کاربران با «فایل روی سرور تایید نشد» شکست می‌خورد.
//
// راه‌حل پایدار: build های production به پوشه جدای .next-prod می‌روند؛
// dev server (که فقط .next را می‌شناسد) هرگز تحت‌تأثیر build قرار نمی‌گیرد.
//  • next dev  → NODE_ENV=development → .next
//  • next build → NODE_ENV=production  → .next-prod
//  • متغیر NEXT_BUILD_DIR می‌تواند هر دو را بازپیشوندی کند (اسکریپت build)
const BUILD_DIR =
  process.env.NEXT_BUILD_DIR ||
  (process.env.NODE_ENV === "production" ? ".next-prod" : ".next");

const nextConfig: NextConfig = {
  output: "standalone",
  distDir: BUILD_DIR,
  typescript: {
    // ⚠️ بررسی کامل تایپ‌ها از build جدا شده و «پیش از انتشار» به‌صورت
    // مستقل و سخت‌گیرانه اجرا می‌شود (npm run typecheck):
    //   • داخل Docker (Dockerfile → builder): RUN npm run typecheck —
    //     شکست tsc = شکست build ایمیج = توقف دیپلوی روی سرور
    //   • محلی: npm run typecheck
    // این پرچم فقط «تاب‌آوری» مرحله‌ی next build را حفظ می‌کند تا خطای
    // تایپیِ خاصِ نسخه‌ی Next (فایل‌های تولیدیِ validator) آپدیت امنیتیِ
    // فوری را روی سرور بلاک نکند؛ خطاهای واقعی src پیش‌تر در گیت جداگانه
    // گرفته می‌شوند. برای فعال‌کردن بررسی داخل build نیز همین خط را
    // false کنید.
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // پکیج‌های سنگین تولید فایل (docx/exceljs/@react-pdf) در زمان اجرا
  // از node_modules لود می‌شوند — همانند الگوی createRequire موتور خواندن
  // اسناد؛ closure کامل وابستگی‌ها در scripts/postbuild.mjs کپی می‌شود.
  serverExternalPackages: ["docx", "exceljs", "@react-pdf/renderer"],
  // نکته: پکیج‌های require زمان-اجرا (pdf-parse/mammoth/xlsx) در
  // scripts/postbuild.mjs «با closure کامل وابستگی‌ها» کپی می‌شوند؛
  // outputFileTracingIncludes فقط فولدر خود پکیج را کپی می‌کرد و
  // وابستگی‌ها (underscore، node-ensure و...) جا می‌ماندند.
  // ─── هدرهای امنیتی فایل‌های کاربر (سرو استاتیک از public/) ───
  // فایل‌های آپلودی هرگز نباید به‌صورت سند فعال (HTML/SVG) اجرا شوند.
  // این هدرها اجرای اسکریپت/آبجکت را در سطح سند مسدود می‌کنند بدون
  // اینکه نمایش عادی تصویر/ویدیو/PDF (به‌صورت زیرمنبع) را خراب کنند.
  async headers() {
    return [
      {
        source: "/uploads/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "script-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
