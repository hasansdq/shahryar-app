// ═════ تشخیص دیتابیس — GET /api/diag/db ═════
// ماژول db با «import پویا» داخل هندلر بارگذاری می‌شود تا حتی اگر
// ارزیابی ماژولش کرش کند، خطای دقیقش به‌صورت JSON گزارش شود (نه
// Internal Server Error خام). سپس تست خواندن و تست نوشتن واقعی
// (CREATE/DROP از همان مسیر journal) انجام می‌شود و خطای دقیق
// SQLite — مثل SQLITE_READONLY — عیناً برگردانده می‌شود.
import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/core/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ⚠️ فقط مدیر سیستم — پیش‌تر بدون احراز هویت بود: فهرست جداول،
// مسیر مطلق دیتابیس و DDL ناشناس در دسترس هر کسی بود.
export async function GET(req: NextRequest) {
  const admin = await getAdmin(req);
  if (!admin) {
    return NextResponse.json({ ok: false, error: "دسترسی محدود به مدیر سامانه" }, { status: 403 });
  }

  const report: Record<string, unknown> = {
    ok: true,
    time: new Date().toISOString(),
  };

  // ۱) بارگذاری ماژول db — جداگانه از بقیه
  try {
    const mod = await import("@/lib/db");
    report.dbModule = "loaded";
    report.diagnostics = mod.getDbDiagnostics();
  } catch (err) {
    report.dbModule = "crashed";
    report.moduleError = String(err);
    // حتی پیام خطای ماژول هم ارزشمند است — پاسخ همچنان 200 JSON است
    return NextResponse.json(report);
  }

  const { db } = await import("@/lib/db");

  // ۲) تست خواندن — فهرست جداول
  try {
    const rows = (await db.$queryRawUnsafe(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    )) as Array<{ name: string }>;
    report.tables = rows.map((r) => r.name);
  } catch (err) {
    report.readTest = "failed";
    report.readError = String(err);
    return NextResponse.json(report);
  }
  report.readTest = "passed";

  // ۳) تست نوشتن واقعی — DDL از همان مسیری که SQLite journal می‌سازد؛
  // اگر فایل‌سیستم فقط‌خواندنی باشد خطای دقیق (مثلاً «attempt to write
  // a readonly database») همین‌جا آشکار می‌شود.
  try {
    await db.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS "_diag_probe" (id INTEGER PRIMARY KEY, ts TEXT)'
    );
    await db.$executeRawUnsafe(
      `INSERT INTO "_diag_probe" (ts) VALUES ('${new Date().toISOString()}')`
    );
    const back = (await db.$queryRawUnsafe(
      'SELECT COUNT(*) AS n FROM "_diag_probe"'
    )) as Array<{ n: number | bigint }>;
    await db.$executeRawUnsafe('DROP TABLE IF EXISTS "_diag_probe"');
    report.writeTest = "passed";
    report.writeProbeRows = back.map((r) => Number(r.n));
  } catch (err) {
    report.writeTest = "failed";
    report.writeError = String(err);
  }

  return NextResponse.json(report);
}
