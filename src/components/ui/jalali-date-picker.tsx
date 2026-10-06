// ═════ انتخابگر تاریخ جلالی شهریار ═════
// تقویم کامل جلالی با طراحی مدرن — جایگزین date picker میلادی
"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, CalendarDays, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  jalaliToday, isoToJalali, jalaliToISO, jalaliMonthLength,
  jalaliWeekday, JALALI_MONTHS, WEEKDAY_HEADERS, formatJalali,
} from "@/lib/client/jalali";
import { faNum } from "@/lib/client/persian";

interface JalaliDatePickerProps {
  value: string; // ISO میلادی YYYY-MM-DD (برای ذخیره در دیتابیس) یا رشته خالی
  onChange: (iso: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  clearable?: boolean;
}

export default function JalaliDatePicker({
  value,
  onChange,
  placeholder = "انتخاب تاریخ",
  disabled = false,
  className = "",
  clearable = true,
}: JalaliDatePickerProps) {
  const [open, setOpen] = useState(false);
  const today = useMemo(() => jalaliToday(), []);
  const selected = useMemo(() => (value ? isoToJalali(value) : null), [value]);

  const [view, setView] = useState(() => ({
    jy: selected?.jy || today.jy,
    jm: selected?.jm || today.jm,
  }));

  useEffect(() => {
    if (open) {
      const base = selected || today;
      setView({ jy: base.jy, jm: base.jm });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const monthLen = jalaliMonthLength(view.jy, view.jm);
  const firstWeekday = jalaliWeekday(view.jy, view.jm, 1); // ۰ = شنبه

  const days = useMemo(() => {
    const arr: Array<{ jd: number; iso: string; isToday: boolean; isSelected: boolean }> = [];
    for (let jd = 1; jd <= monthLen; jd++) {
      const iso = jalaliToISO(view.jy, view.jm, jd);
      arr.push({
        jd,
        iso,
        isToday: today.jy === view.jy && today.jm === view.jm && today.jd === jd,
        isSelected: !!selected && selected.jy === view.jy && selected.jm === view.jm && selected.jd === jd,
      });
    }
    return arr;
  }, [view, monthLen, today, selected]);

  const prevMonth = () => {
    setView((v) => (v.jm === 1 ? { jy: v.jy - 1, jm: 12 } : { jy: v.jy, jm: v.jm - 1 }));
  };
  const nextMonth = () => {
    setView((v) => (v.jm === 12 ? { jy: v.jy + 1, jm: 1 } : { jy: v.jy, jm: v.jm + 1 }));
  };
  const prevYear = () => setView((v) => ({ ...v, jy: v.jy - 1 }));
  const nextYear = () => setView((v) => ({ ...v, jy: v.jy + 1 }));

  const pick = (iso: string) => {
    onChange(iso);
    setOpen(false);
  };

  const goToday = () => {
    onChange(jalaliToISO(today.jy, today.jm, today.jd));
    setView({ jy: today.jy, jm: today.jm });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={`w-full h-11 rounded-xl border border-border/70 bg-transparent px-3.5 flex items-center gap-2.5 text-sm transition-all hover:border-primary/50 focus:border-primary/60 focus:shadow-[0_0_0_4px_oklch(0.5_0.19_258/0.1)] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        >
          <CalendarDays className="w-4.5 h-4.5 text-muted-foreground shrink-0" style={{ width: 18, height: 18 }} />
          <span className={selected ? "font-medium tnum" : "text-muted-foreground"}>
            {selected ? formatJalali(selected) : placeholder}
          </span>
          {clearable && selected && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              onKeyDown={(e) => e.key === "Enter" && onChange("")}
              className="mr-auto text-muted-foreground hover:text-destructive transition-colors p-1 rounded-md hover:bg-destructive/10"
            >
              <X className="w-4 h-4" />
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0 rounded-2xl border-border/70 shadow-blue-glow-lg" align="start" dir="rtl">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${view.jy}-${view.jm}`}
            initial={{ opacity: 0, x: open ? 14 : -14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {/* هدر: ناوبری ماه و سال */}
            <div className="shahryar-gradient rounded-t-2xl p-3.5 text-white">
              <div className="flex items-center justify-between">
                <button type="button" onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-white/15 transition-colors" title="ماه قبل">
                  <ChevronRight className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                </button>
                <div className="text-center">
                  <p className="font-bold text-[15px] leading-tight">{JALALI_MONTHS[view.jm - 1]}</p>
                  <p className="text-[11px] text-blue-100/85 tnum">{faNum(view.jy)}</p>
                </div>
                <button type="button" onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-white/15 transition-colors" title="ماه بعد">
                  <ChevronLeft className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                </button>
              </div>
              <div className="flex items-center justify-between mt-2 text-[11px]">
                <button type="button" onClick={prevYear} className="px-2.5 py-0.5 rounded-md hover:bg-white/15 transition-colors tnum" title="سال قبل">
                  {faNum(view.jy - 1)} ‹
                </button>
                <span className="text-blue-100/70">سال</span>
                <button type="button" onClick={nextYear} className="px-2.5 py-0.5 rounded-md hover:bg-white/15 transition-colors tnum" title="سال بعد">
                  › {faNum(view.jy + 1)}
                </button>
              </div>
            </div>

            {/* سرستون روزهای هفته */}
            <div className="grid grid-cols-7 gap-1 px-3 pt-3 pb-1">
              {WEEKDAY_HEADERS.map((w, i) => (
                <span
                  key={w}
                  className={`text-center text-[11px] font-bold py-1 ${
                    i === 6 ? "text-rose-400" : "text-muted-foreground"
                  }`}
                >
                  {w}
                </span>
              ))}
            </div>

            {/* روزها */}
            <div className="grid grid-cols-7 gap-1 px-3 pb-2">
              {Array.from({ length: firstWeekday }).map((_, i) => (
                <span key={`pad-${i}`} />
              ))}
              {days.map((d) => (
                <button
                  key={d.jd}
                  type="button"
                  onClick={() => pick(d.iso)}
                  className={`jalali-day-btn h-9 rounded-xl text-[13px] font-medium tnum relative ${
                    d.isSelected
                      ? "shahryar-gradient text-white shadow-md scale-105"
                      : d.isToday
                      ? "jalali-day-today text-primary font-bold bg-primary/8"
                      : "hover:bg-accent"
                  }`}
                >
                  {faNum(d.jd)}
                  {d.isToday && !d.isSelected && (
                    <span className="absolute bottom-1 right-1/2 translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                  )}
                </button>
              ))}
            </div>

            {/* فوتر */}
            <div className="flex items-center gap-2 p-3 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={goToday}
                className="flex-1 rounded-lg text-xs h-8 gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                امروز ({formatJalali(today).split(" ").slice(0, 2).join(" ")})
              </Button>
              {clearable && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className="rounded-lg text-xs h-8 text-muted-foreground"
                >
                  پاک کردن
                </Button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </PopoverContent>
    </Popover>
  );
}
