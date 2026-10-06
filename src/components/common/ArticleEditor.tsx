// ═══════════════════════════════════════════════════════════════
// ویرایشگر مقاله — لودر تنبل (dynamic)
// ═══════════════════════════════════════════════════════════════
// MDXEditor به APIهای مرورگر وابسته است و حجیم؛ فقط وقتی بارگذاری
// می‌شود که رئیس انجمن واقعاً ویرایشگر را باز کند — باندل اصلی اپ سبک می‌ماند.
"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const ArticleEditor = dynamic(() => import("./ArticleEditorCore"), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 items-center justify-center gap-2 rounded-2xl border border-border/60 bg-muted/30 text-xs font-bold text-muted-foreground" dir="rtl">
      <Loader2 className="size-4 animate-spin text-primary" />
      در حال آماده‌سازی ویرایشگر حرفه‌ای…
    </div>
  ),
});

export default ArticleEditor;
