// ═══════════════════════════════════════════════════════════════
// سازنده فایل Excel هوشیار — شیت‌های حرفه‌ای راست‌چین (exceljs)
// ═══════════════════════════════════════════════════════════════
// ویژگی‌ها:
//  • نمایش RTL (rightToLeft) — ستون اول در سمت راست
//  • هدر رنگی bold با فریز ردیف اول + فیلتر خودکار
//  • ردیف‌های زبرا، قالب‌های عددی (پول/درصد/عدد صحیح)، جمع پایانی
//  • عرض ستون هوشمند (از طول محتوا) یا دلخواه
//  • فونت Vazirmatn برای سلول‌های فارسی (اگر نصب نباشد Excel
//    خودش fallback می‌کند — بدون جاسازی فونت برای سبک ماندن)
// ═══════════════════════════════════════════════════════════════
import type { SheetSpec } from "./spec";

// پالت هماهنگ با برند
const C = {
  headerFill: { argb: "FF4756D7" },
  headerFont: { argb: "FFFFFFFF" },
  zebraFill: { argb: "FFF6F7FC" },
  totalFill: { argb: "FFEEF0FB" },
  text: { argb: "FF1E293B" },
  gray: { argb: "FF64748B" },
  border: { argb: "FFC7CDE8" },
};

const FONT = "Vazirmatn";

const thinBorder = {
  top: { style: "thin" as const, color: C.border },
  left: { style: "thin" as const, color: C.border },
  bottom: { style: "thin" as const, color: C.border },
  right: { style: "thin" as const, color: C.border },
};

/** فرمت عددی هر ستون بر اساس برچسب colFormats */
const NUM_FMT: Record<string, string> = {
  money: "#,##0",
  percent: "0.0%",
  int: "#,##0",
  date: "yyyy-mm-dd",
  text: "@",
};

/** عرض ستون هوشمند: حداکثر طول محتوای ستون + حاشیه */
function smartWidth(colIdx: number, header: string, rows: unknown[][], custom?: number[]): number {
  if (custom && custom[colIdx]) return custom[colIdx];
  let max = header.length;
  for (const r of rows.slice(0, 500)) {
    const v = r[colIdx];
    const len = typeof v === "number" ? String(v).length + 3 : String(v ?? "").length;
    if (len > max) max = len;
  }
  // متن فارسی فشرده‌تر است؛ حداقل ۱۰ و حداکثر ۴۵
  return Math.min(45, Math.max(10, Math.ceil(max * 1.15) + 3));
}

/** آیا ستونی عددی است؟ (برای جمع پایانی) */
function isNumericColumn(rows: unknown[][], ci: number): boolean {
  let nums = 0;
  let checked = 0;
  for (const r of rows.slice(0, 100)) {
    const v = r[ci];
    if (v === null || v === undefined || v === "") continue;
    checked++;
    if (typeof v === "number") nums++;
    else if (typeof v === "string" && /^-?\d+([.,]\d+)?$/.test(v.trim())) nums++;
  }
  return checked > 0 && nums / checked >= 0.8;
}

export async function buildXlsx(sheets: SheetSpec[]): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "هوشیار — دستیار شهریار";
  wb.created = new Date();

  const usedNames = new Set<string>();
  for (const spec of sheets) {
    // نام شیت یکتا و امن (اکسل نام‌های تکراری را نمی‌پذیرد)
    let name = spec.name.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "برگه ۱";
    if (usedNames.has(name)) {
      let i = 2;
      while (usedNames.has(`${name} ${i}`)) i++;
      name = `${name} ${i}`.slice(0, 31);
    }
    usedNames.add(name);

    const ws = wb.addWorksheet(name, {
      views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }],
    });

    const nCols = spec.columns.length;
    const colFormats = spec.colFormats || [];

    // ─── هدر ───
    const headerRow = ws.getRow(1);
    headerRow.height = 26;
    for (let ci = 0; ci < nCols; ci++) {
      const cell = headerRow.getCell(ci + 1);
      cell.value = spec.columns[ci];
      cell.font = { name: FONT, bold: true, size: 12, color: C.headerFont };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: C.headerFill };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = thinBorder;
    }

    // ─── بدنه ───
    for (let ri = 0; ri < spec.rows.length; ri++) {
      const row = ws.getRow(ri + 2);
      const zebra = ri % 2 === 1;
      for (let ci = 0; ci < nCols; ci++) {
        const cell = row.getCell(ci + 1);
        const v = spec.rows[ri][ci] ?? null;

        // رشته‌های عددیِ ستون عددی → عدد واقعی (تا جمع و فیلتر کار کند)
        let value: unknown = v;
        if (typeof v === "string" && v.trim() !== "" && isNumericColumn(spec.rows, ci) && /^-?\d+([.,]\d+)?$/.test(v.trim())) {
          value = parseFloat(v.replace(/,/g, ""));
        }
        cell.value = value as string | number | boolean | null;

        const fmt = colFormats[ci];
        if (fmt && NUM_FMT[fmt]) cell.numFmt = NUM_FMT[fmt];
        else if (typeof value === "number") cell.numFmt = "#,##0";

        cell.font = { name: FONT, size: 11, color: C.text };
        cell.alignment = {
          horizontal: typeof value === "number" ? "center" : "right",
          vertical: "middle",
          wrapText: false,
          readingOrder: "rtl",
        };
        cell.border = thinBorder;
        if (zebra) cell.fill = { type: "pattern", pattern: "solid", fgColor: C.zebraFill };
      }
    }

    // ─── ردیف جمع (فقط ستون‌های عددی) ───
    if (spec.totals) {
      const tr = ws.getRow(spec.rows.length + 2);
      const numericCols: number[] = [];
      for (let ci = 0; ci < nCols; ci++) {
        const cell = tr.getCell(ci + 1);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: C.totalFill };
        cell.border = thinBorder;
        cell.font = { name: FONT, bold: true, size: 11, color: C.text };
        cell.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" };
        if (isNumericColumn(spec.rows, ci)) {
          numericCols.push(ci);
          const colLetter = ws.getColumn(ci + 1).letter;
          cell.value = { formula: `SUM(${colLetter}2:${colLetter}${spec.rows.length + 1})` } as { formula: string };
          cell.numFmt = colFormats[ci] && NUM_FMT[colFormats[ci]] ? NUM_FMT[colFormats[ci]] : "#,##0";
        } else if (ci === 0) {
          cell.value = "جمع کل";
          cell.alignment = { horizontal: "right", vertical: "middle", readingOrder: "rtl" };
        }
      }
      if (numericCols.length === 0) ws.spliceRows(spec.rows.length + 2, 1); // هیچ ستون عددی نبود → حذف ردیف جمع
    }

    // ─── عرض ستون‌ها + فیلتر ───
    for (let ci = 0; ci < nCols; ci++) {
      ws.getColumn(ci + 1).width = smartWidth(ci, spec.columns[ci], spec.rows, spec.columnWidths);
    }
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: nCols } };
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
