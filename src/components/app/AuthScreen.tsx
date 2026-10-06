// ═════ صفحه ورود و ثبت‌نام شهریار — موبایل + کد یکبارمصرف + رمز دومرحله‌ای ═════
// جریان: شماره موبایل → (ثبت‌نام: نام/جنسیت/تاریخ تولد) → کد پیامکی → (رمز 2FA) → ورود
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown, Smartphone, Lock, UserRound, ShieldCheck, ArrowLeft, ArrowRight, CheckCircle2,
  RefreshCw, AlertCircle, MessageSquareCode, CalendarHeart, Loader2,
  Mars, Venus, ChevronDown, Cake, IdCard, CircleCheck, X, Sparkles,
  Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { post } from "@/lib/client/api";
import { useAppStore, type CurrentUser } from "@/lib/client/store";
import { toast } from "@/hooks/use-toast";
import { enNum, faNum, currentJalaliYear } from "@/lib/client/persian";
import { JALALI_MONTHS, jalaliMonthLength, formatJalali } from "@/lib/client/jalali";
import ThemeToggle from "@/components/theme/ThemeToggle";

type Step = "phone" | "register" | "otp" | "password" | "success";

type AuthedUser = CurrentUser;

/** جعبه‌های کد ۶ رقمی — تایپ/پیست/backspace هوشمند + ارسال خودکار */
function OtpBoxes({
  value,
  onChange,
  onComplete,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const chars = Array.from({ length: 6 }, (_, i) => value[i] || "");

  const setChar = (index: number, digit: string) => {
    const arr = chars.slice();
    arr[index] = digit;
    onChange(arr.join("").replace(/\s/g, "").slice(0, 6));
  };

  const handleInput = (i: number, raw: string) => {
    const digits = enNum(raw).replace(/\D/g, "");
    if (!digits) return;
    if (digits.length > 1) {
      // پیست داخل یک باکس
      const merged = enNum(value).replace(/\D/g, "") + digits;
      const next = merged.slice(0, 6);
      onChange(next);
      const focusIdx = Math.min(next.length, 5);
      refs.current[focusIdx]?.focus();
      if (next.length === 6) onComplete?.(next);
      return;
    }
    setChar(i, digits);
    if (i < 5) refs.current[i + 1]?.focus();
    const joined = (chars.slice(0, i).join("") + digits + chars.slice(i + 1).join("")).slice(0, 6);
    if (joined.length === 6 && !joined.includes(" ")) onComplete?.(joined);
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (chars[i]) {
        setChar(i, "");
      } else if (i > 0) {
        setChar(i - 1, "");
        refs.current[i - 1]?.focus();
      }
    }
    if (e.key === "ArrowLeft" && i < 5) refs.current[i + 1]?.focus();
    if (e.key === "ArrowRight" && i > 0) refs.current[i - 1]?.focus();
  };

  return (
    <div dir="ltr" className="flex items-stretch justify-center gap-1.5 sm:gap-2" onPaste={(e) => {
      e.preventDefault();
      const digits = enNum(e.clipboardData.getData("text")).replace(/\D/g, "").slice(0, 6);
      if (digits) {
        onChange(digits);
        refs.current[Math.min(digits.length, 5)]?.focus();
        if (digits.length === 6) onComplete?.(digits);
      }
    }}>
      {chars.map((c, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          value={c}
          disabled={disabled}
          onChange={(e) => handleInput(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          aria-label={`رقم ${faNum(i + 1)}`}
          className={`h-14 min-w-0 flex-1 sm:h-[3.7rem] sm:max-w-[3.4rem] text-center text-[22px] font-black tabular-nums rounded-xl border bg-muted/40 transition-all duration-200 outline-none
            ${c
              ? "border-primary/55 bg-primary/[0.06] text-foreground shadow-[inset_0_-2.5px_0_0_oklch(0.47_0.19_258/0.5)]"
              : "border-border/70 text-foreground hover:border-border"}
            focus:border-primary/80 focus:bg-background focus:shadow-[0_0_0_4px_oklch(0.5_0.19_258/0.13)] disabled:opacity-50`}
        />
      ))}
    </div>
  );
}

/** سرصفحهٔ بخش‌های فرم — چیپ گرادیانی + خط جداکنندهٔ محو‌شونده */
function FormSection({
  icon: Icon, title, badge,
}: {
  icon: typeof UserRound;
  title: string;
  badge?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 pt-1">
      <span className="grid size-6.5 shrink-0 place-items-center rounded-lg shahryar-gradient text-white shadow-sm">
        <Icon className="size-3.5" style={{ width: 14, height: 14 }} />
      </span>
      <p className="text-xs font-black tracking-tight">{title}</p>
      {badge && (
        <span className="rounded-md border border-border/70 bg-muted/40 px-1.5 py-px text-[10px] font-medium text-muted-foreground">
          {badge}
        </span>
      )}
      <span className="h-px flex-1 rounded-full bg-gradient-to-l from-border to-transparent" />
    </div>
  );
}

/** لیبل فیلد با آیکون + نشان الزامی/اختیاری */
function FieldLabel({
  htmlFor, icon: Icon, required, optional, children,
}: {
  htmlFor?: string;
  icon?: typeof UserRound;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Label htmlFor={htmlFor} className="flex items-center gap-1.5 text-[13px]">
      {Icon && <Icon className="size-3.5 text-primary/70" style={{ width: 14, height: 14 }} />}
      <span>{children}</span>
      {required && <span className="text-destructive font-black">*</span>}
      {optional && (
        <span className="rounded-md border border-border/70 bg-muted/40 px-1.5 py-px text-[10px] font-medium text-muted-foreground">
          اختیاری
        </span>
      )}
    </Label>
  );
}

/** سوییچ جنسیت — قرصِ لغزندهٔ گرادیانی با انیمیشن فیزیکی */
function GenderSegmented({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const opts = [
    { key: "male", label: "مرد", icon: Mars },
    { key: "female", label: "زن", icon: Venus },
  ] as const;
  return (
    <div className="relative grid grid-cols-2 gap-1 rounded-[0.9rem] border border-border/60 bg-muted/50 p-1">
      {opts.map((o) => {
        const selected = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            aria-pressed={selected}
            className={`relative flex h-12 items-center justify-center gap-2 rounded-[0.65rem] text-[14px] font-bold transition-colors duration-200 active:scale-[0.98] ${
              selected ? "text-white" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {selected && (
              <motion.span
                layoutId="auth-gender-pill"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", damping: 30, stiffness: 400 }}
                className="absolute inset-0 rounded-[0.65rem] shahryar-gradient shadow-md"
              />
            )}
            <o.icon className="relative z-10 size-4" style={{ width: 16, height: 16 }} />
            <span className="relative z-10">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ═══ انتخابگر تاریخ تولد — سه فیلد یکپارچه با پاپ‌اور دسکتاپ و بات‌شیت موبایل ═══
type BirthField = "jd" | "jm" | "jy";

const BIRTH_FIELDS: Array<{ key: BirthField; label: string }> = [
  { key: "jd", label: "روز" },
  { key: "jm", label: "ماه" },
  { key: "jy", label: "سال" },
];

function BirthDatePicker({
  jy, jm, jd, onChange,
}: {
  jy: string; jm: string; jd: string;
  onChange: (next: { jy: string; jm: string; jd: string }) => void;
}) {
  const [active, setActive] = useState<BirthField | null>(null);
  const [sheet, setSheet] = useState(false);
  const [rowRect, setRowRect] = useState<DOMRect | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const days = jy && jm ? jalaliMonthLength(Number(jy), Number(jm)) : 31;
  const years = useMemo(
    () => Array.from({ length: currentJalaliYear() - 1299 }, (_, i) => currentJalaliYear() - i),
    []
  );

  const optionsFor = (f: BirthField): Array<{ value: string; label: string }> => {
    if (f === "jd") return Array.from({ length: days }, (_, i) => ({ value: String(i + 1), label: faNum(i + 1) }));
    if (f === "jm") return JALALI_MONTHS.map((m, i) => ({ value: String(i + 1), label: m }));
    return years.map((y) => ({ value: String(y), label: faNum(y) }));
  };

  const colsFor = (f: BirthField) => (f === "jd" ? "grid-cols-7" : f === "jm" ? "grid-cols-3" : "grid-cols-5");

  const valueOf = (f: BirthField) => (f === "jd" ? jd : f === "jm" ? jm : jy);
  const labelOf = (f: BirthField) => {
    const v = valueOf(f);
    if (!v) return "";
    if (f === "jm") return JALALI_MONTHS[Number(jm) - 1] || "";
    return faNum(v);
  };

  const openField = (f: BirthField) => {
    if (!rowRef.current) return;
    setRowRect(rowRef.current.getBoundingClientRect());
    setSheet(!window.matchMedia("(min-width: 640px)").matches);
    setActive(f);
  };

  const clearAll = () => {
    onChange({ jy: "", jm: "", jd: "" });
    setActive(null);
  };

  /** انتخاب مقدار + پیشروی هوشمند به فیلد خالیِ بعدی */
  const pick = (f: BirthField, val: string) => {
    const next = { jy, jm, jd, [f]: val };
    // تغییر ماه/سال می‌تواند روزِ انتخابی را نامعتبر کند → پاک شود
    if (f !== "jd" && jd) {
      const y = Number(f === "jy" ? val : jy);
      const m = Number(f === "jm" ? val : jm);
      if (y && m && Number(jd) > jalaliMonthLength(y, m)) next.jd = "";
    }
    onChange(next);
    const order: BirthField[] = ["jd", "jm", "jy"];
    const after = order.slice(order.indexOf(f) + 1).find((k) => !next[k]);
    const anyEmpty = order.find((k) => !next[k]);
    if (after || anyEmpty) setActive(after || anyEmpty!);
    else setActive(null);
  };

  // بستن با Escape/تغییر اندازه + قفل اسکرول بدن در حالت بات‌شیت
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setActive(null);
    const onResize = () => setActive(null);
    const onScroll = () => !sheet && setActive(null);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    if (sheet) document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
      document.body.style.overflow = "";
    };
  }, [active, sheet]);

  // اسکرول خودکار به گزینهٔ انتخابی هنگام باز شدن
  useEffect(() => {
    if (!active || !gridRef.current) return;
    const sel = gridRef.current.querySelector<HTMLElement>("[data-selected='true']");
    if (sel) {
      gridRef.current.scrollTop = Math.max(0, sel.offsetTop - gridRef.current.clientHeight / 2 + sel.offsetHeight / 2);
    }
  }, [active]);

  const options = active ? optionsFor(active) : [];
  const title = active ? `انتخاب ${BIRTH_FIELDS.find((f) => f.key === active)!.label} تولد` : "";
  const anyValue = !!(jy || jm || jd);
  const allSet = !!(jy && jm && jd);

  // موقعیت پنل دسکتاپ — زیر ردیف فیلدها (یا بالا اگر جا نبود)
  const panelStyle = useMemo(() => {
    if (!rowRect || !active) return undefined;
    const width = Math.min(rowRect.width, window.innerWidth - 16);
    const rows = Math.ceil(optionsFor(active).length / (active === "jd" ? 7 : active === "jm" ? 3 : 5));
    const estimatedH = Math.min(288, 58 + rows * 44);
    const openDown = rowRect.bottom + estimatedH < window.innerHeight - 12;
    return {
      position: "fixed" as const,
      width,
      left: Math.max(8, Math.min(rowRect.left, window.innerWidth - width - 8)),
      ...(openDown
        ? { top: rowRect.bottom + 8 }
        : { bottom: window.innerHeight - rowRect.top + 8 }),
      transformOrigin: openDown ? "top center" : "bottom center",
    };
  }, [rowRect, active]);

  /** شبکهٔ گزینه‌ها — مشترک بین پاپ‌اور و بات‌شیت */
  const grid = (
    <div
      ref={gridRef}
      className={`relative grid gap-2 overflow-y-auto p-3.5 ${active ? colsFor(active) : ""} ${
        sheet ? "max-h-[58dvh]" : "max-h-64"
      }`}
      role="listbox"
      aria-label={title}
    >
      {options.map((o) => {
        const selected = valueOf(active!) === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="option"
            aria-selected={selected}
            data-selected={selected}
            onClick={() => pick(active!, o.value)}
            className={`grid h-11 place-items-center rounded-xl border text-[13px] transition-all duration-150 active:scale-95 ${
              active === "jm" ? "px-1 text-center" : ""
            } ${
              selected
                ? "shahryar-gradient border-transparent font-bold text-white shadow-md"
                : "border-border/50 bg-background text-foreground/80 hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
            }`}
          >
            <span className="truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-2.5">
      {/* سه دکمهٔ ماشه */}
      <div ref={rowRef} className="grid grid-cols-3 gap-2.5" dir="rtl">
        {BIRTH_FIELDS.map((f) => {
          const isOpen = active === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => (isOpen ? setActive(null) : openField(f.key))}
              aria-label={f.label + " تولد"}
              aria-expanded={isOpen}
              className={`flex h-[3.05rem] items-center justify-between gap-1 rounded-xl border bg-muted/30 px-3 text-[13.5px] outline-none transition-all duration-200 ${
                isOpen
                  ? "border-primary/70 bg-primary/[0.05] shadow-[0_0_0_4px_oklch(0.5_0.19_258/0.1)]"
                  : "border-border/70 hover:border-primary/40 hover:bg-accent/40"
              } ${valueOf(f.key) ? "font-bold text-foreground" : "text-muted-foreground"}`}
            >
              <span className="min-w-0 truncate">{labelOf(f.key) || f.label}</span>
              <ChevronDown
                className={`size-4 shrink-0 transition-transform duration-300 ${
                  isOpen ? "rotate-180 text-primary" : "text-muted-foreground/70"
                }`}
                style={{ width: 16, height: 16 }}
              />
            </button>
          );
        })}
      </div>

      {/* پیش‌نمایش تاریخ کامل */}
      <AnimatePresence>
        {allSet && (
          <motion.div
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/[0.05] px-3 py-2.5 text-xs">
              <Cake className="size-4 shrink-0 text-primary" style={{ width: 16, height: 16 }} />
              <span className="font-medium text-foreground/90">
                متولد {formatJalali({ jy: Number(jy), jm: Number(jm), jd: Number(jd) })}
              </span>
              <span className="flex-1" />
              <button
                type="button"
                onClick={clearAll}
                className="rounded-lg px-2 py-1 font-medium text-destructive/80 transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                پاک کردن
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* پنل/شیت — از طریق پورتال رندر می‌شود تا توسط کارت قیچی نشود */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {active && !sheet && (
              <>
                <motion.div
                  key="bp-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[79]"
                  onClick={() => setActive(null)}
                />
                <motion.div
                  key="bp-panel"
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  style={panelStyle}
                  className="z-[80] overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl shadow-primary/10"
                  role="dialog"
                  aria-label={title}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
                    <p className="text-[13px] font-black">{title}</p>
                    <div className="flex items-center gap-1">
                      {anyValue && (
                        <button
                          type="button"
                          onClick={clearAll}
                          className="rounded-lg px-2 py-1 text-[11px] font-medium text-destructive/80 transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          پاک کردن تاریخ
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setActive(null)}
                        aria-label="بستن"
                        className="grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <X className="size-4" style={{ width: 16, height: 16 }} />
                      </button>
                    </div>
                  </div>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={active}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.14 }}
                    >
                      {grid}
                    </motion.div>
                  </AnimatePresence>
                </motion.div>
              </>
            )}

            {active && sheet && (
              <>
                <motion.div
                  key="bs-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[79] bg-black/50 backdrop-blur-sm"
                  onClick={() => setActive(null)}
                />
                <motion.div
                  key="bs-sheet"
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 34, stiffness: 380 }}
                  className="fixed inset-x-0 bottom-0 z-[80] rounded-t-[1.75rem] border-t border-border/70 bg-card shadow-[0_-12px_48px_-12px_oklch(0.25_0.08_266/0.35)]"
                  style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
                  role="dialog"
                  aria-label={title}
                >
                  <div className="flex items-center justify-between gap-2 px-5 pb-3 pt-4">
                    <div className="mx-auto absolute left-1/2 top-2.5 h-[5px] w-11 -translate-x-1/2 rounded-full bg-muted-foreground/25" aria-hidden />
                    <p className="text-[14.5px] font-black">{title}</p>
                    <div className="flex items-center gap-1.5">
                      {anyValue && (
                        <button
                          type="button"
                          onClick={clearAll}
                          className="rounded-lg px-2 py-1 text-[11px] font-medium text-destructive/80 transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          پاک کردن تاریخ
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setActive(null)}
                        aria-label="بستن"
                        className="grid size-9 place-items-center rounded-xl border border-border/60 bg-muted/50 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <X className="size-4" style={{ width: 16, height: 16 }} />
                      </button>
                    </div>
                  </div>
                  <div className="border-t border-border/60">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={active}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.15 }}
                      >
                        {grid}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}

/** ذرات شناور پس‌زمینه */
function Particles() {
  const dots = Array.from({ length: 14 }, (_, i) => ({
    left: `${(i * 37) % 100}%`,
    top: `${(i * 53) % 100}%`,
    delay: `${(i % 7) * 0.9}s`,
    size: 3 + (i % 4),
  }));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {dots.map((d, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-white/30"
          style={{ left: d.left, top: d.top, width: d.size, height: d.size }}
          animate={{ y: [0, -26, 0], opacity: [0.15, 0.6, 0.15] }}
          transition={{ duration: 5 + (i % 5), repeat: Infinity, delay: parseFloat(d.delay), ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

export default function AuthScreen() {
  const setUser = useAppStore((s) => s.setUser);

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [purpose, setPurpose] = useState<"login" | "register">("login");
  const [profile, setProfile] = useState({ firstName: "", lastName: "", gender: "", jy: "", jm: "", jd: "" });

  const [otp, setOtp] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [ticket, setTicket] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [expiry, setExpiry] = useState(0);
  const [expiryTotal, setExpiryTotal] = useState(0);
  const [showPw, setShowPw] = useState(false);
  const errorRef = useRef<HTMLDivElement | null>(null);

  // شمارش معکوس ارسال مجدد و انقضای کد
  useEffect(() => {
    if (cooldown <= 0 && expiry <= 0) return;
    const t = setInterval(() => {
      setCooldown((c) => (c > 0 ? c - 1 : 0));
      setExpiry((e) => (e > 0 ? e - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [cooldown > 0 || expiry > 0]);

  const fmtTime = (s: number) => `${faNum(Math.floor(s / 60))}:${faNum(String(s % 60).padStart(2, "0"))}`;

  const showError = (msg: string) => {
    setError(msg);
    requestAnimationFrame(() => errorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  const normPhone = (raw: string) => enNum(raw).replace(/[\s\-()]/g, "");

  // ─── مرحله ۱: شماره موبایل ───
  const submitPhone = async () => {
    const cleaned = normPhone(phone);
    if (!/^(\+98|98|0)?9\d{9}$/.test(cleaned)) {
      showError("شماره موبایل معتبر نیست؛ نمونه صحیح: ۰۹۱۲۳۴۵۶۷۸۹");
      return;
    }
    setBusy(true);
    setError("");
    const res = await post<{ flow: "login" | "register"; devCode?: string | null; resendInSeconds?: number; expiresInSeconds?: number }>(
      "/api/auth/otp",
      { phone: cleaned, purpose: "login" }
    );
    setBusy(false);

    if (!res.success) return showError(res.error || "خطا در ارتباط با سرور");

    const data = res.data!;
    setPhone(cleaned.startsWith("0") || cleaned.startsWith("9") ? cleaned.replace(/^(\+98|98)/, "") : cleaned);
    if (data.flow === "register") {
      setPurpose("register");
      setStep("register");
    } else {
      setPurpose("login");
      setDevCode(data.devCode || null);
      setCooldown(data.resendInSeconds || 90);
      setExpiry(data.expiresInSeconds || 180);
      setExpiryTotal(data.expiresInSeconds || 180);
      setStep("otp");
    }
  };

  // ─── مرحله ۲ (ثبت‌نام): پروفایل + درخواست کد ───
  const submitRegister = async () => {
    const firstName = profile.firstName.trim();
    const lastName = profile.lastName.trim();
    if (firstName.length < 2) return showError("نام را وارد کنید (حداقل ۲ حرف)");
    if (lastName.length < 2) return showError("نام خانوادگی را وارد کنید (حداقل ۲ حرف)");
    if (profile.gender !== "male" && profile.gender !== "female") return showError("جنسیت را انتخاب کنید");

    const hasBirth = !!(profile.jy || profile.jm || profile.jd);
    if (hasBirth && !(profile.jy && profile.jm && profile.jd)) {
      return showError("تاریخ تولد را کامل انتخاب کنید یا هر سه فیلد را خالی بگذارید");
    }

    setBusy(true);
    setError("");
    const res = await post<{ devCode?: string | null; resendInSeconds?: number; expiresInSeconds?: number }>(
      "/api/auth/otp",
      {
        phone: normPhone(phone),
        purpose: "register",
        profile: {
          firstName,
          lastName,
          gender: profile.gender,
          birthDate: hasBirth
            ? { jy: Number(profile.jy), jm: Number(profile.jm), jd: Number(profile.jd) }
            : null,
        },
      }
    );
    setBusy(false);

    if (!res.success) return showError(res.error || "خطا در ارتباط با سرور");

    setDevCode(res.data!.devCode || null);
    setCooldown(res.data!.resendInSeconds || 90);
    setExpiry(res.data!.expiresInSeconds || 180);
    setExpiryTotal(res.data!.expiresInSeconds || 180);
    setOtp("");
    setStep("otp");
  };

  const finishLogin = (user: AuthedUser) => {
    setStep("success");
    toast({
      title: "خوش آمدید!",
      description: `${user.fullName || "کاربر عزیز"}، به شهریار خوش اومدی`,
    });
    setTimeout(() => setUser(user), 900);
  };

  // ─── مرحله ۳: تایید کد ───
  const verifyOtp = async (code: string) => {
    setBusy(true);
    setError("");
    const hasBirth = !!(profile.jy && profile.jm && profile.jd);
    const res = await post<
      | { user: AuthedUser }
      | { step: "password"; ticket: string }
    >("/api/auth/otp/verify", {
      phone: normPhone(phone),
      purpose,
      code,
      ...(purpose === "register"
        ? {
            profile: {
              firstName: profile.firstName.trim(),
              lastName: profile.lastName.trim(),
              gender: profile.gender,
              birthDate: hasBirth
                ? { jy: Number(profile.jy), jm: Number(profile.jm), jd: Number(profile.jd) }
                : null,
            },
          }
        : {}),
    });
    setBusy(false);

    if (!res.success) {
      // setOtp("") افکتِ همگام‌سازی را فعال می‌کند و otpRef را هم "" می‌کند
      setOtp("");
      return showError(res.error || "کد تایید نامعتبر است");
    }

    const data = res.data as { user?: AuthedUser; step?: string; ticket?: string };
    if (data.step === "password" && data.ticket) {
      setTicket(data.ticket);
      setPassword("");
      setStep("password");
      return;
    }
    if (data.user) return finishLogin(data.user);
  };

  const resendCode = async () => {
    if (cooldown > 0 || busy) return;
    setBusy(true);
    setError("");
    const hasBirth = !!(profile.jy && profile.jm && profile.jd);
    const res = await post<{ devCode?: string | null; resendInSeconds?: number; expiresInSeconds?: number }>(
      "/api/auth/otp",
      purpose === "register"
        ? {
            phone: normPhone(phone),
            purpose: "register",
            profile: {
              firstName: profile.firstName.trim(),
              lastName: profile.lastName.trim(),
              gender: profile.gender,
              birthDate: hasBirth ? { jy: Number(profile.jy), jm: Number(profile.jm), jd: Number(profile.jd) } : null,
            },
          }
        : { phone: normPhone(phone), purpose: "login" }
    );
    setBusy(false);

    if (!res.success) return showError(res.error || "ارسال مجدد ناموفق بود");

    setDevCode(res.data!.devCode || null);
    setCooldown(res.data!.resendInSeconds || 90);
    setExpiry(res.data!.expiresInSeconds || 180);
    setExpiryTotal(res.data!.expiresInSeconds || 180);
    setOtp("");
    toast({ title: "کد جدید ارسال شد", description: "کد تایید جدید برای شما پیامک شد" });
  };

  // ─── مرحله ۴: رمز دومرحله‌ای ───
  const submitPassword = async () => {
    if (password.length < 4) return showError("رمز عبور را وارد کنید");
    setBusy(true);
    setError("");
    const res = await post<{ user: AuthedUser }>("/api/auth/otp/password", { ticket, password });
    setBusy(false);

    if (!res.success) {
      // بلیت منقضی → بازگشت به ابتدای جریان
      if ((res as { status?: number }).status === 401 && /پایان رسیده/.test(res.error || "")) {
        setStep("phone");
        setOtp("");
        setTicket("");
        return showError("مهلت ورود تمام شد. دوباره تلاش کنید");
      }
      setPassword("");
      return showError(res.error || "رمز عبور اشتباه است");
    }
    if (res.data?.user) return finishLogin(res.data.user);
  };

  const backToPhone = () => {
    setStep("phone");
    setOtp("");
    setDevCode(null);
    setError("");
    setTicket("");
  };

  // ─── عناوین هر مرحله ───
  const stepMeta: Record<Step, { title: string; sub: string }> = {
    phone: { title: "ورود | ثبت‌نام", sub: "شماره موبایل خود را وارد کنید" },
    register: { title: "تکمیل ثبت‌نام", sub: "چند مشخصه ساده برای ساخت حساب شما" },
    otp: { title: "کد تایید", sub: `کد ۶ رقمی پیامک‌شده به ${faNum(normPhone(phone))} را وارد کنید` },
    password: { title: "رمز عبور حساب", sub: "حساب شما با رمز عبور محافظت می‌شود" },
    success: { title: "خوش آمدید!", sub: "در حال ورود به شهریار" },
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background" dir="rtl">
      <div className="fixed top-4 z-50 left-4">
        <ThemeToggle />
      </div>

      {/* ═══ پنل خوش‌آمدگویی (دسکتاپ) — فقط هویت و خوش‌آمد، بدون اطلاعات اضافه ═══ */}
      <div className="hidden lg:flex lg:w-[46%] relative overflow-hidden flex-col justify-between p-12 shahryar-gradient">
        <div className="absolute inset-0 bg-gradient-to-br from-[oklch(0.22_0.07_270)] via-transparent to-[oklch(0.5_0.14_230_/_0.35)]" />
        <div className="bg-grid-blue absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_80%)]" />
        <motion.div
          className="absolute -top-32 -left-24 w-[28rem] h-[28rem] rounded-full bg-[oklch(0.6_0.17_240_/_0.4)] blur-3xl"
          animate={{ scale: [1, 1.15, 1], x: [0, 40, 0], y: [0, 25, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-4 right-[-6rem] w-80 h-80 rounded-full bg-[oklch(0.68_0.13_215_/_0.35)] blur-3xl"
          animate={{ scale: [1, 1.2, 1], x: [0, -35, 0], y: [0, -30, 0] }}
          transition={{ duration: 13, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
        />
        <motion.div
          className="absolute top-1/2 left-1/3 w-56 h-56 rounded-full bg-[oklch(0.55_0.18_268_/_0.3)] blur-3xl"
          animate={{ scale: [1.1, 0.95, 1.1] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <Particles />

        <div className="relative z-10 flex items-center gap-3">
          <motion.div
            initial={{ scale: 0, rotate: -12 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", damping: 12, delay: 0.15 }}
            className="w-14 h-14 rounded-2xl glass-dark flex items-center justify-center shadow-blue-glow"
          >
            <Crown className="w-8 h-8 text-white" />
          </motion.div>
          <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
            <h1 className="text-2xl md:text-3xl font-black text-white">شهریار</h1>
            <p className="text-blue-100/85 text-sm mt-1">دستیار هوشمند شهر رفسنجان</p>
          </motion.div>
        </div>

        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 glass-dark rounded-full px-4 py-1.5 text-xs text-blue-100 mb-6">
              <MessageSquareCode className="w-3.5 h-3.5" />
              ورود امن با کد یکبارمصرف پیامکی
            </div>
            <h2 className="text-[2.7rem] font-black text-white leading-[1.2] mb-4">
              خوش آمدید
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-l from-white via-blue-100 to-sky-300">
                به شهریار
              </span>
            </h2>
            <p className="text-blue-50/75 text-lg leading-relaxed max-w-md">
              با شماره موبایل خود وارد شوید یا در چند ثانیه حساب بسازید.
            </p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="relative z-10 text-blue-100/55 text-sm flex items-center gap-2"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>ارتباط رمزنگاری‌شده و ورود دومرحله‌ای امن</span>
        </motion.div>
      </div>

      {/* ═══ هدر موبایل ═══ */}
      <div className="lg:hidden shahryar-gradient relative overflow-hidden rounded-b-[2.5rem]">
        <div className="bg-grid-blue absolute inset-0 opacity-50" />
        <motion.div
          className="absolute -top-20 -left-16 w-64 h-64 rounded-full bg-[oklch(0.6_0.17_240_/_0.45)] blur-3xl"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="relative z-10 flex flex-col items-center px-6 pt-[max(2.6rem,env(safe-area-inset-top))] pb-[4.5rem]">
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", damping: 12, delay: 0.1 }}
            className="w-[3.5rem] h-[3.5rem] rounded-[1.15rem] glass-dark flex items-center justify-center shadow-blue-glow-lg"
          >
            <Crown className="w-8 h-8 text-white" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="text-[1.35rem] font-black text-white mt-3.5 tracking-tight"
          >
            شهریار
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="text-blue-100/80 text-[12.5px] mt-1.5 tracking-wide"
          >
            دستیار هوشمند شهر رفسنجان
          </motion.p>
        </div>
      </div>

      {/* ═══ فرم ورود ═══ */}
      <div className="flex-1 flex items-center justify-center p-5 sm:p-8 lg:p-12 bg-background relative overflow-hidden">
        <div className="absolute top-[-8rem] left-[-6rem] w-96 h-96 rounded-full bg-blue-500/8 dark:bg-blue-500/12 blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-8rem] right-[-6rem] w-96 h-96 rounded-full bg-sky-400/8 dark:bg-indigo-500/12 blur-3xl pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 34 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md relative z-10 -mt-10 lg:mt-0"
        >
          <div className="relative rounded-[1.65rem] p-[1.5px] bg-gradient-to-br from-blue-500/50 via-sky-400/25 to-indigo-500/40 dark:from-blue-400/40 dark:via-sky-500/20 dark:to-indigo-400/35 shadow-[0_24px_60px_-20px_oklch(0.45_0.17_258/0.3),0_8px_24px_-12px_oklch(0.3_0.1_266/0.18)]">
            <div className="absolute -inset-[1.5px] rounded-[1.7rem] bg-gradient-to-br from-blue-500/30 to-indigo-500/30 blur-md opacity-45 animate-glow-pulse pointer-events-none" />
            <div className="relative bg-card rounded-[1.6rem] px-5 pt-10 pb-6 sm:px-8 sm:py-8">
              <AnimatePresence mode="wait">
                {step === "success" ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="py-14 flex flex-col items-center text-center"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", damping: 10, delay: 0.1 }}
                      className="relative w-24 h-24 flex items-center justify-center mb-6"
                    >
                      <span className="absolute inset-0 rounded-full bg-blue-500/15 animate-pulse-ring" aria-hidden />
                      <span className="absolute inset-2 rounded-full bg-blue-500/15 animate-pulse-ring" style={{ animationDelay: "0.4s" }} aria-hidden />
                      <span className="relative w-[4.5rem] h-[4.5rem] rounded-full bg-blue-500/10 border border-blue-500/25 flex items-center justify-center">
                        <CheckCircle2 className="w-12 h-12 text-blue-500" />
                      </span>
                    </motion.div>
                    <h2 className="text-[1.4rem] font-black tracking-tight">خوش آمدید!</h2>
                    <p className="text-muted-foreground text-[13px] mt-2.5 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      در حال ورود به شهریار...
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -14 }}
                    transition={{ duration: 0.22 }}
                  >
                    {/* خطای درون‌فرمی */}
                    <AnimatePresence>
                      {error && (
                        <motion.div
                          ref={errorRef}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden mb-4"
                        >
                          <div className="flex items-start gap-2.5 rounded-xl bg-destructive/[0.07] border border-destructive/25 px-3.5 py-3 text-destructive text-xs leading-relaxed">
                            <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-destructive/10 mt-px">
                              <AlertCircle className="w-3.5 h-3.5" />
                            </span>
                            <span className="font-medium pt-0.5">{error}</span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="mb-6 flex items-start gap-3 sm:mb-7">
                      {step !== "phone" && (
                        <motion.button
                          type="button"
                          onClick={backToPhone}
                          whileTap={{ scale: 0.92 }}
                          aria-label="بازگشت به مرحله قبل"
                          className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl border border-border/70 bg-muted/50 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          <ArrowRight style={{ width: 18, height: 18 }} />
                        </motion.button>
                      )}
                      <div className="min-w-0">
                        <h2 className="text-[1.35rem] sm:text-2xl font-black mb-1.5 tracking-tight">{stepMeta[step].title}</h2>
                        <p className="text-muted-foreground text-[13px] sm:text-sm leading-6 break-words">
                          {stepMeta[step].sub}
                        </p>
                      </div>
                    </div>

                    {/* ─── مرحله ۱: شماره موبایل ─── */}
                    {step === "phone" && (
                      <form
                        onSubmit={(e) => { e.preventDefault(); submitPhone(); }}
                        className="space-y-5"
                      >
                        <div className="space-y-2.5">
                          <Label htmlFor="phone" className="text-[13px] font-bold">شماره موبایل</Label>
                          <div className="relative">
                            <Smartphone className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/80 pointer-events-none z-10" />
                            <Input
                              id="phone"
                              value={phone}
                              onChange={(e) => { setPhone(e.target.value); setError(""); }}
                              placeholder="09123456789"
                              className="pr-12 pl-[4.3rem] h-[54px] rounded-xl text-left text-[17px] font-semibold tracking-[0.12em] transition-all duration-200 border-border/70 bg-muted/40 focus:bg-background focus:border-primary/70 focus:shadow-[0_0_0_4px_oklch(0.5_0.19_258/0.12)]"
                              inputMode="tel"
                              dir="ltr"
                              autoComplete="tel"
                              autoFocus
                              maxLength={14}
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-muted-foreground/90 border border-border/60 bg-muted/50 rounded-lg px-2 py-1.5 tracking-wide" dir="ltr">
                              +98
                            </span>
                          </div>
                        </div>
                        <motion.div whileTap={{ scale: 0.985 }}>
                          <Button
                            type="submit"
                            disabled={busy}
                            className="w-full h-[52px] rounded-[0.9rem] text-[15px] font-extrabold tracking-tight shahryar-gradient btn-shine text-white border-0 hover:brightness-110 active:brightness-95 transition-all shadow-blue-glow"
                          >
                            {busy ? (
                              <span className="flex items-center gap-2">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                در حال بررسی...
                              </span>
                            ) : (
                              <span className="flex items-center gap-2">
                                ادامه
                                <ArrowLeft className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                              </span>
                            )}
                          </Button>
                        </motion.div>
                        <p className="text-center text-[11.5px] leading-6 text-muted-foreground px-3">
                          اگر قبلاً ثبت‌نام کرده باشید وارد حساب خود می‌شوید؛ در غیر این صورت فرم ثبت‌نام نمایش داده می‌شود
                        </p>
                      </form>
                    )}

                    {/* ─── مرحله ۲: ثبت‌نام ─── */}
                    {step === "register" && (
                      <form
                        onSubmit={(e) => { e.preventDefault(); submitRegister(); }}
                        className="space-y-[1.1rem]"
                      >
                        {/* بخش ۱: مشخصات فردی */}
                        <FormSection icon={UserRound} title="مشخصات فردی" />

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2.5">
                            <FieldLabel htmlFor="firstName" icon={UserRound} required>نام</FieldLabel>
                            <div className="relative">
                              <Input
                                id="firstName"
                                value={profile.firstName}
                                onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                                placeholder="مثلاً محمد"
                                className={`h-12 rounded-xl text-right text-[15px] bg-muted/40 focus:bg-background transition-all duration-200 border-border/70 ${
                                  profile.firstName.trim().length >= 2
                                    ? "border-emerald-500/50 focus:border-emerald-500/60 focus:shadow-[0_0_0_4px_oklch(0.7_0.15_162/0.1)]"
                                    : "focus:border-primary/70 focus:shadow-[0_0_0_4px_oklch(0.5_0.19_258/0.12)]"
                                }`}
                                autoFocus
                                autoComplete="given-name"
                              />
                              <AnimatePresence>
                                {profile.firstName.trim().length >= 2 && (
                                  <motion.span
                                    initial={{ opacity: 0, scale: 0.5 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.5 }}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500"
                                  >
                                    <CircleCheck style={{ width: 16, height: 16 }} />
                                  </motion.span>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                          <div className="space-y-2.5">
                            <FieldLabel htmlFor="lastName" icon={IdCard} required>نام خانوادگی</FieldLabel>
                            <div className="relative">
                              <Input
                                id="lastName"
                                value={profile.lastName}
                                onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                                placeholder="مثلاً رضایی"
                                className={`h-12 rounded-xl text-right text-[15px] bg-muted/40 focus:bg-background transition-all duration-200 border-border/70 ${
                                  profile.lastName.trim().length >= 2
                                    ? "border-emerald-500/50 focus:border-emerald-500/60 focus:shadow-[0_0_0_4px_oklch(0.7_0.15_162/0.1)]"
                                    : "focus:border-primary/70 focus:shadow-[0_0_0_4px_oklch(0.5_0.19_258/0.12)]"
                                }`}
                                autoComplete="family-name"
                              />
                              <AnimatePresence>
                                {profile.lastName.trim().length >= 2 && (
                                  <motion.span
                                    initial={{ opacity: 0, scale: 0.5 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.5 }}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500"
                                  >
                                    <CircleCheck style={{ width: 16, height: 16 }} />
                                  </motion.span>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2.5">
                          <FieldLabel icon={UserRound} required>جنسیت</FieldLabel>
                          <GenderSegmented
                            value={profile.gender}
                            onChange={(g) => setProfile({ ...profile, gender: g })}
                          />
                        </div>

                        {/* بخش ۲: تاریخ تولد */}
                        <FormSection icon={CalendarHeart} title="تاریخ تولد" badge="اختیاری" />
                        <BirthDatePicker
                          jy={profile.jy}
                          jm={profile.jm}
                          jd={profile.jd}
                          onChange={(next) => setProfile((p) => ({ ...p, ...next }))}
                        />
                        <p className="flex items-start gap-1.5 text-[11.5px] leading-5 text-muted-foreground/80">
                          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary/60" style={{ width: 14, height: 14 }} />
                          تاریخ تولد برای شخصی‌سازی خدمات و محاسبهٔ سن شما استفاده می‌شود؛ اگر ترجیح می‌دهید، خالی بگذارید.
                        </p>

                        <div className="pt-1.5">
                          <motion.div whileTap={{ scale: 0.985 }}>
                            <Button
                              type="submit"
                              disabled={busy}
                              className="w-full h-[52px] rounded-[0.9rem] text-[15px] font-extrabold tracking-tight shahryar-gradient btn-shine text-white border-0 hover:brightness-110 active:brightness-95 transition-all shadow-blue-glow"
                            >
                              {busy ? (
                                <span className="flex items-center gap-2">
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                  در حال ارسال کد...
                                </span>
                              ) : (
                                <span className="flex items-center gap-2">
                                  <MessageSquareCode className="w-5 h-5" />
                                  دریافت کد تایید
                                </span>
                              )}
                            </Button>
                          </motion.div>
                        </div>
                      </form>
                    )}

                    {/* ─── مرحله ۳: کد تایید ─── */}
                    {step === "otp" && (
                      <div className="space-y-5">
                        {devCode && (
                          <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-2xl bg-amber-500/[0.08] border border-dashed border-amber-500/40 px-4 py-3.5 text-xs leading-6 text-amber-600 dark:text-amber-400"
                          >
                            <p className="font-bold mb-1.5">پنل پیامک هنوز پیکربندی نشده — حالت تست</p>
                            <p className="opacity-90">
                              کد تایید شما:{" "}
                              <span className="inline-block rounded-md bg-amber-500/15 px-2 py-0.5 font-black text-[13px] tracking-[0.28em] align-middle" dir="ltr">
                                {devCode}
                              </span>
                              <br />
                              پس از پیکربندی «پنل پیامکی» در مدیریت، کد از طریق پیامک ارسال می‌شود
                            </p>
                          </motion.div>
                        )}

                        <div className="space-y-4">
                          <OtpBoxes
                            value={otp}
                            onChange={(v) => { setOtp(v); if (v.length < 6) setError(""); }}
                            onComplete={(v) => verifyOtp(v)}
                            disabled={busy}
                          />

                          {/* نوار پیشرفت اعتبار کد */}
                          {expiryTotal > 0 && (
                            <div className="flex items-center gap-3">
                              <div className="relative h-[5px] flex-1 overflow-hidden rounded-full bg-muted">
                                <motion.div
                                  className="h-full rounded-full shahryar-gradient"
                                  initial={false}
                                  animate={{ width: `${Math.max(0, Math.min(100, (expiry / expiryTotal) * 100))}%` }}
                                  transition={{ duration: 1, ease: "linear" }}
                                />
                              </div>
                              {expiry > 0 && (
                                <span className="text-[12px] font-medium text-muted-foreground flex items-center gap-1.5 tnum shrink-0">
                                  <ShieldCheck className="w-4 h-4 text-primary/70" />
                                  {fmtTime(expiry)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <motion.div whileTap={{ scale: 0.985 }}>
                          <Button
                            onClick={() => verifyOtp(otp)}
                            disabled={busy || otp.length !== 6}
                            className="w-full h-[52px] rounded-[0.9rem] text-[15px] font-extrabold tracking-tight shahryar-gradient btn-shine text-white border-0 hover:brightness-110 active:brightness-95 transition-all shadow-blue-glow disabled:opacity-60 disabled:shadow-none disabled:saturate-50"
                          >
                            {busy ? (
                              <span className="flex items-center gap-2">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                در حال تایید...
                              </span>
                            ) : (
                              <span className="flex items-center gap-2">
                                تایید و ادامه
                                <ArrowLeft className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                              </span>
                            )}
                          </Button>
                        </motion.div>

                        <div className="flex items-center justify-between border-t border-border/60 pt-4 text-[12.5px]">
                          <button
                            onClick={backToPhone}
                            className="text-muted-foreground hover:text-foreground transition-colors font-medium"
                          >
                            تغییر شماره
                          </button>
                          {cooldown > 0 ? (
                            <span className="text-muted-foreground/80 tnum">
                              ارسال مجدد کد تا {fmtTime(cooldown)}
                            </span>
                          ) : (
                            <button
                              onClick={resendCode}
                              disabled={busy}
                              className="text-primary hover:text-primary/80 font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                            >
                              <RefreshCw className="w-4 h-4" />
                              ارسال مجدد کد
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ─── مرحله ۴: رمز دومرحله‌ای ─── */}
                    {step === "password" && (
                      <form
                        onSubmit={(e) => { e.preventDefault(); submitPassword(); }}
                        className="space-y-[1.15rem]"
                      >
                        <div className="flex justify-center">
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", damping: 12 }}
                            className="w-[3.6rem] h-[3.6rem] rounded-[1.15rem] bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_10px_28px_-10px_oklch(0.47_0.19_258/0.4)]"
                          >
                            <Lock className="w-[1.65rem] h-[1.65rem] text-primary" />
                          </motion.div>
                        </div>

                        <div className="rounded-2xl bg-primary/[0.05] border border-primary/15 px-4 py-3.5 text-[12.5px] leading-6 text-muted-foreground text-center">
                          کد پیامکی تایید شد. حساب شما با رمز عبور محافظت می‌شود؛ برای تکمیل ورود رمز خود را وارد کنید.
                        </div>

                        <div className="space-y-2.5">
                          <Label htmlFor="password" className="text-[13px] font-bold">رمز عبور</Label>
                          <div className="relative">
                            <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/80 pointer-events-none z-10" />
                            <Input
                              id="password"
                              type={showPw ? "text" : "password"}
                              value={password}
                              onChange={(e) => { setPassword(e.target.value); setError(""); }}
                              placeholder="••••••••"
                              className="pr-12 pl-12 h-[54px] rounded-xl text-left text-[16px] tracking-[0.2em] transition-all duration-200 border-border/70 bg-muted/40 focus:bg-background focus:border-primary/70 focus:shadow-[0_0_0_4px_oklch(0.5_0.19_258/0.12)]"
                              dir="ltr"
                              autoComplete="current-password"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => setShowPw((v) => !v)}
                              aria-label={showPw ? "پنهان کردن رمز" : "نمایش رمز"}
                              className="absolute left-2.5 top-1/2 -translate-y-1/2 grid size-9 place-items-center rounded-lg text-muted-foreground/70 hover:text-foreground hover:bg-accent/60 transition-colors z-10"
                            >
                              {showPw ? <EyeOff style={{ width: 18, height: 18 }} /> : <Eye style={{ width: 18, height: 18 }} />}
                            </button>
                          </div>
                        </div>

                        <motion.div whileTap={{ scale: 0.985 }}>
                          <Button
                            type="submit"
                            disabled={busy}
                            className="w-full h-[52px] rounded-[0.9rem] text-[15px] font-extrabold tracking-tight shahryar-gradient btn-shine text-white border-0 hover:brightness-110 active:brightness-95 transition-all shadow-blue-glow"
                          >
                            {busy ? (
                              <span className="flex items-center gap-2">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                در حال بررسی...
                              </span>
                            ) : (
                              <span className="flex items-center gap-2">
                                ورود به حساب
                                <ArrowLeft className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                              </span>
                            )}
                          </Button>
                        </motion.div>
                      </form>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center text-[11px] leading-5 text-muted-foreground/90 mt-7 px-4"
          >
            با ورود یا ثبت‌نام، شرایط استفاده و حریم خصوصی شهریار را می‌پذیرید
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
