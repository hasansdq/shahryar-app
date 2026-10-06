// ═══════════════════════════════════════════════════════════════
// سازنده فایل PDF هوشیار — سند حرفه‌ای راست‌چین با @react-pdf/renderer
// ═══════════════════════════════════════════════════════════════
// • موتور متن bidi + شکل‌دهی حروف فارسی به‌صورت توکار
// • فونت وزیرمتن (Regular/Bold) از assets/fonts
// • طراحی حرفه‌ای: سربرگ سند، تیترهای رنگی، جدول زبرا، نقل‌قول،
//   پاورقی تکرارشونده با شماره صفحه فارسی
// ═══════════════════════════════════════════════════════════════
import React from "react";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import {
  renderToBuffer,
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { DocBlock } from "./spec";

// ─── پالت هماهنگ با برند شهریار ───
const COLORS = {
  primary: "#4756D7",
  primaryDark: "#2E3A8C",
  accentFill: "#EEF0FB",
  zebra: "#F6F7FC",
  text: "#1E293B",
  gray: "#64748B",
  border: "#C7CDE8",
};

// ─── ثبت فونت (یک‌بار) ───
let fontsReady = false;
function ensureFonts(): boolean {
  if (fontsReady) return true;
  const candidates = [
    path.join(process.cwd(), "assets", "fonts"),
    path.join(process.cwd(), "..", "..", "assets", "fonts"),
  ];
  for (const dir of candidates) {
    const reg = path.join(dir, "Vazirmatn-Regular.ttf");
    const bold = path.join(dir, "Vazirmatn-Bold.ttf");
    if (existsSync(reg) && existsSync(bold)) {
      Font.register({
        family: "Vazirmatn",
        fonts: [
          { src: reg, fontWeight: 400 },
          { src: bold, fontWeight: 700 },
        ],
      });
      fontsReady = true;
      return true;
    }
  }
  return false;
}

// ─── ابزارهای فارسی ───
const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
function faNum(n: number | string): string {
  return String(n).replace(/\d/g, (d) => FA_DIGITS[+d]);
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
function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number")
    return Number.isInteger(v) ? faNum(v.toLocaleString("en-US")) : faNum(v.toLocaleString("en-US", { maximumFractionDigits: 4 }));
  if (typeof v === "boolean") return v ? "بله" : "خیر";
  return String(v);
}

// ─── استایل‌ها ───
const el = React.createElement;

function buildStyles() {
  return StyleSheet.create({
    page: { paddingTop: 48, paddingBottom: 56, paddingHorizontal: 46, fontFamily: "Vazirmatn", fontSize: 10.5, color: COLORS.text, lineHeight: 1.75 },
    // سربرگ سند (فقط صفحه اول)
    docTitle: { fontSize: 21, fontWeight: 700, color: COLORS.primaryDark, textAlign: "center", marginBottom: 6 },
    docSubtitle: { fontSize: 11.5, color: COLORS.gray, textAlign: "center", marginBottom: 6 },
    docMeta: { fontSize: 8.5, color: COLORS.gray, textAlign: "center", marginBottom: 10 },
    titleRule: { height: 2.5, backgroundColor: COLORS.primary, borderRadius: 2, marginBottom: 18 },
    // بلوک‌ها
    h1: { fontSize: 15, fontWeight: 700, color: COLORS.primaryDark, textAlign: "right", marginTop: 14, marginBottom: 6 },
    h1Rule: { height: 1.2, backgroundColor: COLORS.border, marginBottom: 8 },
    h2: { fontSize: 12.5, fontWeight: 700, color: COLORS.primary, textAlign: "right", marginTop: 10, marginBottom: 5 },
    h3: { fontSize: 11, fontWeight: 700, color: COLORS.text, textAlign: "right", marginTop: 8, marginBottom: 4 },
    p: { fontSize: 10.5, textAlign: "right", marginBottom: 7, lineHeight: 1.85 },
    bullet: { flexDirection: "row-reverse", marginBottom: 4, paddingRight: 10 },
    bulletDot: { color: COLORS.primary, fontWeight: 700, marginLeft: 6 },
    bulletText: { flex: 1, textAlign: "right" },
    quoteBox: { backgroundColor: COLORS.zebra, borderRightWidth: 3, borderRightColor: COLORS.primary, borderRadius: 4, padding: 10, marginTop: 6, marginBottom: 10 },
    quoteText: { color: COLORS.gray, textAlign: "right", lineHeight: 1.8 },
    caption: { fontSize: 9, color: COLORS.gray, textAlign: "right", marginBottom: 4 },
    spacer: { height: 8 },
    // جدول
    table: { marginBottom: 10 },
    tr: { flexDirection: "row-reverse" }, // ستون اول = راست‌ترین
    th: { backgroundColor: COLORS.primary, color: "#FFFFFF", fontWeight: 700, fontSize: 9.5, paddingVertical: 6, paddingHorizontal: 4, border: 0.7, borderColor: COLORS.primary, textAlign: "center" },
    td: { fontSize: 9.5, paddingVertical: 5, paddingHorizontal: 4, border: 0.7, borderColor: COLORS.border, textAlign: "right", color: COLORS.text },
    tdNum: { fontSize: 9.5, paddingVertical: 5, paddingHorizontal: 4, border: 0.7, borderColor: COLORS.border, textAlign: "center", color: COLORS.text },
    tdKey: { backgroundColor: COLORS.accentFill, fontWeight: 700, fontSize: 9.5, paddingVertical: 6, paddingHorizontal: 6, border: 0.7, borderColor: COLORS.border, textAlign: "right", color: COLORS.primaryDark },
    // پاورقی ثابت
    footer: { position: "absolute", bottom: 24, left: 46, right: 46, textAlign: "center", fontSize: 8, color: COLORS.gray, borderTopWidth: 0.8, borderTopColor: COLORS.border, paddingTop: 6 },
  });
}

// ─── بلوک → المان react-pdf ───
function blockToElement(b: DocBlock, st: ReturnType<typeof buildStyles>, key: string): React.ReactElement | null {
  switch (b.type) {
    case "h1":
      return el(View, { key }, el(Text, { style: st.h1 }, b.text), el(View, { style: st.h1Rule }));
    case "h2":
      return el(Text, { key, style: st.h2 }, b.text);
    case "h3":
      return el(Text, { key, style: st.h3 }, b.text);
    case "p":
      return el(Text, { key, style: st.p }, b.text);
    case "bullets":
      return el(
        View,
        { key },
        b.items.filter((t) => t.trim() !== "").map((t, i) =>
          el(
            View,
            { key: i, style: st.bullet, wrap: false },
            el(Text, { style: st.bulletDot }, "•"),
            el(Text, { style: st.bulletText }, t)
          )
        )
      );
    case "numbers": {
      const nums = b.items.filter((t) => t.trim() !== "");
      return el(
        View,
        { key },
        nums.map((t, i) =>
          el(
            View,
            { key: i, style: st.bullet, wrap: false },
            el(Text, { style: st.bulletDot }, `${faNum(i + 1)}.`),
            el(Text, { style: st.bulletText }, t)
          )
        )
      );
    }
    case "quote":
      return el(
        View,
        { key, style: st.quoteBox },
        el(Text, { style: st.quoteText }, `❝ ${b.text}`)
      );
    case "table": {
      const n = b.header.length;
      const width = `${100 / n}%`;
      return el(
        View,
        { key, style: st.table },
        b.caption ? el(Text, { style: st.caption }, b.caption) : null,
        el(
          View,
          { style: st.tr },
          b.header.map((h, i) => el(Text, { key: i, style: [st.th, { width }] }, h))
        ),
        b.rows.map((r, ri) =>
          el(
            View,
            { key: `r${ri}`, style: st.tr, wrap: false },
            r.map((v, ci) =>
              el(
                Text,
                {
                  key: ci,
                  style: [
                    typeof v === "number" ? st.tdNum : st.td,
                    { width },
                    ...(ri % 2 === 1 ? [{ backgroundColor: COLORS.zebra }] : []),
                  ],
                },
                cellText(v)
              )
            )
          )
        )
      );
    }
    case "kv":
      return el(
        View,
        { key, style: st.table },
        b.items.map(([k, v], i) =>
          el(
            View,
            { key: i, style: st.tr, wrap: false },
            el(Text, { style: [st.tdKey, { width: "32%" }] }, k),
            el(Text, { style: [st.td, { width: "68%" }] }, v)
          )
        )
      );
    case "spacer":
      return el(View, { key, style: st.spacer });
    case "pagebreak":
      return el(View, { key, break: true, style: { height: 1 } });
    default:
      return null;
  }
}

// ─── API اصلی ───
export interface PdfDocPayload {
  title: string;
  subtitle?: string;
  blocks: DocBlock[];
}

export async function buildPdf(payload: PdfDocPayload): Promise<Buffer> {
  const ok = ensureFonts();
  const st = buildStyles();

  const children: React.ReactElement[] = [
    // سربرگ سند
    el(Text, { style: st.docTitle }, payload.title),
    ...(payload.subtitle ? [el(Text, { style: st.docSubtitle }, payload.subtitle)] : []),
    el(Text, { style: st.docMeta }, `تاریخ تولید: ${jalaliDate()}  ·  تولیدشده توسط هوشیار (شهریار)`),
    el(View, { style: st.titleRule }),
  ];

  payload.blocks.forEach((b, i) => {
    const e = blockToElement(b, st, `b${i}`);
    if (e) children.push(e);
  });

  const doc = el(
    Document,
    null,
    el(
      Page,
      { size: "A4", style: ok ? st.page : { ...st.page, fontFamily: "Helvetica" } },
      ...children,
      el(
        Text,
        {
          style: st.footer,
          fixed: true,
          render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
            `هوشیار · شهریار   —   صفحه ${faNum(pageNumber)} از ${faNum(totalPages)}`,
        },
        ""
      )
    )
  );

  const buf = await renderToBuffer(doc);
  return Buffer.from(buf);
}
