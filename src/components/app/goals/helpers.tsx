// ═════ ابزارهای مشترک ماژول اهداف — نمایش، شمارش معکوس، متادیتا ═════
"use client";

import {
  Target, Heart, Briefcase, GraduationCap, Wallet, Users, Sparkles, Flame,
  TrendingUp, CalendarClock, PartyPopper,
} from "lucide-react";
import { faNum, LABELS } from "@/lib/client/persian";
import { useAppStore } from "@/lib/client/store";
import { iconOf } from "@/lib/client/iconRegistry";

// ─── انواع مشترک کلاینت ───
export interface Task {
  id: string;
  goalId: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done";
  sortOrder: number;
  priority: string;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
}
export interface Goal {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  progress: number;
  color: string;
  deadline: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tasks: Task[];
}
export interface GoalsData {
  goals: Goal[];
  stats: {
    goalsCount: number; activeCount: number; completedCount: number; archivedCount: number;
    totalTasks: number; doneTasks: number;
  };
}

// ─── متادیتای دسته‌بندی‌ها ───
export const CATEGORY_META: Record<
  string, { label: string; icon: typeof Target; color: string; emoji: string; tint: string }
> = {
  personal: { label: "شخصی", icon: Target, color: "#0e8a5a", emoji: "🌱", tint: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  health: { label: "سلامت", icon: Heart, color: "#e11d48", emoji: "💪", tint: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  career: { label: "شغلی", icon: Briefcase, color: "#7c3aed", emoji: "💼", tint: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  education: { label: "تحصیلی", icon: GraduationCap, color: "#0891b2", emoji: "🎓", tint: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" },
  financial: { label: "مالی", icon: Wallet, color: "#d97706", emoji: "💰", tint: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  family: { label: "خانوادگی", icon: Users, color: "#db2777", emoji: "👨‍👩‍👧", tint: "bg-pink-500/10 text-pink-600 dark:text-pink-400" },
};

export function categoryMeta(cat: string) {
  // اولویت با دسته‌بندی‌های داینامیک CMS (فارسی/رنگ/آیکن دلخواه مدیر)
  const dyn = useAppStore.getState().goalCategories.find((c) => c.key === cat);
  if (dyn) {
    return {
      label: dyn.name,
      icon: iconOf(dyn.icon),
      color: dyn.color,
      emoji: "",
      tint: "bg-primary/10 text-primary dark:text-primary-foreground/90",
    };
  }
  return CATEGORY_META[cat] || { ...CATEGORY_META.personal, label: cat };
}

// ─── شمارش معکوس مهلت ───
export interface DeadlineInfo {
  left: number; // روز باقیمانده (منفی = گذشته)
  label: string;
  tone: "danger" | "warn" | "ok" | "done";
}

/** اطلاعات شمارش معکوس مهلت هدف */
export function deadlineInfo(deadline: string | null, isCompleted: boolean): DeadlineInfo | null {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (isNaN(d.getTime())) return null;
  if (isCompleted) return { left: 0, label: "تکمیل‌شده", tone: "done" };

  const now = new Date();
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const left = Math.round((a - b) / 86400000);

  if (left < 0) {
    return { left, label: `${faNum(Math.abs(left))} روز تأخیر`, tone: "danger" };
  }
  if (left === 0) return { left, label: "مهلت امروز است!", tone: "danger" };
  if (left === 1) return { left, label: "فردا مهلت است", tone: "warn" };
  if (left <= 7) return { left, label: `${faNum(left)} روز مانده`, tone: "warn" };
  return { left, label: `${faNum(left)} روز مانده`, tone: "ok" };
}

export const DEADLINE_TONE: Record<DeadlineInfo["tone"], string> = {
  danger: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  warn: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  ok: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  done: "bg-primary/10 text-primary border-primary/20",
};

// ─── آمار سریع یک هدف ───
export function goalTaskStats(goal: Goal) {
  const done = goal.tasks.filter((t) => t.status === "done").length;
  const inProgress = goal.tasks.filter((t) => t.status === "in_progress").length;
  const now = new Date();
  const overdue = goal.tasks.filter((t) => t.dueDate && new Date(t.dueDate) < now && t.status !== "done").length;
  return { total: goal.tasks.length, done, inProgress, todo: goal.tasks.length - done - inProgress, overdue };
}

// ─── مرتب‌سازی اولویت (بحرانی → کم) ───
const PRIO_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
export function priorityRank(p: string): number {
  return PRIO_ORDER[p] ?? 2;
}

// ─── حلقه پیشرفت SVG ───
export function ProgressRing({
  value, size = 64, stroke = 6, color = "var(--color-primary)", track = "hsl(var(--muted))", children,
}: {
  value: number; size?: number; stroke?: number; color?: string; track?: string; children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(100, Math.max(0, value)) / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

// ─── آیکن‌های سرتیتر بخش ───
export const SECTION_ICONS = { Sparkles, Flame, TrendingUp, CalendarClock, PartyPopper };

// ─── برچسب وضعیت/اولویت از LABELS مشترک ───
export const PRIORITIES = LABELS.priorities;
