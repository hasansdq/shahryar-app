// ═══════════════════════════════════════════════════════════════
// ترمیم‌گر JSON مدل — JSON Repair Engine
// ═══════════════════════════════════════════════════════════════
// مدل زبانی هنگام تولید JSON های طولانی (جداول بزرگ با ده‌ها رشته)
// گاهی گلیچ توکنایزری تولید می‌کند. گلیچ‌های واقعیِ مشاهده‌شده:
//
//   ۱) کوتیشن دوباره‌شده:      [""اسکات با وزن بدن", ...]
//        (باید ["اسکات ... باشد — دابل‌کوت اضافی در شروع رشته)
//   ۲) براکت سرگردان:          "rows":[[]"اسکات ...]
//        (باید [["اسکات ... باشد — ] اضافی بین براکت باز و رشته)
//   ۳) جابجایی براکت/آکولاد:   ..."توضیح"},{"شنا","8",...]
//        (باید ..."توضیح"],["شنا",... باشد — } و { به‌جای ] و [)
//   ۴) کامای جاافتاده بین المان‌ها
//   ۵) newline خام داخل رشته + کامای انتهایی
//
// راهبرد: زنجیره‌های ترمیم «محافظه‌کار → تهاجمی» به‌صورت کاندیدای
// موازی؛ اولین کاندیدایی که هم JSON.parse و هم اعتبارسنجی (zod)
// را پاس کند برنده است — ترمیم تهاجمی هرگز روی JSON سالم اجرا
// نمی‌شود چون کاندیدای ساده‌تر زودتر قبول می‌شود.
// ═══════════════════════════════════════════════════════════════

// ─── ۱) کوتیشن دوباره‌شده — ماشین حالت با lookahead ───
//
// منطق: وقتی داخل رشته‌ایم و به " می‌رسیم، اگر کاراکتر غیرفاصله‌ی
// بعدی «ساختاری» باشد (, ] } : یا " یا EOF) این کوتیشن پایانِ
// واقعی رشته است؛ اگر «محتوایی» باشد (حرف/عدد/فارسی...) کوتیشنِ
// اسپوریوس است و حذف می‌شود. رشته‌ی خالیِ قانونی ("") همیشه
// کاراکتر بعدی ساختاری دارد → هرگز قربانی نمی‌شود.
export function fixDoubledQuotes(s: string): string {
  let out = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      out += ch;
      escaped = true;
      continue;
    }
    if (!inString) {
      if (ch === '"') inString = true;
      out += ch;
      continue;
    }
    // داخل رشته
    if (ch !== '"') {
      out += ch;
      continue;
    }
    // به کوتیشن رسیدیم — پایان واقعی یا اسپوریوس؟
    let j = i + 1;
    while (j < s.length && /\s/.test(s[j])) j++;
    const next = j < s.length ? s[j] : "";
    if (next === "" || next === "," || next === "]" || next === "}" || next === ":" || next === '"') {
      inString = false; // پایان قانونی رشته
      out += ch;
    }
    // else: کوتیشن اسپوریس (گلیش "") → ننویس، در رشته بمان
  }
  return out;
}

// ─── ۲) براکت سرگردان — ] اضافی قبل از شروع رشته ───
//
// الگوی گلیچ: [[]"اسکات  →  باید [["اسکات باشد.
// حالت قانونی [[], (آرایه‌ی خالی تو در تو) همیشه بعدش , یا ] است؛
// فقط وقتی بعدش " بیاید ترمیم می‌کنیم → بی‌خطر.
export function fixStrayClosingBracket(s: string): string {
  return s.replace(/\[\[\](?=")/g, "[[");
}

// ─── ۳) آشتی‌ساز براکت‌ها — پیمایش پشته‌ای ───
//
// بستنِ ناهمسان را با بستنِ درستِ بالای پشته جایگزین می‌کند:
//   } جایی که ] لازم است (بستن ردیف آرایه‌ای) و برعکس.
// براکت‌های بسته‌نشده در انتها بسته می‌شوند؛ بسته‌های سرگردان
// (پشته خالی) حذف می‌شوند. آگاه از رشته (داخل " نادیده گرفته می‌شود).
export function reconcileBrackets(s: string): string {
  const stack: Array<"[" | "{"> = [];
  let out = "";
  let inString = false;
  let escaped = false;

  for (const ch of s) {
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (inString) {
      if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      out += ch;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === "[" || ch === "{") {
      stack.push(ch);
      out += ch;
      continue;
    }
    if (ch === "]" || ch === "}") {
      const top = stack.pop();
      if (!top) continue; // بسته‌ی سرگردان با پشته خالی → حذف
      if ((ch === "]" && top === "[") || (ch === "}" && top === "{")) {
        out += ch; // بستن همسان — سالم
      } else {
        out += top === "[" ? "]" : "}"; // بستن ناهمسان → اصلاح به همسان
      }
      continue;
    }
    out += ch;
  }
  // براکت‌های بازِ مانده را ببند
  for (let k = stack.length - 1; k >= 0; k--) {
    out += stack[k] === "[" ? "]" : "}";
  }
  return out;
}

// ─── ۴) شبه‌آبجکت → آرایه ───
//
// گلیچ جابجایی براکت/آکولاد آبجکت‌هایی می‌سازد که فقط مقادیر
// جدا با کاما دارند و هیچ کلیدی (:) ندارند: {"شنا","8","3"}.
// چنین بدنه‌ای در JSON معتبر وجود خارجی ندارد → به آرایه تبدیل
// می‌شود: ["شنا","8","3"]. آبجکت‌های واقعی (دارای :) دست نمی‌خورند.
const SCALAR_SRC =
  '(?:"(?:[^"\\\\]|\\\\.)*"|true|false|null|-?\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)';
const PSEUDO_OBJECT_RE = new RegExp(
  `\\{\\s*(${SCALAR_SRC}(?:\\s*,\\s*${SCALAR_SRC})*)\\s*\\}`,
  "g"
);
export function pseudoObjectsToArrays(s: string): string {
  return s.replace(PSEUDO_OBJECT_RE, (_m: string, body: string) => `[${body}]`);
}

// ─── ۵) کامای جاافتاده بین المان‌ها ───
//
// وقتی مقداری بسته شده (پایان رشته/آرایه/آبجکت) و بلافاصله مقدار
// جدیدی شروع می‌شود بدون کاما: ["a"]["b"] یا ["a" "b"] → کاما درج می‌شود.
// (فقط قبل از " و { و [ — شروع عددی‌ها مبهم است و دست نمی‌خورند)
export function fixMissingCommas(s: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  let valueEnded = false;

  for (const ch of s) {
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (inString) {
      if (ch === "\\") escaped = true;
      else if (ch === '"') {
        inString = false;
        valueEnded = true;
      }
      out += ch;
      continue;
    }
    if (ch === '"') {
      if (valueEnded) out += ","; // مقدار قبلی بسته، رشته‌ی جدید بدون کاما
      valueEnded = false;
      inString = true;
      out += ch;
      continue;
    }
    if (ch === "{") {
      if (valueEnded) out += ",";
      valueEnded = false;
      out += ch;
      continue;
    }
    if (ch === "[") {
      if (valueEnded) out += ",";
      valueEnded = false;
      out += ch;
      continue;
    }
    if (ch === "]" || ch === "}") {
      valueEnded = true;
      out += ch;
      continue;
    }
    if (ch === "," || ch === ":") {
      valueEnded = false;
      out += ch;
      continue;
    }
    if (/\s/.test(ch)) {
      out += ch;
      continue;
    }
    // رقم/لیترال — اگر مقدار قبلی بسته بوده و این توکن عددی است، کاما لازم است
    if (valueEnded && /[0-9-]/.test(ch)) out += ",";
    valueEnded = false;
    out += ch;
  }
  return out;
}

// ─── ۶) newline خام داخل رشته ───
export function fixRawNewlines(s: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (const ch of s) {
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      out += ch;
      continue;
    }
    if (inString && ch === "\n") {
      out += "\\n";
      continue;
    }
    if (inString && ch === "\r") {
      out += "\\r";
      continue;
    }
    if (inString && ch === "\t") {
      out += "\\t";
      continue;
    }
    out += ch;
  }
  return out;
}


// ─── ۷) کوتیشن‌گذاری اتوم‌های غیراستاندارد ───
//
// گلیچ واقعی دیگر مدل: مقادیر بدون کوتیشن که JSON معتبر ندارند:
//   ["زانو بنشین",۳,۱۰-۱۵,۶۰ ثانیه]  ← عدد فارسی، بازه عددی، عدد+کلمه
// این پاس «آگاه از رشته» است: خارج از رشته‌ها، هر توکن پیوسته‌ی
// غیرساختاری که عدد ASCII/true/false/null نیست داخل کوتیشن می‌رود.
// روی JSON معتبر کاملاً no-op است (چنین توکنی ندارد). کلیدهای
// بدون کوتیشن ({نام: "علی"}) را هم تعمیر می‌کند.
const JSON_SCALAR_RE = /^(?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)$/;

export function quoteUnquotedAtoms(s: string): string {
  let out = "";
  let i = 0;
  let inString = false;
  let escaped = false;

  while (i < s.length) {
    const ch = s[i];
    if (escaped) { out += ch; escaped = false; i++; continue; }
    if (inString) {
      if (ch === "\\") { out += ch; escaped = true; i++; continue; }
      if (ch === '"') inString = false;
      out += ch; i++; continue;
    }
    if (ch === '"') { inString = true; out += ch; i++; continue; }
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") { out += ch; i++; continue; }
    if ("," === ch || "[" === ch || "{" === ch || "]" === ch || "}" === ch || ":" === ch) {
      out += ch; i++; continue;
    }
    // شروع اتوم غیرساختاری — تا نزدیک‌ترین کاراکتر ساختاری/کوتیشن
    let j = i;
    let atom = "";
    while (j < s.length) {
      const c = s[j];
      if (c === "," || c === "]" || c === "}" || c === ":" || c === '"' || c === "[" || c === "{") break;
      atom += c;
      j++;
    }
    const trimmed = atom.trim();
    if (!trimmed) {
      out += atom; // فقط فاصله
    } else if (JSON_SCALAR_RE.test(trimmed)) {
      out += atom; // عدد/لیترال معتبر — دست نخور
    } else {
      // عدد فارسی / بازه / عدد+کلمه / کلید بدون کوتیشن → کوتیشن‌دار
      const lead = atom.slice(0, atom.indexOf(trimmed));
      const trail = atom.slice(atom.indexOf(trimmed) + trimmed.length);
      out += lead + '"' + trimmed + '"' + trail;
    }
    i = j;
  }
  return out;
}


// ─── ۸) کلید items جاافتاده در بلوک‌های لیست ───
//
// گلیچ واقعی: {"type":"bullets":["a","b"]} — مدل کلید "items" را
// جا می‌اندازد و آرایه را مستقیم بعد از مقدار type می‌گذارد.
// الگوی دقیق و کم‌خطر: فقط وقتی مقدار bullets/numbers/kv بلافاصله
// با : و [ ادامه یابد (شکل صحیح "items": است).
const MISSING_ITEMS_RE = /("type"\s*:\s*"(?:bullets|numbers|kv)")\s*:\s*\[/g;

export function fixMissingItemsKey(s: string): string {
  return s.replace(MISSING_ITEMS_RE, '$1,"items":[');
}

// ═══ ترکیب‌بندی کاندیداها ═══
//
// هر کاندیدا یک زنجیره‌ی ترمیم است؛ از محافظه‌کار به تهاجمی
// مرتب شده‌اند. اولین کاندیدایی که JSON.parse + اعتبارسنجی را
// پاس کند برگردانده می‌شود؛ اگر هیچ‌کدام اعتبارسنجی را پاس نکرد،
// اولین قابل‌پارس (شاید اعتبارسنجی مشکل دیگری داشته باشد).

/** یک زنجیره‌ی ترمیم عمیق: کوتیشن → براکت سرگردان → کاما → آشتی براکت → شبه‌آبجکت */
function deepRepair(s: string, opts: { strayBracket?: boolean; missingCommas?: boolean } = {}): string {
  let t = fixDoubledQuotes(s);
  if (opts.strayBracket !== false) t = fixStrayClosingBracket(t);
  t = fixMissingItemsKey(t);
  t = quoteUnquotedAtoms(t); // بعد از fixDoubledQuotes — ترتیب حیاتی
  if (opts.missingCommas) t = fixMissingCommas(t);
  t = reconcileBrackets(t);
  t = pseudoObjectsToArrays(t);
  return t;
}

export interface RepairOutcome {
  /** مقدار پارس‌شده (اگر هیچ کاندیدا پارس نشد null) */
  value: unknown | null;
  /** کاندیدای برنده پارس شد اما اعتبارسنجی پاس نشد؟ */
  validationFailed: boolean;
}

/**
 * پارس JSON با ترمیم چندلایه — API اصلی
 * @param raw متن خام بلوک (شاید با fence/متن اضافی)
 * @param validate اعتبارسنجی اختیاری (مثلاً zod safeParse) — اولین کاندیدای
 *        پاس‌شونده ترجیح دارد
 */
export function parseJsonWithRepair(
  raw: string,
  validate?: (v: unknown) => boolean
): RepairOutcome {
  // پاک‌سازی اولیه: fence، متن اطراف، کامای انتهایی
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    return { value: null, validationFailed: false };
  }
  s = s.slice(first, last + 1);
  s = s.replace(/,\s*([}\]])/g, "$1");

  // پایه‌ی امن: newline خام (هرگز در JSON معتبر نیست)
  const base = fixRawNewlines(s);

  // کاندیداها: محافظه‌کار → تهاجمی
  const candidates: string[] = [
    s,
    base,
    quoteUnquotedAtoms(base),
    fixMissingItemsKey(base),
    fixMissingItemsKey(quoteUnquotedAtoms(base)),
    fixDoubledQuotes(base),
    deepRepair(base),
    deepRepair(base, { strayBracket: false }),
    deepRepair(base, { missingCommas: true }),
    deepRepair(base, { strayBracket: false, missingCommas: true }),
  ];

  const seen = new Set<string>();
  let firstParseable: unknown | null = null;
  let anyParsed = false;

  for (const c of candidates) {
    if (seen.has(c)) continue;
    seen.add(c);
    let v: unknown;
    try {
      v = JSON.parse(c);
    } catch {
      continue;
    }
    if (!anyParsed) {
      firstParseable = v;
      anyParsed = true;
    }
    if (!validate || validate(v)) {
      return { value: v, validationFailed: false };
    }
  }
  return { value: firstParseable, validationFailed: anyParsed };
}
