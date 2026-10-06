// ═══ تحلیل و مارکتینگ — بینش‌های داده برای رشد شهریار ═══
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, Users, MonitorSmartphone, Heart, Clock, Star, Lightbulb,
  BarChart3, MessageSquare, Store, Bot, Target, Zap,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { get } from "@/lib/client/api";
import { faNum } from "@/lib/client/persian";
import { cn } from "@/lib/utils";

interface AnalyticsData {
  growth12: Array<{ month: string; count: number }>;
  activity14: Array<{ day: string; chat: number; social: number; signups: number }>;
  moduleEngagement: Array<{ key: string; label: string; value: number }>;
  devices: Array<{ name: string; count: number }>;
  interests: Array<{ name: string; count: number }>;
  gender: { male: number; female: number; unknown: number };
  ageBuckets: Record<string, number>;
  busiestHours: Array<{ hour: number; count: number }>;
  ratingDist: Record<string, number>;
  recommend: { yes: number; no: number };
  topBiz: Array<{ name: string; category: string; views: number; rating: number }>;
  powerUsers: Array<{ id: string; fullName: string | null; isVerified: boolean; goals: number; chats: number }>;
  insights: string[];
  totals: { usersTotal: number; sessionsMonth: number; reviewsTotal: number; goalsTotal: number };
}

const MODULE_COLORS: Record<string, string> = {
  chat: "from-violet-500 to-purple-600",
  goals: "from-amber-500 to-orange-600",
  finance: "from-emerald-500 to-teal-600",
  businesses: "from-sky-500 to-blue-600",
  social: "from-rose-500 to-pink-600",
};

const MODULE_ICONS: Record<string, typeof MessageSquare> = {
  chat: MessageSquare, goals: Target, finance: BarChart3, businesses: Store, social: Users,
};

export default function AnalyticsTab() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await get<AnalyticsData>("/api/admin/analytics");
      if (res.success && res.data) setData(res.data);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }
  if (!data) return null;

  const maxGrowth = Math.max(...data.growth12.map((g) => g.count), 1);
  const maxActivity = Math.max(...data.activity14.map((a) => a.chat + a.social + a.signups), 1);
  const maxModule = Math.max(...data.moduleEngagement.map((m) => m.value), 1);
  const devicesTotal = data.devices.reduce((a, d) => a + d.count, 0) || 1;
  const reviewsTotal = data.totals.reviewsTotal || 1;
  const recommendRate = Math.round((data.recommend.yes / (data.recommend.yes + data.recommend.no || 1)) * 100);
  const genderTotal = data.gender.male + data.gender.female + data.gender.unknown || 1;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-white">تحلیل و مارکتینگ</h2>
        <p className="text-slate-400 text-sm mt-1">بینش‌های داده‌محور برای رشد و تصمیم‌سازی در شهریار</p>
      </div>

      {/* ─── بینش‌های هوشمند ─── */}
      {data.insights.length > 0 && (
        <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-l from-amber-500/10 to-transparent p-4">
          <p className="text-sm font-black text-white mb-3 flex items-center gap-2">
            <Lightbulb className="size-4 text-amber-400" />
            پیشنهادهای هوشمند سیستم
          </p>
          <div className="space-y-2">
            {data.insights.map((ins, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07 }}
                className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed"
              >
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-400" />
                {ins}
              </motion.p>
            ))}
          </div>
        </div>
      )}

      {/* ─── رشد ۱۲ ماهه + فعالیت ۱۴ روزه ─── */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* رشد */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="size-4 text-blue-400" />
            رشد کاربران (۱۲ ماه اخیر)
            <span className="ms-auto text-[10px] text-slate-500 tnum">{faNum(data.totals.usersTotal)} کاربر</span>
          </p>
          <div className="flex items-end justify-between gap-1 h-40" dir="rtl">
            {data.growth12.map((g, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group min-w-0">
                <span className="text-[9px] text-slate-500 tnum opacity-0 group-hover:opacity-100 transition-opacity">
                  {g.count > 0 ? faNum(g.count) : ""}
                </span>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max((g.count / maxGrowth) * 100, g.count > 0 ? 6 : 2)}%` }}
                  transition={{ delay: i * 0.04, duration: 0.4 }}
                  className={cn(
                    "w-full rounded-t-lg transition-colors",
                    g.count > 0 ? "bg-gradient-to-t from-blue-600 to-sky-400 group-hover:to-sky-300" : "bg-slate-800"
                  )}
                />
                <span className="text-[8px] text-slate-500 truncate w-full text-center">{g.month.slice(0, 5)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* فعالیت ۱۴ روزه — stacked */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Zap className="size-4 text-emerald-400" />
            فعالیت ۱۴ روز اخیر
            <span className="ms-auto flex items-center gap-2 text-[9px]">
              <span className="flex items-center gap-1 text-violet-400"><span className="size-2 rounded-sm bg-violet-500" />هوشیار</span>
              <span className="flex items-center gap-1 text-rose-400"><span className="size-2 rounded-sm bg-rose-500" />شبکه</span>
              <span className="flex items-center gap-1 text-sky-400"><span className="size-2 rounded-sm bg-sky-500" />عضویت</span>
            </span>
          </p>
          <div className="flex items-end justify-between gap-1 h-40" dir="rtl">
            {data.activity14.map((a, i) => {
              const total = a.chat + a.social + a.signups;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group min-w-0">
                  <div className="flex w-full flex-col-reverse overflow-hidden rounded-t-lg" style={{ height: `${Math.max((total / maxActivity) * 130, 3)}px` }}>
                    <motion.div initial={{ height: 0 }} animate={{ height: `${(a.chat / (total || 1)) * 100}%` }} className="w-full bg-violet-500" />
                    <motion.div initial={{ height: 0 }} animate={{ height: `${(a.social / (total || 1)) * 100}%` }} className="w-full bg-rose-500" />
                    <motion.div initial={{ height: 0 }} animate={{ height: `${(a.signups / (total || 1)) * 100}%` }} className="w-full bg-sky-500" />
                  </div>
                  <span className="text-[8px] text-slate-500">{a.day.slice(0, 3)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── تعامل ماژول‌ها + دستگاه‌ها ─── */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* تعامل ماژول‌ها */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="size-4 text-violet-400" />
            تعامل کاربران با ماژول‌ها
          </p>
          <div className="space-y-3">
            {data.moduleEngagement.map((m, i) => {
              const Icon = MODULE_ICONS[m.key] || BarChart3;
              const pct = Math.round((m.value / maxModule) * 100);
              return (
                <div key={m.key} className="flex items-center gap-3">
                  <div className={cn("grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br shadow", MODULE_COLORS[m.key])}>
                    <Icon className="size-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-300 font-bold">{m.label}</span>
                      <span className="text-[10px] text-slate-500 tnum">{faNum(m.value)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(pct, 2)}%` }}
                        transition={{ delay: i * 0.08, duration: 0.5 }}
                        className={cn("h-full rounded-full bg-gradient-to-l", MODULE_COLORS[m.key])}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* دستگاه‌ها */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <MonitorSmartphone className="size-4 text-sky-400" />
            دستگاه کاربران
            <span className="ms-auto text-[10px] text-slate-500 tnum">{faNum(data.totals.sessionsMonth)} سشن/ماه</span>
          </p>
          <div className="space-y-2.5">
            {data.devices.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">داده‌ای ثبت نشده</p>
            ) : data.devices.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2.5">
                <span className="w-14 text-[10px] text-slate-400 font-bold shrink-0">{d.name}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(d.count / devicesTotal) * 100}%` }}
                    transition={{ delay: i * 0.06 }}
                    className="h-full rounded-full bg-gradient-to-l from-sky-500 to-cyan-400"
                  />
                </div>
                <span className="text-[10px] text-slate-500 tnum w-8 text-left">{faNum(d.count)}</span>
              </div>
            ))}
          </div>

          {/* جنسیت */}
          <div className="mt-4 pt-4 border-t border-slate-800">
            <p className="text-[10px] text-slate-500 mb-2">ترکیب جنسیتی</p>
            <div className="flex h-2.5 overflow-hidden rounded-full">
              <div className="bg-sky-500" style={{ width: `${(data.gender.male / genderTotal) * 100}%` }} />
              <div className="bg-rose-400" style={{ width: `${(data.gender.female / genderTotal) * 100}%` }} />
              <div className="bg-slate-700" style={{ width: `${(data.gender.unknown / genderTotal) * 100}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-[9px] text-slate-500">
              <span>{faNum(Math.round((data.gender.male / genderTotal) * 100))}٪ آقایان</span>
              <span>{faNum(Math.round((data.gender.female / genderTotal) * 100))}٪ خانم‌ها</span>
              <span>{faNum(Math.round((data.gender.unknown / genderTotal) * 100))}٪ نامشخص</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── علایق + ساعات طلایی ─── */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* علایق */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Heart className="size-4 text-rose-400" />
            علایق کاربران (فرصت‌های هدفگذاری)
          </p>
          {data.interests.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">کاربرانی علایق خود را ثبت نکرده‌اند</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.interests.map((tag, i) => {
                const max = data.interests[0].count || 1;
                const intensity = tag.count / max;
                return (
                  <motion.span
                    key={tag.name}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold"
                    style={{
                      background: `rgba(244, 63, 94, ${0.06 + intensity * 0.14})`,
                      borderColor: `rgba(244, 63, 94, ${0.15 + intensity * 0.3})`,
                      color: intensity > 0.5 ? "#fda4af" : "#94a3b8",
                    }}
                  >
                    {tag.name}
                    <span className="tnum text-[9px] opacity-70">{faNum(tag.count)}</span>
                  </motion.span>
                );
              })}
            </div>
          )}
        </div>

        {/* ساعات طلایی */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Clock className="size-4 text-amber-400" />
            ساعات طلایی فعالیت — بهترین زمان ارسال اعلان
          </p>
          <div className="space-y-2">
            {data.busiestHours.map((h, i) => (
              <div key={h.hour} className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-400 text-xs font-black tnum">
                  {faNum(h.hour)}:۰۰
                </span>
                <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(h.count / (data.busiestHours[0]?.count || 1)) * 100}%` }}
                    transition={{ delay: i * 0.07 }}
                    className="h-full rounded-full bg-gradient-to-l from-amber-500 to-orange-400"
                  />
                </div>
                <span className="text-[10px] text-slate-500 tnum w-14 text-left">{faNum(h.count)} رویداد</span>
              </div>
            ))}
          </div>

          {/* رضایت نظرات */}
          <div className="mt-4 pt-4 border-t border-slate-800">
            <p className="text-[10px] text-slate-500 mb-2 flex items-center gap-1.5">
              <Star className="size-3.5 fill-amber-400 text-amber-400" />
              رضایت از اصناف: {faNum(recommendRate)}٪ توصیه می‌کنند ({faNum(data.recommend.yes + data.recommend.no)} نظر)
            </p>
            <div className="flex h-2.5 overflow-hidden rounded-full">
              <div className="bg-emerald-500" style={{ width: `${(data.recommend.yes / reviewsTotal) * 100}%` }} />
              <div className="bg-rose-400" style={{ width: `${(data.recommend.no / reviewsTotal) * 100}%` }} />
            </div>
            {/* توزیع امتیازها */}
            <div className="mt-2.5 flex items-center gap-1.5">
              {[5, 4, 3, 2, 1].map((s) => {
                const count = data.ratingDist[String(s)] || 0;
                const pct = Math.round((count / reviewsTotal) * 100);
                return (
                  <div key={s} className="flex-1 text-center">
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", s >= 4 ? "bg-emerald-500" : s === 3 ? "bg-amber-400" : "bg-rose-400")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[8px] text-slate-500 tnum">{faNum(s)}★ {faNum(pct)}٪</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ─── برترین‌ها ─── */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* اصناف پربازدید */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Store className="size-4 text-amber-400" />
            اصناف پربازدید — پتانسیل کمپین محلی
          </p>
          <div className="space-y-2">
            {data.topBiz.map((b, i) => (
              <div key={b.name} className="flex items-center gap-3 rounded-xl bg-slate-800/50 p-2.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-amber-400 font-black text-[10px] tnum">{faNum(i + 1)}</span>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs text-slate-200 font-bold">{b.name}</p>
                  <p className="text-[9px] text-slate-500">{b.category}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Star className="size-3 fill-amber-400 text-amber-400" />
                  <span className="text-[10px] text-slate-400 tnum">{faNum(b.rating)}</span>
                </div>
                <span className="text-[10px] text-slate-500 tnum shrink-0">{faNum(b.views)} بازدید</span>
              </div>
            ))}
          </div>
        </div>

        {/* کاربران قدرتی */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Users className="size-4 text-violet-400" />
            کاربران قدرتی — سفیران بالقوه شهریار
          </p>
          <div className="space-y-2">
            {data.powerUsers.map((u, i) => (
              <div key={u.id} className="flex items-center gap-3 rounded-xl bg-slate-800/50 p-2.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-violet-500/15 text-violet-400 font-black text-[10px] tnum">{faNum(i + 1)}</span>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs text-slate-200 font-bold flex items-center gap-1.5">
                    {u.fullName || "بی‌نام"}
                    {u.isVerified && <Badge className="text-[8px] border-0 bg-sky-500/15 text-sky-400 px-1.5">تأییدشده</Badge>}
                  </p>
                  <p className="text-[9px] text-slate-500 tnum">{faNum(u.goals)} هدف · {faNum(u.chats)} گفتگو</p>
                </div>
                <Badge className="text-[8px] border-0 bg-violet-500/15 text-violet-300 shrink-0">
                  <Bot className="size-2.5 ml-0.5" />
                  {faNum(u.goals + u.chats)} تعامل
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
