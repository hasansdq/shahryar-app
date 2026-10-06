// ═══════════════════════════════════════════════════════════════
// مفسر کد امن هوشیار — Code Interpreter Sandbox
// ═══════════════════════════════════════════════════════════════
// برای «ویرایش و تحلیل» فایل‌های اکسل/CSV، مدل زبانی کد جاوااسکریپت
// می‌نویسد؛ این ماژول کد را در یک زمینه‌ی ایزوله‌ی node:vm اجرا
// می‌کند. طراحی امنیتی:
//
//  ۱) زمینه تازه (runInNewContext) — قلمرو V8 جدید با سازه‌های خودش؛
//     هیچ سراسریِ میزبان (process، require، fs، شبکه) وجود ندارد
//  ۲) ⚠️ داده به‌صورت «رشته JSON» وارد می‌شود و «داخل قلمرو» پارس
//     می‌شود — اگر آبجکت میزبان مستقیم پاس شود، زنجیره‌ی prototype
//     میزبان (rows[0].constructor.constructor → Function میزبان)
//     مسیر فرار کلاسیک از vm است و کاملاً بسته شده
//  ۳) سقف زمان ۳ ثانیه (timeout سخت V8 برای حلقه‌های بی‌نهایت)
//  ۴) سقف حافظه‌ی قلمرو (resourceLimits) — انفجار تخصیص حافظه
//     فقط همان قلمرو را می‌کشد، نه پردازه‌ی سرور را
//  ۵) سقف اندازه ورودی/خروجی؛ خروجی فقط از مسیر JSON-clone
//     برمی‌گردد — هیچ ارجاعی از سندباکس فرار نمی‌کند
// ═══════════════════════════════════════════════════════════════
import vm from "node:vm";
import { LIMITS } from "./spec";

export interface SandboxResult {
  ok: boolean;
  /** خروجی نرمال‌شده: { columns: string[]; rows: Cell[][] } */
  columns?: string[];
  rows?: unknown[][];
  error?: string;
}

// ─── گارد استاتیک (دفاع در عمق) ───
// برخی runtimeها (مثل bun) قلمرو vm را واقعاً ایزوله نمی‌کنند؛ این
// گارد مستقل از runtime است: واژه‌هایی که در «تبدیل داده» هیچ نقشی
// ندارند اما در سوءاستفاده نقش کلیدی دارند، پیش از اجرا رد می‌شوند.
// ⚠️ حساس به بزرگی/کوچکی حروف: Function سراسری نه کلمه‌کلیدی function
const DANGEROUS_CODE_RE =
  /\b(constructor|prototype|__proto__|eval|Function|require|process|globalThis|importScripts|WebAssembly|WebSocket|Worker|fetch|XMLHttpRequest|Buffer|module|exports)\b/;

/** بازرسی پیش از اجرا: واژه‌های خطرناک → رد فوری */
function staticGuard(code: string): string | null {
  const m = code.match(DANGEROUS_CODE_RE);
  if (m) {
    return `کد transform شامل واژه ممنوع «${m[1]}» است — فقط منطق تبدیل داده مجاز است`;
  }
  return null;
}

/** نرمال‌سازی خروجی مدل به شکل استاندارد columns+rows */
function normalizeResult(raw: unknown): { columns: string[]; rows: unknown[][] } | string {
  // حالت ۱: آرایه‌ای از آرایه‌ها — سطر اول هدر
  if (Array.isArray(raw)) {
    if (raw.length === 0) return "خروجی transform خالی است";
    if (raw.length > LIMITS.transformResultRows) return `خروجی بیش از حد بزرگ است (${raw.length} ردیف)`;

    if (Array.isArray(raw[0])) {
      const header = (raw[0] as unknown[]).map((h) => String(h ?? ""));
      if (header.length === 0 || header.length > LIMITS.sheetCols) return `تعداد ستون‌ها نامعتبر است (${header.length})`;
      const rows: unknown[][] = [];
      for (let i = 1; i < raw.length; i++) {
        const r = raw[i];
        if (!Array.isArray(r)) return `سطر ${i + 1} خروجی آرایه نیست`;
        if (r.length > LIMITS.sheetCols) return `سطر ${i + 1} بیش از ${LIMITS.sheetCols} ستون دارد`;
        rows.push(r.map((v) => (typeof v === "object" && v !== null ? JSON.stringify(v) : (v as unknown))));
      }
      return { columns: header, rows };
    }

    // حالت ۲: آرایه‌ای از اشیاء — هدر از اجتماع کلیدها
    if (typeof raw[0] === "object" && raw[0] !== null) {
      const keySet = new Set<string>();
      for (const item of raw.slice(0, 100)) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          for (const k of Object.keys(item as Record<string, unknown>)) keySet.add(k);
        }
      }
      if (keySet.size === 0 || keySet.size > LIMITS.sheetCols) return `تعداد ستون‌های استخراج‌شده نامعتبر است (${keySet.size})`;
      const columns = [...keySet];
      const rows: unknown[][] = raw.map((item) =>
        columns.map((k) => {
          const v = (item as Record<string, unknown>)?.[k];
          return typeof v === "object" && v !== null ? JSON.stringify(v) : (v ?? null);
        })
      );
      if (rows.length > LIMITS.transformResultRows) return `خروجی بیش از حد بزرگ است (${rows.length} ردیف)`;
      return { columns, rows };
    }

    return "خروجی transform باید آرایه‌ای از ردیف‌ها یا اشیاء باشد";
  }

  // حالت ۳: شیء { columns, rows }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as { columns?: unknown; rows?: unknown };
    if (Array.isArray(obj.columns) && Array.isArray(obj.rows)) {
      const columns = obj.columns.map((c) => String(c ?? ""));
      if (columns.length === 0 || columns.length > LIMITS.sheetCols) return `تعداد ستون‌ها نامعتبر است (${columns.length})`;
      if (obj.rows.length > LIMITS.transformResultRows) return `خروجی بیش از حد بزرگ است (${obj.rows.length} ردیف)`;
      const rows: unknown[][] = obj.rows.map((r, i) => {
        if (!Array.isArray(r)) throw new Error(`سطر ${i + 1} آرایه نیست`);
        return r.map((v) => (v && typeof v === "object" ? JSON.stringify(v) : (v as unknown)));
      });
      return { columns, rows };
    }
    return "شیء خروجی باید { columns, rows } باشد";
  }

  return "خروجی transform نامعتبر است — آرایه یا { columns, rows } برگردان";
}

/** اجرای امن کد transform مدل روی داده‌ی جدولی پیوست */
export function runTransform(
  code: string,
  inputRows: Record<string, unknown>[],
  inputColumns: string[]
): SandboxResult {
  if (!code || code.length > LIMITS.transformCodeChars) {
    return { ok: false, error: "کد transform خالی یا بیش از حد طولانی است" };
  }
  if (inputRows.length === 0) {
    return { ok: false, error: "فایل مبدأ داده‌ای برای پردازش ندارد" };
  }
  const guard = staticGuard(code);
  if (guard) {
    return { ok: false, error: guard };
  }

  // ورودی به‌صورت متن — پارس JSON «داخل قلمرو» انجام می‌شود تا
  // هیچ آبجکت/prototype میزبان وارد سندباکس نشود
  let rowsJson: string;
  let columnsJson: string;
  try {
    rowsJson = JSON.stringify(inputRows);
    columnsJson = JSON.stringify(inputColumns);
  } catch {
    return { ok: false, error: "داده‌ی ورودی قابل سریال‌سازی نیست" };
  }
  // سقف متن ورودی — جلوگیری از انفجار قبل از اجرا
  if (rowsJson.length > 8 * 1024 * 1024) {
    return { ok: false, error: "داده‌ی ورودی بیش از حد بزرگ است" };
  }

  // ⚠️ هیچ سراسری میزبان به sandbox پاس داده نمی‌شود — قلمرو جدید
  // سازه‌های استاندارد خودش (Object/Array/JSON/Math/Intl/...) را دارد
  const sandbox: Record<string, unknown> = {
    __rowsJson: rowsJson,
    __columnsJson: columnsJson,
  };

  try {
    // ⚠️ کل اجرا باید «داخل» runInNewContext باشد — timeout و
    // resourceLimits فقط به همین فراخوانی اعمال می‌شوند، نه به
    // فراخوانی بعدیِ تابعی که برگردانده شود. پس اسکریپت، خودش را
    // هم‌زمان تعریف و اجرا می‌کند (IIFE با this=sandbox).
    const script = [
      "(function () {",
      '"use strict";',
      "const rows = JSON.parse(this.__rowsJson);",
      "const columns = JSON.parse(this.__columnsJson);",
      "const __fn = (function (rows, columns) {",
      code,
      "});",
      "return __fn(rows, columns);",
      "}).call(this);",
    ].join("\n");

    const opts = {
      timeout: 3000, // حلقه بی‌نهایت → خطای timeout
      displayErrors: true,
      // سقف حافظه‌ی این قلمرو — انفجار تخصیص فقط همین isolate را می‌کشد
      resourceLimits: {
        maxOldGenerationSizeMb: 128,
        maxYoungGenerationSizeMb: 32,
        stackSizeMb: 8,
        codeRangeSizeMb: 16,
      },
    } as unknown as vm.RunningScriptOptions;

    const result = vm.runInNewContext(script, sandbox, opts) as unknown;

    // خروجی فقط از مسیر JSON — هیچ ارجاعی از سندباکس خارج نمی‌شود
    const cloned = JSON.parse(JSON.stringify(result === undefined ? null : result)) as unknown;
    const normalized = normalizeResult(cloned);
    if (typeof normalized === "string") {
      return { ok: false, error: normalized };
    }

    // تضمین نوع سلول‌ها: رشته/عدد/بولی/تهی
    const safeCell = (v: unknown): unknown => {
      if (v === null || v === undefined) return null;
      if (typeof v === "string") return v.length > LIMITS.cellText ? v.slice(0, LIMITS.cellText) : v;
      if (typeof v === "number") return Number.isFinite(v) ? v : null;
      if (typeof v === "boolean") return v;
      return String(v);
    };

    return {
      ok: true,
      columns: normalized.columns.map((c) => c.slice(0, 200)),
      rows: normalized.rows.map((r) => r.map(safeCell)),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // پیام خطای امن و کوتاه — بدون ردیاب استک داخلی
    return { ok: false, error: `خطای اجرای کد: ${msg.slice(0, 300)}` };
  }
}
