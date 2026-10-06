// ═════ دکمه تغییر تم روشن/تیره — شهریار ═════
"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * آیکن دو-حالته (خورشید/ماه) — کاملاً CSS-محور:
 * هر دو آیکن روی هم قرار می‌گیرند و با کلاس .dark روی <html> جای‌به‌جای
 * چرخشی + مقیاسی می‌شوند. چون خروجی رندر به حالت تم در JS وابسته نیست،
 * پیش از هیدریشن هم درست رندر می‌شود → صفر mismatch و صفر فلش.
 */
export function ThemeIcon({ iconClass }: { iconClass?: string }) {
  return (
    <span className="relative inline-grid place-items-center">
      <Sun
        aria-hidden
        className={cn(
          "col-start-1 row-start-1 transition-all duration-300 dark:scale-0 dark:-rotate-90 dark:opacity-0",
          iconClass
        )}
      />
      <Moon
        aria-hidden
        className={cn(
          "col-start-1 row-start-1 scale-0 rotate-90 opacity-0 transition-all duration-300 dark:scale-100 dark:rotate-0 dark:opacity-100",
          iconClass
        )}
      />
    </span>
  );
}

/**
 * دکمه تغییر وضعیت تم — دو گونه:
 * - sidebar: ردیف کامل منو (آیکن + برچسب کنش) — سایدبار دسکتاپ و دروور موبایل
 * - icon (پیش‌فرض): دکمه گرد شیشه‌ای فقط-آیکن (نوار بالای موبایل، صفحه ورود و نقاط شناور)
 */
export default function ThemeToggle({
  variant = "icon",
  className,
}: {
  variant?: "icon" | "sidebar";
  className?: string;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const toggle = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");

  if (variant === "sidebar") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label="تغییر حالت روشن و تیره"
        title="تغییر حالت روشن و تیره"
        className={cn(
          "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium transition-colors",
          "text-foreground/70 hover:bg-accent hover:text-foreground",
          className
        )}
      >
        <ThemeIcon iconClass="size-5" />
        {/* برچسب کنش: در حالت روشن → دعوت به تیره؛ در حالت تیره → دعوت به روشن */}
        <span className="dark:hidden">حالت تیره</span>
        <span className="hidden dark:inline">حالت روشن</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="تغییر حالت روشن و تیره"
      title="تغییر حالت روشن و تیره"
      className={cn(
        "flex size-10 items-center justify-center rounded-full border border-border/60 text-foreground shadow-lg backdrop-blur-md transition-all",
        "bg-card/80 hover:scale-105 hover:bg-card active:scale-95",
        className
      )}
    >
      <ThemeIcon iconClass="size-[18px]" />
    </button>
  );
}
