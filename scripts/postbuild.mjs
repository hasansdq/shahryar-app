#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// پس از build — آماده‌سازی کامل بسته standalone برای دیپلوی
// ═══════════════════════════════════════════════════════════════
// کارها:
//  ۱) تایید server.js و BUILD_ID
//  ۲) کپی static به «مسیر distDir واقعی داخل standalone»
//  ۳) کپی public و storage/media داخل standalone
//  ۴) کپی .env و ثبت DEPLOY_INFO
//  ۵) ساخت خروجی سازگار با pipeline دیپلوی z.ai در .next
//
// ⚠️ نکته حیاتی ۱ — باگ distDir سفارشی:
// در next.config.ts ما distDir = ".next-prod" داریم (برای جداسازی
// build از state سرور dev). در حالت output:standalone ، Next محتوای
// build را داخل `standalone/.next/` کپی می‌کند اما distDir داخل
// server.js همان «./.next-prod» می‌ماند؛ یعنی سرور در زمان اجرا
// فایل‌ها را در `standalone/.next-prod/` می‌جوید. راه‌حل: static
// در همان مسیر distDir داخل standalone قرار می‌گیرد.
//
// ⚠️ نکته حیاتی ۲ — pipeline دیپلوی z.ai (.zscripts/build.sh):
// اسکریپت build.sh پلتفرم بعد از `bun run build` این‌ها را انتظار دارد:
//   • .next/standalone/server.js  (چک سلامت؛ نبودش = شکست دیپلوی!)
//   • .next/static                 (کپی به next-service-dist/.next/static)
//   • public/                      (کپی به next-service-dist/public)
// و «storage/» را بسته‌بندی نمی‌کند؛ پس رسانه‌های موجود باید از طریق
// standalone همراه بسته شوند (پوشه ۳ پایین).
// ما این خروجی سازگار را می‌سازیم «بدون لمس .next/dev» تا سرور dev
// در حال اجرا خراب نشود.
// ═══════════════════════════════════════════════════════════════

import {
  cpSync,
  existsSync,
  readFileSync,
  writeFileSync,
  rmSync,
  readdirSync,
  statSync,
  mkdirSync,
  realpathSync,
  lstatSync,
} from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const prodDir = join(root, ".next-prod");
const standaloneDir = join(prodDir, "standalone");

const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

const countFiles = (d) =>
  readdirSync(d, { recursive: true }).filter((f) => {
    try {
      return statSync(join(d, f)).isFile();
    } catch {
      return false;
    }
  }).length;

// ─── ۱) تایید ساختار خروجی build ───
if (!existsSync(join(standaloneDir, "server.js")))
  fail("server.js در خروجی standalone پیدا نشد — build ناقص است");
const buildId = readFileSync(join(prodDir, "BUILD_ID"), "utf8").trim();
console.log(`✓ server.js و BUILD_ID (${buildId}) موجودند`);

// ─── ۲) تشخیص distDir واقعی از server.js ───
const serverJs = readFileSync(join(standaloneDir, "server.js"), "utf8");
const distMatch = serverJs.match(/"distDir":"\.?\/?([^"]+)"/);
const distDirName = distMatch ? distMatch[1] : ".next";
console.log(`✓ distDir سرور: ${distDirName}`);

const targetDir = join(standaloneDir, distDirName);
const legacyDir = join(standaloneDir, ".next");

if (!existsSync(targetDir)) {
  if (existsSync(legacyDir)) {
    cpSync(legacyDir, targetDir, { recursive: true });
    console.log(`✓ محتوای .next → ${distDirName} (مطابق distDir سرور)`);
  } else {
    fail(`نه ${distDirName} و نه .next داخل standalone پیدا نشد`);
  }
}

// ─── ۳) کپی استاتیک‌ها به مسیر distDir ───
const staticSrc = join(prodDir, "static");
const staticDst = join(targetDir, "static");
rmSync(staticDst, { recursive: true, force: true });
cpSync(staticSrc, staticDst, { recursive: true });

const srcCount = countFiles(staticSrc);
const dstCount = countFiles(staticDst);
if (srcCount === 0) fail("پوشه static خروجی build خالی است — build خراب است");
if (srcCount !== dstCount)
  fail(`کپی استاتیک ناقص: ${dstCount} از ${srcCount} فایل`);
console.log(`✓ static → standalone/${distDirName}/static (${dstCount} فایل)`);

// ─── ۴) حذف پوشه تکراری ───
if (legacyDir !== targetDir && existsSync(legacyDir)) {
  rmSync(legacyDir, { recursive: true, force: true });
  console.log("✓ پوشه تکراری standalone/.next حذف شد");
}

// ─── ۵) کپی public ───
const publicDir = join(root, "public");
if (existsSync(publicDir)) {
  cpSync(publicDir, join(standaloneDir, "public"), { recursive: true });
  console.log("✓ public → standalone/public");
}

// ─── ۶) کپی رسانه‌های موجود داخل standalone ───
// build.sh پلتفرم storage/ را بسته‌بندی نمی‌کند ولی standalone را کامل
// کپی می‌کند؛ پس رسانه‌ها را اینجا می‌گذاریم تا با بسته دیپلوی بیایند.
// در زمان اجرا، mediaRoot از cwd (next-service-dist) حل می‌شود و همان
// storage/media داخل بسته را می‌بیند — هم فایل‌های قدیمی سرو می‌شوند،
// هم آپلودهای جدید همان‌جا می‌نشینند.
const mediaSrc = join(root, "storage", "media");
if (existsSync(mediaSrc)) {
  const mediaDst = join(standaloneDir, "storage", "media");
  rmSync(mediaDst, { recursive: true, force: true });
  cpSync(mediaSrc, mediaDst, { recursive: true });
  console.log(`✓ storage/media → standalone/storage/media (${countFiles(mediaDst)} فایل)`);
}

// ─── ۶-الف) بازتولید db/schema.sql از prisma/schema.prisma ───
// خودشفایی runtime دیتابیس (src/lib/db.ts) از این فایل تغذیه می‌شود.
// اگر فرسوده شود (مثل وقتی که جداول جدید — اقتصاد توکن، انجمن‌ها،
// پست‌ها — به اسکیما اضافه شده ولی schema.sql به‌روز نشده)، در نبود
// سرویس migrate دیتابیسِ ناقص ساخته می‌شود و روت‌های همان ماژول‌ها
// ۵۰۰ می‌شوند. اینجا «در هر build» از منبع حقیقت بازتولید و
// راستی‌آزمایی می‌شود — همان کار scripts/gen-schema-sql.sh، خودکار.
{
  let diff = "";
  try {
    diff = execSync(
      "./node_modules/.bin/prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script",
      {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        // اسکیمای datasource به env نیاز دارد — برای diff نیازی به DB زنده نیست
        env: {
          ...process.env,
          DATABASE_URL: process.env.DATABASE_URL || "file:/build-runtime/custom.db",
        },
      }
    );
  } catch (err) {
    fail(`بازتولید db/schema.sql ناموفق بود (prisma migrate diff): ${err?.message || err}`);
  }
  const schemaSql = diff
    .replace(/^CREATE TABLE "/gm, 'CREATE TABLE IF NOT EXISTS "')
    .replace(/^CREATE UNIQUE INDEX "/gm, 'CREATE UNIQUE INDEX IF NOT EXISTS "')
    .replace(/^CREATE INDEX "/gm, 'CREATE INDEX IF NOT EXISTS "');

  // ضامن هم‌خوانی: هر مدل prisma باید دقیقاً یک جدول در DDL داشته باشد
  // (نام جدول = نام مدل، یا مقدار @@map در صورت وجود — مثل module_configs)
  const ddlTables = [...schemaSql.matchAll(/CREATE TABLE IF NOT EXISTS "([^"]+)"/g)].map((m) => m[1]);
  const schemaText = readFileSync(join(root, "prisma", "schema.prisma"), "utf8");
  // بلوک مدل از «^model Name {» تا «}» در ابتدای خط — چون بدنه‌ی مدل
  // می‌تواند «}» داشته باشد (مثل @default("{}")) و [^}]* را می‌شکند.
  const modelTables = [...schemaText.matchAll(/^model (\w+)\s*\{([\s\S]*?)^\}/gm)].map(([, name, body]) => {
    const map = body.match(/@@map\("([^"]+)"\)/);
    return { model: name, table: map ? map[1] : name };
  });
  if (ddlTables.length === 0)
    fail("prisma migrate diff هیچ جدولی تولید نکرد — schema.prisma را بررسی کنید");
  const missing = modelTables.filter((mt) => !ddlTables.includes(mt.table));
  if (missing.length > 0)
    fail(
      `ناهم‌خوانی اسکیما: ${missing.length} مدل بدون جدول در DDL — ${missing.map((m) => `${m.model}→${m.table}`).join(", ")}`
    );
  if (ddlTables.length !== modelTables.length)
    fail(`ناهم‌خوانی اسکیما: ${modelTables.length} مدل ولی ${ddlTables.length} جدول در DDL`);
  mkdirSync(join(root, "db"), { recursive: true });
  writeFileSync(join(root, "db", "schema.sql"), schemaSql);
  console.log(
    `✓ db/schema.sql بازتولید شد: ${ddlTables.length} جدول — هم‌گام با ${modelTables.length} مدل prisma`
  );
}

// ─── ۶) کپی دیتابیس + اسکیمای خودشفا داخل standalone ───
// db/custom.db: منبع fallback داده‌ها اگر DATABASE_URL حل نشد
// db/schema.sql: DDLِ idempotent — زمان اجرا اگر جدولی نبود اعمال می‌شود
// (خودشفایی؛ مستقل از اینکه pipeline دیپلوی db push را اجرا کرده یا نه)
const dbSrc = join(root, "db");
if (existsSync(dbSrc)) {
  const dbDst = join(standaloneDir, "db");
  mkdirSync(dbDst, { recursive: true });
  for (const f of readdirSync(dbSrc)) {
    if (!f.endsWith(".db") && f !== "schema.sql") continue;
    cpSync(join(dbSrc, f), join(dbDst, f));
  }
  const hasSchema = existsSync(join(dbDst, "schema.sql"));
  if (!hasSchema) {
    fail("db/schema.sql داخل بسته نیست — ابتدا scripts/gen-schema-sql.sh را اجرا کنید");
  }
  console.log(`✓ db/ → standalone/db (custom.db + schema.sql)`);
} else {
  fail("پوشه db/ یافت نشد — دیتابیس و schema.sql باید بسته شوند");
}

// ─── ۷) .env داخل standalone (اگر نبود) ───
const envSrc = join(root, ".env");
const envDst = join(standaloneDir, ".env");
if (existsSync(envSrc) && !existsSync(envDst)) {
  writeFileSync(envDst, readFileSync(envSrc));
  console.log("✓ .env → standalone/.env");
}

// ─── ۸) ثبت شناسه build ───
writeFileSync(join(standaloneDir, "DEPLOY_INFO"), [
  `buildId=${buildId}`,
  `builtAt=${new Date().toISOString()}`,
  `node=${process.version}`,
  `distDir=${distDirName}`,
].join("\n"));
console.log("✓ DEPLOY_INFO نوشته شد");

// ─── ۹) تبدیل symlinkها به فایل واقعی (سازگاری محیط دیپلوی) ───
// ⚠️ باگ Next 16 / Turbopack با distDir سفارشی: برای ماژول‌های external
// یک استاب «hash‌دار» به‌صورت «symlink مطلق» ساخته می‌شود:
//   standalone/.next-prod/node_modules/@prisma/client-<hash>
//     → /home/z/my-project/.next-prod/standalone/node_modules/@prisma/client
// این symlink در سندباکسِ build حل می‌شود ولی روی محیط دیپلوی (FC با
// مسیر /app/...) هدفش وجود ندارد → require با ENOENT می‌شکند:
//   «Failed to load external module @prisma/client-<hash>»
// و همه‌ی روت‌های API خام ۵۰۰ می‌شوند. راه‌حل قطعی و مستقل از نوع
// دیپلویمنت: هر symlink داخل standalone به «کپی واقعیِ» محتوایش
// تبدیل می‌شود — بسته فقط به خودش وابسته می‌ماند.
const dereferenceSymlinks = (dir) => {
  const links = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isSymbolicLink()) {
        links.push(p);
        continue;
      }
      if (e.isDirectory()) stack.push(p);
    }
  }
  for (const link of links) {
    let target;
    try {
      target = realpathSync(link); // در زمان build همیشه موجود است
    } catch {
      // symlink شکسته — هیچ هدفی ندارد؛ حذفش کنیم (شیم CLI است،
      // در runtime از طریق require استفاده نمی‌شود)
      rmSync(link, { force: true });
      continue;
    }
    rmSync(link, { force: true });
    if (statSync(target).isDirectory()) {
      cpSync(target, link, { recursive: true, dereference: true });
    } else {
      cpSync(target, link);
    }
  }
  return links;
};

const linksFixed = dereferenceSymlinks(standaloneDir);
if (linksFixed.length > 0) {
  console.log(
    `✓ ${linksFixed.length} symlink به فایل واقعی تبدیل شد (سازگاری محیط دیپلوی):`
  );
  for (const l of linksFixed)
    console.log(`    • ${l.replace(standaloneDir + "/", "")} → کپی واقعی`);
}

// ─── ۹-ب) کپی پکیج‌های موتور خواندن اسناد «با closure کامل وابستگی‌ها» ───
// pdf-parse / mammoth / xlsx در زمان اجرا با createRequire لود می‌شوند و
// ردیاب استاتیک NFT وابستگی‌های آن‌ها را نمی‌بیند (فقط فولدر خودِ پکیج
// کپی می‌شد؛ underscore و node-ensure جا می‌ماندند → خطای require در
// production). اینجا closure کامل وابستگی‌ها (بازگشتی) کپی می‌شود.
const RUNTIME_REQUIRE_PACKAGES = ["pdf-parse", "mammoth", "xlsx", "docx", "exceljs", "@react-pdf/renderer"];

function copyPackageWithDeps(pkgName, copied) {
  const resolvePkgDir = (name, fromDir) => {
    // جستجوی node_modules/name با بالا رفتن از fromDir (hoisting استاندارد)
    let dir = fromDir;
    for (let i = 0; i < 12; i++) {
      const cand = join(dir, "node_modules", ...name.split("/"));
      if (existsSync(cand)) return cand;
      const parent = dirname(dir);
      if (parent === dir) return null;
      dir = parent;
    }
    return null;
  };

  const stack = [pkgName];
  while (stack.length) {
    const name = stack.pop();
    if (copied.has(name)) continue;
    copied.add(name);
    const src = resolvePkgDir(name, root);
    if (!src) {
      console.warn(`  ⚠ پکیج ${name} در node_modules پیدا نشد — رد شد`);
      continue;
    }
    const dst = join(standaloneDir, "node_modules", ...name.split("/"));
    try {
      // idempotency: اگر از اجرای قبلی postbuild مانده، اول پاک شود —
      // cpSync روی درختی که قبلاً dereference شده EEXIST می‌دهد.
      if (existsSync(dst)) rmSync(dst, { recursive: true, force: true });
      cpSync(src, dst, { recursive: true, dereference: true });
    } catch (err) {
      console.warn(`  ⚠ کپی ${name} ناموفق: ${err.message}`);
      continue;
    }
    // وابستگی‌های این پکیج هم کپی شوند (بازگشتی)
    let deps = [];
    try {
      const pj = JSON.parse(readFileSync(join(src, "package.json"), "utf8"));
      deps = Object.keys({ ...pj.dependencies });
    } catch {}
    for (const d of deps) stack.push(d);
  }
}

const runtimeCopied = new Set();
for (const p of RUNTIME_REQUIRE_PACKAGES) copyPackageWithDeps(p, runtimeCopied);
console.log(
  `✓ ${RUNTIME_REQUIRE_PACKAGES.join("، ")} + ${runtimeCopied.size} پکیجِ closure وابستگی‌ها → standalone/node_modules`
);

// ─── ۹-ت) کپی فونت‌های فارسی سازنده‌های سند (docx/pdf) ───
// وزیرمتن برای جاسازی در Word و رندر PDF — باید داخل بسته باشد
const fontsSrc = join(root, "assets", "fonts");
if (existsSync(fontsSrc)) {
  const fontsDst = join(standaloneDir, "assets", "fonts");
  mkdirSync(fontsDst, { recursive: true });
  let copied = 0;
  for (const f of readdirSync(fontsSrc)) {
    if (f.toLowerCase().endsWith(".ttf")) {
      cpSync(join(fontsSrc, f), join(fontsDst, f));
      copied++;
    }
  }
  console.log(`✓ ${copied} فونت TTF → standalone/assets/fonts (وزیرمتن برای Word/PDF)`);
} else {
  fail("پوشه assets/fonts پیدا نشد — فونت وزیرمتن برای تولید سند لازم است");
}

// ─── ۹-پ) لاغرسازی pdf-parse در بسته‌ی standalone ───
// pdf-parse@1 چهار نسخه‌ی bundled از pdf.js دارد (~۳۰MB) ولی ما همیشه
// با نسخه‌ی پیش‌فرض (v1.10.100) صدا می‌زنیم؛ بقیه + تست‌ها در بسته‌ی
// production حذف می‌شوند (فقط داخل standalone — نصب اصلی دست‌نخورده).
const pdfParseDir = join(standaloneDir, "node_modules", "pdf-parse");
if (existsSync(pdfParseDir)) {
  const pdfJsDir = join(pdfParseDir, "lib", "pdf.js");
  if (existsSync(pdfJsDir)) {
    for (const v of readdirSync(pdfJsDir)) {
      if (v.startsWith("v") && v !== "v1.10.100")
        rmSync(join(pdfJsDir, v), { recursive: true, force: true });
    }
    rmSync(join(pdfParseDir, "test"), { recursive: true, force: true });
    console.log("✓ pdf-parse لاغر شد (فقط v1.10.100 حفظ شد)");
  }
}

// ─── ۹-ث) پاس دوم dereference ───
// باگ fs.cpSync: گزینه‌ی dereference فقط روی ورودیِ سطح‌بالا اعمال
// می‌شود، نه symlinkهای تودرتو — کپی closure پکیج‌ها (۹-ب) می‌تواند
// symlinkهایی مثل exceljs/node_modules/.bin/uuid وارد بسته کند.
// پاس دوم بعد از همه‌ی مراحل کپی، بسته را صددرصد self-contained می‌کند.
{
  const nestedLinks = dereferenceSymlinks(standaloneDir);
  if (nestedLinks.length > 0) {
    console.log(
      `✓ پاس دوم dereference: ${nestedLinks.length} symlink تودرتو به فایل واقعی تبدیل شد`
    );
    for (const l of nestedLinks)
      console.log(`    • ${l.replace(standaloneDir + "/", "")} → کپی واقعی`);
  }
}

// ضامن ساختاری: بعد از تبدیل، «هیچ» symlinkی نباید باقی مانده باشد —
// چون هر symlink (مطلق یا نسبی) روی محیط دیپلوی می‌تواند بشکند.
const remainingLinks = [];
const checkStack = [standaloneDir];
while (checkStack.length) {
  const d = checkStack.pop();
  let entries;
  try {
    entries = readdirSync(d, { withFileTypes: true });
  } catch {
    continue;
  }
  for (const e of entries) {
    const p = join(d, e.name);
    let st;
    try {
      st = lstatSync(p);
    } catch {
      continue;
    }
    if (st.isSymbolicLink()) {
      remainingLinks.push(p);
    } else if (st.isDirectory()) {
      checkStack.push(p);
    }
  }
}
if (remainingLinks.length > 0) {
  fail(
    `symlink باقی‌مانده در standalone (خطر شکستن روی محیط دیپلوی): ${remainingLinks.join(", ")}`
  );
}

// ─── ۱۰) خروجی سازگار با pipeline دیپلوی z.ai ───
// .next/standalone + .next/static — همان چیزی که build.sh می‌جوید.
// فقط همین دو زیرپوشه ساخته/جایگزین می‌شوند؛ .next/dev دست‌نخورده.
const compatStandalone = join(root, ".next", "standalone");
const compatStatic = join(root, ".next", "static");
try {
  mkdirSync(join(root, ".next"), { recursive: true });
  rmSync(compatStandalone, { recursive: true, force: true });
  cpSync(standaloneDir, compatStandalone, { recursive: true });
  rmSync(compatStatic, { recursive: true, force: true });
  cpSync(staticSrc, compatStatic, { recursive: true });
  if (!existsSync(join(compatStandalone, "server.js")))
    fail("ساخت .next/standalone برای pipeline پلتفرم شکست خورد");
  console.log("✓ .next/standalone + .next/static برای pipeline دیپلوی z.ai ساخته شد");
} catch (err) {
  fail(`ساخت خروجی سازگار با پلتفرم ناموفق: ${err.message}`);
}

console.log("بسته standalone آماده دیپلوی است ✓");
