// ═════ داشبورد اصلی شهریار ═════
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Target, Bot, Store, CheckCircle2, Flame, TrendingUp, Brain,
  Pin, ChevronLeft, Star, MapPin, BadgeCheck, Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/client/store";
import { get } from "@/lib/client/api";
import { faNum, faRelative, greeting, LABELS, faRating, faDateWithWeekday } from "@/lib/client/persian";

interface DashboardData {
  goals: Array<{
    id: string; title: string; progress: number; priority: string;
    color: string; deadline: string | null;
    tasks: Array<{ id: string; title: string; status: string }>;
  }>;
  stats: {
    activeGoals: number; completedGoals: number; todayTasks: number;
    todayDone: number; memoriesCount: number;
  };
  todayTasksList: Array<{
    id: string; title: string; status: string;
    goal: { id: string; title: string; color: string };
  }>;
  featuredBusinesses: Array<{
    id: string; slug: string; name: string; rating: number;
    category: { name: string; icon: string; color: string };
    district: string | null; isVerified: boolean;
  }>;
  cityNews: Array<{
    id: string; category: string; title: string; summary: string | null;
    isPinned: boolean; publishedAt: string;
  }>;
}

export default function DashboardView() {
  const { user, setView } = useAppStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    get<DashboardData>("/api/dashboard").then((res) => {
      if (mounted && res.success && res.data) setData(res.data);
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 p-4 lg:p-0">
        <Skeleton className="h-40 rounded-3xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    );
  }

  const firstName = (user?.fullName || "کاربر عزیز").split(" ")[0];

  return (
    <div className="space-y-5 p-4 lg:p-0 max-w-5xl mx-auto">
      {/* ─── سلام و خوش‌آمد ─── */}
      <motion.section
        initial={{ opacity: 0, y: 16, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="shahryar-gradient rounded-3xl p-6 md:p-8 text-white relative overflow-hidden"
      >
        <div className="pattern-dots absolute inset-0 opacity-30" />
        <motion.div
          className="absolute -left-16 -top-16 w-56 h-56 rounded-full bg-white/10 blur-2xl"
          animate={{ scale: [1, 1.25, 1], x: [0, 22, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -right-10 -bottom-20 w-64 h-64 rounded-full bg-[oklch(0.7_0.12_225_/_0.25)] blur-3xl"
          animate={{ scale: [1.1, 0.95, 1.1] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-2.5 flex-wrap">
            <p className="text-blue-100/80 text-sm">{greeting()}!</p>
            <span className="text-blue-100/40">·</span>
            <p className="text-blue-100/70 text-xs tnum">{faDateWithWeekday(new Date())}</p>
          </div>
          <h2 className="text-xl md:text-3xl font-black mt-1">
            {firstName} عزیز، شهر امروز چطوره؟
          </h2>
          <p className="text-blue-50/70 mt-3 max-w-lg text-sm leading-relaxed">
            {data && data.stats.todayTasks > 0
              ? `امروز ${faNum(data.stats.todayTasks)} کار انجام‌نشده داری. با هوشیار برنامه بریزیم؟`
              : "همه‌چیز مرتبه! یک قدم به اهدافت نزدیک‌تری. با هوشیار چت کن!"}
          </p>
          <div className="flex flex-wrap gap-2.5 mt-5">
            <button
              onClick={() => setView("chat")}
              className="flex items-center gap-2 bg-white text-blue-800 font-bold text-sm px-5 py-2.5 rounded-xl shadow-lg hover:shadow-xl transition-shadow"
            >
              <Bot className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
              گفتگو با هوشیار
            </button>
            <button
              onClick={() => setView("goals")}
              className="flex items-center gap-2 bg-white/15 backdrop-blur text-white font-bold text-sm px-5 py-2.5 rounded-xl border border-white/20 hover:bg-white/25 transition-colors"
            >
              <Target className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
              اهداف من
            </button>
          </div>
        </div>
      </motion.section>

      {/* ─── آمار سریع ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "اهداف فعال", value: data?.stats.activeGoals ?? 0, icon: Target, color: "text-blue-600 bg-blue-100/60 dark:bg-blue-900/30" },
          { label: "اهداف تکمیل‌شده", value: data?.stats.completedGoals ?? 0, icon: CheckCircle2, color: "text-sky-600 bg-sky-100/60 dark:bg-sky-900/30" },
          { label: "کارهای امروز", value: data?.stats.todayTasks ?? 0, icon: Flame, color: "text-amber-600 bg-amber-100/60 dark:bg-amber-900/30" },
          { label: "خاطرات هوشیار", value: data?.stats.memoriesCount ?? 0, icon: Brain, color: "text-violet-600 bg-violet-100/60 dark:bg-violet-900/30" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.06 * i, type: "spring", damping: 20 }}
          >
            <Card className="rounded-2xl border-border/60 card-lift">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${s.color}`}>
                  <s.icon className="w-5.5 h-5.5" style={{ width: 22, height: 22 }} />
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-black leading-none tnum">{faNum(s.value)}</p>
                  <p className="text-xs text-muted-foreground mt-1.5">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* ─── اهداف پیشرو ─── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="rounded-3xl border-border/60 overflow-hidden h-full">
            <div className="p-5 border-b border-border/60 flex items-center justify-between bg-gradient-to-l from-blue-50/60 to-transparent dark:from-blue-950/20">
              <h3 className="font-bold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                اهداف در حال پیشرفت
              </h3>
              <button
                onClick={() => setView("goals")}
                className="text-primary text-xs font-medium flex items-center gap-1 hover:underline"
              >
                همه اهداف
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {data?.goals?.length ? (
                data.goals.map((g) => (
                  <div key={g.id} className="group cursor-pointer" onClick={() => setView("goals")}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-sm group-hover:text-primary transition-colors">{g.title}</span>
                      <span className="text-xs font-bold tnum" style={{ color: g.color }}>
                        {faNum(g.progress)}٪
                      </span>
                    </div>
                    <Progress value={g.progress} className="h-2 rounded-full" />
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="secondary" className="text-[10px] px-2 py-0">
                        {LABELS.priorities[g.priority]}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {faNum(g.tasks.length)} وظیفه
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <button
                  onClick={() => setView("goals")}
                  className="w-full py-8 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-accent/40 transition-colors text-center"
                >
                  <Target className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">هنوز هدفی نساخته‌اید</p>
                  <p className="text-xs text-primary font-medium mt-1">اولین هدف را بسازید</p>
                </button>
              )}
            </div>
          </Card>
        </motion.section>

        {/* ─── اخبار و رویدادهای شهر ─── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="rounded-3xl border-border/60 overflow-hidden h-full">
            <div className="p-5 border-b border-border/60 flex items-center justify-between bg-gradient-to-l from-amber-50/60 to-transparent dark:from-amber-950/20">
              <h3 className="font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                رفسنجان امروز
              </h3>
            </div>
            <div className="p-3 max-h-[22rem] overflow-y-auto">
              {data?.cityNews?.map((n) => (
                <div key={n.id} className="p-3 rounded-xl hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      className="text-[10px] px-2 py-0"
                      variant={n.category === "news" ? "default" : n.category === "event" ? "secondary" : "outline"}
                    >
                      {LABELS.cityCategories[n.category]}
                    </Badge>
                    {n.isPinned && <Pin className="w-3.5 h-3.5 text-amber-500" />}
                    <span className="text-[11px] text-muted-foreground mr-auto">{faRelative(n.publishedAt)}</span>
                  </div>
                  <p className="text-sm font-bold leading-relaxed">{n.title}</p>
                  {n.summary && (
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{n.summary}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </motion.section>
      </div>

      {/* ─── اصناف ویژه ─── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="font-bold flex items-center gap-2">
            <Store className="w-5 h-5 text-primary" />
            اصناف ویژه رفسنجان
          </h3>
          <button
            onClick={() => setView("businesses")}
            className="text-primary text-xs font-medium flex items-center gap-1 hover:underline"
          >
            همه اصناف
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data?.featuredBusinesses?.map((b, i) => (
            <motion.button
              key={b.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, type: "spring", damping: 22 }}
              onClick={() => setView("businesses")}
              className="text-right bg-card rounded-2xl border border-border/60 p-4 card-lift group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-sm group-hover:text-primary transition-colors">{b.name}</p>
                    {b.isVerified && <BadgeCheck className="w-4 h-4 text-primary shrink-0" />}
                  </div>
                  <Badge variant="outline" className="text-[10px] mt-2 px-2 py-0" style={{ color: b.category.color, borderColor: `${b.category.color}40` }}>
                    {b.category.name}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 text-amber-500 shrink-0">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span className="text-xs font-bold tnum">{faRating(b.rating)}</span>
                </div>
              </div>
              {b.district && (
                <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5" />
                  {b.district}
                </div>
              )}
            </motion.button>
          ))}
        </div>
      </motion.section>
    </div>
  );
}
