// ═══════════════════════════════════════════════════════════════
// سازنده فایل Word هوشیار — سند حرفه‌ای کاملاً راست‌چین + فونت وزیرمتن
// ═══════════════════════════════════════════════════════════════
// ویژگی‌ها:
//  • RTL کامل: bidirectional روی پاراگراف‌ها، rightToLeft روی ران‌ها،
//    visuallyRightToLeft روی جدول‌ها (ستون اول = راست‌ترین)
//  • فونت وزیرمتن «داخل فایل جاسازی» می‌شود — روی هر سیستمی درست
//    باز می‌شود حتی بدون فونت نصب‌شده
//  • طراحی حرفه‌ای: سربرگ سند (عنوان/زیرعنوان/تاریخ جلالی)، تیترهای
//    رنگی با خط زیرین، جدول‌های زبرا با هدر رنگی، نقل‌قول با نوار
//    کناری، پاورقی با شماره صفحه
// ═══════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  Footer,
  PageNumber,
  PageBreak,
  VerticalAlign,
  type IPropertiesOptions,
} from "docx";
import type { DocBlock, SheetSpec } from "./spec";

// ─── پالت رنگی هماهنگ با برند شهریار (نیلی-بنفش) ───
const C = {
  primary: "4756D7", // نیلی اصلی
  primaryDark: "2E3A8C",
  accentFill: "EEF0FB", // پس‌زمینه ملایم هدرها
  zebra: "F6F7FC", // ردیف‌های یک‌درمیان
  text: "1E293B",
  gray: "64748B",
  border: "C7CDE8",
};

// ─── فونت جاسازی‌شده ───
let fontCache: { regular: Buffer; bold: Buffer } | null = null;

function loadFonts(): { regular: Buffer; bold: Buffer } | null {
  if (fontCache) return fontCache;
  // ریشه پروژه — مشابه الگوی document-reader (cwd در dev و standalone)
  const candidates = [
    path.join(process.cwd(), "assets", "fonts"),
    path.join(process.cwd(), "..", "..", "assets", "fonts"),
  ];
  for (const dir of candidates) {
    const reg = path.join(dir, "Vazirmatn-Regular.ttf");
    const bold = path.join(dir, "Vazirmatn-Bold.ttf");
    if (existsSync(reg) && existsSync(bold)) {
      fontCache = { regular: readFileSync(reg), bold: readFileSync(bold) };
      return fontCache;
    }
  }
  return null;
}

// ─── اعداد و تاریخ فارسی ───
const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function faNum(n: number | string): string {
  const s = typeof n === "number" ? n.toLocaleString("en-US") : String(n);
  return s.replace(/\d/g, (d) => FA_DIGITS[+d]);
}

function jalaliDate(): string {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Tehran",
  }).format(new Date());
}

// ─── سازنده‌های پایه ───

/** ران متن RTL با فونت وزیرمتن */
function run(text: string, opts: { bold?: boolean; color?: string; size?: number; gray?: boolean } = {}) {
  return new TextRun({
    text,
    rightToLeft: true,
    font: "Vazirmatn",
    bold: opts.bold ?? false,
    color: opts.color ?? (opts.gray ? C.gray : C.text),
    size: opts.size ?? 22, // نیم‌پوینت → ۱۱pt
  });
}

/** پاراگراف RTL */
function rtl(
  children: TextRun[],
  opts: {
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    before?: number;
    after?: number;
    line?: number;
    indent?: number;
    bottomBorder?: boolean;
    shading?: string;
  } = {}
) {
  return new Paragraph({
    bidirectional: true,
    alignment: opts.align ?? AlignmentType.RIGHT,
    spacing: { before: opts.before ?? 0, after: opts.after ?? 120, line: opts.line ?? 340 },
    indent: opts.indent ? { right: opts.indent } : undefined,
    border: opts.bottomBorder
      ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.primary, space: 4 } }
      : undefined,
    shading: opts.shading ? { type: ShadingType.CLEAR, color: "auto", fill: opts.shading } : undefined,
    children,
  });
}

/** سلول جدول */
function cell(content: string, opts: { bold?: boolean; fill?: string; align?: "right" | "center"; color?: string; width?: number } = {}) {
  return new TableCell({
    verticalAlign: VerticalAlign.CENTER,
    shading: opts.fill ? { type: ShadingType.CLEAR, color: "auto", fill: opts.fill } : undefined,
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    margins: { top: 80, bottom: 80, right: 140, left: 140 },
    children: [
      new Paragraph({
        bidirectional: true,
        alignment: opts.align === "center" ? AlignmentType.CENTER : AlignmentType.RIGHT,
        spacing: { before: 0, after: 0, line: 300 },
        children: [run(content, { bold: opts.bold, color: opts.color })],
      }),
    ],
  });
}

/** تبدیل مقدار سلول به متن نمایشی — اعداد با جداکننده هزارگان فارسی */
function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") {
    return Number.isInteger(v) ? faNum(v.toLocaleString("en-US")) : faNum(v.toLocaleString("en-US", { maximumFractionDigits: 4 }));
  }
  if (typeof v === "boolean") return v ? "بله" : "خیر";
  return String(v);
}

const thinBorders = {
  top: { style: BorderStyle.SINGLE, size: 2, color: C.border },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: C.border },
  right: { style: BorderStyle.SINGLE, size: 2, color: C.border },
  left: { style: BorderStyle.SINGLE, size: 2, color: C.border },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: C.border },
  insideVertical: { style: BorderStyle.SINGLE, size: 2, color: C.border },
};

/** جدول زبرا با هدر رنگی — RTL دیداری */
function buildTable(header: string[], rows: unknown[][], opts: { keyCol?: boolean } = {}): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: header.map((h, i) =>
      cell(h, {
        bold: true,
        fill: C.primary,
        color: "FFFFFF",
        align: i === header.length - 1 && header.length > 2 ? "center" : "right",
      })
    ),
  });

  const bodyRows = rows.map((r, ri) => {
    const fill = ri % 2 === 1 ? C.zebra : undefined;
    return new TableRow({
      children: r.map((v, ci) =>
        cell(cellText(v), {
          fill,
          bold: opts.keyCol && ci === 0,
          align: typeof v === "number" ? "center" : "right",
        })
      ),
    });
  });

  return new Table({
    visuallyRightToLeft: true,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: thinBorders,
    rows: [headerRow, ...bodyRows],
  });
}

// ─── بلوک‌ها → المان‌های Word ───
function blockToElements(b: DocBlock): (Paragraph | Table)[] {
  switch (b.type) {
    case "h1":
      return [rtl([run(b.text, { bold: true, color: C.primaryDark, size: 32 })], { before: 320, after: 160, bottomBorder: true })];
    case "h2":
      return [rtl([run(b.text, { bold: true, color: C.primary, size: 27 })], { before: 260, after: 130 })];
    case "h3":
      return [rtl([run(b.text, { bold: true, color: C.text, size: 24 })], { before: 200, after: 110 })];
    case "p":
      return [rtl([run(b.text)], { align: AlignmentType.BOTH, line: 360 })];
    case "bullets":
      return b.items.filter((t) => t.trim() !== "").map((t) => rtl([run("•  ", { bold: true, color: C.primary }), run(t)], { after: 80, indent: 240 }));
    case "numbers": {
      const nums = b.items.filter((t) => t.trim() !== "");
      return nums.map((t, i) => rtl([run(`${faNum(i + 1)}.  `, { bold: true, color: C.primary }), run(t)], { after: 80, indent: 240 }));
    }
    case "quote":
      return [
        rtl([run(`❝ ${b.text}`, { color: C.gray })], {
          before: 160,
          after: 160,
          indent: 400,
          shading: C.zebra,
        }),
      ];
    case "table": {
      const els: (Paragraph | Table)[] = [];
      if (b.caption) els.push(rtl([run(b.caption, { bold: true, color: C.gray, size: 20 })], { after: 80 }));
      els.push(buildTable(b.header, b.rows));
      els.push(rtl([run(" ", { size: 8 })], { after: 40 }));
      return els;
    }
    case "kv": {
      // جدول دو ستونه کلید-مقدار — ستون کلید رنگی
      const rows = new Table({
        visuallyRightToLeft: true,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: thinBorders,
        rows: b.items.map(
          ([k, v]) =>
            new TableRow({
              children: [cell(k, { bold: true, fill: C.accentFill, width: 32 }), cell(v, { width: 68 })],
            })
        ),
      });
      return [rows, rtl([run(" ", { size: 8 })], { after: 40 })];
    }
    case "spacer":
      return [rtl([run(" ", { size: 8 })], { after: 60 })];
    case "pagebreak":
      return [new Paragraph({ children: [new PageBreak()] })];
  }
}

// ─── API اصلی ───
export interface DocPayload {
  title: string;
  subtitle?: string;
  blocks: DocBlock[];
}

export async function buildDocx(payload: DocPayload, fileName: string): Promise<Buffer> {
  const fonts = loadFonts();

  // سربرگ سند: عنوان + زیرعنوان + تاریخ جلالی + خط جداکننده
  const headerEls: Paragraph[] = [
    rtl([run(payload.title, { bold: true, color: C.primaryDark, size: 44 })], { align: AlignmentType.CENTER, after: payload.subtitle ? 100 : 140, line: 400 }),
  ];
  if (payload.subtitle) {
    headerEls.push(rtl([run(payload.subtitle, { gray: true, size: 26 })], { align: AlignmentType.CENTER, after: 120 }));
  }
  headerEls.push(
    rtl([run(`تاریخ تولید: ${jalaliDate()}  ·  تولیدشده توسط هوشیار (شهریار)`, { gray: true, size: 18 })], {
      align: AlignmentType.CENTER,
      after: 220,
      bottomBorder: true,
    })
  );

  const bodyEls = payload.blocks.flatMap(blockToElements);

  const docOptions: IPropertiesOptions = {
    creator: "هوشیار — دستیار شهریار",
    title: payload.title,
    description: `سند تولیدشده توسط هوشیار — ${fileName}`,
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1134, bottom: 1134, right: 1134, left: 1134 }, // ۲ سانتیمتر
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                bidirectional: true,
                alignment: AlignmentType.CENTER,
                border: { top: { style: BorderStyle.SINGLE, size: 2, color: C.border, space: 4 } },
                children: [
                  run("هوشیار · شهریار   —   صفحه ", { gray: true, size: 16 }),
                  new TextRun({ children: [PageNumber.CURRENT], font: "Vazirmatn", size: 16, color: C.gray }),
                  run(" از ", { gray: true, size: 16 }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], font: "Vazirmatn", size: 16, color: C.gray }),
                ],
              }),
            ],
          }),
        },
        children: [...headerEls, ...bodyEls],
      },
    ],
  };

  // جاسازی فونت وزیرمتن داخل فایل — روی هر سیستمی بدون نصب فونت درست باز می‌شود
  // (docx هر نام فونت را یک‌بار جاسازی می‌کند؛ بولد به‌صورت synthetic)
  if (fonts) {
    (docOptions as { fonts?: Array<{ name: string; data: Buffer }> }).fonts = [
      { name: "Vazirmatn", data: fonts.regular },
    ];
  }

  const doc = new Document(docOptions);
  return Packer.toBuffer(doc) as Promise<Buffer>;
}

/** خروجی ماتریسی SheetSpec برای استفاده در جدول‌ها (interface مشترک) */
export type { SheetSpec };
