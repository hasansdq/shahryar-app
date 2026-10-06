// ═══════════════════════════════════════════════════════════════
// میدل‌ور امنیتی — دفاع CSRF (سه‌لایه)
//
// چرا لازم است: کوکی‌های احراز هویت در production با SameSite=None سرو
// می‌شوند (پیش‌نمایش iframe متقاطع z.ai به آن نیاز دارد) — یعنی مرورگر
// کوکی را با درخواست‌های متقاطع هم می‌فرستد. بدون این میدل‌ور، هر
// سایت ثالثی می‌تواند با credentials:include از طرف قربانی در API
// نوشتن (پست، پیام، هزینه AI، تغییر پروفایل و…).
//
// لایه ۱ — Sec-Fetch-Site (مرورگرهای مدرن؛ مطمئن‌ترین سیگنال):
//   این هدر را خود مرورگر تنظیم می‌کند و جاوااسکریپت به هیچ شکلی
//   نمی‌تواند آن را جعل کند (header ممنوع). مقدارش «رابطه مبدأ با
//   مقصد» را از دید مرورگر می‌گوید — مستقل از پراکسی‌ها:
//     • same-origin / none → قطعاً CSRF نیست → مجاز
//     • cross-site → دقیقاً سناریوی حمله → مسدود
//     • same-site → دامنه خواهر (خطر واقعی در پلتفرم: preview-*
//       کاربران دیگر!) → با لایه ۲ بررسی می‌شود
//
//   ⚠️ چرا این لایه حیاتی است: در زنجیره پراکسی پیش‌نمایش z.ai
//   (مرورگر → edge → Caddy → سرور) هدر Host در میانه بازنویسی
//   می‌شود و X-Forwarded-Host را هم Caddy با Hostِ دریافتی خودش
//   بازنویسی می‌کند؛ در نتیجه «مقایسه Origin با Host» به‌تنهایی
//   درخواست‌های کاملاً سالمِ پیش‌نمایش را هم مسدود می‌کرد —
//   باگ «درخواست از مبدا غیرمجاز» روی لاگین اپ و پنل ادمین.
//   Sec-Fetch-Site از سمت مرورگر می‌آید و پراکسی‌ها فقط ردش
//   می‌کنند (تأییدشده با تست عملی روی زنجیره Caddy واقعی).
//
// لایه ۲ — فول‌بک Origin/Referer (مرورگرهای قدیمی/بدون Sec-Fetch):
//   • بدون Origin و بدون Referer → مجاز (کلاینت غیرمرورگری مثل curl/SDK)
//   • Origin (یا Referer) موجود → میزبانی که مرورگر اعلام می‌کند باید
//     با یکی از «میزبان‌های شناخته‌شده» یکی باشد:
//       Host + همه مقادیر X-Forwarded-Host (جدا با کاما)
//       + host= داخل هدر Forwarded (RFC 7239 — تنها هدر پراکسی که
//         Caddy بازنویسی‌اش نمی‌کند و مقدار edge را نگه می‌دارد)
//   • Origin: null → مسدود (iframe سندباکس‌شده/زمینه مشکوک)
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** میزبان‌های مجاز: Host + X-Forwarded-Host (همه مقادیر) + host از Forwarded */
function collectHosts(req: NextRequest): Set<string> {
  const hosts = new Set<string>();
  const pushList = (value: string | null) => {
    if (!value) return;
    for (const part of value.split(",")) {
      const h = part.trim().toLowerCase();
      // مقدار RFC 7239 ممکن است داخل کوتیشن باشد: host="example.com"
      const unquoted = h.replace(/^"+|"+$/g, "");
      if (unquoted) hosts.add(unquoted);
    }
  };
  pushList(req.headers.get("host"));
  pushList(req.headers.get("x-forwarded-host"));
  const forwarded = req.headers.get("forwarded");
  if (forwarded) {
    for (const m of forwarded.matchAll(/host=("[^"]*"|[^;,\s]+)/gi)) {
      pushList(m[1]);
    }
  }
  return hosts;
}

/**
 * بررسی یک هدر Origin/Referer: آیا میزبانش جزو میزبان‌های شناخته‌شده است؟
 * null = هدر ارسال نشده (قاعده بعدی بررسی شود)
 */
function headerHostOk(headerValue: string | null, hosts: Set<string>): boolean | null {
  if (!headerValue) return null;
  if (headerValue === "null") return false; // سندباکس/زمینه مشکوک — مسدود
  try {
    const origin = new URL(headerValue);
    // URL.host شامل پورت است و پورت هم مقایسه می‌شود
    return hosts.has(origin.host.toLowerCase());
  } catch {
    return false; // هدر خراب/جعلی → مسدود
  }
}

function blocked(req: NextRequest): NextResponse {
  // لاگ تشخیصی: هر مسدودسازی با کل هدرهای مربوطه ثبت می‌شود تا اگر
  // کلاینت سالمی مسدود شد، ریشه‌اش (توپولوژی پراکسی/مرورگر قدیمی)
  // بلافاصله از لاگ سرور قابل تشخیص باشد.
  const h = (name: string) => req.headers.get(name) || "-";
  console.warn(
    `[CSRF-BLOCK] ${req.method} ${req.nextUrl.pathname}`,
    `origin=${h("origin")} referer=${h("referer")} sec-fetch-site=${h("sec-fetch-site")}`,
    `host=${h("host")} xfh=${h("x-forwarded-host")} forwarded=${h("forwarded")}`,
    `ua="${(req.headers.get("user-agent") || "").slice(0, 80)}"`
  );
  return new NextResponse(
    JSON.stringify({ success: false, error: "درخواست از مبدا غیرمجاز ارسال شده است" }),
    { status: 403, headers: { "content-type": "application/json; charset=utf-8" } }
  );
}

export function middleware(req: NextRequest) {
  if (!MUTATING.has(req.method.toUpperCase())) return NextResponse.next();

  // ── لایه ۱: Sec-Fetch-Site (جعل‌ناپذیر توسط مرورگر) ──
  const sfs = req.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (sfs === "same-origin" || sfs === "none") {
    // مرورگر خودش تضمین کرده: مبدأ همان مقصد است (یا درخواست مستقیم کاربر)
    return NextResponse.next();
  }
  if (sfs === "cross-site") {
    // دقیقاً تعریف حمله CSRF — حتی اگر لایه‌های بعدی هم‌میزبان به نظر برسند
    return blocked(req);
  }
  // sfs === "same-site" یا هدر نبود → ادامه با لایه ۲

  // ── لایه ۲: تطبیق Origin/Referer با میزبان‌های شناخته‌شده ──
  const hosts = collectHosts(req);
  const originOk = headerHostOk(req.headers.get("origin"), hosts);
  if (originOk !== null) {
    // Origin موجود: نتیجه‌اش قطعی است (مرورگر جعلش نمی‌کند؛
    // مخرب هم نمی‌تواند مقدار «مجاز» بسازد مگر واقعاً از میزبان ما بیاید)
    if (originOk) return NextResponse.next();
    return blocked(req);
  }

  // مرورگرهای قدیمی ممکن است فقط Referer بفرستند
  const refererOk = headerHostOk(req.headers.get("referer"), hosts);
  if (refererOk !== null) {
    if (refererOk) return NextResponse.next();
    return blocked(req);
  }

  // بدون Origin و بدون Referer → کلاینت غیرمرورگری (curl/SDK/تست) → مجاز
  return NextResponse.next();
}

export const config = {
  // فقط API — صفحات و فایل‌های استاتیک بدون هزینه میدل‌ور می‌مانند
  matcher: ["/api/:path*"],
};
