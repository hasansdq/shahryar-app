// ═══════════════════════════════════════════════════════════════
// رندر حرفه‌ای مقاله نشریه — خوانش مدرن و ساختارمند
// ═══════════════════════════════════════════════════════════════
// ورودی: مارک‌داون ذخیره‌شده توسط ویرایشگر (شامل تصاویر با اندازه).
//  • تصاویر HTML خروجی ویرایشگر (<img width height>) به توکن مارک‌داون
//    ![alt|WxH](src) تبدیل و با عرض پاسخ‌گو رندر می‌شوند (min(W,100%))
//  • زیرنویس تصویر از متن جایگزین ساخته می‌شود
//  • تایپوگرافی کامل: تیترها، فهرست‌ها، نقل‌قول، جدول، کد، جداکننده
//    همه از کلاس article-content در globals.css استایل می‌گیرند
// ═══════════════════════════════════════════════════════════════
"use client";

import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** پاک‌سازی متن جایگزین از کاراکترهای شکننده سینتکس مارک‌داون */
const cleanAlt = (s: string) => s.replace(/[\[\]()|]/g, " ").trim();

/**
 * پیش‌پردازش مارک‌داون:
 * تصاویر HTMLِ خروجی MDXEditor (با width/height) → توکن ![alt|WxH](src)
 * تا react-markdown بتواند بدون rehype-raw آن‌ها را رندر کند.
 */
function transformHtmlImages(md: string): string {
  return md.replace(/<img\s[^>]*\/?>/gi, (tag) => {
    const src = /src="([^"]*)"/i.exec(tag)?.[1] || "";
    if (!src) return "";
    const alt = cleanAlt(/alt="([^"]*)"/i.exec(tag)?.[1] || "");
    const w = /width="(\d+)"/i.exec(tag)?.[1];
    const h = /height="(\d+)"/i.exec(tag)?.[1];
    const size = w ? `|${w}${h ? `x${h}` : ""}` : "";
    return `![${alt}${size}](${src})`;
  });
}

/** استخراج اندازه از alt توکنی — "عکس پسته|520x340" → {alt, width, height} */
function parseSizedAlt(alt: string | null | undefined): {
  alt: string;
  width?: number;
  height?: number;
} {
  if (!alt) return { alt: "" };
  const m = /^(.*?)\|(\d+)(?:x(\d+))?$/.exec(alt);
  if (!m) return { alt: alt.trim() };
  return {
    alt: m[1].trim(),
    width: Number(m[2]) || undefined,
    height: Number(m[3]) || undefined,
  };
}

function ArticleContent({ content, className = "" }: { content: string; className?: string }) {
  // پیش‌پردازش یک‌بار per content
  const processed = useMemo(() => transformHtmlImages(content || ""), [content]);

  return (
    <div className={`article-content ${className}`} dir="rtl">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // لینک امن: تب جدید + noopen
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          // تصویر: عرض پاسخ‌گو از اندازه ذخیره‌شده + زیرنویس از alt
          img: ({ src, alt }) => {
            const { alt: cleanText, width, height } = parseSizedAlt(alt);
            const style: React.CSSProperties = {
              width: width ? `min(${width}px, 100%)` : undefined,
              aspectRatio: width && height ? `${width} / ${height}` : undefined,
            };
            return (
              <span className="article-fig">
                { }
                <img
                  src={typeof src === "string" ? src : undefined}
                  alt={cleanText}
                  loading="lazy"
                  style={style}
                />
                {cleanText ? <span className="article-fig-caption">{cleanText}</span> : null}
              </span>
            );
          },
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}

export default memo(ArticleContent);
