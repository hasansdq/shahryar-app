// ═════ جزئیات هدف — کانبان حرفه‌ای + هوشیار + جشن تکمیل ═════
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  DndContext, DragEndEvent, PointerSensor, useSensor, useSensors,
  DragOverlay, useDroppable, pointerWithin, rectIntersection,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronRight, Plus, Trash2, CheckCircle2, Clock, Circle, GripVertical,
  Flag, CalendarDays, Trophy, X, Pencil, Sparkles, Loader2, PartyPopper,
  Archive, ArchiveRestore, MessageCircleQuestion, Layers, AlarmClock, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { post, patch, del } from "@/lib/client/api";
import { faNum, faDate, faRelative, LABELS, PRIORITY_COLORS } from "@/lib/client/persian";
import { moduleConfig } from "@/lib/client/store";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "@/hooks/use-toast";
import GoalFormDialog from "./GoalFormDialog";
import TaskFormDialog from "./TaskFormDialog";
import {
  type Goal, type Task, categoryMeta, deadlineInfo, DEADLINE_TONE,
  goalTaskStats, ProgressRing, PRIORITIES,
} from "./helpers";

const COLUMNS: Array<{ id: Task["status"]; label: string; icon: typeof Circle; color: string }> = [
  { id: "todo", label: "در انتظار انجام", icon: Circle, color: "border-t-slate-400" },
  { id: "in_progress", label: "در حال انجام", icon: Clock, color: "border-t-amber-500" },
  { id: "done", label: "انجام‌شده", icon: CheckCircle2, color: "border-t-blue-500" },
];

/** تشخیص برخورد — الگوی رسمی dnd-kit برای کانبان */
function kanbanCollisionDetection(args: Parameters<NonNullable<import("@dnd-kit/core").DndContextProps["collisionDetection"]>>[0]) {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  return rectIntersection(args);
}

interface Suggestion {
  title: string;
  priority: string;
  dueInDays: number;
}

export default function GoalDetail({
  goal, onBack, refresh, onArchived,
}: {
  goal: Goal; onBack: () => void; refresh: () => void; onArchived?: (title: string) => void;
}) {
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [activeDragTask, setActiveDragTask] = useState<Task | null>(null);
  const [editGoalOpen, setEditGoalOpen] = useState(false);
  const [taskDialog, setTaskDialog] = useState<{ open: boolean; editing: Task | null; status: Task["status"] }>({
    open: false, editing: null, status: "todo",
  });
  const [confirmDeleteGoal, setConfirmDeleteGoal] = useState(false);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<Task | null>(null);

  // ─── هوشیار ───
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTab, setAiTab] = useState<"breakdown" | "coaching">("breakdown");
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<Set<number>>(new Set());
  const [aiLoading, setAiLoading] = useState(false);
  const [coaching, setCoaching] = useState<string | null>(null);
  const [coachingLoading, setCoachingLoading] = useState(false);

  // ─── جشن تکمیل (فقط در لحظه‌ی گذر به ۱۰۰٪) ───
  const [celebrate, setCelebrate] = useState(false);
  const prevProgress = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevProgress.current;
    if (prev !== null && goal.progress === 100 && prev < 100 && goal.tasks.length > 0) {
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 4200);
      prevProgress.current = goal.progress;
      return () => clearTimeout(t);
    }
    prevProgress.current = goal.progress;
  }, [goal.progress, goal.tasks.length]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const isMobile = useIsMobile();

  const stats = goalTaskStats(goal);
  const meta = categoryMeta(goal.category);
  const dl = deadlineInfo(goal.deadline, goal.status === "completed");
  const isDone = goal.status === "completed";

  // ═════ درگ‌اند‌دراپ ═════
  const handleDragStart = (event: any) => {
    const { active } = event;
    setActiveDragTask(goal.tasks.find((t) => t.id === active.id) || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = String(active.id);
    const task = goal.tasks.find((t) => t.id === taskId);
    if (!task) return;

    const overId = String(over.id);
    let targetStatus: Task["status"];
    let targetIndex: number;

    if (overId.startsWith("col-")) {
      targetStatus = overId.replace("col-", "") as Task["status"];
      targetIndex = goal.tasks.filter((t) => t.status === targetStatus).length;
    } else {
      const overTask = goal.tasks.find((t) => t.id === overId);
      if (!overTask) return;
      targetStatus = overTask.status;
      targetIndex = overTask.sortOrder;
      if (task.status === targetStatus && task.sortOrder < overTask.sortOrder) {
        targetIndex = Math.max(0, overTask.sortOrder - 1);
      }
    }

    if (task.status === targetStatus && task.sortOrder === targetIndex) return;

    const res = await patch(`/api/tasks/${taskId}`, {
      newStatus: targetStatus,
      newOrder: targetIndex,
    });

    if (res.success) {
      if (targetStatus === "done" && task.status !== "done") {
        toast({ title: "آفرین! 🎉", description: "یک قدم به هدفت نزدیک‌تر شدی" });
      }
      refresh();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
      refresh();
    }
  };

  // ═════ عملیات وظیفه ═════
  const quickAddTask = async () => {
    const title = newTaskTitle.trim();
    if (!title) return;
    setNewTaskTitle("");
    const res = await post("/api/tasks", { goalId: goal.id, title });
    if (res.success) {
      refresh();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const deleteTask = async (taskId: string) => {
    setConfirmDeleteTask(null);
    const res = await del(`/api/tasks/${taskId}`);
    if (res.success) {
      refresh();
      toast({ title: "وظیفه حذف شد" });
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const deleteGoal = async () => {
    setConfirmDeleteGoal(false);
    const res = await del(`/api/goals/${goal.id}`);
    if (res.success) {
      onBack();
      refresh();
      toast({ title: "هدف حذف شد" });
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const toggleArchive = async () => {
    const next = goal.status === "archived" ? "active" : "archived";
    const res = await patch(`/api/goals/${goal.id}`, { status: next });
    if (res.success) {
      if (next === "archived") {
        onArchived?.(goal.title);
        onBack();
      }
      refresh();
      toast({ title: next === "archived" ? "هدف بایگانی شد" : "هدف بازگردانده شد" });
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  // ═════ هوشیار ═════
  const loadSuggestions = useCallback(async () => {
    if (aiLoading) return;
    setAiLoading(true);
    try {
      const res = await post<{ suggestions: Suggestion[] }>(`/api/goals/${goal.id}/ai`, { mode: "breakdown" });
      if (res.success && res.data?.suggestions) {
        setSuggestions(res.data.suggestions);
        setSelectedIdx(new Set(res.data.suggestions.map((_, i) => i)));
      } else {
        toast({ title: "خطا", description: res.error, variant: "destructive" });
      }
    } finally {
      setAiLoading(false);
    }
  }, [goal.id, aiLoading]);

  const loadCoaching = useCallback(async () => {
    if (coachingLoading) return;
    setCoachingLoading(true);
    try {
      const res = await post<{ reply: string }>(`/api/goals/${goal.id}/ai`, { mode: "coaching" });
      if (res.success && res.data?.reply) {
        setCoaching(res.data.reply);
      } else {
        toast({ title: "خطا", description: res.error, variant: "destructive" });
      }
    } finally {
      setCoachingLoading(false);
    }
  }, [goal.id, coachingLoading]);

  const addSelectedSuggestions = async () => {
    const picked = (suggestions || []).filter((_, i) => selectedIdx.has(i));
    if (picked.length === 0) return;
    setAiLoading(true);
    try {
      let added = 0;
      for (const s of picked) {
        const res = await post("/api/tasks", {
          goalId: goal.id,
          title: s.title,
          priority: s.priority,
          ...(s.dueInDays > 0 ? { dueDate: new Date(Date.now() + s.dueInDays * 86400000).toISOString() } : {}),
        });
        if (res.success) added++;
      }
      if (added > 0) {
        toast({ title: `${faNum(added)} وظیفه به کانبان اضافه شد ✨`, description: "پیشنهادهای هوشیار ثبت شد" });
        setSuggestions(null);
        refresh();
      }
    } finally {
      setAiLoading(false);
    }
  };

  // ═════ رندر ═════
  return (
    <div className="p-4 lg:p-0 max-w-6xl mx-auto" dir="rtl">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        {/* ─── هدر هدف ─── */}
        <div className="bg-card rounded-3xl border border-border/60 p-4 sm:p-5 mb-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-1.5" style={{ background: goal.color }} />
          <div
            className="absolute -left-16 -top-16 w-48 h-48 rounded-full opacity-[0.06] blur-2xl"
            style={{ background: goal.color }}
          />

          <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
            <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
              {/* حلقه پیشرفت */}
              <ProgressRing value={goal.progress} size={isMobile ? 60 : 72} stroke={isMobile ? 6 : 7} color={goal.color}>
                <div className="text-center">
                  <p className="text-sm sm:text-base font-black tnum leading-none">{faNum(goal.progress)}٪</p>
                  <p className="text-[8px] text-muted-foreground mt-0.5">پیشرفت</p>
                </div>
              </ProgressRing>

              <div className="flex-1 min-w-0">
                <button
                  onClick={onBack}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mb-1.5 sm:mb-2"
                >
                  <ChevronRight className="w-4 h-4" />
                  همه اهداف
                </button>
                <h2 className="text-lg md:text-2xl font-black flex flex-wrap items-center gap-2">
                  <span className="meta-icon">{meta.emoji}</span>
                  {goal.title}
                  {isDone && (
                    <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 gap-1 text-[10px]">
                      <Trophy className="w-3 h-3" />
                      تکمیل‌شده
                    </Badge>
                  )}
                  {goal.status === "archived" && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Archive className="w-3 h-3" />
                      بایگانی
                    </Badge>
                  )}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-2.5">
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <meta.icon className="w-3 h-3" style={{ color: meta.color }} />
                    {meta.label}
                  </Badge>
                  <Badge className={`text-[10px] ${PRIORITY_COLORS[goal.priority]}`}>
                    <Flag className="w-3 h-3" />
                    {PRIORITIES[goal.priority] || goal.priority}
                  </Badge>
                  {dl && (
                    <Badge variant="outline" className={`text-[10px] gap-1 ${DEADLINE_TONE[dl.tone]}`}>
                      <AlarmClock className="w-3 h-3" />
                      {dl.label}
                    </Badge>
                  )}
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5" />
                    {faNum(stats.done)}/{faNum(stats.total)} وظیفه
                    {stats.overdue > 0 && (
                      <span className="text-rose-500 font-medium">({faNum(stats.overdue)} معوق)</span>
                    )}
                  </span>
                </div>
                {goal.description && (
                  <p className="text-sm text-muted-foreground mt-2.5 leading-relaxed line-clamp-3">{goal.description}</p>
                )}
              </div>
            </div>

            {/* نوار ابزار */}
            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
              <Button
                size="sm" variant="outline"
                onClick={() => setEditGoalOpen(true)}
                className="rounded-xl gap-1.5 h-8 sm:h-9"
              >
                <Pencil className="w-3.5 h-3.5" />
                ویرایش
              </Button>
              {moduleConfig("goals", "enableAIAssist", true) === true && (
                <Button
                  size="sm"
                  onClick={() => { setAiOpen(true); if (aiTab === "breakdown" && !suggestions) loadSuggestions(); if (aiTab === "coaching" && !coaching) loadCoaching(); }}
                  className="shahryar-gradient text-white border-0 rounded-xl gap-1.5 h-8 sm:h-9 font-bold"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  هوشیار
                </Button>
              )}
              <Button
                size="sm" variant="ghost"
                onClick={toggleArchive}
                className="rounded-xl h-8 sm:h-9 text-muted-foreground"
                title={goal.status === "archived" ? "بازگردانی" : "بایگانی"}
              >
                {goal.status === "archived" ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
              </Button>
              <Button
                size="sm" variant="ghost"
                onClick={() => setConfirmDeleteGoal(true)}
                className="text-destructive hover:bg-destructive/10 rounded-xl h-8 sm:h-9"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* آمار وظایف */}
          <div className="grid grid-cols-4 gap-2 mt-4 sm:mt-5">
            {[
              { label: "انجام‌شده", value: stats.done, color: "text-blue-600 dark:text-blue-400" },
              { label: "در حال انجام", value: stats.inProgress, color: "text-amber-600 dark:text-amber-400" },
              { label: "در انتظار", value: stats.todo, color: "text-slate-600 dark:text-slate-400" },
              { label: "معوق", value: stats.overdue, color: stats.overdue > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl bg-muted/50 border border-border/40 px-1.5 sm:px-2 py-2 sm:py-2.5 text-center">
                <p className={`text-base sm:text-lg font-black tnum leading-none ${s.color}`}>{faNum(s.value)}</p>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-1 sm:mt-1.5">{s.label}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground/70 mt-3 text-left">
            آخرین به‌روزرسانی: {faRelative(goal.updatedAt)}
          </p>
        </div>

        {/* ─── بنر تکمیل ─── */}
        {isDone && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-3xl border border-primary/30 bg-primary/5 p-4 mb-4 flex items-center gap-3"
          >
            <div className="w-11 h-11 rounded-2xl shahryar-gradient flex items-center justify-center shrink-0">
              <PartyPopper className="w-5.5 h-5.5 text-white" style={{ width: 22, height: 22 }} />
            </div>
            <div className="flex-1">
              <p className="font-black text-sm">این هدف کامل شد! 🎉</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {goal.completedAt ? `تکمیل در ${faDate(goal.completedAt)} — ` : ""}
                برای تمرکز روی اهداف بعدی، می‌توانی آن را بایگانی کنی.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={toggleArchive} className="rounded-xl gap-1.5 shrink-0 h-9">
              <Archive className="w-3.5 h-3.5" />
              بایگانی
            </Button>
          </motion.div>
        )}

        {/* ─── افزودن سریع وظیفه ─── */}
        <div className="flex gap-2 mb-4">
          <Input
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && quickAddTask()}
            placeholder="وظیفه جدید... (Enter برای ثبت سریع)"
            className="h-11 rounded-xl text-sm bg-accent/40 border-border/70"
          />
          <Button
            variant="outline"
            onClick={() => setTaskDialog({ open: true, editing: null, status: "todo" })}
            className="rounded-xl h-11 px-3 sm:px-4 shrink-0 gap-1.5"
            title="با جزئیات (اولویت، موعد، توضیح)"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">با جزئیات</span>
          </Button>
          <Button
            onClick={quickAddTask}
            disabled={!newTaskTitle.trim()}
            className="shahryar-gradient text-white border-0 hover:opacity-90 rounded-xl h-11 px-4 sm:px-5"
          >
            افزودن
          </Button>
        </div>

        {/* ─── پنل هوشیار ─── */}
        <AnimatePresence>
          {aiOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="overflow-hidden mb-4"
            >
              <div className="rounded-3xl border border-primary/25 bg-gradient-to-bl from-primary/[0.07] to-transparent p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl shahryar-gradient flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <p className="font-black text-sm">همراهِ هدف — هوشیار</p>
                  </div>
                  <button onClick={() => setAiOpen(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-lg">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* تب‌های هوشیار */}
                <div className="flex gap-1.5 mb-3 p-1 bg-card/70 rounded-xl border border-border/50">
                  {[
                    { id: "breakdown" as const, label: "تفکیک هوشمند وظایف", icon: Layers },
                    { id: "coaching" as const, label: "تحلیل و مربی‌گری", icon: MessageCircleQuestion },
                  ].map((t) => {
                    const active = aiTab === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => {
                          setAiTab(t.id);
                          if (t.id === "breakdown" && !suggestions) loadSuggestions();
                          if (t.id === "coaching" && !coaching) loadCoaching();
                        }}
                        className={`relative flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                          active ? "text-white" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {active && (
                          <motion.span layoutId="goal-ai-tab" className="absolute inset-0 rounded-lg shahryar-gradient" />
                        )}
                        <t.icon className="w-3.5 h-3.5 relative z-10" />
                        <span className="relative z-10">{t.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* محتوای تفکیک */}
                {aiTab === "breakdown" && (
                  <div>
                    {aiLoading && !suggestions ? (
                      <div className="space-y-2 py-2">
                        {[...Array(5)].map((_, i) => (
                          <Skeleton key={i} className="h-12 rounded-xl" />
                        ))}
                      </div>
                    ) : suggestions ? (
                      <>
                        <div className="space-y-2 max-h-72 overflow-y-auto pl-1">
                          {suggestions.map((s, i) => {
                            const checked = selectedIdx.has(i);
                            return (
                              <motion.button
                                key={i}
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                onClick={() => {
                                  setSelectedIdx((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(i)) next.delete(i);
                                    else next.add(i);
                                    return next;
                                  });
                                }}
                                className={`w-full flex items-center gap-3 rounded-xl border p-3 text-right transition-all ${
                                  checked ? "border-primary/40 bg-primary/5" : "border-border/50 bg-card/60 opacity-60"
                                }`}
                              >
                                <Checkbox checked={checked} className="pointer-events-none" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium line-clamp-1">{s.title}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${PRIORITY_COLORS[s.priority]}`}>
                                      {PRIORITIES[s.priority] || s.priority}
                                    </span>
                                    {s.dueInDays > 0 && (
                                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                        <CalendarDays className="w-3 h-3" />
                                        تا {faNum(s.dueInDays)} روز آینده
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </motion.button>
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <Button
                            onClick={addSelectedSuggestions}
                            disabled={selectedIdx.size === 0 || aiLoading}
                            className="shahryar-gradient text-white border-0 rounded-xl font-bold flex-1"
                          >
                            {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            افزودن {faNum(selectedIdx.size)} وظیفه به کانبان
                          </Button>
                          <Button variant="outline" onClick={loadSuggestions} disabled={aiLoading} className="rounded-xl" title="پیشنهاد تازه">
                            <Sparkles className="w-4 h-4" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">روی «تفکیک دوباره» بزن</p>
                    )}
                  </div>
                )}

                {/* محتوای مربی‌گری */}
                {aiTab === "coaching" && (
                  <div>
                    {coachingLoading ? (
                      <div className="space-y-2 py-2">
                        <Skeleton className="h-6 w-1/3 rounded-lg" />
                        <Skeleton className="h-20 rounded-xl" />
                        <Skeleton className="h-16 rounded-xl" />
                        <Skeleton className="h-20 rounded-xl" />
                      </div>
                    ) : coaching ? (
                      <>
                        <div className="rounded-2xl bg-card border border-border/50 p-4 text-sm leading-7 prose-sm prose-p:my-1.5 prose-headings:text-base prose-headings:font-bold prose-headings:mt-3 prose-headings:mb-1.5 prose-ul:my-1.5 prose-li:my-0.5">
                          <ReactMarkdown
                            components={{
                              h2: (props) => <h2 className="text-sm font-black mt-3 mb-1.5" {...props} />,
                              h3: (props) => <h3 className="text-[13px] font-bold mt-2.5 mb-1" {...props} />,
                              p: (props) => <p className="my-1.5" {...props} />,
                              ul: (props) => <ul className="list-disc pr-5 my-1.5 space-y-0.5" {...props} />,
                              ol: (props) => <ol className="list-decimal pr-5 my-1.5 space-y-0.5" {...props} />,
                              li: (props) => <li className="text-[13px] leading-6" {...props} />,
                              strong: (props) => <strong className="font-bold text-foreground" {...props} />,
                            }}
                          >
                            {coaching}
                          </ReactMarkdown>
                        </div>
                        <Button variant="outline" onClick={loadCoaching} disabled={coachingLoading} className="rounded-xl mt-3 w-full gap-1.5">
                          <Sparkles className="w-4 h-4" />
                          تحلیل تازه
                        </Button>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">روی «تحلیل تازه» بزن</p>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── کانبان ─── */}
        <DndContext
          sensors={sensors}
          collisionDetection={kanbanCollisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* موبایل: اسکرول افقی — دسکتاپ: ۳ ستون */}
          <div className="flex md:grid md:grid-cols-3 gap-3 overflow-x-auto md:overflow-visible no-scrollbar pb-2 md:pb-0 snap-x md:snap-none">
            {COLUMNS.map((col) => {
              const colTasks = goal.tasks
                .filter((t) => t.status === col.id)
                .sort((a, b) => a.sortOrder - b.sortOrder);
              return (
                <div
                  key={col.id}
                  className={`snap-start shrink-0 w-[78vw] sm:w-[60vw] md:w-auto bg-muted/40 rounded-2xl border border-t-4 ${col.color} border-x-border/50 border-b-border/50 p-2.5 sm:p-3`}
                >
                  <div className="flex items-center gap-2 px-1 pb-3">
                    <col.icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-bold">{col.label}</span>
                    <span className="text-xs text-muted-foreground mr-auto tnum bg-accent rounded-lg px-2 py-0.5">
                      {faNum(colTasks.length)}
                    </span>
                    {col.id === "todo" && (
                      <button
                        onClick={() => setTaskDialog({ open: true, editing: null, status: "todo" })}
                        className="text-muted-foreground hover:text-primary transition-colors"
                        title="وظیفه جدید در این ستون"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <SortableContext items={colTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                    <DroppableColumn id={`col-${col.id}`}>
                      {colTasks.map((task) => (
                        <SortableTaskCard
                          key={task.id}
                          task={task}
                          goalColor={goal.color}
                          onEdit={() => setTaskDialog({ open: true, editing: task, status: task.status })}
                          onDelete={() => setConfirmDeleteTask(task)}
                        />
                      ))}
                      {colTasks.length === 0 && (
                        <div className="text-center text-xs text-muted-foreground/60 py-6 border-2 border-dashed border-border/50 rounded-xl">
                          کارتی اینجا رها کن
                        </div>
                      )}
                    </DroppableColumn>
                  </SortableContext>
                </div>
              );
            })}
          </div>

          <DragOverlay>
            {activeDragTask && (
              <div className="bg-card border-2 border-primary/50 rounded-xl p-3 shadow-xl rotate-2 max-w-full">
                <p className="text-sm font-medium line-clamp-2">{activeDragTask.title}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </motion.div>

      {/* ─── دیالوگ‌ها ─── */}
      <GoalFormDialog
        open={editGoalOpen}
        onClose={() => setEditGoalOpen(false)}
        onSaved={refresh}
        editing={goal}
      />
      <TaskFormDialog
        open={taskDialog.open}
        onClose={() => setTaskDialog((s) => ({ ...s, open: false }))}
        onSaved={refresh}
        goalId={goal.id}
        editing={taskDialog.editing}
        defaultStatus={taskDialog.status}
      />

      <AlertDialog open={confirmDeleteGoal} onOpenChange={setConfirmDeleteGoal}>
        <AlertDialogContent dir="rtl" className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              حذف هدف
            </AlertDialogTitle>
            <AlertDialogDescription>
              هدف «{goal.title}» و همه‌ی {faNum(goal.tasks.length)} وظیفه‌ی آن برای همیشه حذف می‌شود. این عمل قابل بازگشت نیست!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteGoal}
              className="rounded-xl bg-destructive text-white hover:bg-destructive/90"
            >
              حذف قطعی
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDeleteTask} onOpenChange={(o) => !o && setConfirmDeleteTask(null)}>
        <AlertDialogContent dir="rtl" className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              حذف وظیفه
            </AlertDialogTitle>
            <AlertDialogDescription>
              «{confirmDeleteTask?.title}» حذف شود؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDeleteTask && deleteTask(confirmDeleteTask.id)}
              className="rounded-xl bg-destructive text-white hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── جشن تکمیل ─── */}
      <AnimatePresence>
        {celebrate && <Celebration goalTitle={goal.title} />}
      </AnimatePresence>
    </div>
  );
}

// ═════ ستون قابل رهاکردن ═════
function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`space-y-2 min-h-24 kanban-column rounded-xl transition-all ${
        isOver ? "bg-primary/5 ring-2 ring-primary/30" : ""
      }`}
    >
      {children}
    </div>
  );
}

// ═════ کارت وظیفه قابل مرتب‌سازی — نسخه ۲ ═════
function SortableTaskCard({
  task, goalColor, onEdit, onDelete,
}: {
  task: Task; goalColor: string; onEdit: () => void; onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const now = new Date();
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = due && due < now && task.status !== "done";
  const isDone = task.status === "done";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-card border border-border/60 rounded-xl p-3 shadow-sm group ${
        isDone ? "opacity-70" : ""
      } ${isDragging ? "opacity-40 dragging" : ""} ${isOverdue ? "border-rose-500/40" : ""}`}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing mt-0.5 touch-none"
          title="جابجایی"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0">
          <p className={`text-sm leading-relaxed line-clamp-3 ${isDone ? "line-through text-muted-foreground" : ""}`}>
            {task.title}
          </p>
          {task.description && (
            <p className="text-[11px] text-muted-foreground/70 mt-1 line-clamp-2 leading-5">{task.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${PRIORITY_COLORS[task.priority]}`}>
              {PRIORITIES[task.priority] || task.priority}
            </span>
            {due && (
              <span
                className={`text-[10px] flex items-center gap-0.5 px-1.5 py-0.5 rounded-md ${
                  isOverdue
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium"
                    : isDone
                    ? "text-muted-foreground"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                }`}
              >
                <CalendarDays className="w-3 h-3" />
                {faDate(due)}
                {isOverdue ? " ⚠" : ""}
              </span>
            )}
            <span className="w-2 h-2 rounded-full mr-auto" style={{ background: goalColor }} />
          </div>
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="md:opacity-0 md:group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all p-1 rounded-md"
            title="ویرایش"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="md:opacity-0 md:group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1 rounded-md"
            title="حذف"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ═════ جشن تکمیل هدف — ذرات انیمیشنی ═════
function Celebration({ goalTitle }: { goalTitle: string }) {
  const pieces = Array.from({ length: 42 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.6,
    duration: 2 + Math.random() * 1.6,
    color: ["#2563eb", "#e11d48", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899"][i % 6],
    size: 6 + Math.random() * 8,
    rotate: Math.random() * 360,
  }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] pointer-events-none flex items-center justify-center"
    >
      {/* ذرات کاغذی */}
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ y: "-10vh", x: `${p.x - 50}vw`, opacity: 1, rotate: 0 }}
          animate={{ y: "110vh", x: `${p.x - 50 + (Math.random() * 20 - 10)}vw`, opacity: [1, 1, 0.8, 0], rotate: p.rotate + 360 }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
          className="absolute rounded-sm"
          style={{ width: p.size, height: p.size * 0.5, background: p.color }}
        />
      ))}

      {/* کارت تبریک */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: "spring", bounce: 0.5 }}
        className="bg-card border-2 border-primary/40 rounded-3xl p-8 mx-4 shadow-2xl text-center max-w-sm"
        dir="rtl"
      >
        <motion.div
          animate={{ rotate: [0, -10, 10, -8, 8, 0] }}
          transition={{ duration: 1.2, repeat: 1 }}
          className="w-20 h-20 mx-auto rounded-3xl shahryar-gradient flex items-center justify-center shadow-lg mb-4"
        >
          <Trophy className="w-10 h-10 text-white" />
        </motion.div>
        <h3 className="text-lg md:text-2xl font-black">هدف کامل شد! 🎉</h3>
        <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
          «{goalTitle}» به‌طور کامل انجام شد.
          <br />
          هر قدمِ کوچک، نتیجه‌ی تصمیم‌های امروزِ توست. به خودت افتخار کن!
        </p>
      </motion.div>
    </motion.div>
  );
}
