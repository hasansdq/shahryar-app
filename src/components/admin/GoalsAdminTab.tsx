// ═════ اهداف کاربران — تحلیل + دسته‌بندی‌ها + مرورگر/مودریشن ═════
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Target, Trophy, ListTodo, AlertCircle, FolderTree, Plus, Pencil, Trash2,
  Archive, ArchiveRestore, Eye, ChevronRight, ChevronLeft, Search, Users,
  CalendarClock, CheckCircle2, Loader2, Flame,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import AppDialog from "@/components/ui/app-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { get, post, patch, del } from "@/lib/client/api";
import { faNum, faDate, faRelative, LABELS } from "@/lib/client/persian";
import { iconOf, ICON_REGISTRY } from "@/lib/client/iconRegistry";
import { toast } from "@/hooks/use-toast";

// ─── انواع ───

interface Analytics {
  totals: {
    goalsTotal: number; activeCount: number; completedCount: number; archivedCount: number;
    completionRate: number; tasksTotal: number; tasksDone: number; tasksInProgress: number;
    avgActiveProgress: number; staleGoals: number; dueSoon: number; overdueDeadlines: number;
  };
  byCategory: Array<{ category: string; count: number; completed: number; avgProgress: number }>;
  byPriority: Array<{ priority: string; count: number }>;
  completedByMonth: Array<{ monthKey: string; label: string; count: number }>;
  perUser: Array<{
    userId: string; name: string; phone: string; total: number; active: number;
    completed: number; avgActiveProgress: number; lastUpdate: string;
  }>;
}

interface GoalCategoryRow {
  id: string; key: string; name: string; icon: string; color: string;
  sortOrder: number; isActive: boolean; usage: number;
}

interface GoalRow {
  id: string; title: string; description: string | null; category: string;
  priority: string; status: string; progress: number; color: string;
  deadline: string | null; completedAt: string | null; createdAt: string; updatedAt: string;
  tasksCount: number; doneTasks: number;
  user: { id: string; fullName: string | null; phone: string; status: string };
}

interface BrowserData {
  items: GoalRow[];
  pagination: { page: number; perPage: number; total: number; totalPages: number };
  facets: {
    statuses: Record<string, number>;
    categories: Array<{ category: string; count: number }>;
  };
  users: Array<{ id: string; fullName: string | null; phone: string }>;
}

interface TaskRow {
  id: string; title: string; description: string | null; status: string;
  priority: string; dueDate: string | null; completedAt: string | null; createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  active: "فعال", completed: "تکمیل‌شده", archived: "بایگانی",
};

const PALETTE = [
  "#0e8a5a", "#e11d48", "#7c3aed", "#0891b2", "#d97706", "#db2777",
  "#2563eb", "#16a34a", "#ca8a04", "#dc2626", "#475569", "#0f766e",
];

const DONUT_COLORS = ["#0e8a5a", "#e11d48", "#7c3aed", "#0891b2", "#d97706", "#db2777", "#2563eb", "#475569"];

export default function GoalsAdminTab() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [categories, setCategories] = useState<GoalCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCore = useCallback(async () => {
    setLoading(true);
    const [aRes, cRes] = await Promise.all([
      get<Analytics>("/api/admin/goals-analytics"),
      get<{ categories: GoalCategoryRow[] }>("/api/admin/goal-categories"),
    ]);
    if (aRes.success && aRes.data) setAnalytics(aRes.data);
    if (cRes.success && cRes.data) setCategories(cRes.data.categories);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(loadCore, 0);
    return () => clearTimeout(t);
  }, [loadCore]);

  const catName = (key: string) =>
    categories.find((c) => c.key === key)?.name || LABELS.goalCategories[key] || key;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64 rounded-xl" />
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  const t = analytics?.totals;

  return (
    <div className="space-y-6">
      {/* ─── هدر ─── */}
      <div>
        <h2 className="text-2xl font-black text-white flex items-center gap-2.5">
          <Target className="w-7 h-7 text-blue-400" />
          اهداف کاربران
        </h2>
        <p className="text-slate-400 text-sm mt-1.5 leading-relaxed max-w-xl">
          تحلیل جامع ماژول اهداف، مدیریت دسته‌بندی‌ها و مرور/مودریشن اهداف کاربران — داده‌های غیرحساس.
        </p>
      </div>

      {/* ─── کارت‌های KPI ─── */}
      {t && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <KpiCard icon={Target} label="کل اهداف" value={t.goalsTotal} color="text-blue-400" delay={0} />
          <KpiCard icon={Flame} label="فعال" value={t.activeCount} color="text-emerald-400" delay={0.05} />
          <KpiCard icon={Trophy} label="تکمیل‌شده" value={t.completedCount} color="text-amber-400" delay={0.1} />
          <KpiCard icon={CheckCircle2} label="نرخ تکمیل" value={`${faNum(t.completionRate)}٪`} color="text-violet-400" delay={0.15} />
          <KpiCard icon={ListTodo} label="وظایف" value={t.tasksTotal} sub={`${faNum(t.tasksDone)} انجام‌شده`} color="text-sky-400" delay={0.2} />
          <KpiCard icon={AlertCircle} label="مهلت گذشته" value={t.overdueDeadlines} color="text-rose-400" delay={0.25} />
          <KpiCard icon={CalendarClock} label="مهلت نزدیک (۷ روز)" value={t.dueSoon} color="text-amber-400" delay={0.3} />
          <KpiCard icon={Loader2} label="راکد (۱۴ روز بی‌تحرک)" value={t.staleGoals} color="text-slate-400" delay={0.35} />
        </div>
      )}

      {/* ─── نمودارها ─── */}
      {analytics && (
        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard title="تکمیل ماهانه (۶ ماه جلالی)" className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={analytics.completedByMonth} barSize={26}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickFormatter={(v: string) => v.split(" ")[0]}
                  axisLine={{ stroke: "#1e293b" }}
                  tickLine={false}
                  reversed
                />
                <YAxis
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  orientation="right"
                />
                <Tooltip
                  contentStyle={{ background: "#0d1526", border: "1px solid #1e293b", borderRadius: 12, color: "#fff" }}
                  labelStyle={{ color: "#e2e8f0" }}
                />
                <Bar dataKey="count" name="اهداف تکمیل‌شده" fill="#0e8a5a" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="توزیع دسته‌بندی">
            {analytics.byCategory.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={analytics.byCategory}
                      dataKey="count"
                      nameKey="category"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {analytics.byCategory.map((_, i) => (
                        <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#0d1526", border: "1px solid #1e293b", borderRadius: 12, color: "#fff" }}
                      formatter={(v: number, name: string) => [faNum(v), catName(name)]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5">
                  {analytics.byCategory.slice(0, 6).map((c, i) => (
                    <div key={c.category} className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                      <span className="flex-1 text-slate-300">{catName(c.category)}</span>
                      <span className="text-slate-500 tabular-nums">
                        {faNum(c.count)} · میانگین {faNum(c.avgProgress)}٪
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-slate-500 text-sm py-10 text-center">هدفی ثبت نشده است</p>
            )}
          </ChartCard>
        </div>
      )}

      {/* ─── به تفکیک کاربر ─── */}
      {analytics && analytics.perUser.length > 0 && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-white font-bold text-sm flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-blue-400" />
            به تفکیک کاربر
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[560px]">
              <thead>
                <tr className="text-slate-500 border-b border-slate-800">
                  <th className="text-right py-2.5 px-2 font-medium">کاربر</th>
                  <th className="text-center py-2.5 px-2 font-medium">کل</th>
                  <th className="text-center py-2.5 px-2 font-medium">فعال</th>
                  <th className="text-center py-2.5 px-2 font-medium">تکمیل</th>
                  <th className="text-center py-2.5 px-2 font-medium">میانگین پیشرفت فعال‌ها</th>
                  <th className="text-right py-2.5 px-2 font-medium">آخرین تحرک</th>
                </tr>
              </thead>
              <tbody>
                {analytics.perUser.map((u) => (
                  <tr key={u.userId} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-2">
                      <p className="text-slate-200 font-medium">{u.name}</p>
                      <p className="text-slate-600 text-[10px]" dir="ltr">{u.phone}</p>
                    </td>
                    <td className="text-center text-slate-300 tabular-nums">{faNum(u.total)}</td>
                    <td className="text-center text-emerald-400 tabular-nums">{faNum(u.active)}</td>
                    <td className="text-center text-amber-400 tabular-nums">{faNum(u.completed)}</td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-2 justify-center">
                        <Progress value={u.avgActiveProgress} className="w-20 h-1.5" />
                        <span className="text-slate-400 tabular-nums text-[10px]">{faNum(u.avgActiveProgress)}٪</span>
                      </div>
                    </td>
                    <td className="text-slate-500 text-[11px]">{faRelative(u.lastUpdate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── مدیریت دسته‌بندی‌ها ─── */}
      <CategoriesManager categories={categories} onChange={loadCore} />

      {/* ─── مرورگر اهداف ─── */}
      <GoalsBrowser catName={catName} categories={categories} onStatsChange={loadCore} />
    </div>
  );
}

// ═════ کارت KPI ═════
function KpiCard({
  icon: Icon, label, value, sub, color, delay,
}: {
  icon: typeof Target; label: string; value: number | string; sub?: string;
  color: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4"
    >
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
          <Icon className={`w-4.5 h-4.5 ${color}`} style={{ width: 18, height: 18 }} />
        </div>
        <div className="min-w-0">
          <p className="text-white font-black text-xl tabular-nums leading-none">
            {typeof value === "number" ? faNum(value) : value}
          </p>
          <p className="text-[11px] text-slate-500 mt-1.5 truncate">{sub || label}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ═════ قاب نمودار ═════
function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`bg-slate-900/70 border border-slate-800 rounded-2xl p-5 ${className || ""}`}
    >
      <h3 className="text-white font-bold text-sm mb-4">{title}</h3>
      {children}
    </motion.div>
  );
}

// ═════ مدیریت دسته‌بندی‌های اهداف ═════
function CategoriesManager({
  categories, onChange,
}: {
  categories: GoalCategoryRow[];
  onChange: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GoalCategoryRow | null>(null);
  const [form, setForm] = useState({ name: "", icon: "target", color: "#0e8a5a", sortOrder: 100 });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GoalCategoryRow | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", icon: "target", color: PALETTE[0], sortOrder: 100 });
    setDialogOpen(true);
  };

  const openEdit = (c: GoalCategoryRow) => {
    setEditing(c);
    setForm({ name: c.name, icon: c.icon, color: c.color, sortOrder: c.sortOrder });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    const res = editing
      ? await patch(`/api/admin/goal-categories/${editing.id}`, form)
      : await post("/api/admin/goal-categories", form);
    setSaving(false);
    if (res.success) {
      toast({ title: editing ? "دسته‌بندی ویرایش شد" : "دسته‌بندی ساخته شد" });
      setDialogOpen(false);
      onChange();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const toggleActive = async (c: GoalCategoryRow) => {
    const res = await patch(`/api/admin/goal-categories/${c.id}`, { isActive: !c.isActive });
    if (res.success) {
      toast({ title: !c.isActive ? `«${c.name}» فعال شد` : `«${c.name}» غیرفعال شد` });
      onChange();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    const res = await del(`/api/admin/goal-categories/${deleteTarget.id}`);
    setDeleteTarget(null);
    if (res.success) {
      toast({ title: "دسته‌بندی حذف شد" });
      onChange();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-white font-bold text-sm flex items-center gap-2">
          <FolderTree className="w-4 h-4 text-blue-400" />
          دسته‌بندی‌های اهداف
          <span className="text-slate-500 text-xs font-normal">
            ({faNum(categories.filter((c) => c.isActive).length)} فعال از {faNum(categories.length)})
          </span>
        </h3>
        <Button onClick={openCreate} size="sm" className="shahryar-gradient text-white border-0 rounded-xl font-bold h-8">
          <Plus className="w-3.5 h-3.5" />
          دسته جدید
        </Button>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => {
          const Icon = iconOf(c.icon);
          return (
            <div
              key={c.id}
              className={`flex items-center gap-3 bg-slate-800/50 border rounded-xl p-3 transition-colors ${
                c.isActive ? "border-slate-700/60" : "border-slate-800/50 opacity-55"
              }`}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${c.color}22` }}>
                <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18, color: c.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-200 text-sm font-medium truncate">{c.name}</p>
                <p className="text-[10px] text-slate-500">
                  {faNum(c.usage)} هدف · {c.key}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Switch checked={c.isActive} onCheckedChange={() => toggleActive(c)} className="scale-90" />
                <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeleteTarget(c)}
                  disabled={c.usage > 0}
                  title={c.usage > 0 ? "در استفاده است — فقط غیرفعال‌سازی" : "حذف"}
                  className="p-1.5 rounded-lg text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* دیالوگ ساخت/ویرایش */}
      <AppDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        variant="admin"
        icon={FolderTree}
        size="md"
        locked={saving}
        title={editing ? `ویرایش «${editing.name}»` : "دسته‌بندی جدید"}
        description="دسته‌بندی اهداف برای همه‌ی کاربران"
        footer={
          <div className="flex flex-row-reverse gap-2">
            <Button onClick={save} disabled={!form.name.trim() || saving} className="shahryar-gradient text-white border-0 rounded-xl font-bold min-w-28">
              {saving ? "در حال ذخیره..." : "ذخیره"}
            </Button>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="rounded-xl text-slate-400">انصراف</Button>
          </div>
        }
      >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">نام نمایشی *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="مثلاً: مسافرت"
                className="rounded-xl bg-slate-800/70 border-slate-700 text-white"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">آیکن</Label>
              <div className="grid grid-cols-8 gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-800/40 rounded-xl">
                {Object.keys(ICON_REGISTRY).map((name) => {
                  const I = ICON_REGISTRY[name];
                  const active = form.icon === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, icon: name }))}
                      className={`aspect-square rounded-lg flex items-center justify-center transition-all ${
                        active ? "shahryar-gradient scale-105" : "bg-slate-800 hover:bg-slate-700"
                      }`}
                      title={name}
                    >
                      <I className={`w-4 h-4 ${active ? "text-white" : "text-slate-400"}`} />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">رنگ</Label>
              <div className="flex flex-wrap gap-2">
                {PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color }))}
                    className={`w-8 h-8 rounded-full transition-transform ${
                      form.color === color ? "scale-110 ring-2 ring-white/70" : "hover:scale-105"
                    }`}
                    style={{ background: color }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">ترتیب نمایش</Label>
              <Input
                type="number"
                value={form.sortOrder}
                min={0}
                max={999}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                className="rounded-xl bg-slate-800/70 border-slate-700 text-white w-28"
              />
            </div>
          </div>
      </AppDialog>

      {/* تأیید حذف */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl bg-slate-900 border-slate-800" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">حذف «{deleteTarget?.name}»؟</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              دسته‌بندی حذف می‌شود؛ اهداف موجود تغییری نمی‌کنند. این عمل قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse">
            <AlertDialogAction onClick={remove} className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white border-0">
              حذف
            </AlertDialogAction>
            <AlertDialogCancel className="rounded-xl bg-slate-800 border-slate-700 text-slate-300">انصراف</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═════ مرورگر اهداف ═════
function GoalsBrowser({
  catName, categories, onStatsChange,
}: {
  catName: (key: string) => string;
  categories: GoalCategoryRow[];
  onStatsChange: () => void;
}) {
  const [data, setData] = useState<BrowserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [userId, setUserId] = useState("all");
  const [sort, setSort] = useState("newest");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteGoal, setDeleteGoal] = useState<GoalRow | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ status, category, userId, sort, page: String(page) });
    if (q.trim()) params.set("q", q.trim());
    const res = await get<BrowserData>(`/api/admin/goals?${params.toString()}`);
    if (res.success && res.data) setData(res.data);
    setLoading(false);
  }, [status, category, userId, sort, page, q]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const onSearch = (v: string) => {
    setQ(v);
    setPage(1);
  };

  // تغییر هر فیلتر → بازگشت به صفحه ۱ (در handler، نه effect — سازگار با React Compiler)
  const onStatusChange = (s: string) => {
    setStatus(s);
    setPage(1);
  };
  const onCategoryChange = (v: string) => {
    setCategory(v);
    setPage(1);
  };
  const onUserChange = (v: string) => {
    setUserId(v);
    setPage(1);
  };
  const onSortChange = (v: string) => {
    setSort(v);
    setPage(1);
  };

  const moderate = async (goal: GoalRow, action: "archive" | "restore") => {
    const res = await patch(`/api/admin/goals/${goal.id}`, { action });
    if (res.success) {
      toast({ title: action === "archive" ? "هدف بایگانی شد" : "هدف بازگردانی شد" });
      load();
      onStatsChange();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const removeGoal = async () => {
    if (!deleteGoal) return;
    const res = await del(`/api/admin/goals/${deleteGoal.id}`);
    setDeleteGoal(null);
    if (res.success) {
      toast({ title: "هدف حذف شد", description: "وظایفش هم پاک شدند" });
      if (detailId === deleteGoal.id) setDetailId(null);
      load();
      onStatsChange();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const p = data?.pagination;

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h3 className="text-white font-bold text-sm flex items-center gap-2">
          <Search className="w-4 h-4 text-blue-400" />
          مرورگر اهداف
          {p && <span className="text-slate-500 text-xs font-normal">({faNum(p.total)} هدف)</span>}
        </h3>
      </div>

      {/* فیلترها */}
      <div className="space-y-2.5 mb-4">
        <div className="flex gap-1.5 flex-wrap">
          {["all", "active", "completed", "archived"].map((s) => (
            <button
              key={s}
              onClick={() => onStatusChange(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                status === s
                  ? "shahryar-gradient text-white shadow"
                  : "bg-slate-800/70 border border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {s === "all" ? "همه" : STATUS_LABELS[s]}
              {data?.facets.statuses[s] !== undefined && (
                <span className="mr-1 opacity-70 tabular-nums">{faNum(data.facets.statuses[s])}</span>
              )}
            </button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            value={q}
            onChange={(e) => {
              if (searchTimer.current) clearTimeout(searchTimer.current);
              searchTimer.current = setTimeout(() => onSearch(e.target.value), 400);
            }}
            placeholder="جستجوی عنوان، توضیح یا نام کاربر..."
            className="rounded-xl bg-slate-800/70 border-slate-700 text-white text-sm"
          />
          <Select value={category} onValueChange={onCategoryChange}>
            <SelectTrigger className="rounded-xl bg-slate-800/70 border-slate-700 text-white text-sm">
              <SelectValue placeholder="همه دسته‌ها" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all">همه دسته‌ها</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.key} value={c.key}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={userId} onValueChange={onUserChange}>
            <SelectTrigger className="rounded-xl bg-slate-800/70 border-slate-700 text-white text-sm">
              <SelectValue placeholder="همه کاربران" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700 max-h-56">
              <SelectItem value="all">همه کاربران</SelectItem>
              {(data?.users || []).map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.fullName || u.phone}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={onSortChange}>
            <SelectTrigger className="rounded-xl bg-slate-800/70 border-slate-700 text-white text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="newest">جدیدترین</SelectItem>
              <SelectItem value="oldest">قدیمی‌ترین</SelectItem>
              <SelectItem value="progress_desc">بیشترین پیشرفت</SelectItem>
              <SelectItem value="progress_asc">کمترین پیشرفت</SelectItem>
              <SelectItem value="deadline">نزدیک‌ترین مهلت</SelectItem>
              <SelectItem value="most_tasks">بیشترین وظایف</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* لیست */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="text-center py-14 bg-slate-900/50 rounded-xl border border-dashed border-slate-800">
          <Target className="w-12 h-12 mx-auto text-slate-700 mb-3" />
          <p className="text-slate-400 text-sm">هدفی با این فیلترها یافت نشد</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {data.items.map((g) => (
            <div
              key={g.id}
              className="bg-slate-800/40 border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <p className="text-white font-bold text-sm truncate max-w-full sm:max-w-xs">{g.title}</p>
                    <Badge className={`text-[9px] border-0 ${
                      g.status === "active" ? "bg-emerald-500/15 text-emerald-400"
                      : g.status === "completed" ? "bg-amber-500/15 text-amber-400"
                      : "bg-slate-700 text-slate-400"
                    }`}>
                      {STATUS_LABELS[g.status]}
                    </Badge>
                    <Badge className="text-[9px] border-0 bg-slate-800 text-slate-400">{catName(g.category)}</Badge>
                    <Badge className={`text-[9px] border-0 bg-slate-800 ${
                      g.priority === "critical" ? "text-rose-400" : g.priority === "high" ? "text-amber-400" : "text-slate-500"
                    }`}>
                      {LABELS.priorities[g.priority]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    <span className="text-slate-400">{g.user.fullName || g.user.phone}</span>
                    <span>·</span>
                    <span>{faNum(g.doneTasks)}/{faNum(g.tasksCount)} وظیفه</span>
                    <span>·</span>
                    <span>{faRelative(g.updatedAt)}</span>
                    {g.deadline && (
                      <>
                        <span>·</span>
                        <span className={new Date(g.deadline) < new Date() && g.status === "active" ? "text-rose-400" : ""}>
                          مهلت: {faDate(g.deadline)}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2.5">
                    <Progress value={g.progress} className="h-1.5 flex-1" />
                    <span className="text-[10px] text-slate-500 tabular-nums w-8 text-left">{faNum(g.progress)}٪</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => setDetailId(g.id)}
                    className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-700 transition-colors"
                    title="جزئیات"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => moderate(g, g.status === "archived" ? "restore" : "archive")}
                    className={`p-2 rounded-lg transition-colors ${
                      g.status === "archived"
                        ? "text-emerald-400/70 hover:text-emerald-400 hover:bg-emerald-500/10"
                        : "text-slate-400 hover:text-amber-400 hover:bg-amber-500/10"
                    }`}
                    title={g.status === "archived" ? "بازگردانی" : "بایگانی"}
                  >
                    {g.status === "archived" ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => setDeleteGoal(g)}
                    className="p-2 rounded-lg text-rose-400/60 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="حذف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* صفحه‌بندی */}
          {p && p.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-3">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((v) => Math.max(1, v - 1))}
                className="rounded-xl text-slate-400 gap-1"
              >
                <ChevronRight className="w-4 h-4" />
                قبلی
              </Button>
              <span className="text-xs text-slate-500 tabular-nums">
                صفحه {faNum(p.page)} از {faNum(p.totalPages)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= p.totalPages}
                onClick={() => setPage((v) => Math.min(p.totalPages, v + 1))}
                className="rounded-xl text-slate-400 gap-1"
              >
                بعدی
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* دیالوگ جزئیات */}
      {detailId && (
        <GoalDetailDialog
          goalId={detailId}
          catName={catName}
          onClose={() => setDetailId(null)}
          onArchived={(action) => {
            load();
            onStatsChange();
          }}
          onDelete={(goal) => {
            setDetailId(null);
            setDeleteGoal(goal);
          }}
        />
      )}

      {/* تأیید حذف هدف */}
      <AlertDialog open={!!deleteGoal} onOpenChange={(o) => !o && setDeleteGoal(null)}>
        <AlertDialogContent className="rounded-2xl bg-slate-900 border-slate-800" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">حذف هدف «{deleteGoal?.title}»؟</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              هدف به‌همراه {faNum(deleteGoal?.tasksCount || 0)} وظیفه‌ی آن برای همیشه حذف می‌شود. این عمل قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse">
            <AlertDialogAction onClick={removeGoal} className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white border-0">
              حذف کامل
            </AlertDialogAction>
            <AlertDialogCancel className="rounded-xl bg-slate-800 border-slate-700 text-slate-300">انصراف</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═════ دیالوگ جزئیات هدف (ادمین) ═════
function GoalDetailDialog({
  goalId, catName, onClose, onArchived, onDelete,
}: {
  goalId: string;
  catName: (key: string) => string;
  onClose: () => void;
  onArchived: (action: "archive" | "restore") => void;
  onDelete: (goal: GoalRow) => void;
}) {
  const [goal, setGoal] = useState<(GoalRow & { tasks: TaskRow[] }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await get<{ goal: GoalRow & { tasks: TaskRow[] } }>(`/api/admin/goals/${goalId}`);
      if (!cancelled && res.success && res.data) setGoal(res.data.goal);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [goalId]);

  const moderate = async (action: "archive" | "restore") => {
    const res = await patch(`/api/admin/goals/${goalId}`, { action });
    if (res.success) {
      toast({ title: action === "archive" ? "بایگانی شد" : "بازگردانی شد" });
      onArchived(action);
      onClose();
    }
  };

  return (
    <AppDialog
      open
      onClose={onClose}
      variant="admin"
      icon={Target}
      size="lg"
      title="جزئیات هدف"
      description="مرور کامل هدف و وظایف کاربر"
      footer={
        <div className="flex flex-row-reverse gap-2">
          {goal && (
            <>
              <Button
                variant="ghost"
                onClick={() => moderate(goal.status === "archived" ? "restore" : "archive")}
                className="rounded-xl text-amber-400 gap-1.5"
              >
                {goal.status === "archived" ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                {goal.status === "archived" ? "بازگردانی" : "بایگانی"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => onDelete(goal)}
                className="rounded-xl text-rose-400 gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                حذف
              </Button>
            </>
          )}
          <Button variant="ghost" onClick={onClose} className="rounded-xl text-slate-400">بستن</Button>
        </div>
      }
    >
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        ) : goal ? (
          <div className="space-y-4">
            <div>
              <p className="text-white font-bold text-lg">{goal.title}</p>
              {goal.description && (
                <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">{goal.description}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <InfoBox label="کاربر" value={goal.user.fullName || goal.user.phone} sub={goal.user.phone} />
              <InfoBox label="وضعیت" value={STATUS_LABELS[goal.status]} />
              <InfoBox label="دسته‌بندی" value={catName(goal.category)} />
              <InfoBox label="اولویت" value={LABELS.priorities[goal.priority]} />
              <InfoBox label="پیشرفت" value={`${faNum(goal.progress)}٪`} />
              <InfoBox label="وظایف" value={`${faNum(goal.doneTasks)} از ${faNum(goal.tasksCount)} انجام‌شده`} />
              <InfoBox label="ساخته‌شده" value={faDate(goal.createdAt)} />
              <InfoBox label="آخرین تغییر" value={faRelative(goal.updatedAt)} />
              {goal.deadline && <InfoBox label="مهلت" value={faDate(goal.deadline)} />}
              {goal.completedAt && <InfoBox label="تکمیل" value={faDate(goal.completedAt)} />}
            </div>

            <div>
              <p className="text-slate-400 text-xs font-bold mb-2">وظایف ({faNum(goal.tasks.length)})</p>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {goal.tasks.length === 0 && (
                  <p className="text-slate-600 text-xs py-4 text-center bg-slate-800/30 rounded-xl">وظیفه‌ای ندارد</p>
                )}
                {goal.tasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2.5 bg-slate-800/40 rounded-xl px-3 py-2.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      t.status === "done" ? "bg-emerald-500" : t.status === "in_progress" ? "bg-amber-400" : "bg-slate-600"
                    }`} />
                    <span className={`text-xs flex-1 truncate ${t.status === "done" ? "text-slate-500 line-through" : "text-slate-300"}`}>
                      {t.title}
                    </span>
                    {t.dueDate && (
                      <span className={`text-[10px] shrink-0 ${
                        new Date(t.dueDate) < new Date() && t.status !== "done" ? "text-rose-400" : "text-slate-600"
                      }`}>
                        {faDate(t.dueDate)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-slate-400 text-sm text-center py-8">هدف یافت نشد</p>
        )}
    </AppDialog>
  );
}

function InfoBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-slate-800/40 rounded-xl px-3 py-2.5">
      <p className="text-[10px] text-slate-500 mb-1">{label}</p>
      <p className="text-slate-200 font-medium">{value}</p>
      {sub && <p className="text-slate-600 text-[10px]" dir="ltr">{sub}</p>}
    </div>
  );
}
