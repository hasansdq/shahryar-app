// ═════ اقتصاد توکن — نمای کلی: کارت‌ها، روند ۱۴روز، تفکیک ویژگی، مصرف‌کنندگان برتر ═════
"use client";

import { motion } from "framer-motion";
import {
  Coins, Users, TrendingDown, Banknote, ShoppingCart, RotateCcw,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { faNum, faDateShort } from "@/lib/client/persian";
import { SECTION_LABELS, type AdminTokenStats } from "@/lib/modules/tokens/types";

const FEATURE_LABELS: Record<string, string> = {
  chat: "گفتگو", deep_think: "تفکر عمیق", web_search: "جستجوی وب", image_gen: "تولید تصویر",
  finance_advisor: "مشاور مالی", goal_ai: "اهداف", forum_agent: "ایجنت انجمن",
  social_agent: "ایجنت شخصی", document_read: "خواندن اسناد", file_gen: "ساخت فایل",
};

const PIE_COLORS = ["#d97706", "#0891b2", "#7c3aed", "#e11d48", "#0e8a5a", "#db2777", "#2563eb", "#ca8a04", "#0d9488", "#9333ea"];

const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  paid: { label: "پرداخت شده", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  pending: { label: "در انتظار", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  failed: { label: "ناموفق", cls: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
  canceled: { label: "لغو شده", cls: "bg-slate-500/15 text-slate-500" },
};

function StatCard({
  icon: Icon, label, value, sub, tone, delay,
}: {
  icon: typeof Coins; label: string; value: string; sub?: string;
  tone: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-3xl border border-border/60 bg-card p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between">
        <span className={`grid size-10 place-items-center rounded-2xl ${tone}`}>
          <Icon className="size-5" />
        </span>
      </div>
      <p className="text-2xl font-black mt-3 tabular-nums">{value}</p>
      <p className="text-xs font-bold text-muted-foreground mt-1">{label}</p>
      {sub && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{sub}</p>}
    </motion.div>
  );
}

const SECTION_COLORS: Record<string, string> = {
  hoshyar: "#d97706",
  social: "#7c3aed",
  forums: "#0891b2",
  goals: "#0e8a5a",
  finance: "#e11d48",
};

export default function OverviewSection({ stats }: { stats: AdminTokenStats }) {
  const chartData = stats.dailySeries.map((d) => ({
    ...d,
    label: faDateShort(d.date),
  }));
  const pieData = stats.featureBreakdown
    .slice(0, 10)
    .map((f) => ({ name: FEATURE_LABELS[f.feature] ?? f.feature, value: f.tokens }));
  const totalSectionTokens = stats.sectionBreakdown.reduce((s, x) => s + x.tokens, 0) || 1;

  return (
    <div className="space-y-5">
      {/* ─── کارت‌های آماری ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard icon={Users} label="کیف پول‌های فعال" value={faNum(stats.walletsCount)} tone="bg-sky-500/10 text-sky-600 dark:text-sky-400" delay={0} />
        <StatCard icon={Coins} label="توکن در گردش" value={faNum(stats.circulatingBalance)} sub="مجموع موجودی کاربران" tone="bg-amber-500/10 text-amber-600 dark:text-amber-400" delay={0.05} />
        <StatCard icon={TrendingDown} label="مصرف امروز" value={faNum(stats.spentToday)} sub={`۷روز: ${faNum(stats.spent7d)}`} tone="bg-rose-500/10 text-rose-600 dark:text-rose-400" delay={0.1} />
        <StatCard icon={Banknote} label="درآمد کل" value={`${faNum(stats.revenueToman)}`} sub="تومان — خریدهای تأییدشده" tone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" delay={0.15} />
        <StatCard icon={ShoppingCart} label="خرید موفق" value={faNum(stats.paidOrders)} sub={`ناتمام: ${faNum(stats.pendingOrders + stats.failedOrders)}`} tone="bg-violet-500/10 text-violet-600 dark:text-violet-400" delay={0.2} />
        <StatCard icon={RotateCcw} label="مصرف ۳۰روز" value={faNum(stats.spent30d)} sub={`کل: ${faNum(stats.lifetimeSpent)}`} tone="bg-teal-500/10 text-teal-600 dark:text-teal-400" delay={0.25} />
      </div>

      {/* ─── نمودار روند ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 rounded-3xl border border-border/60 bg-card p-5">
          <h3 className="font-black text-sm mb-4">روند مصرف و خرید توکن — ۱۴ روز اخیر</h3>
          <div style={{ direction: "ltr" }} className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gSpent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.03} />
                  </linearGradient>
                  <linearGradient id="gPurchased" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} width={44} />
                <Tooltip
                  contentStyle={{ direction: "rtl", borderRadius: 14, fontSize: 12, border: "1px solid rgba(0,0,0,.08)" }}
                  formatter={(v: number, name: string) => [faNum(v), name === "spent" ? "مصرف" : name === "purchased" ? "خرید" : "درآمد (تومان)"]}
                />
                <Area type="monotone" dataKey="spent" stroke="#f59e0b" strokeWidth={2} fill="url(#gSpent)" name="spent" />
                <Area type="monotone" dataKey="purchased" stroke="#10b981" strokeWidth={2} fill="url(#gPurchased)" name="purchased" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* تفکیک ویژگی */}
        <div className="rounded-3xl border border-border/60 bg-card p-5">
          <h3 className="font-black text-sm mb-2">تفکیک مصرف بر اساس ویژگی</h3>
          {pieData.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-16">هنوز مصرفی ثبت نشده است</p>
          ) : (
            <div style={{ direction: "ltr" }} className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={72} paddingAngle={3}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ direction: "rtl", borderRadius: 14, fontSize: 12 }}
                    formatter={(v: number) => [`${faNum(v)} توکن`, "مصرف"]}
                  />
                  <Legend wrapperStyle={{ direction: "rtl", fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ─── تفکیک بخش‌های شهریار + مصرف‌کنندگان برتر ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-3xl border border-border/60 bg-card p-5">
          <h3 className="font-black text-sm mb-3">مصرف به تفکیک بخش‌های شهریار — ۳۰ روز</h3>
          {stats.sectionBreakdown.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">هنوز مصرفی ثبت نشده است</p>
          ) : (
            <ul className="space-y-3">
              {stats.sectionBreakdown.map((x) => {
                const pct = Math.round((x.tokens / totalSectionTokens) * 100);
                return (
                  <li key={x.section}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-bold">{SECTION_LABELS[x.section] ?? x.section}</span>
                      <span className="text-xs font-black tabular-nums">
                        {faNum(x.tokens)} <span className="text-muted-foreground font-normal">({faNum(x.count)} فراخوانی · {faNum(pct)}٪)</span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-border/50 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.max(3, pct)}%`, backgroundColor: SECTION_COLORS[x.section] ?? "#94a3b8" }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-3xl border border-border/60 bg-card p-5">
          <h3 className="font-black text-sm mb-3">بیشترین مصرف‌کنندگان</h3>
          {stats.topConsumers.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">داده‌ای نیست</p>
          ) : (
            <ul className="space-y-2">
              {stats.topConsumers.map((u, i) => (
                <li key={u.userId} className="flex items-center gap-3 rounded-2xl bg-accent/40 px-3 py-2.5">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-black">
                    {faNum(i + 1)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{u.fullName || "بی‌نام"}</p>
                    <p className="text-[11px] text-muted-foreground" dir="ltr">{u.phone}</p>
                  </div>
                  <div className="text-end shrink-0">
                    <p className="text-sm font-black text-rose-600 dark:text-rose-400 tabular-nums">{faNum(u.spent)}</p>
                    <p className="text-[10px] text-muted-foreground">موجودی: {faNum(u.balance)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ─── سفارش‌های اخیر ─── */}
      <div className="rounded-3xl border border-border/60 bg-card p-5">
        <h3 className="font-black text-sm mb-3">آخرین سفارش‌های پرداخت</h3>
          {stats.recentOrders.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">سفارشی ثبت نشده است</p>
          ) : (
            <ul className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {stats.recentOrders.map((o) => {
                const st = ORDER_STATUS[o.status] ?? { label: o.status, cls: "bg-slate-500/15 text-slate-500" };
                return (
                  <li key={o.id} className="flex items-center gap-3 rounded-2xl bg-accent/40 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{o.user}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {o.packageTitle} — {faNum(o.tokens)} توکن — {faNum(o.priceToman)} تومان
                        {o.refId && <span dir="ltr" className="ms-1">· رهگیری {o.refId}</span>}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${st.cls}`}>{st.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
      </div>
    </div>
  );
}
