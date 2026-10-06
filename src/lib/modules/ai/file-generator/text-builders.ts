// ═══════════════════════════════════════════════════════════════
// سازنده‌های متنی هوشیار — CSV (سازگار اکسل) + Markdown + TXT + HTML
// ═══════════════════════════════════════════════════════════════
// CSV: BOM UTF-8 (بدون آن، اکسل فارسی را خراب می‌کند) + استاندارد
//      RFC 4180 (کوت کردن فیلدها، دوبرابرکردن کوتیشن‌ها، CRLF)
// HTML: قالب راست‌چین حرفه‌ای با CSS داخلی — بازشدن آفلاین بدون
//       هیچ وابستگی؛ فونت سیستمی (وزیرمتن → Tahoma)
// ═══════════════════════════════════════════════════════════════

/** کوت کردن امن فیلد CSV مطابق RFC 4180 */
function csvField(v: unknown, delimiter: string): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (s.includes(delimiter) || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export interface TablePayload {
  columns: string[];
  rows: unknown[][];
}

/** CSV با BOM و CRLF — بازشدن بدون خطا در Excel فارسی */
export function buildCsv(payload: TablePayload, delimiter = ","): Buffer {
  const d = delimiter || ",";
  const lines: string[] = [];
  lines.push(payload.columns.map((c) => csvField(c, d)).join(d));
  for (const r of payload.rows) {
    lines.push(r.map((v) => csvField(v, d)).join(d));
  }
  // BOM + CRLF — استاندارد اکسل
  return Buffer.from("\uFEFF" + lines.join("\r\n") + "\r\n", "utf8");
}

/** متن ساده/مارک‌داون — UTF-8 با LF */
export function buildText(text: string): Buffer {
  return Buffer.from(text.replace(/\r\n/g, "\n"), "utf8");
}

/** حذف اسکریپت‌های خطرناک از HTML تولیدی مدل (ایمنی فایل آفلاین) */
function stripDangerousHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

/** قالب HTML راست‌چین حرفه‌ای — CSS داخلی، سازگار با چاپ */
export function buildHtml(title: string, bodyHtml: string, jalaliDateStr: string): Buffer {
  const safeBody = stripDangerousHtml(bodyHtml);
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title.replace(/[<>&]/g, "")}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    font-family: "Vazirmatn", "Segoe UI", Tahoma, "Iranian Sans", sans-serif;
    background: #f1f3f9; color: #1e293b; margin: 0; padding: 24px 12px;
    line-height: 2; font-size: 15px;
  }
  .page {
    max-width: 860px; margin: 0 auto; background: #fff;
    border-radius: 16px; padding: 40px 44px;
    box-shadow: 0 4px 24px rgba(46,58,140,.08);
  }
  h1 { color: #2e3a8c; font-size: 26px; margin: 0 0 6px; }
  h2 { color: #4756d7; font-size: 20px; margin: 28px 0 10px; border-bottom: 2px solid #eef0fb; padding-bottom: 6px; }
  h3 { color: #1e293b; font-size: 17px; margin: 20px 0 8px; }
  p { margin: 8px 0; text-align: justify; }
  .doc-meta { color: #64748b; font-size: 12.5px; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 3px solid #4756d7; border-radius: 2px; }
  table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 13.5px; }
  th { background: #4756d7; color: #fff; padding: 9px 10px; text-align: right; font-weight: 700; }
  td { border: 1px solid #c7cde8; padding: 7px 10px; text-align: right; }
  tr:nth-child(even) td { background: #f6f7fc; }
  blockquote { background: #f6f7fc; border-right: 4px solid #4756d7; margin: 14px 0; padding: 12px 16px; border-radius: 6px; color: #64748b; }
  ul, ol { padding-right: 24px; }
  li { margin: 4px 0; }
  code { background: #eef0fb; border-radius: 5px; padding: 1px 7px; font-size: 13px; direction: ltr; display: inline-block; }
  pre { background: #1e293b; color: #e2e8f0; border-radius: 10px; padding: 16px; overflow-x: auto; direction: ltr; text-align: left; }
  pre code { background: transparent; color: inherit; padding: 0; }
  img { max-width: 100%; border-radius: 10px; }
  hr { border: none; border-top: 1.5px solid #c7cde8; margin: 22px 0; }
  a { color: #4756d7; }
  footer.doc-footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #c7cde8; color: #64748b; font-size: 11.5px; text-align: center; }
  @media print {
    body { background: #fff; padding: 0; }
    .page { box-shadow: none; padding: 20px; border-radius: 0; }
  }
</style>
</head>
<body>
<div class="page">
  <h1>${title}</h1>
  <div class="doc-meta">تاریخ تولید: ${jalaliDateStr} &nbsp;·&nbsp; تولیدشده توسط هوشیار (شهریار)</div>
  ${safeBody}
  <footer class="doc-footer">این سند توسط هوشیار — دستیار هوشمند شهریار — تولید شده است</footer>
</div>
</body>
</html>`;
  return Buffer.from(html, "utf8");
}
