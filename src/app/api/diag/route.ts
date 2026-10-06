// ═════ تشخیص محیط اجرا — GET /api/diag ═════
// این روت «عمداً» هیچ وابستگی‌ای به دیتابیس ندارد تا حتی وقتی
// ماژول db خراب است، وضعیت واقعی محیط (tmpdir، مجوزها، مسیرها)
// را گزارش کند. برای عیب‌یابی دیپلوی space-z / FC ساخته شده است.
import { NextRequest, NextResponse } from "next/server";
import os from "node:os";
import { existsSync } from "node:fs";
import path from "node:path";
import { getAdmin } from "@/lib/core/api";
import { isDirWritable, isFileWritable, runtimeDataDir } from "@/lib/core/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** حذف رمز/رمز عبور از URL دیتابیس (در صورت وجود) */
function maskUrl(u: string | undefined): string | null {
  if (!u) return null;
  return u.replace(/:\/\/([^:@/\s]+):([^@\s]+)@/, "://$1:***@");
}

function probeDir(d: string) {
  return { path: d, exists: existsSync(d), writable: isDirWritable(d) };
}

function probeFile(f: string) {
  const exists = existsSync(f);
  return { path: f, exists, writable: exists ? isFileWritable(f) : false };
}

// ⚠️ فقط مدیر سیستم — پیش‌تر بدون احراز هویت بود و مسیرها/مجوزهای
// سرور را برای هر کسی افشا می‌کرد.
export async function GET(req: NextRequest) {
  const admin = await getAdmin(req);
  if (!admin) {
    return NextResponse.json({ ok: false, error: "دسترسی محدود به مدیر سامانه" }, { status: 403 });
  }

  const tmp = os.tmpdir();
  const bun = (globalThis as unknown as { Bun?: { version: string } }).Bun;

  // مسیرهای کلیدی محیط FC — بدون افشای راز
  const dirs = [
    tmp,
    "/tmp",
    "/dev/shm",
    process.cwd(),
    path.dirname(process.cwd()),
    "/app",
    "/app/db",
    "/app/next-service-dist",
  ].filter((v, i, a) => a.indexOf(v) === i);

  const files = [
    "/app/db/custom.db",
    "/app/db/schema.sql",
    "/app/next-service-dist/db/custom.db",
    "/app/next-service-dist/db/schema.sql",
  ];

  return NextResponse.json({
    ok: true,
    time: new Date().toISOString(),
    runtimeEnv: {
      NODE_ENV: process.env.NODE_ENV ?? null,
      TMPDIR: process.env.TMPDIR ?? null,
      cwd: process.cwd(),
      platform: `${os.platform()}/${os.arch()}`,
      processRuntime: bun ? `bun ${bun.version}` : `node ${process.version}`,
      osTmpdir: tmp,
    },
    databaseUrl: maskUrl(process.env.DATABASE_URL),
    runtimeDataDirChosen: runtimeDataDir(),
    dirProbes: dirs.map(probeDir),
    fileProbes: files.map(probeFile),
  });
}
