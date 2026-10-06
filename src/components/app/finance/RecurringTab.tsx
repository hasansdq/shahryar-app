// ═════ تب تکرارشونده‌ها — اجاره، اشتراک، حقوق با تولید خودکار تراکنش ═════
"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Repeat, Calendar, Send, Download, Pause, Play } from "lucide-react";
import AppDialog from "@/components/ui/app-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import JalaliDatePicker from "@/components/ui/jalali-date-picker";
import { get, post, patch, del } from "@/lib/client/api";
import { toast } from "@/hooks/use-toast";
import { faNum, enNum, faDate } from "@/lib/client/persian";
import { toman, tomanShort, CADENCE_LABELS, ACCOUNT_TYPE_LABELS } from "@/lib/client/finance";
import type { Account, Category } from "./TransactionDialog";

interface Recurring {
  id: string; title: string; type: string; amount: number; cadence: string;
  accountId: string; categoryId: string | null; nextRunDate: string;
  isActive: boolean; description: string | null;
  account?: { name: string; color: string };
  category?: { name: string; color: string; icon: string } | null;
}

export default function RecurringTab() {
  const [recurrings, setRecurrings] = useState<Recurring[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "", type: "expense", amount: "", cadence: "monthly",
    accountId: "", categoryId: "", nextRunDate: "",
  });

  const load = useCallback(async () => {
    const [rRes, accRes, catRes] = await Promise.all([
      get<{ recurrings: Recurring[]; materialized: number }>("/api/finance/recurring"),
      get<{ accounts: Account[] }>("/api/finance/accounts"),
      get<{ categories: Category[] }>("/api/finance/categories"),
    ]);
    if (rRes.success && rRes.data) {
      setRecurrings(rRes.data.recurrings);
      if (rRes.data.materialized > 0) {
        toast({
          title: "تراکنش‌های خودکار ثبت شد",
          description: `${faNum(rRes.data.materialized)} تراکنش تکرارشونده‌ی سررسیدشده`,
        });
      }
    }
    if (accRes.success && accRes.data) {
      const active = accRes.data.accounts.filter((a) => a.isActive !== false);
      setAccounts(active);
      // به‌روزرسانی تابعی — وابستگی به form.accountId حذف می‌شود (حلقه‌ی
      // load → setForm → deps تغییر → load دیگر وجود ندارد)
      if (active[0]) setForm((f) => (f.accountId ? f : { ...f, accountId: active[0].id }));
    }
    if (catRes.success && catRes.data) setCategories(catRes.data.categories);
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const active = recurrings.filter((r) => r.isActive);
  const inactive = recurrings.filter((r) => !r.isActive);
  const monthlyCommitment = active
    .filter((r) => r.cadence === "monthly")
    .reduce((s, r) => s + (r.type === "expense" ? r.amount : 0), 0);

  const handleCreate = async () => {
    const amount = Number(enNum(form.amount).replace(/[^\d]/g, ""));
    if (!form.title.trim()) { toast({ title: "عنوان الزامی است", variant: "destructive" }); return; }
    if (!amount || amount <= 0) { toast({ title: "مبلغ نامعتبر", variant: "destructive" }); return; }
    if (!form.accountId) { toast({ title: "حساب را انتخاب کنید", variant: "destructive" }); return; }
    setSaving(true);
    const res = await post("/api/finance/recurring", {
      title: form.title.trim(),
      type: form.type,
      amount,
      cadence: form.cadence,
      accountId: form.accountId,
      categoryId: form.categoryId || null,
      nextRunDate: form.nextRunDate || undefined,
    });
    setSaving(false);
    if (res.success) {
      toast({ title: "قلم تکرارشونده ثبت شد", description: `${toman(amount)} تومان — ${CADENCE_LABELS[form.cadence]}` });
      setDialogOpen(false);
      setForm({ title: "", type: "expense", amount: "", cadence: "monthly", accountId: accounts[0]?.id || "", categoryId: "", nextRunDate: "" });
      load();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const toggleActive = async (r: Recurring) => {
    const res = await patch(`/api/finance/recurring/${r.id}`, { isActive: !r.isActive });
    if (res.success) { toast({ title: r.isActive ? "موقتاً متوقف شد" : "فعال شد" }); load(); }
  };

  const handleDelete = async (id: string) => {
    const res = await del(`/api/finance/recurring/${id}`);
    if (res.success) { toast({ title: "حذف شد" }); load(); }
  };

  return (
    <div className="space-y-4">
      {/* ─── کارت خلاصه ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl bg-card border border-border/60 p-5 shadow-sm"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Repeat className="w-4 h-4 text-primary" />
              تراکنش‌های تکرارشونده
            </h3>
            <p className="text-[11px] text-muted-foreground mt-1">
              اجاره، اشتراک‌ها و حقوق — به‌موقع خودکار ثبت می‌شوند
            </p>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)} className="rounded-xl shahryar-gradient text-white h-8">
            <Plus className="w-4 h-4 ml-1" />
            افزودن
          </Button>
        </div>
        {monthlyCommitment > 0 && (
          <div className="rounded-2xl bg-muted/50 p-3 flex justify-between items-center">
            <span className="text-xs text-muted-foreground">تعهد ماهانه‌ی جاری</span>
            <span className="font-black tabular-nums text-rose-500">{toman(monthlyCommitment)} تومان</span>
          </div>
        )}
      </motion.div>

      {/* ─── لیست ─── */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-card animate-pulse border border-border/40" />
          ))}
        </div>
      ) : recurrings.length === 0 ? (
        <div className="rounded-3xl bg-card border border-border/60 p-10 text-center">
          <Repeat className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium mb-1">قلم تکرارشونده‌ای ندارید</p>
          <p className="text-xs text-muted-foreground">
            اجاره خانه، اشتراک اینترنت یا حقوق ثابت را ثبت کنید تا هر ماه خودکار ثبت شود
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {[...active, ...inactive].map((r, i) => {
            const isExpense = r.type === "expense";
            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`rounded-2xl bg-card border border-border/60 p-4 shadow-sm group ${r.isActive ? "" : "opacity-55"}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isExpense ? "bg-rose-100 dark:bg-rose-900/40 text-rose-500" : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600"
                  }`}>
                    {isExpense ? <Send className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} /> : <Download className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{r.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {toman(r.amount)} تومان · {CADENCE_LABELS[r.cadence]}
                      {r.account ? ` · ${r.account.name}` : ""}
                      {r.category ? ` · ${r.category.name}` : ""}
                    </p>
                  </div>
                  <div className="text-left shrink-0">
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end">
                      <Calendar className="w-3 h-3" />
                      {r.isActive ? faDate(r.nextRunDate) : "متوقف"}
                    </p>
                    <div className="flex gap-1 justify-end mt-1">
                      <button
                        onClick={() => toggleActive(r)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        title={r.isActive ? "توقف" : "فعال‌سازی"}
                      >
                        {r.isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ─── دیالوگ افزودن ─── */}
      <AppDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        icon={Repeat}
        size="sm"
        locked={saving}
        title="قلم تکرارشونده‌ی جدید"
        description="هزینه‌ها و درآمدهای دوره‌ای را خودکار ثبت کن"
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">انصراف</Button>
            <Button onClick={handleCreate} disabled={saving} className="rounded-xl shahryar-gradient text-white font-bold">
              {saving ? "..." : "ثبت"}
            </Button>
          </>
        }
      >
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, type: "expense", categoryId: "" })}
                className={`py-3 rounded-2xl text-xs font-bold border transition-all ${
                  form.type === "expense" ? "bg-rose-500 text-white border-transparent shadow-md" : "border-border/60 bg-card text-muted-foreground"
                }`}
              >
                هزینه‌ی دوره‌ای
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, type: "income", categoryId: "" })}
                className={`py-3 rounded-2xl text-xs font-bold border transition-all ${
                  form.type === "income" ? "bg-emerald-500 text-white border-transparent shadow-md" : "border-border/60 bg-card text-muted-foreground"
                }`}
              >
                درآمد دوره‌ای
              </button>
            </div>
            <div className="space-y-1.5">
              <Label>عنوان</Label>
              <Input
                value={form.title} maxLength={100}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="مثلاً: اجاره مغازه"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>مبلغ (تومان)</Label>
                <Input
                  dir="ltr" inputMode="numeric"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d]/g, "") })}
                  placeholder="۳۵۰۰۰۰۰"
                  className="text-left font-bold tabular-nums h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>دوره</Label>
                <Select value={form.cadence} onValueChange={(v) => setForm({ ...form, cadence: v })}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CADENCE_LABELS).map(([id, l]) => (
                      <SelectItem key={id} value={id}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>حساب</Label>
              <Select value={form.accountId} onValueChange={(v) => setForm({ ...form, accountId: v })}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="انتخاب حساب" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name} ({ACCOUNT_TYPE_LABELS[a.type] || a.type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>دسته‌بندی (اختیاری)</Label>
              <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="انتخاب دسته" /></SelectTrigger>
                <SelectContent className="max-h-52">
                  {categories.filter((c) => c.type === form.type).map((c) => (
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
              <Label>اولین سررسید</Label>
              <JalaliDatePicker value={form.nextRunDate} onChange={(v) => setForm({ ...form, nextRunDate: v })} clearable={false} />
            </div>
            <p className="text-[11px] text-muted-foreground leading-5">
              هنگام باز کردن این بخش، اقلام سررسیدشده به‌صورت تراکنش واقعی ثبت می‌شوند.
            </p>
          </div>
      </AppDialog>
    </div>
  );
}
