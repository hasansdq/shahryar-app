// ═════ تأمین‌کننده تم سراسری شهریار — next-themes ═════
"use client";

import { useEffect } from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";

/**
 * همگام‌سازی متاتگ‌های theme-color با تم فعلی
 * (رنگ نوار مرورگر موبایل — دقیقاً مطابق پس‌زمینه هر حالت)
 */
function ThemeColorSync() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    const color = resolvedTheme === "dark" ? "#0a0f1e" : "#f8f9fc";
    document
      .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
      .forEach((m) => m.setAttribute("content", color));
  }, [resolvedTheme]);
  return null;
}

/**
 * تم سراسری با next-themes:
 * - attribute="class" → کلاس .dark روی <html> (Tailwind 4 custom-variant فعال)
 * - defaultTheme="system" → اولین بازدید از ترجیح سیستم‌عامل پیروی می‌کند
 * - اسکریپت ضد-فلش داخلی next-themes پیش از هیدریشن کلاس را می‌گذارد
 * - ذخیره در localStorage با کلید اختصاصی shahryar-theme
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="shahryar-theme"
    >
      {children}
      <ThemeColorSync />
    </NextThemesProvider>
  );
}
