// ═════ تب بودجه‌ها — سقف‌گذاری ماهانه به تفکیک دسته با نوار پیشرفت ═════
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, PieChart, AlertTriangle } from "lucide-react";
import AppDialog from "@/components/ui/app-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { get, post, del } from "@/lib/client/api";
import { toast } from "@/hooks/use-toast";
import { faNum, enNum } from "@/lib/client/persian";
import { toman, tomanShort, budgetStatus, monthLabel, currentMonthKey } from "@/lib/client/finance";

interface Budget {
  id: string; categoryId: string; monthKey: string; amount: number;
  spent: number; pct: number; remaining: number;
  category: { name: string; color: string; icon: string; type: string };
}
interface Category {
  id: string; name: string; color: string; type: string;
}

export default function BudgetsTab() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [month, setMonth] = useState<string>(currentMonthKey());
  const [totalBudget, setTotalBudget] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selCategory, setSelCategory] = useState("");
  const [selAmount, setSelAmount] = useState("");

  const load = useCallback(async () => {
    const [bRes, cRes] = await Promise.all([
      get<{ budgets: Budget[]; categories: Category[]; month: string; totalBudget: number; totalSpent: number }>(
        `/api/finance/budgets?month=${month}`
      ),
      get<{ categories: Category[] }>("/api/finance/categories"),
    ]);
    if (bRes.success && bRes.data) {
      setBudgets(bRes.data.budgets);
      setTotalBudget(bRes.data.totalBudget);
      setTotalSpent(bRes.data.totalSpent);
    }
    if (cRes.success && cRes.data) {
      setCategories(cRes.data.categories.filter((c) => c.type === "expense"));
    }
    setLoading(false);
  }, [month]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const unBudgeted = useMemo(
    () => categories.filter((c) => !budgets.some((b) => b.categoryId === c.id)),
    [categories, budgets]
  );

  const overallPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
  const overspent = budgets.filter((b) => b.pct >= 100);

  const handleAdd = async () => {
    const amount = Number(enNum(selAmount).replace(/[^\d]/g, ""));
    if (!selCategory) { toast({ title: "دسته را انتخاب کنید", variant: "destructive" }); return; }
    if (!amount || amount <= 0) { toast({ title: "مبلغ نامعتبر", variant: "destructive" }); return; }
    setSaving(true);
    const res = await post("/api/finance/budgets", { categoryId: selCategory, amount, month });
    setSaving(false);
    if (res.success) {
      toast({ title: "بودجه تعریف شد", description: `${toman(amount)} تومان` });
      setDialogOpen(false); setSelAmount(""); setSelCategory("");
      load();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    const res = await del(`/api/finance/budgets/${id}`);
    if (res.success) { toast({ title: "بودجه حذف شد" }); load(); }
    else toast({ title: "خطا", description: res.error, variant: "destructive" });
  };

  return (
    <div className="space-y-4">
      {/* ─── کارت کلی بودجه ماه ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl bg-card border border-border/60 p-5 shadow-sm"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <PieChart className="w-4 h-4 text-primary" />
            بودجه‌بندی {monthLabel(month)}
          </h3>
          <Button
            size="sm" onClick={() => setDialogOpen(true)} disabled={unBudgeted.length === 0}
            className="rounded-xl shahryar-gradient text-white h-8"
          >
            <Plus className="w-4 h-4 ml-1" />
            بودجه جدید
          </Button>
        </div>

        {totalBudget > 0 ? (
          <>
            <div className="flex justify-between items-end mb-2">
              <div>
                <p className="text-xl md:text-2xl font-black tabular-nums">{tomanShort(totalSpent)}</p>
                <p className="text-[10px] text-muted-foreground">مصرف‌شده از {toman(totalBudget)} تومان</p>
              </div>
              <span className={`text-lg font-black tabular-nums ${budgetStatus(overallPct).color}`}>{faNum(overallPct)}٪</span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${overallPct >= 100 ? "bg-rose-500" : "shahryar-gradient"}`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, overallPct)}%` }}
                transition={{ duration: 0.9, ease: "easeOut" }}
              />
            </div>
            {overspent.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 mt-3 text-xs text-rose-500 bg-rose-500/10 rounded-xl px-3 py-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {faNum(overspent.length)} دسته از بودجه‌شان عبور کرده‌اند
              </motion.div>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-6">
            برای این ماه بودجه‌ای تعریف نشده — با سقف‌گذاری دسته‌های پرهزینه، خرجتان را کنترل کنید
          </p>
        )}
      </motion.div>

      {/* ─── لیست بودجه‌ها ─── */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-card animate-pulse border border-border/40" />
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <div className="rounded-3xl bg-card border border-border/60 p-10 text-center">
          <PieChart className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium mb-1">بودجه‌ای تعریف نشده</p>
          <p className="text-xs text-muted-foreground">
            برای دسته‌هایی مثل «خورد و خوراک» یا «حمل و نقل» سقف ماهانه تعیین کنید
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {budgets.map((b, i) => {
              const st = budgetStatus(b.pct);
              return (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-2xl bg-card border border-border/60 p-4 shadow-sm group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: b.category.color }} />
                      <span className="font-bold text-sm">{b.category.name}</span>
                    </div>
                    <button
                      onClick={() => handleDelete(b.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${b.pct >= 100 ? "bg-rose-500" : b.pct >= 80 ? "bg-amber-400" : "shahryar-gradient"}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, b.pct)}%` }}
                      transition={{ duration: 0.8, delay: i * 0.05, ease: "easeOut" }}
                    />
                  </div>
                  <div className="flex justify-between items-center mt-2.5 text-xs">
                    <span className="tabular-nums text-muted-foreground">
                      {toman(b.spent)} از {toman(b.amount)}
                    </span>
                    <span className={`tabular-nums font-bold ${st.color}`}>
                      {faNum(b.pct)}٪ · {b.remaining >= 0 ? `${tomanShort(b.remaining)} باقی` : `${tomanShort(-b.remaining)} بیش از حد`}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ─── دیالوگ تعریف بودجه ─── */}
      <AppDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        icon={PieChart}
        size="sm"
        locked={saving}
        title={"تعریف بودجه — " + monthLabel(month)}
        description="سقف ماهانه برای یک دسته هزینه تعیین کن"
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">انصراف</Button>
            <Button onClick={handleAdd} disabled={saving} className="rounded-xl shahryar-gradient text-white font-bold">
              {saving ? "..." : "تعریف بودجه"}
            </Button>
          </>
        }
      >
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>دسته‌ی هزینه</Label>
              <Select value={selCategory} onValueChange={setSelCategory}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="انتخاب دسته" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {unBudgeted.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>سقف ماهانه (تومان)</Label>
              <Input
                dir="ltr" inputMode="numeric"
                value={selAmount}
                onChange={(e) => {
                  const raw = enNum(e.target.value).replace(/[^\d]/g, "");
                  if (Number(raw) > 2_000_000_000) return;
                  setSelAmount(raw ? faNum(Number(raw).toLocaleString("en-US")) : "");
                }}
                placeholder="۲٬۰۰۰٬۰۰۰"
                className="text-left font-bold tabular-nums h-11 rounded-xl"
              />
            </div>
            <p className="text-[11px] text-muted-foreground leading-5">
              هوشیار مصرف این دسته را در {monthLabel(month)} رصد می‌کند و پیش از عبور از سقف به شما هشدار می‌دهد.
            </p>
          </div>
      </AppDialog>
    </div>
  );
}
