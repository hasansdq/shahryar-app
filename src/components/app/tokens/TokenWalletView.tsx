// ═════ کیف پول توکن شهریار — موجودی، شارژ دلخواه، مدیریت و تحلیل مصرف دقیق ═════
// مدل v2: موجودی = توکن واقعی هوش مصنوعی (مثل اعتبار API)؛
// مصرف هر فراخوانی دقیقاً محاسبه و ثبت می‌شود (ورودی + خروجی).
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Coins, Gift, TrendingDown, TrendingUp, CreditCard, History, ChevronLeft,
  ChevronRight, Info, Zap, BarChart3, Wallet, RefreshCw, Sparkles, Check, X, Gauge,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { get, post } from "@/lib/client/api";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { faNum, faDateShort, faDateTime, enNum } from "@/lib/client/persian";
import {
  chargePriceToman,
  TX_TYPE_LABELS, FEATURE_LABELS, SECTION_LABELS,
  type WalletSummaryDto, type TokenUsageDto, type UsageAnalyticsDto,
} from "@/lib/modules/tokens/types";

const fa = (n: number) => n.toLocaleString("fa-IR");
const faCompact = (n: number) =>
  new Intl.NumberFormat("fa-IR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
const toman = (n: number) => `${fa(n)} تومان`;

/** رنگ‌های ثابت بخش‌ها (نمودار دونات + نشان‌ها) */
const SECTION_COLORS: Record<string, string> = {
  hoshyar: "#d97706",
  social: "#7c3aed",
  forums: "#0891b2",
  goals: "#0e8a5a",
  finance: "#e11d48",
};

const QUICK_AMOUNTS = [100_000, 500_000, 1_000_000, 5_000_000];

interface UsageResponse {
  records: TokenUsageDto[];
  total: number;
  page: number;
  pageCount: number;
  analytics: UsageAnalyticsDto;
}

export default function TokenWalletView() {
  const [summary, setSummary] = useState<WalletSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  // ─── شارژ دلخواه ───
  const [chargeInput, setChargeInput] = useState("");
  const [buying, setBuying] = useState(false);

  // ─── کاوشگر مصرف ───
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usagePage, setUsagePage] = useState(1);

  const load = useCallback(async () => {
    const w = await get<WalletSummaryDto>("/api/tokens/wallet");
    if (w.success && w.data) setSummary(w.data);
    setLoading(false);
  }, []);

  const loadUsage = useCallback(async (r: number, p: number) => {
    setUsageLoading(true);
    const res = await get<UsageResponse>(`/api/tokens/usage?range=${r}&page=${p}`);
    if (res.success && res.data) setUsage(res.data);
    setUsageLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => loadUsage(range, usagePage), 0);
    return () => clearTimeout(t);
  }, [loadUsage, range, usagePage]);

  const claimBonus = async () => {
    setClaiming(true);
    const res = await post<{ granted: number; balance: number }>("/api/tokens/daily-bonus");
    if (res.success && res.data) {
      toast({ title: "پاداش روزانه دریافت شد 🎁", description: `${fa(res.data.granted)} توکن به کیف شما اضافه شد` });
      await load();
      await loadUsage(range, 1);
    } else {
      toast({ title: "خطا", description: res.error || "دریافت پاداش ممکن نشد", variant: "destructive" });
    }
    setClaiming(false);
  };

  // ─── محاسبه شارژ دلخواه ───
  const chargeTokens = useMemo(() => {
    const digits = enNum(chargeInput).replace(/[^\d]/g, "");
    const n = parseInt(digits || "0", 10);
    return Number.isFinite(n) ? n : 0;
  }, [chargeInput]);

  const price = summary ? chargePriceToman(chargeTokens, summary.pricing.pricePerMillion) : 0;
  const chargeError = useMemo(() => {
    if (!summary || chargeTokens <= 0) return null;
    if (chargeTokens < summary.pricing.minChargeTokens)
      return `حداقل مقدار شارژ ${fa(summary.pricing.minChargeTokens)} توکن است`;
    if (chargeTokens > summary.pricing.maxChargeTokens)
      return `حداکثر مقدار شارژ ${fa(summary.pricing.maxChargeTokens)} توکن است`;
    if (price < 1000) return "مبلغ محاسبه‌شده کمتر از حد مجاز درگاه است";
    return null;
  }, [summary, chargeTokens, price]);

  const buy = async () => {
    if (chargeTokens <= 0 || chargeError) return;
    setBuying(true);
    const res = await post<{ orderId: string; redirectUrl: string }>("/api/tokens/purchase", { tokens: chargeTokens });
    if (res.success && res.data?.redirectUrl) {
      window.location.assign(res.data.redirectUrl);
      return;
    }
    toast({ title: "خطای درگاه پرداخت", description: res.error || "شروع پرداخت ممکن نشد", variant: "destructive" });
    setBuying(false);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 lg:px-6 pt-2 lg:pt-0">
        <div className="animate-pulse space-y-4">
          <div className="h-44 rounded-3xl bg-accent/40" />
          <div className="h-40 rounded-3xl bg-accent/30" />
          <div className="h-80 rounded-3xl bg-accent/20" />
        </div>
      </div>
    );
  }

  const s = summary;
  const analytics = usage?.analytics;
  const balanceTomanValue = s ? Math.floor((s.balance * s.pricing.pricePerMillion) / 1_000_000) : 0;
  const records = usage?.records ?? [];
  const usagePageCount = usage?.pageCount ?? 1;

  return (
    <div className="max-w-4xl mx-auto px-4 lg:px-6 pt-2 lg:pt-0 pb-10">
      {/* ─── سرتیتر ─── */}
      <div className="flex items-center gap-3 mb-4">
        <span className="grid size-11 place-items-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Coins className="size-6" />
        </span>
        <div>
          <h1 className="text-xl font-black">توکن‌های شهریار</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            اعتبار هوش مصنوعی شما — مصرف دقیق مثل API، در همه‌ی بخش‌های شهریار
          </p>
        </div>
      </div>

      {/* ─── کارت موجودی (هیرو) ─── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl p-6 lg:p-8 text-white shadow-xl"
        style={{ background: "linear-gradient(135deg, #b45309 0%, #d97706 45%, #f59e0b 100%)" }}
      >
        <div aria-hidden className="absolute -top-20 -start-16 size-56 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden className="absolute -bottom-24 -end-10 size-64 rounded-full bg-black/10 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-amber-50/90 text-sm font-bold">موجودی کیف توکن هوش مصنوعی</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-4xl lg:text-5xl font-black tracking-tight drop-shadow-sm">{s ? fa(s.balance) : "۰"}</span>
              <span className="text-amber-50/80 font-bold">توکن</span>
            </div>
            <p className="text-xs text-amber-50/75 mt-1.5">
              ≈ {toman(balanceTomanValue)} اعتبار مصرف — هر ۱ میلیون توکن {toman(s?.pricing.pricePerMillion ?? 0)}
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs font-bold">
                <TrendingUp className="size-3.5" /> {fa(s?.lifetimePurchased ?? 0)} خریداری‌شده
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs font-bold">
                <Gift className="size-3.5" /> {fa(s?.lifetimeGranted ?? 0)} هدیه‌شده
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs font-bold">
                <TrendingDown className="size-3.5" /> {fa(s?.lifetimeSpent ?? 0)} مصرف‌شده
              </span>
            </div>
          </div>

          {/* مصرف اخیر */}
          <div className="rounded-2xl bg-white/12 backdrop-blur px-4 py-3 min-w-44">
            <p className="text-xs font-bold text-amber-50/90 flex items-center gap-1.5">
              <Gauge className="size-3.5" /> مصرف توکن
            </p>
            <div className="mt-2 space-y-1.5 text-sm font-black">
              <p className="flex items-center justify-between gap-4">
                <span className="text-amber-50/70 text-xs font-bold">امروز</span> {fa(s?.spentToday ?? 0)}
              </p>
              <p className="flex items-center justify-between gap-4">
                <span className="text-amber-50/70 text-xs font-bold">۷ روز</span> {fa(s?.spent7d ?? 0)}
              </p>
              <p className="flex items-center justify-between gap-4">
                <span className="text-amber-50/70 text-xs font-bold">۳۰ روز</span> {fa(s?.spent30d ?? 0)}
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ─── پاداش روزانه ─── */}
      {s?.dailyBonusAvailable && (
        <motion.button
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={claimBonus}
          disabled={claiming}
          className="mt-4 w-full flex items-center gap-4 rounded-3xl border border-amber-300/60 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-500/10 p-4 text-start transition-all hover:shadow-md disabled:opacity-60 group"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-amber-400/20 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
            <Gift className="size-6" />
          </span>
          <span className="flex-1">
            <span className="block font-black text-amber-900 dark:text-amber-200">پاداش روزانه‌ی امروز آماده است!</span>
            <span className="block text-sm text-amber-800/70 dark:text-amber-300/70 mt-0.5">
              {fa(s.dailyBonusAmount)} توکن رایگان — هر روز یک‌بار
            </span>
          </span>
          <span className="shrink-0 rounded-2xl shahryar-gradient px-4 py-2 text-sm font-black text-white">
            {claiming ? "..." : "دریافت"}
          </span>
        </motion.button>
      )}

      {/* ═══ شارژ دلخواه ═══ */}
      <section className="mt-6 rounded-3xl border border-border/60 bg-card p-5 lg:p-6">
        <h2 className="font-black text-lg flex items-center gap-2">
          <Wallet className="size-5 text-amber-600 dark:text-amber-400" />
          شارژ کیف توکن
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          مقدار توکن دلخواه خود را وارد کنید — قیمت به‌صورت پویا از «مبلغ هر ۱ میلیون توکن» محاسبه می‌شود
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-stretch gap-2">
            <div className="relative flex-1">
              <input
                value={chargeInput}
                onChange={(e) => {
                  const digits = enNum(e.target.value).replace(/[^\d]/g, "").slice(0, 12);
                  setChargeInput(digits ? Number(digits).toLocaleString("en-US") : "");
                }}
                inputMode="numeric"
                placeholder="مثلاً 1,000,000"
                dir="ltr"
                className="w-full h-13 rounded-2xl border-2 border-border/70 bg-background px-4 ps-4 pe-16 text-lg font-black tracking-wide outline-none transition-colors focus:border-amber-500/70 tabular-nums"
              />
              <span className="absolute end-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">توکن</span>
            </div>
          </div>

          {/* مقادیر سریع */}
          <div className="flex flex-wrap gap-2">
            {QUICK_AMOUNTS.map((amount) => (
              <button
                key={amount}
                onClick={() => setChargeInput(amount.toLocaleString("en-US"))}
                className={cn(
                  "rounded-2xl border px-3.5 py-2 text-xs font-black transition-all",
                  chargeTokens === amount
                    ? "border-amber-500/70 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "border-border/60 bg-accent/40 text-muted-foreground hover:border-amber-500/40 hover:text-foreground"
                )}
              >
                {amount >= 1_000_000 ? `${fa(amount / 1_000_000)} میلیون` : `${fa(amount / 1000)} هزار`} توکن
              </button>
            ))}
          </div>

          {/* قیمت پویا */}
          {chargeTokens > 0 && (
            <div className={cn(
              "rounded-2xl border p-4 space-y-2",
              chargeError
                ? "border-rose-500/30 bg-rose-500/5"
                : "border-emerald-500/30 bg-emerald-500/5"
            )}>
              {chargeError ? (
                <p className="text-sm font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <X className="size-4 shrink-0" /> {chargeError}
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold text-muted-foreground">مبلغ قابل پرداخت</span>
                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{toman(price)}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    {fa(chargeTokens)} توکن × نرخ {toman(s?.pricing.pricePerMillion ?? 0)} به ازای هر ۱ میلیون توکن
                  </p>
                </>
              )}
            </div>
          )}

          <Button
            onClick={buy}
            disabled={buying || chargeTokens <= 0 || !!chargeError}
            className="w-full h-12 text-base font-black shahryar-gradient text-white hover:opacity-95"
          >
            {buying ? "در حال اتصال به درگاه..." : (
              <span className="inline-flex items-center gap-2">
                <CreditCard className="size-5" /> پرداخت و شارژ — زرین‌پال
              </span>
            )}
          </Button>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Info className="size-3.5 shrink-0" />
            پرداخت امن از درگاه زرین‌پال؛ توکن‌ها بلافاصله پس از پرداخت موفق به کیف شما اضافه می‌شوند و هرگز منقضی نمی‌شوند.
          </p>
        </div>
      </section>

      {/* ═══ مدیریت و تحلیل مصرف ═══ */}
      <section className="mt-6 rounded-3xl border border-border/60 bg-card p-5 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-black text-lg flex items-center gap-2">
            <BarChart3 className="size-5 text-amber-600 dark:text-amber-400" />
            مدیریت و تحلیل مصرف
          </h2>
          <div className="flex items-center gap-1 rounded-2xl border border-border/60 bg-accent/30 p-1">
            {([7, 30, 90] as const).map((r) => (
              <button
                key={r}
                onClick={() => { setRange(r); setUsagePage(1); }}
                className={cn(
                  "rounded-xl px-3.5 py-1.5 text-xs font-black transition-all",
                  range === r ? "shahryar-gradient text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {fa(r)} روز
              </button>
            ))}
          </div>
        </div>

        {usageLoading && !usage ? (
          <div className="mt-4 space-y-4">
            <div className="h-24 rounded-2xl bg-accent/30 animate-pulse" />
            <div className="h-56 rounded-2xl bg-accent/20 animate-pulse" />
          </div>
        ) : !analytics || analytics.totalCount === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-border/70 p-10 text-center">
            <Sparkles className="size-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm font-bold text-muted-foreground mt-3">
              در {fa(range)} روز اخیر مصرفی ثبت نشده است
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              با گفتگو با هوشیار یا ایجنت‌ها، مصرف دقیق شما همین‌جا نمودار می‌شود
            </p>
          </div>
        ) : (
          <UsageDashboard analytics={analytics} range={range} />
        )}

        {/* ─── رکوردهای ریز مصرف ─── */}
        <div className="mt-6">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="font-black text-sm flex items-center gap-2">
              <History className="size-4 text-amber-600 dark:text-amber-400" />
              ریز مصرف ({fa(usage?.total ?? 0)} فراخوانی)
            </h3>
            <Button
              variant="ghost" size="sm"
              onClick={() => loadUsage(range, usagePage)}
              disabled={usageLoading}
              className="text-muted-foreground"
            >
              <RefreshCw className={cn("size-4", usageLoading && "animate-spin")} />
            </Button>
          </div>

          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">رکوردی در این بازه نیست</p>
          ) : (
            <ul className="space-y-2">
              {records.map((r) => {
                const secColor = SECTION_COLORS[r.section] ?? "#94a3b8";
                return (
                  <li key={r.id} className="rounded-2xl border border-border/50 bg-accent/20 px-3.5 py-3">
                    <div className="flex items-start gap-3">
                      <span
                        className="mt-1 grid size-9 shrink-0 place-items-center rounded-xl text-white"
                        style={{ backgroundColor: secColor }}
                      >
                        <Zap className="size-4" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-black">{FEATURE_LABELS[r.feature] ?? r.feature}</span>
                          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                            {SECTION_LABELS[r.section] ?? r.section}
                          </span>
                          {r.estimated && (
                            <span
                              title="سرویس مدل گزارش دقیق نداد — مصرف برآورد شده است"
                              className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400"
                            >
                              برآوردی
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1 truncate">
                          {r.title || "—"} · {faDateTime(r.createdAt)}
                          {r.model ? ` · ${r.model}` : ""}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5" dir="ltr">
                          in {r.inputTokens.toLocaleString("en-US")} + out {r.outputTokens.toLocaleString("en-US")}
                          {r.chargedTokens !== r.totalTokens ? ` · charged ${r.chargedTokens.toLocaleString("en-US")}` : ""}
                        </p>
                      </div>
                      <div className="text-end shrink-0">
                        <p className="font-black text-sm tabular-nums">{fa(r.totalTokens)}</p>
                        <p className="text-[10px] text-muted-foreground">توکن</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {usagePageCount > 1 && (
            <div className="flex items-center justify-center gap-3 mt-3">
              <Button variant="outline" size="icon" className="size-8" disabled={usagePage <= 1} onClick={() => setUsagePage(usagePage - 1)}>
                <ChevronRight className="size-4" />
              </Button>
              <span className="text-xs font-bold text-muted-foreground">صفحه {fa(usagePage)} از {fa(usagePageCount)}</span>
              <Button variant="outline" size="icon" className="size-8" disabled={usagePage >= usagePageCount} onClick={() => setUsagePage(usagePage + 1)}>
                <ChevronLeft className="size-4" />
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* ═══ دفتر تراکنش‌ها ═══ */}
      <LedgerSection transactions={s?.transactions ?? []} />

      {/* راهنمای سیاست‌ها */}
      <div className="mt-4 flex items-start gap-2.5 rounded-3xl bg-sky-500/5 dark:bg-sky-400/5 border border-sky-500/20 p-4 text-xs leading-relaxed text-muted-foreground">
        <Check className="size-4 shrink-0 text-sky-600 dark:text-sky-400 mt-0.5" />
        <p>
          مصرف دقیقاً مثل صورتحساب API محاسبه می‌شود: توکن ورودی (پرامپت) + توکن خروجی (پاسخ) هر فراخوانی.
          پاداش روزانه ({fa(s?.dailyBonusAmount ?? 0)} توکن) هر شبانه‌روز قابل دریافت است و توکن‌های خریداری‌شده هرگز منقضی نمی‌شوند.
        </p>
      </div>
      <div className="mt-2 flex items-start gap-2.5 rounded-3xl bg-rose-500/5 dark:bg-rose-400/5 border border-rose-500/20 p-4 text-xs leading-relaxed text-muted-foreground">
        <X className="size-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
        <p>
          تولید تصویر در هوشیار {fa(s?.pricing.imageGenTokens ?? 0)} توکن به ازای هر تصویر مصرف می‌کند.
          توکن صرفاً اعتبار استفاده از خدمات هوش مصنوعی است و قابل تبدیل به پول نقد یا انتقال به کاربر دیگر نیست.
        </p>
      </div>
    </div>
  );
}

// ═══ داشبورد نموداری مصرف — روند روزانه + تفکیک بخش + تفکیک قابلیت ═══
function UsageDashboard({ analytics, range }: { analytics: UsageAnalyticsDto; range: number }) {
  const chartData = analytics.daily.map((d) => ({ ...d, label: faDateShort(d.date) }));
  const maxDaily = Math.max(...analytics.daily.map((d) => d.tokens), 1);
  const totalBySection = analytics.bySection.reduce((s, x) => s + x.tokens, 0) || 1;
  const totalByFeature = analytics.byFeature.reduce((s, x) => s + x.tokens, 0) || 1;
  const pieData = analytics.bySection.map((x) => ({
    name: SECTION_LABELS[x.section] ?? x.section,
    value: x.tokens,
    color: SECTION_COLORS[x.section] ?? "#94a3b8",
  }));

  return (
    <div className="mt-5 space-y-4">
      {/* آمار کلی بازه */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-2xl bg-amber-500/8 dark:bg-amber-400/10 border border-amber-500/20 px-3 py-3 text-center">
          <p className="text-xl font-black text-amber-600 dark:text-amber-400 tabular-nums">{faCompact(analytics.totalTokens)}</p>
          <p className="text-[10px] font-bold text-muted-foreground mt-1">مجموع مصرف ({fa(range)} روز)</p>
        </div>
        <div className="rounded-2xl bg-cyan-500/8 dark:bg-cyan-400/10 border border-cyan-500/20 px-3 py-3 text-center">
          <p className="text-xl font-black text-cyan-600 dark:text-cyan-400 tabular-nums">{faCompact(analytics.avgDaily)}</p>
          <p className="text-[10px] font-bold text-muted-foreground mt-1">میانگین روزانه فعال</p>
        </div>
        <div className="rounded-2xl bg-violet-500/8 dark:bg-violet-400/10 border border-violet-500/20 px-3 py-3 text-center">
          <p className="text-xl font-black text-violet-600 dark:text-violet-400 tabular-nums">{fa(analytics.totalCount)}</p>
          <p className="text-[10px] font-bold text-muted-foreground mt-1">فراخوانی هوش مصنوعی</p>
        </div>
      </div>

      {/* روند روزانه */}
      <div className="rounded-2xl border border-border/50 bg-accent/20 p-4">
        <h3 className="font-black text-sm mb-3">روند مصرف روزانه</h3>
        <div style={{ direction: "ltr" }} className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gUsage" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9 }}
                interval={range > 30 ? 14 : range > 7 ? 4 : 0}
              />
              <YAxis tick={{ fontSize: 9 }} width={46} tickFormatter={(v: number) => faCompact(v)} />
              <Tooltip
                contentStyle={{ direction: "rtl", borderRadius: 14, fontSize: 12, border: "1px solid rgba(0,0,0,.08)" }}
                formatter={(v: number, _n, item) => [
                  `${fa(v)} توکن`,
                  `فراخوانی: ${fa((item?.payload as { count?: number })?.count ?? 0)}`,
                ]}
                labelFormatter={(l) => String(l)}
              />
              <Area type="monotone" dataKey="tokens" stroke="#f59e0b" strokeWidth={2} fill="url(#gUsage)" name="مصرف" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* تفکیک بخش + ویژگی */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border/50 bg-accent/20 p-4">
          <h3 className="font-black text-sm mb-2">مصرف به تفکیک بخش شهریار</h3>
          <div className="flex items-center gap-3">
            <div style={{ direction: "ltr" }} className="size-36 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={38} outerRadius={62} paddingAngle={3}>
                    {pieData.map((p, i) => (
                      <Cell key={i} fill={p.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ direction: "rtl", borderRadius: 14, fontSize: 12 }}
                    formatter={(v: number) => [`${fa(v)} توکن`, "مصرف"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex-1 min-w-0 space-y-1.5">
              {analytics.bySection.map((x) => {
                const pct = Math.round((x.tokens / totalBySection) * 100);
                return (
                  <li key={x.section} className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: SECTION_COLORS[x.section] ?? "#94a3b8" }} />
                    <span className="text-xs font-bold flex-1 truncate">{SECTION_LABELS[x.section] ?? x.section}</span>
                    <span className="text-[11px] font-black tabular-nums">{faCompact(x.tokens)}</span>
                    <span className="text-[10px] text-muted-foreground w-8 text-end">{fa(pct)}٪</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="rounded-2xl border border-border/50 bg-accent/20 p-4">
          <h3 className="font-black text-sm mb-2">مصرف به تفکیک قابلیت</h3>
          <ul className="space-y-2">
            {analytics.byFeature.slice(0, 6).map((x) => {
              const pct = Math.round((x.tokens / totalByFeature) * 100);
              return (
                <li key={x.feature}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-bold truncate">{FEATURE_LABELS[x.feature] ?? x.feature}</span>
                    <span className="text-[11px] font-black tabular-nums shrink-0">
                      {faCompact(x.tokens)} <span className="text-muted-foreground font-normal">({fa(x.count)}×)</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-border/60 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500/80 transition-all"
                      style={{ width: `${Math.max(3, pct)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* بیشترین روز */}
      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
        <TrendingUp className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
        بیشترین مصرف روزانه در این بازه: {faCompact(maxDaily)} توکن
      </p>
    </div>
  );
}

// ═══ دفتر تراکنش‌ها ═══
function LedgerSection({ transactions }: { transactions: WalletSummaryDto["transactions"] }) {
  const [page, setPage] = useState(0);
  const slice = transactions.slice(page * 8, page * 8 + 8);
  const pageCount = Math.max(1, Math.ceil(transactions.length / 8));

  return (
    <section className="mt-6 rounded-3xl border border-border/60 bg-card p-5">
      <h2 className="font-black flex items-center gap-2 mb-3">
        <History className="size-5 text-amber-600 dark:text-amber-400" />
        دفتر تراکنش‌ها
      </h2>
      {slice.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">هنوز تراکنشی ثبت نشده است</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {slice.map((t) => {
            const positive = t.amount > 0;
            return (
              <li key={t.id} className="flex items-center gap-3 py-3">
                <span className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-xl",
                  positive ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                )}>
                  {positive ? <TrendingUp className="size-4.5" /> : <TrendingDown className="size-4.5" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">
                    {t.note || TX_TYPE_LABELS[t.type] || t.type}
                    {t.feature && !t.note && (
                      <span className="text-muted-foreground font-normal"> — {FEATURE_LABELS[t.feature] ?? t.feature}</span>
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {faDateTime(t.createdAt)}
                  </p>
                </div>
                <div className="text-end shrink-0">
                  <p className={cn("font-black text-sm tabular-nums", positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                    {positive ? "+" : ""}{fa(t.amount)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">موجودی: {fa(t.balanceAfter)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3 mt-3">
          <Button variant="outline" size="icon" className="size-8" disabled={page === 0} onClick={() => setPage(page - 1)}>
            <ChevronRight className="size-4" />
          </Button>
          <span className="text-xs font-bold text-muted-foreground">صفحه {fa(page + 1)} از {fa(pageCount)}</span>
          <Button variant="outline" size="icon" className="size-8" disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)}>
            <ChevronLeft className="size-4" />
          </Button>
        </div>
      )}
    </section>
  );
}
