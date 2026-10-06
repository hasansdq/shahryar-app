// ═════ سلامت سرویس — GET /api/health ═════
// پروب سلامت عمومی برای Docker HEALTHCHECK، اسکریپت deploy.sh و
// مانیتورینگ (مثل uptime-robin / Nagios روی DirectAdmin).
//
// طراحی امن:
//  • «عمومی» است (بدون احراز هویت) — استاندارد liveness/readiness؛
//    هیچ اطلاعات حساسی (مسیر، نسخه، آمار) برنمی‌گرداند.
//  • فقط دو چیز می‌گوید: پروسه زنده است؟ دیتابیس جواب می‌دهد؟
//  • هرگز کش نمی‌شود (force-dynamic + no-store).
//  • کوئری اول از db، خودشفایی اسکیما (schema.sql) را هم فعال
//    می‌کند؛ یعنی «سالم» یعنی دیتابیسِ واقعاً قابل‌استفاده.
//
// ⚠️ برای عیب‌یابی عمیق (مسیرها/مجوزها) از /api/diag استفاده کنید —
//    آن روت فقط با نشست مدیر پاسخ می‌دهد.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

export async function GET() {
  try {
    await db.$queryRawUnsafe("SELECT 1");
    return NextResponse.json(
      { ok: true, db: "up" },
      { headers: NO_STORE }
    );
  } catch (err) {
    console.error("[health] پینگ دیتابیس ناموفق:", err);
    return NextResponse.json(
      { ok: false, db: "down" },
      { status: 503, headers: NO_STORE }
    );
  }
}
