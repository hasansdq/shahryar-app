// ═════ اهداف من — نسخه ۲: فیلترهای حرفه‌ای، آمار زنده و تحلیل‌محور ═════
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target, Plus, Trophy, Layers, Search, MoreVertical, Pencil,
  Archive, ArchiveRestore, Trash2, Flame, BarChart3, ChevronLeft, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { get, patch, del } from "@/lib/client/api";
import { faNum, PRIORITY_COLORS, LABELS } from "@/lib/client/persian";
import { moduleConfig } from "@/lib/client/store";
import { toast } from "@/hooks/use-toast";
import GoalDetail from "./GoalDetail";
import GoalFormDialog from "./GoalFormDialog";
import AnalyticsTab from "./AnalyticsTab";
import {
  type Goal, type GoalsData, CATEGORY_META, categoryMeta, deadlineInfo, DEADLINE_TONE,
  goalTaskStats, priorityRank, PRIORITIES,
} from "./helpers";

const STATUS_CHIPS = [
  { id: "active", label: "فعال" },
  { id: "completed", label: "تکمیل‌شده" },
  { id: "archived", label: "بایگانی" },
] as const;

const SORTS = [
  { id: "priority", label: "اولویت (بحرانی اول)" },
  { id: "deadline", label: "نزدیک‌ترین مهلت" },
  { id: "progress", label: "بیشترین پیشرفت" },
  { id: "updated", label: "آخرین تغییر" },
  { id: "newest", label: "جدیدترین" },
] as const;

const TABS = [
  { id: "goals", label: "اهداف", icon: Target },
  { id: "analytics", label: "آمار و تحلیل", icon: BarChart3 },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function GoalsView() {
  const [data, setData] = useState<GoalsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("goals");
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  // امکانات CMS: تب تحلیل (پیش‌فرض فعال — کانفیگ ماژول اهداف)
  const tabs = moduleConfig("goals", "enableAnalytics", true) === true ? TABS : TABS.filter((t) => t.id !== "analytics");
  const [createOpen, setCreateOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);

  // فیلترها
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("active");
  const [category, setCategory] = useState<string>("all");
  const [sort, setSort] = useState<string>("priority");

  const [reloadKey, setReloadKey] = useState(0);
  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  const [confirmDelete, setConfirmDelete] = useState<Goal | null>(null);

  // ─── بارگذاری ───
  useEffect(() => {
    let active = true;
    (async () => {
      const res = await get<GoalsData>("/api/goals?status=all");
      if (!active) return;
      if (res.success && res.data) {
        setData(res.data);
        // اگر هدف باز در جزئیات حذف/بایگانی شده، به لیست برگرد
        setSelectedGoalId((prev) => {
          if (!prev) return prev;
          return res.data!.goals.some((g) => g.id === prev) ? prev : null;
        });
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [reloadKey]);

  // ─── فیلتر و مرتب‌سازی کلاینت‌ساید ───
  const filteredGoals = useMemo(() => {
    if (!data?.goals) return [];
    let list = data.goals.filter((g) => g.status === status);
    const q = search.trim();
    if (q) {
      list = list.filter(
        (g) =>
          g.title.includes(q) ||
          (g.description || "").includes(q) ||
          g.tasks.some((t) => t.title.includes(q))
      );
    }
    if (category !== "all") list = list.filter((g) => g.category === category);

    const dl = (g: Goal) => (g.deadline ? new Date(g.deadline).getTime() : Number.MAX_SAFE_INTEGER);
    return [...list].sort((a, b) => {
      switch (sort) {
        case "deadline": return dl(a) - dl(b);
        case "progress": return b.progress - a.progress;
        case "updated": return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case "newest": return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default: {
          const p = priorityRank(a.priority) - priorityRank(b.priority);
          return p !== 0 ? p : dl(a) - dl(b);
        }
      }
    });
  }, [data, search, status, category, sort]);

  const selectedGoal = useMemo(
    () => data?.goals.find((g) => g.id === selectedGoalId) || null,
    [data, selectedGoalId]
  );

  // ─── عملیات کارت ───
  const openGoal = (id: string) => {
    setSelectedGoalId(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const archiveGoal = async (goal: Goal, restore = false) => {
    const res = await patch(`/api/goals/${goal.id}`, { status: restore ? "active" : "archived" });
    if (res.success) {
      toast({ title: restore ? "هدف بازگردانده شد" : "هدف بایگانی شد", description: restore ? undefined : "از تب «بایگانی» قابل بازگردانی است" });
      if (selectedGoalId === goal.id && !restore) setSelectedGoalId(null);
      refresh();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const deleteGoal = async () => {
    if (!confirmDelete) return;
    const g = confirmDelete;
    setConfirmDelete(null);
    const res = await del(`/api/goals/${g.id}`);
    if (res.success) {
      if (selectedGoalId === g.id) setSelectedGoalId(null);
      toast({ title: "هدف حذف شد" });
      refresh();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  // ═════ جزئیات هدف ═════
  if (selectedGoal) {
    return (
      <div className="pt-2 lg:pt-0">
        <GoalDetail
          goal={selectedGoal}
          onBack={() => setSelectedGoalId(null)}
          refresh={refresh}
          onArchived={() => setSelectedGoalId(null)}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4 p-4 lg:p-0 max-w-6xl mx-auto">
        <Skeleton className="h-36 rounded-3xl" />
        <Skeleton className="h-14 rounded-2xl" />
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-44 rounded-3xl" />
          <Skeleton className="h-44 rounded-3xl" />
        </div>
      </div>
    );
  }

  const stats = data?.stats;
  const activeCount = stats?.activeCount ?? 0;
  const completedCount = stats?.completedCount ?? 0;
  const totalTasks = stats?.totalTasks ?? 0;
  const doneTasks = stats?.doneTasks ?? 0;
  const completionRate = activeCount + completedCount > 0
    ? Math.round((completedCount / (activeCount + completedCount)) * 100) : 0;

  // ═════ نمایش اصلی ═════
  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-6 pt-2 lg:pt-0" dir="rtl">
      {/* ─── سرتیتر ─── */}
      <div className="shahryar-gradient rounded-3xl p-4 sm:p-6 text-white relative overflow-hidden mb-4">
        <div className="pattern-dots absolute inset-0 opacity-25" />
        <div className="absolute -left-20 -bottom-24 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg md:text-2xl font-black flex items-center gap-2">
              <Target className="w-6 h-6 md:w-7 md:h-7 shrink-0" />
              اهداف من
            </h1>
            <p className="text-blue-50/80 text-xs sm:text-sm mt-1.5 sm:mt-2 max-w-md leading-relaxed">
              برنامه‌ریزی هوشمند، کانبان حرفه‌ای و همراهی هوشیار برای رسیدن به خواسته‌هایت
            </p>
          </div>

          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-white text-blue-800 hover:bg-blue-50 font-bold rounded-xl h-10 sm:h-11 px-4 sm:px-5 shadow-lg border-0 shrink-0"
          >
            <Plus className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
            <span className="hidden sm:inline">هدف جدید</span>
            <span className="sm:hidden">هدف</span>
          </Button>
        </div>

        {/* آمار زنده — موبایل: ردیف فشرده / دسکتاپ: همان چیدمان قبلی */}
        <div className="relative z-10 mt-3 sm:mt-4 grid grid-cols-3 sm:flex sm:items-center sm:gap-4 text-center">
          <div className="rounded-2xl bg-white/10 sm:bg-transparent sm:rounded-none py-2 sm:py-0">
            <p className="text-lg sm:text-3xl font-black tnum leading-none">{faNum(activeCount)}</p>
            <p className="text-[10px] sm:text-xs text-blue-100/70 mt-1">فعال</p>
          </div>
          <div className="h-px sm:h-6 w-px sm:w-px bg-white/15 sm:bg-white/20 my-1 mx-auto sm:mx-0 hidden sm:block" />
          <div className="rounded-2xl bg-white/10 sm:bg-transparent sm:rounded-none py-2 sm:py-0">
            <p className="text-lg sm:text-3xl font-black tnum leading-none flex items-center justify-center gap-1">
              {faNum(completedCount)}
              <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300" />
            </p>
            <p className="text-[10px] sm:text-xs text-blue-100/70 mt-1">تکمیل‌شده</p>
          </div>
          <div className="h-px sm:h-6 w-px sm:w-px bg-white/15 sm:bg-white/20 my-1 mx-auto sm:mx-0 hidden sm:block" />
          <div className="rounded-2xl bg-white/10 sm:bg-transparent sm:rounded-none py-2 sm:py-0">
            <p className="text-lg sm:text-3xl font-black tnum leading-none">{faNum(doneTasks)}<span className="text-xs sm:text-lg text-blue-100/60">/{faNum(totalTasks)}</span></p>
            <p className="text-[10px] sm:text-xs text-blue-100/70 mt-1">وظایف</p>
          </div>
        </div>

        {/* نوار نرخ تکمیل */}
        <div className="relative z-10 mt-3 sm:mt-4 max-w-sm">
          <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-blue-100/80 mb-1">
            <span>نرخ تکمیل کل</span>
            <span className="font-bold tnum">{faNum(completionRate)}٪</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${completionRate}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full rounded-full bg-amber-300"
            />
          </div>
        </div>
      </div>

      {/* ─── تب‌های بخش — اسکرول چسبان ─── */}
      <div className="sticky top-14 lg:top-0 z-30 -mx-4 lg:mx-0 px-4 lg:px-0 py-2 bg-background/90 backdrop-blur-md">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar p-1 bg-card/70 rounded-2xl border border-border/60 w-fit mx-auto lg:mx-0">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                  active ? "text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="goals-tab-pill"
                    className="absolute inset-0 rounded-xl shahryar-gradient shadow-md"
                    transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                  />
                )}
                <t.icon className="w-4 h-4 relative z-10" />
                <span className="relative z-10">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-2">
      {tab === "goals" && (
        <>
          {/* ─── نوار فیلتر ─── */}
          <div className="bg-card rounded-2xl border border-border/60 p-2.5 sm:p-3 mb-4 space-y-2.5">
            {/* ردیف اول: جستجو تمام-عرض موبایل + مرتب‌سازی کنارش در دسکتاپ */}
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="جستجو در اهداف و وظایف..."
                  className="rounded-xl pr-9 h-10 text-sm bg-accent/40 border-border/70 focus-visible:border-primary/50"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="rounded-xl h-10 w-full sm:w-40 md:w-48 shrink-0 text-sm bg-accent/40 border-border/70">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORTS.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ردیف دوم: چیپ‌های وضعیت اسکرول‌شونده + دسته هم‌عرض باقی فضا */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto no-scrollbar">
                {STATUS_CHIPS.map((c) => {
                  const isActive = status === c.id;
                  const count = c.id === "active" ? activeCount : c.id === "completed" ? completedCount : (stats?.archivedCount ?? 0);
                  return (
                    <button
                      key={c.id}
                      onClick={() => setStatus(c.id)}
                      className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-colors active:scale-95 ${
                        isActive ? "text-white" : "text-muted-foreground hover:text-foreground bg-muted/60"
                      }`}
                    >
                      {isActive && (
                        <motion.span layoutId="goal-status-chip" className="absolute inset-0 rounded-xl shahryar-gradient shadow-sm" />
                      )}
                      <span className="relative z-10">{c.label}</span>
                      <span className={`relative z-10 tnum text-[10px] rounded-md px-1.5 py-0.5 ${isActive ? "bg-white/20" : "bg-border/50"}`}>
                        {faNum(count)}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="w-px h-6 bg-border/60 mx-0.5 hidden sm:block" />
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="rounded-xl h-8 flex-1 sm:flex-none sm:w-32 border-0 bg-muted/60 text-xs shadow-none">
                  <SelectValue placeholder="همه دسته‌ها" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه دسته‌ها</SelectItem>
                  {Object.entries(CATEGORY_META).map(([k, m]) => (
                    <SelectItem key={k} value={k}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ─── لیست اهداف ─── */}
          {filteredGoals.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-4">
              <AnimatePresence>
                {filteredGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onOpen={() => openGoal(goal.id)}
                    onEdit={() => setEditGoal(goal)}
                    onArchive={() => archiveGoal(goal, goal.status === "archived")}
                    onDelete={() => setConfirmDelete(goal)}
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-14 bg-card rounded-3xl border-2 border-dashed border-border"
            >
              <div className="w-16 h-16 mx-auto rounded-3xl shahryar-gradient flex items-center justify-center shadow-lg mb-4">
                <Search className="w-8 h-8 text-white opacity-80" />
              </div>
              <h3 className="font-black text-lg">
                {data?.goals?.length ? "چیزی با این فیلترها پیدا نشد" : "سفرت را شروع کن!"}
              </h3>
              <p className="text-muted-foreground text-sm mt-2 max-w-sm mx-auto leading-relaxed">
                {data?.goals?.length
                  ? "فیلترها را تغییر بده یا عبارت دیگری جستجو کن"
                  : "اولین هدف را بساز تا با کانبان حرفه‌ای و همراهی هوشیار، قدم‌به‌قدم به آن برسی"}
              </p>
              {!data?.goals?.length && (
                <Button
                  onClick={() => setCreateOpen(true)}
                  className="mt-5 shahryar-gradient text-white border-0 rounded-xl font-bold px-6"
                >
                  <Plus className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                  ساخت اولین هدف
                </Button>
              )}
            </motion.div>
          )}
        </>
      )}

      {tab === "analytics" && (
        <div className="mt-2">
          <AnalyticsTab onOpenGoal={openGoal} />
        </div>
      )}
      </div>

      {/* ─── دیالوگ‌ها ─── */}
      <GoalFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={refresh}
      />
      <GoalFormDialog
        open={!!editGoal}
        onClose={() => setEditGoal(null)}
        onSaved={refresh}
        editing={editGoal}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent dir="rtl" className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              حذف هدف
            </AlertDialogTitle>
            <AlertDialogDescription>
              هدف «{confirmDelete?.title}» و همه‌ی {faNum(confirmDelete?.tasks.length || 0)} وظیفه‌ی آن برای همیشه حذف می‌شود. این عمل قابل بازگشت نیست!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">انصراف</AlertDialogCancel>
            <AlertDialogAction onClick={deleteGoal} className="rounded-xl bg-destructive text-white hover:bg-destructive/90">
              حذف قطعی
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═════ کارت هدف — نسخه ۲ با منوی اقدامات و شمارش معکوس ═════
function GoalCard({
  goal, onOpen, onEdit, onArchive, onDelete,
}: {
  goal: Goal; onOpen: () => void; onEdit: () => void; onArchive: () => void; onDelete: () => void;
}) {
  const meta = categoryMeta(goal.category);
  const stats = goalTaskStats(goal);
  const dl = deadlineInfo(goal.deadline, goal.status === "completed");
  const isCompleted = goal.status === "completed";
  const isArchived = goal.status === "archived";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="relative"
    >
      <div
        onClick={onOpen}
        className="w-full text-right bg-card rounded-3xl border border-border/60 p-4 sm:p-5 hover:shadow-lg hover:border-primary/40 active:scale-[0.99] transition-all group relative overflow-hidden cursor-pointer"
      >
        <div className="absolute top-0 right-0 w-1.5 h-full" style={{ background: goal.color }} />
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="flex items-start gap-2.5 sm:gap-3 flex-1 min-w-0">
            {/* آیکن دسته */}
            <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center shrink-0 ${meta.tint}`}>
              <meta.icon className="w-5 h-5" style={{ width: 20, height: 20 }} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h3 className={`font-black text-base sm:text-lg group-hover:text-primary transition-colors ${isCompleted ? "line-through text-muted-foreground" : ""}`}>
                  {goal.title}
                </h3>
                {isCompleted && (
                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 gap-1 text-[10px]">
                    <Trophy className="w-3 h-3" />
                    تکمیل‌شده
                  </Badge>
                )}
                {isArchived && (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Archive className="w-3 h-3" />
                    بایگانی
                  </Badge>
                )}
              </div>

              {goal.description && (
                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-5">{goal.description}</p>
              )}

              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                <Badge className={`text-[10px] ${PRIORITY_COLORS[goal.priority]}`}>
                  <Flame className="w-3 h-3" />
                  {PRIORITIES[goal.priority] || goal.priority}
                </Badge>
                {dl && (
                  <Badge variant="outline" className={`text-[10px] gap-1 ${DEADLINE_TONE[dl.tone]}`}>
                    {dl.label}
                  </Badge>
                )}
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" />
                  {faNum(stats.done)}/{faNum(stats.total)} وظیفه
                </span>
                {stats.overdue > 0 && !isCompleted && (
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 font-medium flex items-center gap-0.5 bg-rose-500/10 rounded-md px-1.5 py-0.5">
                    {faNum(stats.overdue)} معوق
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <p className="text-xl md:text-2xl font-black tnum" style={{ color: goal.color }}>
              {faNum(goal.progress)}٪
            </p>
            {/* منوی اقدامات */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg p-1.5 transition-colors"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }} className="gap-2">
                  <Pencil className="w-3.5 h-3.5" />
                  ویرایش هدف
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(); }} className="gap-2">
                  {isArchived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                  {isArchived ? "بازگردانی" : "بایگانی"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="gap-2 text-destructive focus:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                  حذف
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Progress value={goal.progress} className="h-2 mt-3 sm:mt-4" />
        <div className="flex items-center gap-1 text-xs text-primary font-medium mt-2 sm:mt-3">
          مشاهده کانبان
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        </div>
      </div>
    </motion.div>
  );
}
