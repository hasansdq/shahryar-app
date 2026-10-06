// ═════ داشبورد مدیریت — آمار و نمودارها ═════
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Users, Store, Target, MessageSquare, Brain, Star, TrendingUp,
  Activity, UserPlus, Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { get } from "@/lib/client/api";
import { faNum, faRelative, maskPhone } from "@/lib/client/persian";

interface StatsData {
  totals: {
    usersTotal: number; usersToday: number; usersActive: number;
    businessesTotal: number; businessesFeatured: number; categoriesTotal: number;
    goalsTotal: number; tasksDone: number;
    chatSessionsTotal: number; messagesTotal: number; messagesToday: number;
    memoriesTotal: number; reviewsTotal: number; cityDataTotal: number; logsToday: number;
  };
  usersGrowth: Array<{ day: string; count: number }>;
  chatActivity: Array<{ day: string; count: number }>;
  topBusinesses: Array<{ id: string; name: string; viewCount: number; rating: number; category: { name: string } }>;
  recentUsers: Array<{ id: string; fullName: string | null; phone: string; createdAt: string; status: string }>;
  recentLogs: Array<{ id: string; action: string; level: string; createdAt: string; actorType: string }>;
}

export default function DashboardTab() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await get<StatsData>("/api/admin/stats");
      if (active && res.success && res.data) setData(res.data);
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  const t = data?.totals;
  const maxGrowth = Math.max(...(data?.usersGrowth || []).map((g) => g.count), 1);
  const maxChat = Math.max(...(data?.chatActivity || []).map((c) => c.count), 1);

  const cards = [
    { label: "کاربران", value: t?.usersTotal ?? 0, sub: `${faNum(t?.usersToday ?? 0)} امروز`, icon: Users, color: "from-blue-500 to-indigo-600" },
    { label: "کسب‌وکارها", value: t?.businessesTotal ?? 0, sub: `${faNum(t?.businessesFeatured ?? 0)} ویژه`, icon: Store, color: "from-amber-500 to-orange-600" },
    { label: "اهداف کاربران", value: t?.goalsTotal ?? 0, sub: `${faNum(t?.tasksDone ?? 0)} وظیفه انجام‌شده`, icon: Target, color: "from-violet-500 to-purple-600" },
    { label: "پیام‌های هوشیار", value: t?.messagesTotal ?? 0, sub: `${faNum(t?.messagesToday ?? 0)} امروز`, icon: MessageSquare, color: "from-sky-500 to-cyan-600" },
    { label: "خاطرات AI", value: t?.memoriesTotal ?? 0, sub: "حافظه داینامیک", icon: Brain, color: "from-rose-500 to-pink-600" },
    { label: "نظرات اصناف", value: t?.reviewsTotal ?? 0, sub: "بازخورد شهروندان", icon: Star, color: "from-yellow-500 to-amber-600" },
    { label: "داده‌های شهری", value: t?.cityDataTotal ?? 0, sub: "پایگاه دانش", icon: Sparkles, color: "from-cyan-500 to-sky-600" },
    { label: "فعالیت امروز", value: t?.logsToday ?? 0, sub: "رویداد سیستم", icon: Activity, color: "from-slate-500 to-slate-700" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-white">داشبورد مدیریت</h2>
        <p className="text-slate-400 text-sm mt-1">نمای کلی سلامت و عملکرد سامانه شهریار</p>
      </div>

      {/* کارت‌های آماری */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="rounded-2xl bg-slate-900/70 border-slate-800 hover:border-slate-700 transition-colors">
              <CardContent className="p-4">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center mb-3 shadow-lg`}>
                  <c.icon className="w-5 h-5 text-white" />
                </div>
                <p className="text-2xl font-black text-white tnum">{faNum(c.value)}</p>
                <p className="text-xs text-slate-400 mt-1">{c.label}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{c.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* نمودارها */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="rounded-2xl bg-slate-900/70 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-blue-500" />
              رشد کاربران (۷ روز اخیر)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-2 h-36" dir="rtl">
              {(data?.usersGrowth || []).map((g, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                  <span className="text-[10px] text-slate-500 tnum opacity-0 group-hover:opacity-100 transition-opacity">
                    {faNum(g.count)}
                  </span>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max((g.count / maxGrowth) * 100, 4)}%` }}
                    className="w-full rounded-t-lg bg-gradient-to-t from-blue-600 to-sky-400 group-hover:from-blue-500 group-hover:to-sky-300 transition-colors"
                  />
                  <span className="text-[10px] text-slate-500">{g.day}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl bg-slate-900/70 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              فعالیت هوشیار (۷ روز اخیر)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-2 h-36" dir="rtl">
              {(data?.chatActivity || []).map((g, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                  <span className="text-[10px] text-slate-500 tnum opacity-0 group-hover:opacity-100 transition-opacity">
                    {faNum(g.count)}
                  </span>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max((g.count / maxChat) * 100, 4)}%` }}
                    className="w-full rounded-t-lg bg-gradient-to-t from-amber-600 to-yellow-400 group-hover:from-amber-500 group-hover:to-yellow-300 transition-colors"
                  />
                  <span className="text-[10px] text-slate-500">{g.day}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* جدول‌های پایین */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* محبوب‌ترین اصناف */}
        <Card className="rounded-2xl bg-slate-900/70 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
              <Store className="w-4 h-4 text-primary" />
              پربازدیدترین اصناف
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.topBusinesses || []).map((b, i) => (
              <div key={b.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-800/50 transition-colors">
                <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-400 text-xs font-bold flex items-center justify-center tnum">
                  {faNum(i + 1)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{b.name}</p>
                  <p className="text-[11px] text-slate-500">{b.category.name}</p>
                </div>
                <div className="text-left shrink-0">
                  <p className="text-xs text-amber-400 font-bold tnum flex items-center gap-1">
                    <Star className="w-3 h-3 fill-amber-400" />
                    {faNum(b.rating.toFixed(1))}
                  </p>
                  <p className="text-[10px] text-slate-500 tnum">{faNum(b.viewCount)} بازدید</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* آخرین کاربران */}
        <Card className="rounded-2xl bg-slate-900/70 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              جدیدترین کاربران
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.recentUsers || []).map((u) => (
              <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-800/50 transition-colors">
                <div className="w-9 h-9 rounded-xl shahryar-gradient flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {(u.fullName || "ک").charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{u.fullName || "بی‌نام"}</p>
                  <p className="text-[11px] text-slate-500 tnum" dir="ltr">{maskPhone(u.phone)}</p>
                </div>
                <div className="text-left shrink-0">
                  <Badge
                    className={`text-[9px] border-0 ${
                      u.status === "ACTIVE" ? "bg-blue-500/15 text-blue-400" : "bg-rose-500/15 text-rose-400"
                    }`}
                  >
                    {u.status === "ACTIVE" ? "فعال" : "غیرفعال"}
                  </Badge>
                  <p className="text-[10px] text-slate-500 mt-1">{faRelative(u.createdAt)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* آخرین فعالیت‌ها */}
      <Card className="rounded-2xl bg-slate-900/70 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            آخرین رویدادهای سیستم
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-2">
            {(data?.recentLogs || []).map((l) => (
              <div key={l.id} className="flex items-center gap-2.5 text-xs p-2.5 rounded-xl bg-slate-800/40">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    l.level === "error" ? "bg-rose-500" : l.level === "warning" ? "bg-amber-500" : "bg-blue-500"
                  }`}
                />
                <code className="text-slate-300 font-mono text-[11px]" dir="ltr">{l.action}</code>
                <span className="text-slate-500 mr-auto">{faRelative(l.createdAt)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
