// ═════ امور مالی — تحلیل غیرحساس + قالب‌های دسته‌بندی + به تفکیک کاربر ═════
"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Wallet, Users, ArrowLeftRight, PieChartIcon, Target, HandCoins, Repeat,
  Sparkles, ShieldCheck, Tag, Plus, Pencil, Trash2, Activity, Clock, Shapes,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import AppDialog from "@/components/ui/app-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { get, post, patch, del } from "@/lib/client/api";
import { faNum, faDateTime } from "@/lib/client/persian";
import { iconOf, ICON_REGISTRY } from "@/lib/client/iconRegistry";
import { ACCOUNT_TYPE_LABELS, TX_TYPE_LABELS } from "@/lib/client/finance";
import { toast } from "@/hooks/use-toast";

// ─── انواع ───

interface FinanceAnalytics {
  kpis: {
    usersTotal: number; usersWithFinance: number; adoption: number;
    accounts: number; transactions: number; txThisMonth: number;
    budgets: number; financeGoals: number; debtsActive: number;
    recurringsActive: number; advisorCalls: number;
  };
  monthly: Array<{ monthKey: string; label: string; income: number; expense: number; transfer: number }>;
  topCategories: Array<{ name: string; type: string; count: number }>;
  accountTypes: Array<{ type: string; count: number }>;
  perUser: Array<{
    user: { id: string; fullName: string | null; phone: string; status: string };
    accounts: number; transactions: number; budgets: number; financeGoals: number;
    debts: number; recurrings: number; lastTxAt: string | null;
  }>;
  recentTransactions: Array<{
    id: string; date: string; type: string; categoryName: string;
    accountType: string; userName: string;
  }>;
}

interface TemplateRow {
  id: string; name: string; type: string; icon: string; color: string;
  sortOrder: number; isActive: boolean; usage: number;
}

const PALETTE = [
  "#e67e22", "#2980b9", "#8e44ad", "#c0392b", "#e74c3c", "#d35400",
  "#16a085", "#27ae60", "#f39c12", "#9b59b6", "#2ecc71", "#7f8c8d",
];

const DONUT_COLORS = ["#0e8a5a", "#2980b9", "#d97706", "#7c3aed", "#db2777", "#475569"];

export default function FinanceAdminTab() {
  const [data, setData] = useState<FinanceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await get<FinanceAnalytics>("/api/admin/finance");
    if (res.success && res.data) setData(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64 rounded-xl" />
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  const k = data?.kpis;

  return (
    <div className="space-y-6">
      {/* ─── هدر + بنر حریم خصوصی ─── */}
      <div>
        <h2 className="text-2xl font-black text-white flex items-center gap-2.5">
          <Wallet className="w-7 h-7 text-blue-400" />
          امور مالی (تحلیل غیرحساس)
        </h2>
        <p className="text-slate-400 text-sm mt-1.5 leading-relaxed max-w-xl">
          نمای جامع ماژول مالی: میزان استفاده، تراکنش‌ها (فقط شمارنده)، دسته‌های پرکاربرد و قالب‌های سید.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 flex items-start gap-3"
      >
        <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-amber-200/90 text-xs leading-relaxed">
          برای حفظ حریم خصوصی کاربران، <b>هیچ مبلغ، توضیح یا یادداشت تراکنشی</b> نمایش داده نمی‌شود —
          فقط شمارنده‌ها، توزیع‌ها و متادیتای غیرحساس (نوع، دسته، تاریخ).
        </p>
      </motion.div>

      {/* ─── کارت‌های KPI ─── */}
      {k && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <Kpi icon={Users} label="کاربران فعال مالی" value={`${faNum(k.usersWithFinance)}`} sub={`از ${faNum(k.usersTotal)} کاربر (${faNum(k.adoption)}٪)`} color="text-emerald-400" delay={0} />
          <Kpi icon={ArrowLeftRight} label="کل تراکنش‌ها" value={k.transactions} sub={`${faNum(k.txThisMonth)} در این ماه`} color="text-blue-400" delay={0.05} />
          <Kpi icon={Wallet} label="حساب‌ها" value={k.accounts} color="text-sky-400" delay={0.1} />
          <Kpi icon={PieChartIcon} label="بودجه‌ها" value={k.budgets} color="text-violet-400" delay={0.15} />
          <Kpi icon={Target} label="اهداف مالی" value={k.financeGoals} color="text-amber-400" delay={0.2} />
          <Kpi icon={HandCoins} label="قرض‌های باز" value={k.debtsActive} color="text-rose-400" delay={0.25} />
          <Kpi icon={Repeat} label="تکرارشونده‌های فعال" value={k.recurringsActive} color="text-cyan-400" delay={0.3} />
          <Kpi icon={Sparkles} label="مشاوره‌های AI" value={k.advisorCalls} sub="فراخوان مشاور هوشمند" color="text-pink-400" delay={0.35} />
        </div>
      )}

      {/* ─── نمودارها ─── */}
      {data && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 lg:col-span-2">
            <h3 className="text-white font-bold text-sm mb-4">روند تعداد تراکنش‌ها (۶ ماه جلالی)</h3>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={data.monthly} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
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
                  formatter={(v: number, name: string) => [faNum(v), TX_TYPE_LABELS[name] || name]}
                />
                <Legend formatter={(v: string) => TX_TYPE_LABELS[v] || v} wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                <Bar dataKey="income" stackId="a" fill="#0e8a5a" radius={[0, 0, 0, 0]} name="income" />
                <Bar dataKey="expense" stackId="a" fill="#e11d48" name="expense" />
                <Bar dataKey="transfer" stackId="a" fill="#2980b9" radius={[4, 4, 0, 0]} name="transfer" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-white font-bold text-sm mb-4">نوع حساب‌ها</h3>
            {data.accountTypes.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie
                      data={data.accountTypes}
                      dataKey="count"
                      nameKey="type"
                      innerRadius={42}
                      outerRadius={65}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {data.accountTypes.map((_, i) => (
                        <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#0d1526", border: "1px solid #1e293b", borderRadius: 12, color: "#fff" }}
                      formatter={(v: number, name: string) => [faNum(v), ACCOUNT_TYPE_LABELS[name] || name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5">
                  {data.accountTypes.map((a, i) => (
                    <div key={a.type} className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                      <span className="flex-1 text-slate-300">{ACCOUNT_TYPE_LABELS[a.type] || a.type}</span>
                      <span className="text-slate-500 tabular-nums">{faNum(a.count)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-slate-500 text-sm py-10 text-center">حسابی ثبت نشده است</p>
            )}
          </div>
        </div>
      )}

      {/* ─── دسته‌های پرکاربرد + تراکنش‌های اخیر ─── */}
      {data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-white font-bold text-sm flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-blue-400" />
              دسته‌بندی‌های پرکاربرد (بر اساس تعداد تراکنش)
            </h3>
            {data.topCategories.length > 0 ? (
              <div className="space-y-2.5">
                {data.topCategories.slice(0, 8).map((c) => {
                  const max = data.topCategories[0].count || 1;
                  const pct = Math.round((c.count / max) * 100);
                  return (
                    <div key={`${c.name}-${c.type}`}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300">{c.name}</span>
                        <Badge className={`text-[9px] border-0 ${
                          c.type === "income" ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
                        }`}>
                          {c.type === "income" ? "درآمد" : "هزینه"} · {faNum(c.count)}
                        </Badge>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full shahryar-gradient"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-slate-500 text-sm py-10 text-center">تراکنشی ثبت نشده است</p>
            )}
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-white font-bold text-sm flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-blue-400" />
              آخرین تراکنش‌ها (غیرحساس)
            </h3>
            {data.recentTransactions.length > 0 ? (
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {data.recentTransactions.map((t) => (
                  <div key={t.id} className="flex items-center gap-2.5 bg-slate-800/40 rounded-xl px-3 py-2.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      t.type === "income" ? "bg-emerald-500" : t.type === "expense" ? "bg-rose-500" : "bg-sky-500"
                    }`} />
                    <span className="text-slate-300 text-xs w-20 shrink-0">{faDateTime(t.date)}</span>
                    <span className="text-slate-500 text-[10px] w-14 shrink-0">{TX_TYPE_LABELS[t.type]}</span>
                    <span className="text-slate-400 text-xs flex-1 truncate">{t.categoryName}</span>
                    <span className="text-slate-500 text-[10px] truncate hidden sm:block max-w-24">{t.userName}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm py-10 text-center">تراکنشی ثبت نشده است</p>
            )}
          </div>
        </div>
      )}

      {/* ─── به تفکیک کاربر ─── */}
      {data && data.perUser.length > 0 && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-white font-bold text-sm flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-blue-400" />
            استفاده‌ی ماژول مالی به تفکیک کاربر (شمارنده)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[640px]">
              <thead>
                <tr className="text-slate-500 border-b border-slate-800">
                  <th className="text-right py-2.5 px-2 font-medium">کاربر</th>
                  <th className="text-center py-2.5 px-2 font-medium">حساب</th>
                  <th className="text-center py-2.5 px-2 font-medium">تراکنش</th>
                  <th className="text-center py-2.5 px-2 font-medium">بودجه</th>
                  <th className="text-center py-2.5 px-2 font-medium">هدف مالی</th>
                  <th className="text-center py-2.5 px-2 font-medium">قرض</th>
                  <th className="text-center py-2.5 px-2 font-medium">تکرارشونده</th>
                  <th className="text-right py-2.5 px-2 font-medium">آخرین تراکنش</th>
                </tr>
              </thead>
              <tbody>
                {data.perUser.map((u) => (
                  <tr key={u.user.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-2">
                      <p className="text-slate-200 font-medium">{u.user.fullName || "بی‌نام"}</p>
                      <p className="text-slate-600 text-[10px]" dir="ltr">{u.user.phone}</p>
                    </td>
                    <td className="text-center text-slate-300 tabular-nums">{faNum(u.accounts)}</td>
                    <td className="text-center text-blue-400 tabular-nums font-bold">{faNum(u.transactions)}</td>
                    <td className="text-center text-slate-300 tabular-nums">{faNum(u.budgets)}</td>
                    <td className="text-center text-slate-300 tabular-nums">{faNum(u.financeGoals)}</td>
                    <td className="text-center text-slate-300 tabular-nums">{faNum(u.debts)}</td>
                    <td className="text-center text-slate-300 tabular-nums">{faNum(u.recurrings)}</td>
                    <td className="text-slate-500 text-[11px]">{u.lastTxAt ? faDateTime(u.lastTxAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── قالب‌های دسته‌بندی ─── */}
      <TemplatesManager onChange={load} />
    </div>
  );
}

// ═════ کارت KPI ═════
function Kpi({
  icon: Icon, label, value, sub, color, delay,
}: {
  icon: typeof Wallet; label: string; value: string | number; sub?: string;
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
          <Icon className={color} style={{ width: 18, height: 18 }} />
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

// ═════ مدیریت قالب‌های دسته‌بندی مالی ═════
function TemplatesManager({ onChange }: { onChange: () => void }) {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [form, setForm] = useState<{ name: string; type: string; icon: string; color: string; sortOrder: number }>({
    name: "", type: "expense", icon: "tag", color: "#e67e22", sortOrder: 100,
  });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TemplateRow | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await get<{ templates: TemplateRow[] }>("/api/admin/finance/categories");
    if (res.success && res.data) setTemplates(res.data.templates);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const openCreate = (type: string) => {
    setEditing(null);
    setForm({ name: "", type, icon: "tag", color: type === "income" ? "#27ae60" : "#e67e22", sortOrder: 100 });
    setDialogOpen(true);
  };

  const openEdit = (t: TemplateRow) => {
    setEditing(t);
    setForm({ name: t.name, type: t.type, icon: t.icon, color: t.color, sortOrder: t.sortOrder });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    const res = editing
      ? await patch(`/api/admin/finance/categories/${editing.id}`, form)
      : await post("/api/admin/finance/categories", form);
    setSaving(false);
    if (res.success) {
      toast({ title: editing ? "قالب ویرایش شد" : "قالب ساخته شد" });
      setDialogOpen(false);
      load();
      onChange();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const toggleActive = async (t: TemplateRow) => {
    const res = await patch(`/api/admin/finance/categories/${t.id}`, { isActive: !t.isActive });
    if (res.success) {
      toast({ title: !t.isActive ? `«${t.name}» فعال شد` : `«${t.name}» غیرفعال شد` });
      load();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    const res = await del(`/api/admin/finance/categories/${deleteTarget.id}`);
    setDeleteTarget(null);
    if (res.success) {
      toast({ title: "قالب حذف شد" });
      load();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const filtered = typeFilter === "all" ? templates : templates.filter((t) => t.type === typeFilter);

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h3 className="text-white font-bold text-sm flex items-center gap-2">
            <Tag className="w-4 h-4 text-blue-400" />
            قالب‌های دسته‌بندی مالی
            <span className="text-slate-500 text-xs font-normal">({faNum(templates.filter((t) => t.isActive).length)} فعال)</span>
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">
            این قالب‌ها هنگام اولین استفاده‌ی ماژول مالی برای هر کاربر جدید سید می‌شوند
          </p>
        </div>
        <div className="flex gap-1.5">
          {["all", "expense", "income"].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                typeFilter === t
                  ? "shahryar-gradient text-white shadow"
                  : "bg-slate-800/70 border border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {t === "all" ? "همه" : t === "expense" ? "هزینه" : "درآمد"}
            </button>
          ))}
          <Button onClick={() => openCreate(typeFilter === "income" ? "income" : "expense")} size="sm" className="shahryar-gradient text-white border-0 rounded-xl font-bold h-8 mr-1">
            <Plus className="w-3.5 h-3.5" />
            قالب جدید
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => {
            const Icon = iconOf(t.icon);
            return (
              <div
                key={t.id}
                className={`flex items-center gap-3 bg-slate-800/50 border rounded-xl p-3 transition-colors ${
                  t.isActive ? "border-slate-700/60" : "border-slate-800/50 opacity-55"
                }`}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${t.color}22` }}>
                  <Icon style={{ width: 18, height: 18, color: t.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 text-sm font-medium truncate">{t.name}</p>
                  <p className="text-[10px] text-slate-500">
                    {t.type === "income" ? "درآمد" : "هزینه"} · در {faNum(t.usage)} حساب کاربر
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Switch checked={t.isActive} onCheckedChange={() => toggleActive(t)} className="scale-90" />
                  <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(t)}
                    className="p-1.5 rounded-lg text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="حذف قالب"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-slate-500 text-sm py-8 text-center col-span-full">قالبی در این دسته نیست</p>
          )}
        </div>
      )}

      {/* دیالوگ ساخت/ویرایش قالب */}
      <AppDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        variant="admin"
        icon={Shapes}
        size="md"
        locked={saving}
        title={editing ? `ویرایش «${editing.name}»` : "قالب دسته‌بندی جدید"}
        description="قالب‌ها هنگام ثبت‌نام کاربران جدید سید می‌شوند"
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-slate-300">نام *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="مثلاً: تعمیر خودرو"
                  className="rounded-xl bg-slate-800/70 border-slate-700 text-white"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">نوع</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger className="rounded-xl bg-slate-800/70 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="expense">هزینه</SelectItem>
                    <SelectItem value="income">درآمد</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
              <Label className="text-slate-300">ترتیب</Label>
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
            <AlertDialogTitle className="text-white">حذف قالب «{deleteTarget?.name}»؟</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              قالب حذف می‌شود اما دسته‌های ساخته‌شده در حساب کاربران فعلی دست‌نخورده می‌مانند؛
              فقط کاربران جدید آن را دریافت نمی‌کنند.
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
