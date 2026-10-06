// ═════ مرکز آپلود شهریار — پنل شناور پیشرفت بارگذاری ═════
// در همه صفحات نصب می‌شود و جزئیات لحظه‌ای آپلود را نمایش می‌دهد:
// درصد، سرعت، حجم منتقل‌شده، زمان باقی‌مانده، وضعیت موفقیت/خطا

"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, File as FileIcon, UploadCloud, X, ImageIcon } from "lucide-react";
import { useUploadStore, faFileSize, faSpeed, faEta, type UploadItem } from "@/lib/client/media-store";

/** آیتم تک‌آپلود با پروگرس زنده */
function UploadRow({ item }: { item: UploadItem }) {
  const removeItem = useUploadStore((s) => s.removeItem);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -30, scale: 0.95 }}
      transition={{ type: "spring", damping: 26, stiffness: 320 }}
      className={`relative rounded-2xl border p-3.5 shadow-xl backdrop-blur-xl overflow-hidden ${
        item.status === "error"
          ? "bg-rose-950/85 border-rose-500/30"
          : item.status === "success"
          ? "bg-card/95 border-blue-500/30"
          : "bg-card/95 border-border/70"
      }`}
    >
      {/* نوار پیشرفت پس‌زمینه */}
      {item.status === "uploading" && (
        <div
          className="absolute inset-y-0 right-0 bg-primary/8 transition-[width] duration-300 ease-out"
          style={{ width: `${item.progress}%` }}
        />
      )}

      <div className="relative flex items-center gap-3">
        {/* آیکون/پیش‌نمایش */}
        <div className="relative shrink-0">
          {item.isImage ? (
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden">
              <ImageIcon className="w-5 h-5 text-primary" />
            </div>
          ) : (
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileIcon className="w-5 h-5 text-primary" />
            </div>
          )}
          {item.status === "uploading" && (
            <span className="absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full border-2 border-card bg-primary animate-upload-pulse" />
          )}
        </div>

        {/* جزئیات */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold truncate flex-1">{item.name}</p>
            <button
              onClick={() => removeItem(item.id)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
              title="بستن"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {item.status === "uploading" && (
            <>
              <div className="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground tnum">
                <span>{faFileSize(item.loaded)} از {faFileSize(item.size)}</span>
                <span className="font-bold text-primary">{faSpeed(item.speed)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1.5">
                <motion.div
                  className="h-full rounded-full shahryar-gradient"
                  animate={{ width: `${item.progress}%` }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                />
              </div>
              <div className="flex items-center justify-between mt-1 text-[10px]">
                <span className="font-black text-primary tnum">{item.progress.toFixed(0).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d])}٪</span>
                <span className="text-muted-foreground tnum">
                  {item.eta > 0 && item.eta !== Infinity ? `${faEta(item.eta)} باقی‌مانده` : "در حال ارسال..."}
                </span>
              </div>
            </>
          )}

          {item.status === "success" && (
            <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-blue-600 dark:text-blue-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="font-bold">با موفقیت بارگذاری شد</span>
              <span className="text-muted-foreground">· {faFileSize(item.size)}</span>
            </div>
          )}

          {item.status === "error" && (
            <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-rose-400">
              <XCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="font-medium truncate">{item.error}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/** پنل شناور مرکز آپلود — در ریشه اپ و پنل مدیریت نصب می‌شود */
export default function UploadCenter() {
  const items = useUploadStore((s) => s.items);
  const uploadingCount = items.filter((i) => i.status === "uploading").length;

  // محدودسازی نمایش به ۴ آیتم اخیر
  const visible = items.slice(0, 4);

  // جلوگیری از بسته‌شدن صفحه هنگام آپلود
  useEffect(() => {
    if (uploadingCount === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [uploadingCount]);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[70] w-[21rem] max-w-[calc(100vw-2rem)] space-y-2.5 pointer-events-none" dir="rtl">
      {/* هدر خلاصه */}
      <AnimatePresence>
        {uploadingCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="shahryar-gradient rounded-2xl px-4 py-2.5 text-white text-xs font-bold flex items-center gap-2 shadow-blue-glow pointer-events-auto"
          >
            <UploadCloud className="w-4 h-4 animate-upload-pulse" />
            در حال بارگذاری {uploadingCount.toString().replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d])} فایل...
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {visible.map((item) => (
          <div key={item.id} className="pointer-events-auto">
            <UploadRow item={item} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
