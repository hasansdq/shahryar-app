// ═════ داشبورد مالی — آمار، نمودارها، امتیاز سلامت و بینش AI ═════
"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpCircle, ArrowDownCircle, Wallet, TrendingUp, TrendingDown,
  Sparkles, RefreshCw, ArrowLeftRight, Target, HandCoins, PieChart as PieIcon,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import { get } from "@/lib/client/api";
import { toast } from "@/hooks/use-toast";
import { toman, tomanShort, monthShortLabel, budgetStatus, healthColor } from "@/lib/client/finance";
import type { FinanceSnapshot } from "@/lib/modules/finance/service";

interface Props {
  onNavigate: (tab: string) => void;
  /** تب‌هایی که مدیریت از CMS غیرفعال کرده — CTAهای مربوطه پنهان می‌شود */
  hiddenTabs?: string[];
}

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

export default function DashboardTab({ onNavigate, hiddenTabs = [] }: Props) {
  const [snap, setSnap] = useState<FinanceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const showBudgets = !hiddenTabs.includes("budgets");
  const showDebts = !hiddenTabs.includes("debts");
  const showAdvisor = !hiddenTabs.includes("advisor");

  const load = useCallback(async () => {
    const res = await get<{ snapshot: FinanceSnapshot }>("/api/finance/summary");
    if (res.success && res.data) {
      setSnap(res.data.snapshot);
    } else if (res.error) {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  if (loading && !snap) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-card animate-pulse border border-border/40" />
        ))}
      </div>
    );
  }

  if (!snap) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        خطا در بارگذاری داده‌های مالی
      </div>
    );
  }

  // حالت خالی — راهنمای شروع
  if (snap.transactionCount === 0 && snap.accounts.length === 0) {
    return (
      <motion.div {...fadeUp} className="max-w-2xl mx-auto">
        <div className="rounded-3xl bg-card border border-border/60 p-8 text-center shadow-sm">
          <div className="w-16 h-16 rounded-3xl shahryar-gradient mx-auto flex items-center justify-center shadow-lg mb-4">
            <Wallet className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-lg md:text-xl font-black mb-2">به امور مالی خوش آمدید! 🌱</h2>
          <p className="text-sm text-muted-foreground leading-7 mb-6">
            برای شروع، یک حساب بسازید (مثلاً «نقدی» یا «بانک») و اولین تراکنش‌هایتان را ثبت کنید.
            با ثبت چند تراکنش، داشبورد، نمودارها و مشاور هوشمند با داده‌های واقعی شما جان می‌گیرند.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={() => onNavigate("accounts")}
              className="shahryar-gradient text-white px-5 py-2.5 rounded-xl font-medium shadow-md hover:shadow-lg transition-all"
            >
              ساخت اولین حساب
            </button>
            <button
              onClick={() => onNavigate("transactions")}
              className="bg-accent px-5 py-2.5 rounded-xl font-medium hover:bg-accent/70 transition-colors"
            >
              ثبت اولین تراکنش
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  const netPositive = snap.current.net >= 0;
  const expenseTrend =
    snap.trend.length >= 2 && snap.trend[snap.trend.length - 2].expense > 0
      ? ((snap.current.expense - snap.trend[snap.trend.length - 2].expense) / snap.trend[snap.trend.length - 2].expense) * 100
      : null;

  const chartData = snap.trend.map((t) => ({
    name: monthShortLabel(t.monthKey),
    درآمد: t.income,
    هزینه: t.expense,
  }));

  const donutData = snap.topCategories.slice(0, 6).map((c) => ({
    name: c.name,
    value: c.total,
    color: c.color,
  }));

  return (
    <div className="space-y-4">
      {/* ─── کارت‌های آماری ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <motion.div {...fadeUp} className="rounded-2xl bg-card border border-border/60 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Wallet className="w-4 h-4" />
            <span className="text-xs font-medium">موجودی کل</span>
          </div>
          <p className="text-xl md:text-2xl font-black tabular-nums">{tomanShort(snap.totalCash)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">تومان · {snap.accounts.length} حساب فعال</p>
        </motion.div>

        <motion.div {...fadeUp} transition={{ delay: 0.05 }} className="rounded-2xl bg-card border border-border/60 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-600 mb-2">
            <ArrowUpCircle className="w-4 h-4" />
            <span className="text-xs font-medium">درآمد {monthShortLabel(snap.monthKey)}</span>
          </div>
          <p className="text-xl md:text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
            {tomanShort(snap.current.income)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">تومان · میانگین ۶م: {tomanShort(snap.avg6.income)}</p>
        </motion.div>

        <motion.div {...fadeUp} transition={{ delay: 0.1 }} className="rounded-2xl bg-card border border-border/60 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-rose-500 mb-2">
            <ArrowDownCircle className="w-4 h-4" />
            <span className="text-xs font-medium">هزینه {monthShortLabel(snap.monthKey)}</span>
          </div>
          <p className="text-xl md:text-2xl font-black text-rose-500 dark:text-rose-400 tabular-nums">
            {tomanShort(snap.current.expense)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            تومان
            {expenseTrend !== null && (
              <span className={expenseTrend > 0 ? " text-rose-500" : " text-emerald-600"}>
                {" "}{expenseTrend > 0 ? "▲" : "▼"} {Math.abs(Math.round(expenseTrend))}٪ نسبت به ماه قبل
              </span>
            )}
          </p>
        </motion.div>

        <motion.div {...fadeUp} transition={{ delay: 0.15 }} className="rounded-2xl bg-card border border-border/60 p-4 shadow-sm">
          <div className={`flex items-center gap-2 mb-2 ${netPositive ? "text-sky-600" : "text-amber-600"}`}>
            {netPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span className="text-xs font-medium">پس‌مانده ماه</span>
          </div>
          <p className={`text-xl md:text-2xl font-black tabular-nums ${netPositive ? "text-sky-600 dark:text-sky-400" : "text-amber-600 dark:text-amber-400"}`}>
            {netPositive ? "+" : "−"}{tomanShort(Math.abs(snap.current.net))}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">تومان · {snap.current.txCount} تراکنش</p>
        </motion.div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* ─── نمودار روند ۶ ماه ─── */}
        <motion.div {...fadeUp} className="lg:col-span-2 rounded-3xl bg-card border border-border/60 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              روند درآمد و هزینه — ۶ ماه اخیر
            </h3>
            <button
              onClick={load}
              disabled={loading}
              className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-accent"
              title="بارگذاری مجدد"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
          <div className="h-64 md:h-72" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.08} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10 }}
                  stroke="currentColor" opacity={0.5} axisLine={false} tickLine={false}
                  tickFormatter={(v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}م` : v >= 1000 ? `${(v / 1000).toFixed(0)}ه` : v)}
                  width={42}
                />
                <Tooltip
                  formatter={(value: number | string, name: string) => [`${toman(Number(value))} تومان`, name]}
                  contentStyle={{
                    borderRadius: 14, border: "1px solid rgba(0,0,0,0.08)", fontSize: 12,
                    backgroundColor: "rgba(255,255,255,0.96)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                  }}
                />
                <Area type="monotone" dataKey="درآمد" stroke="#10b981" strokeWidth={2.5} fill="url(#gIncome)" animationDuration={900} />
                <Area type="monotone" dataKey="هزینه" stroke="#f43f5e" strokeWidth={2.5} fill="url(#gExpense)" animationDuration={900} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* ─── امتیاز سلامت مالی ─── */}
        <motion.div {...fadeUp} transition={{ delay: 0.08 }} className="rounded-3xl bg-card border border-border/60 p-5 shadow-sm flex flex-col">
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            امتیاز سلامت مالی
          </h3>
          <div className="flex items-center justify-center mb-5">
            <div className="relative w-36 h-36">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="10" opacity={0.08} />
                <motion.circle
                  cx="60" cy="60" r="52" fill="none"
                  stroke={healthColor(snap.health.score)}
                  strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 52}
                  initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - snap.health.score / 100) }}
                  transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl md:text-3xl font-black tabular-nums" style={{ color: healthColor(snap.health.score) }}>
                  {snap.health.score}
                </span>
                <span className="text-[10px] text-muted-foreground">از ۱۰۰</span>
              </div>
            </div>
          </div>
          <div className="space-y-2.5">
            {snap.health.components.map((c, i) => (
              <motion.div
                key={c.key}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
              >
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">{c.label}</span>
                  <span className="tabular-nums text-muted-foreground">{c.note}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: healthColor(c.score) }}
                    initial={{ width: 0 }}
                    animate={{ width: `${c.score}%` }}
                    transition={{ delay: 0.35 + i * 0.08, duration: 0.7, ease: "easeOut" }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* ─── دونات دسته‌بندی هزینه ─── */}
        <motion.div {...fadeUp} className="rounded-3xl bg-card border border-border/60 p-5 shadow-sm">
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-primary" />
            هزینه‌های {monthShortLabel(snap.monthKey)} به تفکیک دسته
          </h3>
          {donutData.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-12">هنوز هزینه‌ای ثبت نشده</p>
          ) : (
            <>
              <div className="h-44" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData} dataKey="value" nameKey="name"
                      innerRadius="58%" outerRadius="88%" paddingAngle={3}
                      animationDuration={900}
                    >
                      {donutData.map((d, i) => (
                        <Cell key={i} fill={d.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number | string, name: string) => [`${toman(Number(value))} تومان`, name]}
                      contentStyle={{ borderRadius: 14, fontSize: 12, border: "1px solid rgba(0,0,0,0.08)" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-2">
                {snap.topCategories.slice(0, 5).map((c) => (
                  <div key={c.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="tabular-nums text-muted-foreground">{tomanShort(c.total)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>

        {/* ─── بودجه‌های ماه ─── */}
        {showBudgets && (
        <motion.div {...fadeUp} transition={{ delay: 0.06 }} className="rounded-3xl bg-card border border-border/60 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <PieChart className="w-4 h-4 text-primary" />
              بودجه‌های {monthShortLabel(snap.monthKey)}
            </h3>
            <button onClick={() => onNavigate("budgets")} className="text-[11px] text-primary hover:underline">
              مدیریت
            </button>
          </div>
          {snap.budgets.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-xs text-muted-foreground mb-3">هنوز بودجه‌ای تعریف نکرده‌اید</p>
              <button onClick={() => onNavigate("budgets")} className="text-xs shahryar-gradient text-white px-4 py-2 rounded-xl">
                تعریف بودجه
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {snap.budgets.slice(0, 5).map((b) => {
                const pct = b.amount > 0 ? Math.round((b.spent / b.amount) * 100) : 0;
                const st = budgetStatus(pct);
                return (
                  <div key={b.name}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-medium">{b.name}</span>
                      <span className={`tabular-nums ${st.color}`}>{pct}٪</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full rounded-full shahryar-gradient"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, pct)}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">
                      {toman(b.spent)} از {toman(b.amount)} تومان
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
        )}

        {/* ─── اهداف و قرض‌ها ─── */}
        <motion.div {...fadeUp} transition={{ delay: 0.12 }} className="rounded-3xl bg-card border border-border/60 p-5 shadow-sm space-y-5">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                اهداف پس‌انداز
              </h3>
              <button onClick={() => onNavigate("goals")} className="text-[11px] text-primary hover:underline">مدیریت</button>
            </div>
            {snap.goals.length === 0 ? (
              <p className="text-xs text-muted-foreground">هدفی تعریف نشده — یک هدف کوچک بسازید 🎯</p>
            ) : (
              <div className="space-y-3">
                {snap.goals.slice(0, 3).map((g) => (
                  <div key={g.title}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-medium truncate">{g.title}</span>
                      <span className="tabular-nums text-muted-foreground">{g.progress}٪</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-amber-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${g.progress}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {showDebts && (
          <div className="border-t border-border/60 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <HandCoins className="w-4 h-4 text-primary" />
                قرض‌ها و طلب‌ها
              </h3>
              <button onClick={() => onNavigate("debts")} className="text-[11px] text-primary hover:underline">مدیریت</button>
            </div>
            {snap.debts.openCount === 0 ? (
              <p className="text-xs text-muted-foreground">قرض بازی ندارید — عالی! ✨</p>
            ) : (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span>بدهی من:</span>
                  <span className="tabular-nums text-rose-500 font-bold">{toman(snap.debts.iOwe)}</span>
                </div>
                <div className="flex justify-between">
                  <span>طلب من:</span>
                  <span className="tabular-nums text-emerald-600 font-bold">{toman(snap.debts.owedToMe)}</span>
                </div>
                {snap.debts.nearestDue && (
                  <p className="text-[10px] text-amber-600">نزدیک‌ترین سررسید: {snap.debts.nearestDue}</p>
                )}
              </div>
            )}
          </div>
          )}
        </motion.div>
      </div>

      {/* ─── دعوت به مشاور AI ─── */}
      {showAdvisor && (
      <motion.button
        {...fadeUp}
        onClick={() => onNavigate("advisor")}
        className="w-full rounded-3xl p-5 shahryar-gradient text-white text-right shadow-lg hover:shadow-xl transition-shadow group"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold">تحلیل حرفه‌ای وضعیت مالی با هوش مصنوعی</p>
            <p className="text-xs opacity-90 mt-0.5">
              مشاور هوشیار داده‌های واقعی شما را تحلیل می‌کند و برنامه‌ی اجرایی می‌دهد
            </p>
          </div>
          <ArrowLeftRight className="w-5 h-5 opacity-70 rotate-180 shrink-0" />
        </div>
      </motion.button>
      )}
    </div>
  );
}
