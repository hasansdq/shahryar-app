// ═══ پنل لیدهای ایجنت شخصی — تب «لیدها» در پروفایل ═══
// CRM حرفه‌ای برای افرادی که ایجنت فعال دارند:
//  • کارت‌های آماری (کل/جدید/تماس‌گرفته/تبدیل‌شده)
//  • فیلتر وضعیت + جستجو
//  • کارت لید: پروفایل + پیش‌نمایش آخرین پیام + وضعیت + بازنشانی
//  • دیالوگ جزئیات: ترنسکریپت کامل + وضعیت + یادداشت
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bot, CheckCircle2, Magnet, MessageSquareText, PhoneOutgoing, Power,
  RotateCcw, Search, Sparkles, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { get } from "@/lib/client/api";
import { faNum, faRelative } from "@/lib/client/persian";
import { useAppStore } from "@/lib/client/store";
import type { LeadsListResult, LeadStatus, LeadSummaryDTO } from "@/lib/modules/leads/service";
import { LeadStatusBadge, LEAD_STATUS_META } from "./lead-ui";
import { PersonAvatar } from "../social-ui";
import LeadDetailDialog from "./LeadDetailDialog";

type FilterKey = "ALL" | LeadStatus;

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "ALL", label: "همه" },
  { key: "NEW", label: "جدید" },
  { key: "CONTACTED", label: "تماس‌گرفته" },
  { key: "CONVERTED", label: "تبدیل‌شده" },
  { key: "ARCHIVED", label: "آرشیو" },
];

export default function AgentLeadsPanel() {
  const { setView } = useAppStore();
  const [data, setData] = useState<LeadsListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [q, setQ] = useState("");
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await get<LeadsListResult>("/api/social/leads");
    if (res.success && res.data) setData(res.data);
    else if (res.error) toast({ title: "خطا", description: res.error, variant: "destructive" });
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- بارگذاری اولیه لیدها در mount (الگوی متعارف پروژه)
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const query = q.trim();
    return data.leads.filter((l) => {
      if (filter !== "ALL" && l.status !== filter) return false;
      if (query && !`${l.user.name} ${l.user.headline || ""}`.includes(query)) return false;
      return true;
    });
  }, [data, filter, q]);

  // ─── اسکلتون ───
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-3xl" />
          ))}
        </div>
        <Skeleton className="h-12 rounded-2xl" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-3xl" />
        ))}
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className="space-y-4">
      {/* ═══ هدر معرفی ═══ */}
      <div className="relative overflow-hidden rounded-3xl border border-violet-200/60 bg-gradient-to-l from-violet-500/10 via-purple-500/5 to-transparent p-4 sm:p-5 dark:border-violet-800/40">
        <div aria-hidden className="absolute -top-12 start-10 size-32 rounded-full bg-violet-500/10 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25">
              <Magnet className="size-6" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black sm:text-base">لیدهای ایجنت شما</h3>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground sm:text-xs">
                هر کسی که با ایجنت شما گفتگو کند، اینجا به‌عنوان لید ثبت می‌شود — پروفایلش را ببینید،
                گفتگوی کاملش را بخوانید و پیگیری را حرفه‌ای مدیریت کنید.
              </p>
            </div>
          </div>
          {data && !data.agentEnabled ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/60 bg-amber-50 px-3 py-1.5 text-[10px] font-bold text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/30 dark:text-amber-300">
              <Power className="size-3.5" />
              ایجنت شما خاموش است — لیدهای قبلی محفوظ‌اند
            </span>
          ) : null}
        </div>
      </div>

      {/* ═══ کارت‌های آماری ═══ */}
      {stats ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { label: "کل لیدها", value: stats.total, icon: Users, cls: "from-sky-500 to-blue-600" },
            { label: "جدید", value: stats.NEW, icon: Sparkles, cls: "from-sky-400 to-cyan-500" },
            { label: "تماس‌گرفته", value: stats.CONTACTED, icon: PhoneOutgoing, cls: "from-amber-500 to-orange-600" },
            { label: "تبدیل‌شده", value: stats.CONVERTED, icon: CheckCircle2, cls: "from-emerald-500 to-green-600" },
          ].map((s) => (
            <div key={s.label} className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-3.5">
              <div aria-hidden className={`absolute -top-6 -end-6 size-16 rounded-full bg-gradient-to-br ${s.cls} opacity-10`} />
              <s.icon className={`size-4.5 rounded-lg bg-gradient-to-br ${s.cls} p-1 text-white`} />
              <p className="mt-2 text-xl font-black leading-7 tnum">{faNum(String(s.value))}</p>
              <p className="text-[10px] font-bold text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* ═══ فیلتر + جستجو ═══ */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="flex flex-1 gap-1 overflow-x-auto rounded-2xl border border-border/60 bg-card/70 p-1 no-scrollbar">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const count = f.key === "ALL" ? stats?.total : stats?.[f.key as LeadStatus];
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`relative flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[11.5px] font-bold transition-colors active:scale-95 ${
                  active ? "text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="leads-filter-pill"
                    className="absolute inset-0 rounded-xl shahryar-gradient shadow-md"
                    transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                  />
                )}
                <span className="relative z-10">{f.label}</span>
                {count !== undefined && count > 0 ? (
                  <span className={`relative z-10 rounded-full px-1.5 py-0.5 text-[9px] font-black tnum ${active ? "bg-white/25 text-white" : "bg-muted text-muted-foreground"}`}>
                    {faNum(String(count))}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="relative sm:w-64">
          <Search className="absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجوی لید…"
            className="h-11 rounded-2xl border-border/70 bg-accent/40 pe-4 ps-10 text-sm focus-visible:border-primary/50 sm:h-10"
          />
        </div>
      </div>

      {/* ═══ فهرست لیدها ═══ */}
      {filtered.length === 0 ? (
        data && data.leads.length === 0 ? (
          // حالت خالی مطلق — هنوز لیدی نیست
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border/60 bg-card p-10 text-center">
            <div className="flex size-16 items-center justify-center rounded-3xl bg-violet-100 text-violet-500 dark:bg-violet-900/40 dark:text-violet-300">
              <Bot className="size-8" />
            </div>
            <p className="font-black">هنوز لیدی برای ایجنت شما ثبت نشده</p>
            <p className="max-w-sm text-xs leading-6 text-muted-foreground">
              هر وقت کسی در شهریار با ایجنت شما گفتگو کند، به‌طور خودکار اینجا ثبت می‌شود؛ پروفایل و کل
              گفتگوی او را می‌بینید و می‌توانید پیگیری کنید. برای جذب لید، پروفایل و دانش ایجنت‌تان را
              کامل نگه دارید.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => setView("profile")} variant="outline" className="rounded-xl font-bold">
                تکمیل پروفایل شهریار
              </Button>
            </div>
          </div>
        ) : (
          // نتیجه فیلتر خالی
          <div className="flex flex-col items-center gap-2.5 rounded-3xl border border-dashed border-border/60 bg-card p-8 text-center">
            <Search className="size-8 text-muted-foreground/40" />
            <p className="text-sm font-bold">لیدی با این فیلتر پیدا نشد</p>
            <p className="text-xs text-muted-foreground">فیلتر یا جستجو را تغییر دهید.</p>
          </div>
        )
      ) : (
        <div className="space-y-2.5">
          {filtered.map((lead, i) => (
            <LeadCard key={lead.id} lead={lead} index={i} onOpen={() => setOpenLeadId(lead.user.userId)} />
          ))}
        </div>
      )}

      {/* ═══ دیالوگ جزئیات لید ═══ */}
      <LeadDetailDialog
        open={!!openLeadId}
        onClose={() => setOpenLeadId(null)}
        scope="user"
        userId={openLeadId}
        onUpdated={load}
        onDeleted={load}
      />
    </div>
  );
}

/** کارت لید — ردیف حرفه‌ای با آواتار، پیش‌نمایش آخرین پیام و وضعیت */
function LeadCard({ lead, index, onOpen }: { lead: LeadSummaryDTO; index: number; onOpen: () => void }) {
  const meta = LEAD_STATUS_META[lead.status];
  const StatusIcon = meta.icon;
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.3) }}
      onClick={onOpen}
      className="group flex w-full items-center gap-3.5 rounded-3xl border border-border/60 bg-card p-3.5 text-right shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md active:scale-[0.99] sm:p-4"
    >
      {/* نشانگر رنگ وضعیت */}
      <span className={`h-12 w-1 shrink-0 rounded-full ${meta.dot} opacity-70`} aria-hidden />
      <div className="relative shrink-0">
        <PersonAvatar
          name={lead.user.name}
          avatarUrl={lead.user.avatarUrl}
          color={lead.user.avatarColor}
          size={48}
          className="ring-2 ring-border/40"
        />
        <span className={`absolute -bottom-0.5 -end-0.5 grid size-5 place-items-center rounded-lg border-2 border-card text-white ${meta.solid}`}>
          <StatusIcon className="size-2.5" />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-black leading-6" dir="auto">
            {lead.user.name}
          </p>
          <span className="shrink-0 text-[10px] text-muted-foreground tnum">{faRelative(lead.lastMessageAt)}</span>
        </div>
        {lead.user.headline ? (
          <p className="truncate text-[11px] font-bold text-primary/80" dir="auto">
            {lead.user.headline}
          </p>
        ) : null}
        <div className="mt-1.5 flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-[11px] leading-5 text-muted-foreground" dir="auto">
            {lead.wasReset ? (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <RotateCcw className="size-3" />
                گفتگو بازنشانی شده
              </span>
            ) : (
              lead.lastMessagePreview || "—"
            )}
          </p>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold text-muted-foreground tnum">
            <MessageSquareText className="size-2.5" />
            {faNum(String(lead.messageCount))} پیام
          </span>
        </div>
      </div>
      <LeadStatusBadge status={lead.status} size="xs" />
    </motion.button>
  );
}
