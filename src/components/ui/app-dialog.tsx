// ═══════════════════════════════════════════════════════════════
// AppDialog — قالب واحد و حرفه‌ای همه‌ی پاپ‌آپ‌های شهریار
// یک قالب، هزار محتوا: هدر (آیکن گرادیانی + عنوان + توضیح)،
// بدنه اسکرول‌شونده، فوتر چسبان، انیمیشن فنری و ضربدر یکدست.
// ═══════════════════════════════════════════════════════════════
"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type AppDialogSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZES: Record<AppDialogSize, string> = {
  xs: "sm:max-w-xs",
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-2xl",
};

export interface AppDialogProps {
  open: boolean;
  onClose: () => void;
  /** عنوان (متن یا نود) */
  title?: React.ReactNode;
  /** توضیح کوتاه زیر عنوان */
  description?: React.ReactNode;
  /** آیکن هدر */
  icon?: LucideIcon;
  /** کلاس گرادیان کاشی آیکن (پیش‌فرض: گرادیان شهریار) */
  iconClassName?: string;
  size?: AppDialogSize;
  /** app = تم روشن اپ · admin = تم تیره پنل مدیریت */
  variant?: "app" | "admin";
  /** دکمه‌های فوتر (به‌صورت prop — چسبان به پایین) */
  footer?: React.ReactNode;
  /** عنصر اضافه سمت چپ هدر (چیپ، دکمه، امتیاز و...) */
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
  /** هدر خودکار حذف شود (برای دیالوگ با هدر کاملاً سفارشی مثل جزئیات صنف) */
  hideHeader?: boolean;
  /** نوار گرادیان تزئینی بالای دیالوگ */
  accentBar?: boolean;
  /** قفل موقت بستن (حین ذخیره/ارسال) */
  locked?: boolean;
  /** کلاس اضافی خود DialogContent */
  contentClassName?: string;
  /** کلاس اضافی ناحیه بدنه */
  bodyClassName?: string;
  /** استایل سفارشی ضربدر (مثلاً شیشه‌ای روی هدر گرادیانی) */
  closeButtonClassName?: string;
  showCloseButton?: boolean;
}

export default function AppDialog({
  open,
  onClose,
  title,
  description,
  icon: Icon,
  iconClassName,
  size = "md",
  variant = "app",
  footer,
  headerExtra,
  children,
  hideHeader = false,
  accentBar = true,
  locked = false,
  contentClassName,
  bodyClassName,
  closeButtonClassName,
  showCloseButton = true,
}: AppDialogProps) {
  const isAdmin = variant === "admin";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !locked) onClose();
      }}
    >
      <DialogContent
        showCloseButton={showCloseButton}
        closeButtonClassName={closeButtonClassName}
        dir="rtl"
        className={cn(
          "flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0",
          SIZES[size],
          isAdmin && "bg-slate-900 border-slate-800 text-slate-100",
          contentClassName
        )}
      >
        {/* نوار گرادیان تزئینی بالای پاپ‌آپ */}
        {accentBar && (
          <div
            aria-hidden
            className={cn(
              "absolute inset-x-0 top-0 z-10 h-1",
              isAdmin ? "bg-gradient-to-l from-blue-500 via-indigo-500 to-purple-500" : "shahryar-gradient"
            )}
          />
        )}

        {/* ─── هدر واحد: آیکن گرادیانی + عنوان + توضیح ─── */}
        {!hideHeader && (
          <div className={cn("flex items-start gap-3.5 px-4 pt-5 pb-3.5 sm:px-6 sm:pt-6 sm:pb-4", !Icon && "pe-14")}>
            {Icon && (
              <div
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg",
                  "animate-in zoom-in-50 fade-in-0 duration-500",
                  iconClassName || (isAdmin ? "bg-gradient-to-br from-blue-500 to-indigo-600" : "shahryar-gradient")
                )}
              >
                <Icon className="size-5.5" />
              </div>
            )}
            <div className="min-w-0 flex-1 pt-0.5">
              <DialogTitle
                className={cn(
                  "text-base font-black leading-6",
                  isAdmin ? "text-white" : "text-foreground"
                )}
              >
                {title}
              </DialogTitle>
              {description && (
                <DialogDescription className={cn("text-xs leading-5 mt-1", isAdmin ? "text-slate-400" : "text-muted-foreground")}>
                  {description}
                </DialogDescription>
              )}
            </div>
            {headerExtra && <div className="shrink-0">{headerExtra}</div>}
          </div>
        )}
        {hideHeader && (
          <DialogTitle className="sr-only">{typeof title === "string" ? title : "پنجره"}</DialogTitle>
        )}

        {/* ─── جداکننده مویی گرادیانی ─── */}
        {!hideHeader && (
          <div
            aria-hidden
            className={cn(
              "h-px bg-gradient-to-l from-transparent to-transparent",
              isAdmin ? "via-slate-700" : "via-border"
            )}
          />
        )}

        {/* ─── بدنه: تنها ناحیه اسکرول‌شونده ─── */}
        <div
          data-slot="app-dialog-body"
          className={cn(
            "min-h-0 flex-1 overscroll-contain overflow-y-auto px-4 py-4 sm:px-6 sm:py-5",
            bodyClassName
          )}
        >
          {children}
        </div>

        {/* ─── فوتر چسبان ─── */}
        {footer && (
          <div
            className={cn(
              "border-t px-4 py-3.5 sm:px-6 sm:py-4",
              isAdmin
                ? "border-slate-800 bg-slate-900/95"
                : "border-border/60 bg-card/80 backdrop-blur-sm"
            )}
          >
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
