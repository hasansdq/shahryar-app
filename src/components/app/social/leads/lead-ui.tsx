// ═══ اتم‌های مشترک UI لید — وضعیت، ترنسکریپت، کاربر لید ═══
// بین پنل لیدهای ایجنت شخصی (تب پروفایل) و لیدهای ایجنت انجمن
// (بخش مدیریت انجمن) به اشتراک گذاشته می‌شود.
"use client";

import { Fragment } from "react";
import {
  Archive, ArrowLeft, BadgeCheck, Bot, CheckCircle2, Crown, MapPin, MessagesSquare,
  PhoneOutgoing, Sparkles, User, UserCheck,
} from "lucide-react";
import { faDate, faNum, faRelative, faTime } from "@/lib/client/persian";
import type { LeadMessageDTO, LeadStatus, LeadUserDTO } from "@/lib/modules/leads/service";
import { PersonAvatar } from "../social-ui";

// ─── متادیتا وضعیت‌های لید (رنگ + آیکن + برچسب فارسی) ───

export const LEAD_STATUS_META: Record<
  LeadStatus,
  { label: string; icon: typeof Sparkles; chip: string; dot: string; solid: string }
> = {
  NEW: {
    label: "جدید",
    icon: Sparkles,
    chip: "border-sky-300/60 bg-sky-50 text-sky-700 dark:border-sky-700/40 dark:bg-sky-900/30 dark:text-sky-300",
    dot: "bg-sky-500",
    solid: "bg-gradient-to-br from-sky-500 to-blue-600 text-white",
  },
  CONTACTED: {
    label: "تماس گرفته‌شده",
    icon: PhoneOutgoing,
    chip: "border-amber-300/60 bg-amber-50 text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/30 dark:text-amber-300",
    dot: "bg-amber-500",
    solid: "bg-gradient-to-br from-amber-500 to-orange-600 text-white",
  },
  CONVERTED: {
    label: "تبدیل‌شده",
    icon: CheckCircle2,
    chip: "border-emerald-300/60 bg-emerald-50 text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-900/30 dark:text-emerald-300",
    dot: "bg-emerald-500",
    solid: "bg-gradient-to-br from-emerald-500 to-green-600 text-white",
  },
  ARCHIVED: {
    label: "آرشیو",
    icon: Archive,
    chip: "border-slate-300/60 bg-slate-100 text-slate-600 dark:border-slate-700/40 dark:bg-slate-800/60 dark:text-slate-300",
    dot: "bg-slate-400",
    solid: "bg-gradient-to-br from-slate-500 to-slate-600 text-white",
  },
};

/** چیپ وضعیت لید */
export function LeadStatusBadge({ status, size = "sm" }: { status: LeadStatus; size?: "sm" | "xs" }) {
  const meta = LEAD_STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border font-bold ${meta.chip} ${
        size === "sm" ? "px-2.5 py-1 text-[10px]" : "px-2 py-0.5 text-[9px]"
      }`}
    >
      <Icon className={size === "sm" ? "size-3" : "size-2.5"} />
      {meta.label}
    </span>
  );
}

/** انتخابگر وضعیت — چهار گزینه با بازخورد بصری کامل */
export function LeadStatusPicker({
  value,
  onChange,
  disabled,
}: {
  value: LeadStatus;
  onChange: (s: LeadStatus) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {(Object.keys(LEAD_STATUS_META) as LeadStatus[]).map((s) => {
        const meta = LEAD_STATUS_META[s];
        const Icon = meta.icon;
        const active = value === s;
        return (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onChange(s)}
            className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-[11px] font-bold transition-all active:scale-95 disabled:opacity-50 ${
              active
                ? `${meta.solid} border-transparent shadow-md`
                : "border-border/60 bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
            }`}
          >
            <Icon className="size-4.5" />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}

/** نشان نقش کاربر در انجمن (لید انجمن) */
export function ForumRoleBadge({ role }: { role: "CHAIR" | "MEMBER" | "GUEST" }) {
  if (role === "CHAIR") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/60 bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/30 dark:text-amber-300">
        <Crown className="size-2.5" />
        رئیس انجمن
      </span>
    );
  }
  if (role === "MEMBER") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-teal-300/60 bg-teal-50 px-2 py-0.5 text-[9px] font-bold text-teal-700 dark:border-teal-700/40 dark:bg-teal-900/30 dark:text-teal-300">
        <UserCheck className="size-2.5" />
        عضو انجمن
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-sky-300/60 bg-sky-50 px-2 py-0.5 text-[9px] font-bold text-sky-700 dark:border-sky-700/40 dark:bg-sky-900/30 dark:text-sky-300">
      <User className="size-2.5" />
      مهمان (غیرعضو)
    </span>
  );
}

/** بلوک کاربر لید — آواتار + نام + عنوان + شهر + دکمه پروفایل */
export function LeadUserBlock({
  user,
  onOpenProfile,
  extra,
}: {
  user: LeadUserDTO;
  onOpenProfile?: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3.5">
      <PersonAvatar name={user.name} avatarUrl={user.avatarUrl} color={user.avatarColor} size={56} className="shrink-0 ring-2 ring-border/60" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm font-black leading-6" dir="auto">
            {user.name}
          </p>
          {user.isVerified ? <BadgeCheck className="size-4 shrink-0 fill-primary text-white" aria-label="تأییدشده" /> : null}
          {extra}
        </div>
        {user.headline ? (
          <p className="mt-0.5 truncate text-xs font-bold text-primary" dir="auto">
            {user.headline}
          </p>
        ) : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          {user.city ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {user.city}
            </span>
          ) : null}
          {onOpenProfile ? (
            <button
              type="button"
              onClick={onOpenProfile}
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-[10px] font-bold text-primary transition-colors hover:bg-primary/10 active:scale-95"
            >
              مشاهده پروفایل
              <ArrowLeft className="size-3" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** برچسب روز برای ترنسکریپت */
function transcriptDayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit",
  });
  const today = fmt.format(new Date());
  const yesterday = fmt.format(new Date(Date.now() - 86400000));
  const that = fmt.format(d);
  if (that === today) return "امروز";
  if (that === yesterday) return "دیروز";
  return faDate(d);
}

/** ترنسکریپت فقط-خواندنی گفتگوی لید با ایجنت — حباب‌های متمایز + جداکننده تاریخ */
export function LeadTranscript({
  messages,
  agentTheme = "violet",
  wasReset,
  userLabel,
}: {
  messages: LeadMessageDTO[];
  agentTheme?: "violet" | "teal";
  wasReset: boolean;
  userLabel: string;
}) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-dashed border-border/60 bg-muted/30 px-4 py-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
          <MessagesSquare className="size-6 text-muted-foreground" />
        </div>
        <p className="text-xs font-bold">{wasReset ? "گفتگو توسط کاربر بازنشانی شده است" : "هنوز پیامی ردوبدل نشده است"}</p>
        <p className="max-w-xs text-[11px] leading-5 text-muted-foreground">
          {wasReset
            ? "کاربر برای شروع تازه، تاریخچه‌ی گفتگوی خود را پاک کرده است؛ آمار کل گفتگو در کارت لید محفوظ است."
            : "به‌محض ارسال اولین پیام از طرف کاربر، ترنسکریپت کامل اینجا نمایش داده می‌شود."}
        </p>
      </div>
    );
  }

  const violet = agentTheme === "violet";
  return (
    <div className="space-y-2.5 rounded-2xl border border-border/60 bg-muted/20 p-3.5">
      {messages.map((m, i) => {
        const day = transcriptDayLabel(m.createdAt);
        const prevDay = i > 0 ? transcriptDayLabel(messages[i - 1].createdAt) : null;
        const showDay = !!day && day !== prevDay;
        return (
          <Fragment key={m.id}>
            {showDay ? (
              <div className="flex items-center justify-center gap-3 pt-1 pb-0.5">
                <div aria-hidden className="h-px flex-1 bg-gradient-to-l from-transparent to-border" />
                <span className="rounded-full border border-border/50 bg-accent/70 px-2.5 py-0.5 text-[9.5px] font-medium text-muted-foreground">
                  {day}
                </span>
                <div aria-hidden className="h-px flex-1 bg-gradient-to-r from-transparent to-border" />
              </div>
            ) : null}
            {m.fromUser ? (
              <div className="flex justify-end">
                <div className="min-w-0 max-w-[85%] rounded-2xl rounded-br-sm shahryar-gradient px-3.5 py-2 text-white">
                  <p className="whitespace-pre-line break-words text-[12.5px] leading-6" dir="auto">
                    {m.content}
                  </p>
                  <p className="mt-0.5 text-end text-[9.5px] text-white/70 tnum">{faTime(m.createdAt)}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <div
                  className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-white shadow-md ${
                    violet ? "bg-gradient-to-br from-violet-500 to-purple-600" : "bg-gradient-to-br from-teal-500 to-cyan-600"
                  }`}
                >
                  <Bot className="size-3.5" />
                </div>
                <div className="min-w-0 max-w-[85%]">
                  <div
                    className={`rounded-2xl rounded-bl-sm border px-3.5 py-2 ${
                      violet
                        ? "border-violet-200/70 bg-violet-50/80 dark:border-violet-800/50 dark:bg-violet-900/25"
                        : "border-teal-500/25 bg-teal-500/5 dark:border-teal-700/30 dark:bg-teal-900/15"
                    }`}
                  >
                    <p className="whitespace-pre-line break-words text-[12.5px] leading-6 text-foreground/90" dir="auto">
                      {m.content}
                    </p>
                  </div>
                  <p className="mt-0.5 px-1 text-[9.5px] text-muted-foreground/80 tnum">{faTime(m.createdAt)}</p>
                </div>
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

/** ردیف متادیتای لید — تعداد پیام + اولین تماس + آخرین تماس */
export function LeadMetaRow({
  messageCount,
  firstMessageAt,
  lastMessageAt,
}: {
  messageCount: number;
  firstMessageAt: string;
  lastMessageAt: string;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {[
        { label: "پیام ردوبدل‌شده", value: faNum(String(messageCount)), icon: MessagesSquare },
        { label: "اولین تماس", value: faRelative(firstMessageAt), icon: Sparkles },
        { label: "آخرین تماس", value: faRelative(lastMessageAt), icon: PhoneOutgoing },
      ].map((s) => (
        <div key={s.label} className="flex flex-col items-center gap-1 rounded-2xl border border-border/60 bg-muted/30 p-2.5 text-center">
          <s.icon className="size-4 text-primary/70" />
          <p className="text-[13px] font-black leading-5 tnum">{s.value}</p>
          <p className="text-[9.5px] leading-4 text-muted-foreground">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
