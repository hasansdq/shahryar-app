// ═══ آواتار حرف‌دار — اندازه فونت و وسط‌چینی نوری جوهر گلیف ═══
//
// مشکل: فونت فارسی YekanBakhFaNum ارتفاع خط پیش‌فرض ~۱٫۵em دارد و «مرکز
// جوهرِ» حروف فارسی با مرکز em-box یکی نیست (ن، م، ع پایین‌تر؛ آ، ک بالاتر).
// بنابراین flex-center تنها جعبهٔ خط را وسط می‌گذارد، نه خود حرف را.
//
// راه‌حل: با canvas.measureText جعبهٔ جوهر واقعی (actualBoundingBox) هر حرف
// اندازه گرفته می‌شود و آفست دقیق وسط‌چینیِ نوری محاسبه و به‌صورت translateY
// اعمال می‌گردد (فقط سمت کلاینت؛ در سرور 0 — بدون mismatch هیدریشن).

/** اندازه فونت حرف اول آواتار — ~۴۲٪ قطر با کف خوانا ۱۰px */
export function initialFontSize(size: number): number {
  return Math.max(10, Math.round((size / 2.4) * 10) / 10);
}

const inkOffsetCache = new Map<string, number>();
let measureCtx: CanvasRenderingContext2D | null = null;

/**
 * آفست عمودی جوهر حرف نسبت به مرکز دایره (بر حسب em).
 * مثبت = جوهر پایین‌تر از مرکز است (نیاز به شیفت به بالا).
 * خروجی نسبت به em است تا برای هر fontPx مقیاس‌پذیر باشد.
 */
function inkOffsetRatio(letter: string, weight: number): number {
  const key = `${weight}|${letter}`;
  const cached = inkOffsetCache.get(key);
  if (cached !== undefined) return cached;

  let ratio = 0;
  try {
    if (!measureCtx) {
      const canvas = document.createElement("canvas");
      measureCtx = canvas.getContext("2d");
    }
    if (measureCtx) {
      // اگر فونت هنوز لود نشده، متریکِ فونت fallback اندازه گرفته می‌شود →
      // اندازه‌گیری نکن (0 برگردان) و بعد از آماده‌شدن فونت دوباره تلاش شود.
      if (typeof document !== "undefined" && document.fonts && !document.fonts.check(`${weight} 16px YekanBakh`)) {
        return 0;
      }
      // ⚠️ نام family باید دقیقاً مثل globals.css باشد ('YekanBakh') — وگرنه
      // متریک فونت fallback اندازه گرفته می‌شود و آفست غلط درمی‌آید.
      measureCtx.font = `${weight} 100px 'YekanBakh', 'Segoe UI', Tahoma, sans-serif`;
      const m = measureCtx.measureText(letter);
      const ascent = m.actualBoundingBoxAscent;
      const descent = m.actualBoundingBoxDescent;
      const fontAscent = m.fontBoundingBoxAscent;
      const fontDescent = m.fontBoundingBoxDescent;
      if (
        Number.isFinite(ascent) && Number.isFinite(descent) &&
        Number.isFinite(fontAscent) && Number.isFinite(fontDescent) &&
        ascent + descent > 0 && fontAscent + fontDescent > 0
      ) {
        const em = 100;
        // با line-height:1 → جای baseline از بالای line-box:
        const baselineY = (em - (fontAscent + fontDescent)) / 2 + fontAscent;
        // مرکز جوهر نسبت به baseline (مثبت = پایین)
        const inkCenterFromBaseline = (descent - ascent) / 2;
        const inkCenterY = baselineY + inkCenterFromBaseline;
        ratio = (inkCenterY - em / 2) / em;
      }
    }
  } catch {
    ratio = 0;
  }
  inkOffsetCache.set(key, ratio);
  return ratio;
}

/**
 * مقدار translateY (پیکسل) برای قرارگیری «دقیقاً وسط» جوهر حرف در دایره.
 * منفی = بالا. در سرور (بدون document) همیشه 0.
 */
export function initialOpticalDy(letter: string, fontPx: number, weight = 900): number {
  if (typeof document === "undefined" || !fontPx) return 0;
  const ch = (letter || "ش").trim().charAt(0) || "ش";
  return inkOffsetRatio(ch, weight) * fontPx;
}
