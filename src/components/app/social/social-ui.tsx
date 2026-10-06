// ═════ کامپوننت‌های مشترک شبکه اجتماعی شهریار ═════
"use client";

import { useEffect, useRef } from "react";
import { Check, Eye, MapPin, Sparkles, ThumbsUp } from "lucide-react";
import { avatarColor, faNum } from "@/lib/client/persian";
import { initialFontSize, initialOpticalDy } from "@/lib/client/avatar-initial";
import { bannerGradient, SKILL_LEVEL_LABELS, type PersonCardData } from "@/lib/modules/social/types";

/** شکل گوشه آواتار — از map ایستا تا Tailwind کلاس‌ها را شناسایی کند */
const AVATAR_RADIUS: Record<string, string> = {
  full: "rounded-full",
  "3xl": "rounded-3xl",
  "2xl": "rounded-2xl",
  xl: "rounded-xl",
  lg: "rounded-lg",
  md: "rounded-md",
};

/**
 * آواتار کاربر — تصویر یا حرف اول با گرادیان.
 * حرف اول: نسبت فونت ~۴۲٪ قطر + leading-none + وسط‌چینیِ «نوریِ» جوهر گلیف
 * (با canvas اندازه‌گیری می‌شود — ن، م پایین‌ نمی‌مانند و آ، ک بالا نمی‌روند).
 * size داده نشود → اندازه از کلاس‌های className گرفته می‌شود.
 */
export function PersonAvatar({
  name,
  avatarUrl,
  color,
  size,
  radius = "2xl",
  className = "",
}: {
  name: string;
  avatarUrl?: string | null;
  color?: string | null;
  size?: number;
  radius?: keyof typeof AVATAR_RADIUS;
  className?: string;
}) {
  const letter = (name || "ش").trim().charAt(0) || "ش";
  const fontPx = size ? initialFontSize(size) : undefined;
  const letterRef = useRef<HTMLSpanElement>(null);

  // وسط‌چینی نوری — فقط سمت کلاینت و پس از هیدریشن (بدون mismatch)
  useEffect(() => {
    const el = letterRef.current;
    if (!el || avatarUrl) return;
    const apply = () => {
      const px = fontPx ?? parseFloat(getComputedStyle(el).fontSize);
      const dy = initialOpticalDy(letter, px);
      el.style.transform = Number.isFinite(dy) && Math.abs(dy) >= 0.5 ? `translateY(${-dy.toFixed(2)}px)` : "";
    };
    apply();
    // اگر فونت هنوز در حال لود است، پس از آماده‌شدن دوباره اعمال شود
    if (typeof document !== "undefined" && document.fonts && document.fonts.status !== "loaded") {
      document.fonts.ready.then(apply).catch(() => {});
    }
  }, [letter, fontPx, avatarUrl]);

  const roundCls = AVATAR_RADIUS[radius] ?? AVATAR_RADIUS["2xl"];
  const cls = `${roundCls} object-cover shadow-md ${className}`;
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        width={size}
        height={size}
        style={size ? { width: size, height: size } : undefined}
        className={cls}
      />
    );
  }
  return (
    <div
      style={size ? { width: size, height: size } : undefined}
      className={`${roundCls} bg-gradient-to-br ${avatarColor(color || "0")} flex items-center justify-center text-white font-black shadow-md shrink-0 ${className}`}
    >
      {/* حرف در span جدا — translateYِ وسط‌چینی نوری باید فقط روی «حرف» بیاید،
          نه کل دایره (وگرنه دایره و حرف با هم جابه‌جا می‌شوند و فایده ندارد) */}
      <span
        ref={letterRef}
        style={size ? { fontSize: fontPx } : undefined}
        className="leading-none"
      >
        {letter}
      </span>
    </div>
  );
}

/** چیپ مهارت با سطح تسلط — وقتی onClick ندارد به‌صورت span رندر می‌شود (قابل‌تودرتو در دکمه‌ها) */
export function SkillChip({
  name,
  level,
  count,
  endorsed,
  onClick,
}: {
  name: string;
  level?: number;
  count?: number;
  endorsed?: boolean;
  onClick?: () => void;
}) {
  const cls = `inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-2 text-[11px] font-bold transition-all max-sm:text-xs sm:py-1 ${
    onClick ? "cursor-pointer hover:scale-105 active:scale-95" : ""
  } ${
    endorsed
      ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/30 dark:text-emerald-300"
      : "border-primary/20 bg-primary/5 text-primary dark:bg-primary/10"
  }`;
  const inner = (
    <>
      {endorsed ? <Check className="size-3 shrink-0" /> : null}
      {/* dir=auto: مهارت‌های انگلیسی در راستای خودشان و مهارت‌های فارسی راست‌چین */}
      <span dir="auto" className="truncate">{name}</span>
      {level ? <span className="shrink-0 font-medium opacity-60">· {SKILL_LEVEL_LABELS[level] || ""}</span> : null}
      {typeof count === "number" && count > 0 ? (
        <span className="tnum inline-flex shrink-0 items-center gap-0.5 rounded-full bg-foreground/10 px-1.5 py-px text-[10px]">
          <ThumbsUp className="size-2.5" />
          {faNum(count)}
        </span>
      ) : null}
    </>
  );
  if (!onClick) return <span className={cls}>{inner}</span>;
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

/** نشان «ایجنت فعال» — دانش اختصاصی دارد؛ glass برای قرارگیری روی بنر گرادیانی */
export function AgentBadge({ compact = false, glass = false }: { compact?: boolean; glass?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
        glass
          ? "border border-white/30 bg-white/15 text-white backdrop-blur-md"
          : "border border-violet-300/60 bg-violet-50 text-violet-700 dark:border-violet-700/40 dark:bg-violet-900/30 dark:text-violet-300"
      }`}
    >
      <Sparkles className="size-3" />
      {compact ? "ایجنت" : "ایجنت فعال"}
    </span>
  );
}

/** نوار آمار کوچک — در ظرف wrap شده قرار می‌گیرد تا در کارت‌های باریک بشکند، نه سرریز */
export function StatRow({ views, endorsements, knowledge }: { views: number; endorsements: number; knowledge?: boolean }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground tnum">
      <span className="inline-flex items-center gap-1">
        <Eye className="size-3 shrink-0" />
        {faNum(views)} بازدید
      </span>
      <span className="inline-flex items-center gap-1">
        <ThumbsUp className="size-3 shrink-0" />
        {faNum(endorsements)} تأیید مهارت
      </span>
      {knowledge ? (
        <span className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400">
          <Sparkles className="size-3 shrink-0" />
          ایجنت هوشمند
        </span>
      ) : null}
    </div>
  );
}

/** بنر کوچک بالای کارت — گرادیان تم یا تصویر */
export function MiniBanner({
  theme,
  url,
  className = "h-16",
  children,
}: {
  theme: string;
  url?: string | null;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: bannerGradient(theme) }}>
      {url ? <img src={url} alt="بنر پروفایل" className="absolute inset-0 size-full object-cover" /> : null}
      <div aria-hidden className="pattern-dots absolute inset-0 opacity-20" />
      {children}
    </div>
  );
}

/** نشان شهر/محله */
export function CityChip({ city }: { city?: string | null }) {
  if (!city) return null;
  return (
    <span className="inline-flex max-w-32 shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
      <MapPin className="size-3 shrink-0" />
      <span dir="auto" className="truncate">{city}</span>
    </span>
  );
}

/** کارت پیشنهادی افقی (شبیه people-you-may-know لینکدین) — نام تک‌خطی، ساختار ثابت
 *  راهنمای «مشاهده پروفایل ←» در موبایل همیشه‌نمایان است (hover ندارد) */
export function SuggestionCard({ person, onClick }: { person: PersonCardData; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={`پروفایل ${person.name}`}
      className="group flex w-44 shrink-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card text-right shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg active:scale-[0.97] sm:w-48"
    >
      <MiniBanner theme={person.bannerTheme} url={person.bannerUrl} className="h-14 shrink-0" />
      {/* relative z-10: آواتار باید روی بنر بنشیند، نه زیر گرادیان */}
      <div className="relative z-10 flex flex-1 flex-col px-3 pb-3">
        <div className="-mt-6 mb-1.5 flex items-end">
          <PersonAvatar
            name={person.name}
            avatarUrl={person.avatarUrl}
            color={person.avatarColor}
            size={44}
            className="shrink-0 ring-4 ring-card"
          />
        </div>
        <p className="line-clamp-1 text-sm font-black leading-5" dir="auto" title={person.name}>
          {person.name}
        </p>
        <p className="mt-1 line-clamp-2 min-h-8 text-[11px] leading-4 text-muted-foreground" dir="auto">
          {person.headline || "بدون عنوان شغلی"}
        </p>
        <p className="mt-auto flex items-center gap-1 pt-2 text-[10px] font-bold text-primary opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          مشاهده پروفایل
          <span aria-hidden>←</span>
        </p>
      </div>
    </button>
  );
}
