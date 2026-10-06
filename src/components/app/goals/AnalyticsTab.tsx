// ═════ تب آمار و تحلیل اهداف — نمودارها و بینش‌های واقعی ═════
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, CartesianGrid, AreaChart, Area,
} from "recharts";
import {
  TrendingUp, Flame, CheckCircle2, Target, CalendarClock, AlarmClock,
  Lightbulb, Trophy, ChevronLeft, Loader2, Activity,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { get } from "@/lib/client/api";
import { faNum, faDate, PRIORITY_COLORS, LABELS } from "@/lib/client/persian";
import { CATEGORY_META, categoryMeta, DEADLINE_TONE, deadlineInfo, ProgressRing } from "./helpers";

interface GoalStats {
  totals: {
    goalsCount: number; activeCount: number; completedCount: number; archivedCount: number;
    completionRate: number; totalTasks: number; doneTasks: number; inProgressTasks: number;
    avgActiveProgress: number; overdueTasks: number; dueSoonGoals: number; staleGoals: number;
  };
  byCategory: Array<{ category: string; count: number; completed: number; avgProgress: number }>;
  byPriority: Array<{ priority: string; count: number }>;
  completedByMonth: Array<{ monthKey: string; label: string; count: number }>;
  activity: { streak: number; activeDays: number; last30: Array<{ day: string; count: number }>; mostProductiveDay: string | null };
  overdue: Array<{ id: string; title: string; dueDate: string; goalId: string; goalTitle: string; priority: string }>;
  upcoming: Array<{ goalId: string; title: string; deadline: string; daysLeft: number; progress: number; category: string }>;
}

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

export default function AnalyticsTab({ onOpenGoal }: { onOpenGoal: (goalId: string) => void }) {
  const [stats, setStats] = useState<GoalStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await get<{ stats: GoalStats }>("/api/goals/stats");
      if (active && res.success && res.data) setStats(res.data.stats);
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-3xl" />)}
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      </div>
    );
  }

  const t = stats?.totals;
  const empty = !t || (t.goalsCount === 0);

  if (empty) {
    return (
      <motion.div {...fadeUp} className="text-center py-16 bg-card rounded-3xl border-2 border-dashed border-border">
        <div className="w-20 h-20 mx-auto rounded-3xl shahryar-gradient flex items-center justify-center shadow-lg mb-4">
          <Activity className="w-10 h-10 text-white" />
        </div>
        <h3 className="font-black text-lg md:text-xl">هنوز داده‌ای برای تحلیل نیست</h3>
        <p className="text-muted-foreground text-sm mt-2 max-w-sm mx-auto leading-relaxed">
          اول چند هدف بساز و وظایفش را جابجا کن؛ اینجا نمودارهای پیشرفت، زنجیره‌ی فعالیت و بینش‌های هوشمند ظاهر می‌شود.
        </p>
      </motion.div>
    );
  }

  // داده‌ی نمودار دسته‌ها
  const catData = (stats!.byCategory || []).map((c) => ({
    name: categoryMeta(c.category).label,
    value: c.count,
    color: categoryMeta(c.category).color,
  }));

  // داده‌ی فعالیت ۳۰ روزه — فقط روزهای پرکار فشرده برای محور
  const actData = stats!.activity.last30.map((d) => ({
    name: d.day.slice(5).replace("-", "/"),
    count: d.count,
  }));

  const insights: Array<{ icon: typeof Lightbulb; text: string; tone: string }> = [];
  if (t.avgActiveProgress >= 60) insights.push({ icon: TrendingUp, text: `میانگین پیشرفت اهداف فعال ${faNum(t.avgActiveProgress)}٪ است — روند فوق‌العاده‌ای داری!`, tone: "text-emerald-600 dark:text-emerald-400" });
  if (t.staleGoals > 0) insights.push({ icon: CalendarClock, text: `${faNum(t.staleGoals)} هدف بیش از دو هفته به‌روزرسانی نشده؛ یک نگاه به آنها بینداز.`, tone: "text-amber-600 dark:text-amber-400" });
  if (t.overdueTasks > 0) insights.push({ icon: AlarmClock, text: `${faNum(t.overdueTasks)} وظیفه‌ی معوق داری؛ اول آنها را ببند یا موعدشان را به‌روز کن.`, tone: "text-rose-600 dark:text-rose-400" });
  if (stats!.activity.streak >= 3) insights.push({ icon: Flame, text: `زنجیره‌ی ${faNum(stats!.activity.streak)} روزه‌ی فعالیت داری — نشکنش! 🔥`, tone: "text-orange-600 dark:text-orange-400" });
  if (t.dueSoonGoals > 0) insights.push({ icon: CalendarClock, text: `${faNum(t.dueSoonGoals)} هدف تا ۷ روز آینده مهلت دارد؛ اولویت‌ها را مرتب کن.`, tone: "text-amber-600 dark:text-amber-400" });
  if (stats!.activity.mostProductiveDay) insights.push({ icon: Lightbulb, text: `پرکارترین روزت «${stats!.activity.mostProductiveDay}» است — کارهای سنگین را آن روز بگذار.`, tone: "text-primary" });
  if (insights.length === 0) insights.push({ icon: Lightbulb, text: "همه‌چیز منظم است؛ همین‌طور ادامه بده و هر روز یک قدم بردار.", tone: "text-primary" });

  return (
    <div className="space-y-4" dir="rtl">
      {/* ─── کارت‌های شاخص ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
        <motion.div {...fadeUp} className="bg-card rounded-3xl border border-border/60 p-3.5 sm:p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-1 shahryar-gradient" />
          <div className="flex items-center gap-3">
            <ProgressRing value={t.completionRate} size={54} stroke={5}>
              <span className="text-xs font-black tnum">{faNum(t.completionRate)}٪</span>
            </ProgressRing>
            <div>
              <p className="text-xs text-muted-foreground">نرخ تکمیل</p>
              <p className="text-sm font-bold mt-0.5">{faNum(t.completedCount)} از {faNum(t.activeCount + t.completedCount)}</p>
            </div>
          </div>
        </motion.div>

        <motion.div {...fadeUp} transition={{ delay: 0.05 }} className="bg-card rounded-3xl border border-border/60 p-4">
          <Target className="w-5 h-5 text-primary mb-2" />
          <p className="text-xl md:text-2xl font-black tnum">{faNum(t.activeCount)}</p>
          <p className="text-xs text-muted-foreground mt-1">هدف فعال</p>
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">میانگین پیشرفت {faNum(t.avgActiveProgress)}٪</p>
        </motion.div>

        <motion.div {...fadeUp} transition={{ delay: 0.1 }} className="bg-card rounded-3xl border border-border/60 p-4">
          <CheckCircle2 className="w-5 h-5 text-blue-500 mb-2" />
          <p className="text-xl md:text-2xl font-black tnum">{faNum(t.doneTasks)}</p>
          <p className="text-xs text-muted-foreground mt-1">وظیفه‌ی انجام‌شده</p>
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">
            {t.totalTasks > 0 ? `${faNum(Math.round((t.doneTasks / t.totalTasks) * 100))}٪ از کل ${faNum(t.totalTasks)} وظیفه` : "—"}
          </p>
        </motion.div>

        <motion.div {...fadeUp} transition={{ delay: 0.15 }} className="bg-card rounded-3xl border border-border/60 p-4 relative overflow-hidden">
          <div className="absolute -left-8 -bottom-8 w-24 h-24 rounded-full bg-orange-500/10 blur-xl" />
          <Flame className="w-5 h-5 text-orange-500 mb-2" />
          <p className="text-xl md:text-2xl font-black tnum">{faNum(stats!.activity.streak)}</p>
          <p className="text-xs text-muted-foreground mt-1">روز زنجیره‌ی فعالیت</p>
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">{faNum(stats!.activity.activeDays)} روز فعال در ماه اخیر</p>
        </motion.div>
      </div>

      {/* ─── نمودارها ─── */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* تکمیل ماهانه */}
        <motion.div {...fadeUp} className="bg-card rounded-3xl border border-border/60 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="font-black text-sm flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" />
              اهداف تکمیل‌شده در ۶ ماه اخیر
            </h3>
          </div>
          <div className="h-40 sm:h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats!.completedByMonth} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.08} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  stroke="currentColor" opacity={0.5} axisLine={false} tickLine={false}
                  tickFormatter={(v: string) => v.split(" ")[0]}
                />
                <YAxis allowDecimals={false} width={24} tick={{ fontSize: 10 }} stroke="currentColor" opacity={0.5} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => [faNum(v) + " هدف", ""]}
                  labelFormatter={(l: string) => l}
                  contentStyle={{ direction: "rtl", borderRadius: 14, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={42}>
                  {stats!.completedByMonth.map((m, i) => (
                    <Cell key={i} fill={m.count > 0 ? "#2563eb" : "hsl(var(--muted))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* توزیع دسته‌ها */}
        <motion.div {...fadeUp} transition={{ delay: 0.05 }} className="bg-card rounded-3xl border border-border/60 p-4 sm:p-5">
          <h3 className="font-black text-sm flex items-center gap-2 mb-3 sm:mb-4">
            <Target className="w-4 h-4 text-primary" />
            اهداف بر اساس دسته‌بندی
          </h3>
          {catData.length > 0 ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <div className="h-36 sm:h-44 w-full sm:flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={catData} dataKey="value" nameKey="name"
                      cx="50%" cy="50%" innerRadius={40} outerRadius={58} paddingAngle={3}
                      animationDuration={800}
                    >
                      {catData.map((c, i) => <Cell key={i} fill={c.color} />)}
                    </Pie>
                    <Tooltip
                      formatter={(v: number, n: string) => [faNum(v) + " هدف", n]}
                      contentStyle={{ direction: "rtl", borderRadius: 14, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 sm:block gap-x-3 gap-y-1.5 sm:space-y-2 sm:w-36 shrink-0">
                {catData.slice(0, 6).map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                    <span className="text-xs flex-1 truncate">{c.name}</span>
                    <span className="text-xs font-bold tnum">{faNum(c.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">داده‌ای نیست</p>
          )}
        </motion.div>
      </div>

      {/* ─── فعالیت ۳۰ روزه ─── */}
      <motion.div {...fadeUp} className="bg-card rounded-3xl border border-border/60 p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h3 className="font-black text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            فعالیت ۳۰ روز گذشته
          </h3>
          {stats!.activity.streak > 0 && (
            <Badge className="gap-1 bg-orange-500/10 text-orange-600 dark:text-orange-400 border-0">
              <Flame className="w-3 h-3" />
              {faNum(stats!.activity.streak)} روز زنجیره
            </Badge>
          )}
        </div>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={actData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="gAct" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.08} vertical={false} />
              <XAxis
                dataKey="name" tick={{ fontSize: 9 }} interval={4}
                stroke="currentColor" opacity={0.5} axisLine={false} tickLine={false}
                reversed
              />
              <YAxis allowDecimals={false} width={24} tick={{ fontSize: 10 }} stroke="currentColor" opacity={0.5} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number) => [faNum(v) + " اقدام", ""]}
                contentStyle={{ direction: "rtl", borderRadius: 14, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }}
              />
              <Area type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} fill="url(#gAct)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* ─── وظایف معوق + مهلت‌های نزدیک ─── */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* معوق */}
        <motion.div {...fadeUp} className="bg-card rounded-3xl border border-border/60 p-4 sm:p-5">
          <h3 className="font-black text-sm flex items-center gap-2 mb-3">
            <AlarmClock className="w-4 h-4 text-rose-500" />
            وظایف معوق
            {stats!.overdue.length > 0 && (
              <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-0 text-[10px]">
                {faNum(stats!.overdue.length)}
              </Badge>
            )}
          </h3>
          {stats!.overdue.length > 0 ? (
            <div className="space-y-2">
              {stats!.overdue.slice(0, 6).map((o) => (
                <button
                  key={o.id}
                  onClick={() => onOpenGoal(o.goalId)}
                  className="w-full flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-3 text-right hover:border-rose-500/40 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{o.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {o.goalTitle} • موعد: {faDate(o.dueDate)}
                    </p>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md shrink-0 ${PRIORITY_COLORS[o.priority]}`}>
                    {LABELS.priorities[o.priority]}
                  </span>
                  <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">معوقی نداری — عالی! ✅</p>
          )}
        </motion.div>

        {/* مهلت‌های نزدیک */}
        <motion.div {...fadeUp} transition={{ delay: 0.05 }} className="bg-card rounded-3xl border border-border/60 p-4 sm:p-5">
          <h3 className="font-black text-sm flex items-center gap-2 mb-3">
            <CalendarClock className="w-4 h-4 text-amber-500" />
            مهلت‌های نزدیک (۱۴ روز)
          </h3>
          {stats!.upcoming.length > 0 ? (
            <div className="space-y-2">
              {stats!.upcoming.map((u) => {
                const dl = deadlineInfo(u.deadline, false);
                const cm = categoryMeta(u.category);
                return (
                  <button
                    key={u.goalId}
                    onClick={() => onOpenGoal(u.goalId)}
                    className="w-full flex items-center gap-3 rounded-xl border border-border/50 p-3 text-right hover:border-primary/40 transition-colors group"
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cm.tint}`}>
                      <cm.icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.title}</p>
                      <div className="h-1.5 rounded-full bg-muted mt-1.5 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${u.progress}%`, background: cm.color }} />
                      </div>
                    </div>
                    {dl && (
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${DEADLINE_TONE[dl.tone]}`}>
                        {dl.label}
                      </Badge>
                    )}
                    <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">مهلت نزدیکی وجود ندارد</p>
          )}
        </motion.div>
      </div>

      {/* ─── بینش‌های هوشمند ─── */}
      <motion.div {...fadeUp} className="bg-card rounded-3xl border border-border/60 p-4 sm:p-5">
        <h3 className="font-black text-sm flex items-center gap-2 mb-3 sm:mb-4">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          بینش‌های هوشمند
        </h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {insights.map((ins, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.07 }}
              className="flex items-start gap-3 rounded-2xl bg-muted/40 border border-border/40 p-3.5"
            >
              <ins.icon className={`w-4.5 h-4.5 shrink-0 mt-0.5 ${ins.tone}`} style={{ width: 18, height: 18 }} />
              <p className="text-[13px] leading-6">{ins.text}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
