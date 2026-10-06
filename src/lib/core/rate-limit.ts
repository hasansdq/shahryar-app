// ═══════════════════════════════════════════════════════════════
// محدودساز نرخ درخواست (Rate Limiter) — درون‌حافظه‌ای
// محافظت در برابر Brute Force و سوءاستفاده
// ═══════════════════════════════════════════════════════════════

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// پاکسازی دوره‌ای باکت‌های منقضی (جلوگیری از نشت حافظه)
let lastCleanup = Date.now();
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * بررسی محدودیت نرخ
 * @param key کلید یکتا (مثلاً ip + endpoint)
 * @param limit حداکثر تعداد مجاز
 * @param windowMs بازه زمانی (میلی‌ثانیه)
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  cleanup();
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  bucket.count++;
  if (bucket.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }
  return { allowed: true, remaining: limit - bucket.count, retryAfterSec: 0 };
}

/**
 * استخراج IP از هدر درخواست.
 *
 * نکته امنیتی: اولین مدخل XFF قابل جعل است (کلاینت می‌تواند هر چیزی
 * بفرستد). پراکسی معتمد (Caddy با header_up … {remote_host}) مقدار را
 * «بازنویسی» می‌کند، پس تک‌مدخلی = IP واقعی. در حالت چندمدخلی، آخرین
 * مدخل نزدیک‌ترین لایه پروکسی است — مدخل‌های چپ‌تر قابل تزریق توسط
 * مهاجم‌اند. به همین دلیل سقف‌های حساس هرگز «فقط» به IP وابسته
 * نیستند و کلید حساب (شماره موبایل / شناسه کاربر) را هم در بر می‌گیرند.
 */
export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return req.headers.get("x-real-ip") || "unknown";
}
