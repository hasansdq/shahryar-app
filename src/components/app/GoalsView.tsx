// ═════ اهداف من — کانبان حرفه‌ای با درگ‌اند‌دراپ ═════
"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext, DragEndEvent, PointerSensor, useSensor, useSensors,
  DragOverlay, useDroppable, pointerWithin, rectIntersection,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Target, Plus, Trash2, CheckCircle2, Clock, Circle, GripVertical,
  ChevronRight, ArrowRight, Flag, CalendarDays, Trophy, Layers, X, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { get, post, patch, del } from "@/lib/client/api";
import { faNum, faDate, LABELS, PRIORITY_COLORS } from "@/lib/client/persian";
import JalaliDatePicker from "@/components/ui/jalali-date-picker";
import { toast } from "@/hooks/use-toast";

interface Task {
  id: string;
  goalId: string;
  title: string;
  status: "todo" | "in_progress" | "done";
  sortOrder: number;
  priority: string;
}
interface Goal {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  progress: number;
  color: string;
  deadline: string | null;
  createdAt: string;
  tasks: Task[];
}
interface GoalsData {
  goals: Goal[];
  stats: {
    goalsCount: number; activeCount: number; completedCount: number;
    totalTasks: number; doneTasks: number;
  };
}

const COLUMNS: Array<{ id: Task["status"]; label: string; icon: typeof Circle; color: string }> = [
  { id: "todo", label: "در انتظار انجام", icon: Circle, color: "border-t-slate-400" },
  { id: "in_progress", label: "در حال انجام", icon: Clock, color: "border-t-amber-500" },
  { id: "done", label: "انجام‌شده", icon: CheckCircle2, color: "border-t-blue-500" },
];

/**
 * تشخیص برخورد: اولویت با محتوای زیر نشانگر، سپس تقاطع مستطیل‌ها
 * (الگوی رسمی پیشنهادی dnd-kit برای کانبان)
 */
function kanbanCollisionDetection(args: Parameters<NonNullable<import("@dnd-kit/core").DndContextProps["collisionDetection"]>>[0]) {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }
  return rectIntersection(args);
}

export default function GoalsView() {
  const [data, setData] = useState<GoalsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [taskGoalId, setTaskGoalId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [activeDragTask, setActiveDragTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const [reloadKey, setReloadKey] = useState(0);
  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await get<GoalsData>("/api/goals");
      if (!active) return;
      if (res.success && res.data) {
        setData(res.data);
        // به‌روزرسانی هدف انتخاب‌شده با الگوی تابعی (بدون وابستگی به state)
        setSelectedGoal((prev) => {
          if (!prev) return prev;
          return res.data!.goals.find((g) => g.id === prev.id) || null;
        });
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  // ═════ درگ‌اند‌دراپ ═════
  const handleDragStart = (event: any) => {
    const { active } = event;
    const task = selectedGoal?.tasks.find((t) => t.id === active.id);
    setActiveDragTask(task || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragTask(null);
    const { active, over } = event;
    if (!over || !selectedGoal) return;

    const taskId = String(active.id);
    const task = selectedGoal.tasks.find((t) => t.id === taskId);
    if (!task) return;

    // تعیین ستون مقصد
    const overId = String(over.id);
    let targetStatus: Task["status"];
    let targetIndex: number;

    if (overId.startsWith("col-")) {
      targetStatus = overId.replace("col-", "") as Task["status"];
      targetIndex = selectedGoal.tasks.filter((t) => t.status === targetStatus).length;
    } else {
      const overTask = selectedGoal.tasks.find((t) => t.id === overId);
      if (!overTask) return;
      targetStatus = overTask.status;
      targetIndex = overTask.sortOrder;
      if (task.status === targetStatus && task.sortOrder < overTask.sortOrder) {
        targetIndex = Math.max(0, overTask.sortOrder - 1);
      }
    }

    if (task.status === targetStatus && task.sortOrder === targetIndex) return;

    // بهینه‌سازی UI — جابجایی فوری
    const updatedTasks = selectedGoal.tasks.map((t) =>
      t.id === taskId ? { ...t, status: targetStatus } : t
    );
    setSelectedGoal({ ...selectedGoal, tasks: updatedTasks });

    const res = await patch(`/api/tasks/${taskId}`, {
      newStatus: targetStatus,
      newOrder: targetIndex,
    });

    if (res.success) {
      refresh();
      if (targetStatus === "done") {
        toast({ title: "آفرین! 🎉", description: "یک قدم به هدفت نزدیک‌تر شدی" });
      }
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
      refresh();
    }
  };

  // ═════ عملیات ═════
  const addTask = async () => {
    if (!newTaskTitle.trim() || !taskGoalId) return;
    const res = await post("/api/tasks", { goalId: taskGoalId, title: newTaskTitle.trim() });
    if (res.success) {
      setNewTaskTitle("");
      refresh();
      toast({ title: "وظیفه اضافه شد" });
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const deleteTask = async (taskId: string) => {
    const res = await del(`/api/tasks/${taskId}`);
    if (res.success) refresh();
  };

  const deleteGoal = async (goalId: string) => {
    const res = await del(`/api/goals/${goalId}`);
    if (res.success) {
      setSelectedGoal(null);
      refresh();
      toast({ title: "هدف حذف شد" });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4 md:p-0 max-w-5xl mx-auto">
        <Skeleton className="h-28 rounded-3xl" />
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-48 rounded-3xl" />
          <Skeleton className="h-48 rounded-3xl" />
        </div>
      </div>
    );
  }

  // ═════ نمایش کانبان هدف انتخاب‌شده ═════
  if (selectedGoal) {
    return (
      <div className="p-4 md:p-0 max-w-6xl mx-auto" dir="rtl">
        <AnimatePresence>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            {/* هدر هدف */}
            <div className="bg-card rounded-3xl border border-border/60 p-5 mb-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 left-0 h-1.5" style={{ background: selectedGoal.color }} />
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => setSelectedGoal(null)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mb-2"
                  >
                    <ChevronRight className="w-4 h-4" />
                    همه اهداف
                  </button>
                  <h2 className="text-xl font-black flex items-center gap-2">
                    {selectedGoal.title}
                    <Badge className={`text-[10px] ${PRIORITY_COLORS[selectedGoal.priority]}`}>
                      {LABELS.priorities[selectedGoal.priority]}
                    </Badge>
                  </h2>
                  {selectedGoal.description && (
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{selectedGoal.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {selectedGoal.deadline && (
                    <Badge variant="outline" className="gap-1.5 text-xs">
                      <CalendarDays className="w-3.5 h-3.5" />
                      {faDate(selectedGoal.deadline)}
                    </Badge>
                  )}
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => deleteGoal(selectedGoal.id)}
                    className="text-destructive hover:bg-destructive/10 rounded-xl"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground text-xs">پیشرفت کلی</span>
                  <span className="font-black tnum" style={{ color: selectedGoal.color }}>
                    {faNum(selectedGoal.progress)}٪
                  </span>
                </div>
                <Progress value={selectedGoal.progress} className="h-2.5" />
              </div>
            </div>

            {/* افزودن وظیفه */}
            <div className="flex gap-2 mb-4">
              <Input
                value={newTaskTitle}
                onChange={(e) => { setNewTaskTitle(e.target.value); setTaskGoalId(selectedGoal.id); }}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
                placeholder="وظیفه جدیدی به این هدف اضافه کنید..."
                className="h-11 rounded-xl"
              />
              <Button
                onClick={addTask}
                disabled={!newTaskTitle.trim()}
                className="shahryar-gradient text-white border-0 hover:opacity-90 rounded-xl h-11 px-5"
              >
                <Plus className="w-4 h-4" />
                افزودن
              </Button>
            </div>

            {/* کانبان */}
            <DndContext
              sensors={sensors}
              collisionDetection={kanbanCollisionDetection}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {COLUMNS.map((col) => {
                  const colTasks = selectedGoal.tasks
                    .filter((t) => t.status === col.id)
                    .sort((a, b) => a.sortOrder - b.sortOrder);
                  return (
                    <div
                      key={col.id}
                      className={`bg-muted/40 rounded-2xl border border-t-4 ${col.color} border-x-border/50 border-b-border/50 p-3`}
                    >
                      <div className="flex items-center gap-2 px-1 pb-3">
                        <col.icon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-bold">{col.label}</span>
                        <span className="text-xs text-muted-foreground mr-auto tnum bg-accent rounded-lg px-2 py-0.5">
                          {faNum(colTasks.length)}
                        </span>
                      </div>
                      <SortableContext items={colTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                        <DroppableColumn id={`col-${col.id}`}>
                          {colTasks.map((task) => (
                            <SortableTaskCard
                              key={task.id}
                              task={task}
                              goalColor={selectedGoal.color}
                              onDelete={deleteTask}
                            />
                          ))}
                          {colTasks.length === 0 && (
                            <div className="text-center text-xs text-muted-foreground/60 py-6 border-2 border-dashed border-border/50 rounded-xl">
                              کارتی اینجا رها کنید
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
        </AnimatePresence>
      </div>
    );
  }

  // ═════ لیست اهداف ═════
  const stats = data?.stats;

  return (
    <div className="p-4 md:p-0 max-w-5xl mx-auto space-y-5" dir="rtl">
      {/* هدر و آمار */}
      <div className="shahryar-gradient rounded-3xl p-6 text-white relative overflow-hidden">
        <div className="pattern-dots absolute inset-0 opacity-25" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black flex items-center gap-2">
              <Target className="w-7 h-7" />
              اهداف من
            </h2>
            <p className="text-blue-50/80 text-sm mt-2">
              برنامه‌ریزی هوشمند برای رسیدن به خواسته‌هات
            </p>
          </div>
          <div className="flex gap-5 text-center">
            <div>
              <p className="text-3xl font-black tnum">{faNum(stats?.activeCount ?? 0)}</p>
              <p className="text-xs text-blue-100/70 mt-1">فعال</p>
            </div>
            <div className="w-px bg-white/20" />
            <div>
              <p className="text-3xl font-black tnum">{faNum(stats?.completedCount ?? 0)}</p>
              <p className="text-xs text-blue-100/70 mt-1">تکمیل‌شده</p>
            </div>
            <div className="w-px bg-white/20" />
            <div>
              <p className="text-3xl font-black tnum">
                {faNum(stats?.doneTasks ?? 0)}/{faNum(stats?.totalTasks ?? 0)}
              </p>
              <p className="text-xs text-blue-100/70 mt-1">وظایف</p>
            </div>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-white text-blue-800 hover:bg-blue-50 font-bold rounded-xl h-11 px-5 shadow-lg border-0"
          >
            <Plus className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
            هدف جدید
          </Button>
        </div>
      </div>

      {/* لیست اهداف */}
      {data?.goals?.length ? (
        <div className="grid md:grid-cols-2 gap-4">
          <AnimatePresence>
            {data.goals.map((goal) => {
              const doneCount = goal.tasks.filter((t) => t.status === "done").length;
              return (
                <motion.div
                  key={goal.id}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                >
                  <button
                    onClick={() => setSelectedGoal(goal)}
                    className="w-full text-right bg-card rounded-3xl border border-border/60 p-5 hover:shadow-lg hover:border-primary/40 transition-all group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-1.5 h-full" style={{ background: goal.color }} />
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-black text-lg group-hover:text-primary transition-colors">
                            {goal.title}
                          </h3>
                          {goal.status === "completed" && (
                            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 gap-1 text-[10px]">
                              <Trophy className="w-3 h-3" />
                              تکمیل‌شده
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-2.5">
                          <Badge variant="outline" className="text-[10px]">
                            {LABELS.goalCategories[goal.category]}
                          </Badge>
                          <Badge className={`text-[10px] ${PRIORITY_COLORS[goal.priority]}`}>
                            <Flag className="w-3 h-3" />
                            {LABELS.priorities[goal.priority]}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5" />
                            {faNum(doneCount)}/{faNum(goal.tasks.length)} وظیفه
                          </span>
                          {goal.deadline && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <CalendarDays className="w-3.5 h-3.5" />
                              {faDate(goal.deadline)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-center">
                        <p className="text-2xl font-black tnum" style={{ color: goal.color }}>
                          {faNum(goal.progress)}٪
                        </p>
                      </div>
                    </div>
                    <Progress value={goal.progress} className="h-2 mt-4" />
                    <div className="flex items-center gap-1 text-xs text-primary font-medium mt-3">
                      مشاهده کانبان
                      <ArrowRight className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    </div>
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        <div className="text-center py-16 bg-card rounded-3xl border-2 border-dashed border-border">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="w-20 h-20 mx-auto rounded-3xl shahryar-gradient flex items-center justify-center shadow-lg mb-4"
          >
            <Target className="w-10 h-10 text-white" />
          </motion.div>
          <h3 className="font-black text-xl">سفرت رو شروع کن!</h3>
          <p className="text-muted-foreground text-sm mt-2 max-w-sm mx-auto leading-relaxed">
            اولین هدفت رو بساز تا با کانبان حرفه‌ای و همراهی هوشیار، قدم‌به‌قدم بهش برسی
          </p>
          <Button
            onClick={() => setCreateOpen(true)}
            className="mt-5 shahryar-gradient text-white border-0 rounded-xl font-bold px-6"
          >
            <Plus className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
            ساخت اولین هدف
          </Button>
        </div>
      )}

      {/* ═════ دیالوگ ساخت هدف ═════ */}
      <CreateGoalDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={refresh} />
    </div>
  );
}

// ═════ ستون قابل رهاکردن کانبان ═════
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

// ═════ کارت وظیفه قابل مرتب‌سازی ═════
function SortableTaskCard({
  task, goalColor, onDelete,
}: {
  task: Task; goalColor: string; onDelete: (id: string) => void;
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-card border border-border/60 rounded-xl p-3 shadow-sm group ${
        isDragging ? "opacity-40 dragging" : ""
      }`}
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
        <p className="flex-1 text-sm leading-relaxed line-clamp-3">{task.title}</p>
        <button
          onClick={() => onDelete(task.id)}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1 rounded-md"
          title="حذف"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-1.5 mt-2 pr-6">
        <span className="w-2 h-2 rounded-full" style={{ background: goalColor }} />
        <span className="text-[10px] text-muted-foreground">{LABELS.priorities[task.priority]}</span>
      </div>
    </div>
  );
}

// ═════ دیالوگ ساخت هدف ═════
function CreateGoalDialog({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("personal");
  const [priority, setPriority] = useState("medium");
  const [deadline, setDeadline] = useState("");
  const [tasksText, setTasksText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const GOAL_COLORS: Record<string, string> = {
    personal: "#0e8a5a", health: "#e11d48", career: "#7c3aed",
    education: "#0891b2", financial: "#d97706", family: "#db2777",
  };

  const submit = async () => {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    const tasks = tasksText.split("\n").map((t) => t.trim()).filter(Boolean);
    const res = await post("/api/goals", {
      title: title.trim(),
      description: description.trim() || null,
      category,
      priority,
      color: GOAL_COLORS[category],
      deadline: deadline || null,
      tasks,
    });
    setSubmitting(false);
    if (res.success) {
      toast({ title: "هدف ساخته شد! 🎯", description: "حالا وظایفش رو تو کانبان جابجا کن" });
      setTitle(""); setDescription(""); setTasksText(""); setDeadline("");
      setCategory("personal"); setPriority("medium");
      onCreated();
      onClose();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={open ? undefined : onClose}>
      <DialogContent className="rounded-3xl max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Target className="w-6 h-6 text-primary" />
            هدف جدید
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>عنوان هدف *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: یادگیری زبان انگلیسی"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label>توضیحات</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="چرا این هدف برات مهمه؟"
              className="rounded-xl min-h-20"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>دسته‌بندی</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LABELS.goalCategories).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>اولویت</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LABELS.priorities).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>مهلت (اختیاری)</Label>
            <JalaliDatePicker
              value={deadline}
              onChange={setDeadline}
              placeholder="انتخاب مهلت با تقویم جلالی"
            />
          </div>
          <div className="space-y-2">
            <Label>وظایف اولیه (هر خط یک وظیفه)</Label>
            <Textarea
              value={tasksText}
              onChange={(e) => setTasksText(e.target.value)}
              placeholder={"ثبت‌نام در کلاس\nخرید کتاب آموزشی\nروزی ۳۰ دقیقه تمرین"}
              className="rounded-xl min-h-24"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="rounded-xl">انصراف</Button>
          <Button
            onClick={submit}
            disabled={!title.trim() || submitting}
            className="shahryar-gradient text-white border-0 rounded-xl font-bold min-w-28"
          >
            {submitting ? "در حال ساخت..." : "ساخت هدف"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
