// ═══════ رندر مارک‌داون یکپارچه پیام‌های هوش مصنوعی ═════
// استفاده در: چت هوشیار، چت ایجنت‌های اجتماعی، مشاور مالی
// — بولد/ایتالیک/تیتر/لیست/جدول/کد بلافاصله پس از تولید ساختار حرفه‌ای می‌گیرند
"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * متن مارک‌داون AI را رندر می‌کند.
 * @param content متن خام (مثلاً **بولد**، لیست‌ها، جدول‌ها)
 * @param className کلاس اضافی (پیش‌فرض: chat-markdown)
 */
function MarkdownContent({ content, className = "" }: { content: string; className?: string }) {
  return (
    <div className={`chat-markdown ${className}`} dir="rtl">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // لینک‌ها همیشه در تب جدید و امن باز شوند
          a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default memo(MarkdownContent);
