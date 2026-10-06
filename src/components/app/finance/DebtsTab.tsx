// ═════ تب قرض‌ها — بدهی‌ها و طلب‌های دوسویه با تسویه قسط ═════
"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, HandCoins, Send, Download, Calendar, CheckCircle2, BanknoteArrowUp } from "lucide-react";
import AppDialog from "@/components/ui/app-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import JalaliDatePicker from "@/components/ui/jalali-date-picker";
import { get, post, patch, del } from "@/lib/client/api";
import { toast } from "@/hooks/use-toast";
import { faNum, enNum, faDate } from "@/lib/client/persian";
import { toman, tomanShort } from "@/lib/client/finance";

interface Debt {
  id: string; direction: string; personName: string; amount: number;
  remainingAmount: number; dueDate: string | null; description: string | null;
  status: string; settledAt: string | null;
}

export default function DebtsTab() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<Debt | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ direction: "i_owe", personName: "", amount: "", dueDate: "", description: "" });

  const load = useCallback(async () => {
    const res = await get<{ debts: Debt[] }>("/api/finance/debts");
    if (res.success && res.data) setDebts(res.data.debts);
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const open = debts.filter((d) => d.status === "open");
  const settled = debts.filter((d) => d.status === "settled");
  const iOwe = open.filter((d) => d.direction === "i_owe");
  const owedToMe = open.filter((d) => d.direction === "owed_to_me");

  const handleCreate = async () => {
    const amount = Number(enNum(form.amount).replace(/[^\d]/g, ""));
    if (!form.personName.trim()) { toast({ title: "نام طرف حساب الزامی است", variant: "destructive" }); return; }
    if (!amount || amount <= 0) { toast({ title: "مبلغ نامعتبر", variant: "destructive" }); return; }
    setSaving(true);
    const res = await post("/api/finance/debts", {
      direction: form.direction,
      personName: form.personName.trim(),
      amount,
      dueDate: form.dueDate || undefined,
      description: form.description.trim() || undefined,
    });
    setSaving(false);
    if (res.success) {
      toast({ title: "ثبت شد", description: `${form.direction === "i_owe" ? "بدهی" : "طلب"} ${toman(amount)} تومان` });
      setDialogOpen(false);
      setForm({ direction: "i_owe", personName: "", amount: "", dueDate: "", description: "" });
      load();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const handlePay = async () => {
    if (!payTarget) return;
    const amount = Number(enNum(payAmount).replace(/[^\d]/g, ""));
    if (!amount || amount <= 0) { toast({ title: "مبلغ نامعتبر", variant: "destructive" }); return; }
    setSaving(true);
    const res = await patch(`/api/finance/debts/${payTarget.id}`, { pay: amount });
    setSaving(false);
    if (res.success) {
      const updated = (res.data as { debt: Debt })?.debt;
      toast({
        title: updated?.status === "settled" ? "✓ تسویه کامل شد" : "پرداخت ثبت شد",
        description: `${toman(amount)} تومان — «${payTarget.personName}»`,
      });
      setPayTarget(null); setPayAmount(""); load();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    const res = await del(`/api/finance/debts/${id}`);
    if (res.success) { toast({ title: "حذف شد" }); load(); }
  };

  const DebtCard = ({ d, index }: { d: Debt; index: number }) => {
    const isIOwe = d.direction === "i_owe";
    const pct = d.amount > 0 ? Math.round((d.remainingAmount / d.amount) * 100) : 0;
    const isSettled = d.status === "settled";
    const overdue = !isSettled && d.dueDate && new Date(d.dueDate) < new Date();
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ delay: index * 0.05 }}
        className={`rounded-2xl bg-card border p-4 shadow-sm group ${
          isSettled ? "border-emerald-500/30 opacity-75" : overdue ? "border-amber-500/40" : "border-border/60"
        }`}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isSettled ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600"
                : isIOwe ? "bg-rose-100 dark:bg-rose-900/40 text-rose-500"
                : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600"
            }`}>
              {isSettled ? <CheckCircle2 className="w-5 h-5" /> : isIOwe ? <Send className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} /> : <Download className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm truncate">{d.personName}</p>
              <p className="text-[11px] text-muted-foreground">
                {isIOwe ? "من بدهکارم" : "به من بدهکار است"}
                {d.description ? ` · ${d.description}` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleDelete(d.id)}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1 shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-end justify-between mb-2">
          <div>
            {isSettled ? (
              <p className="text-sm font-black text-emerald-600 text-xs">تسویه‌شده — {toman(d.amount)} تومان</p>
            ) : (
              <>
                <p className="text-base font-black tabular-nums">{toman(d.remainingAmount)}</p>
                <p className="text-[10px] text-muted-foreground">مانده از {toman(d.amount)} تومان · {faNum(pct)}٪ باقی</p>
              </>
            )}
          </div>
          {d.dueDate && !isSettled && (
            <p className={`text-[10px] flex items-center gap-1 ${overdue ? "text-amber-600 font-bold" : "text-muted-foreground"}`}>
              <Calendar className="w-3 h-3" />
              {overdue ? "سررسید گذشته! " : ""}{faDate(d.dueDate)}
            </p>
          )}
        </div>

        {!isSettled && (
          <button
            onClick={() => { setPayTarget(d); setPayAmount(""); }}
            className={`w-full mt-1 text-xs font-bold py-2 rounded-xl transition-all ${
              isIOwe
                ? "bg-rose-500/10 text-rose-600 hover:bg-rose-500/20"
                : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
            }`}
          >
            {isIOwe ? "ثبت پرداخت" : "ثبت دریافت"}
          </button>
        )}
      </motion.div>
    );
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
          <h3 className="font-bold text-sm flex items-center gap-2">
            <HandCoins className="w-4 h-4 text-primary" />
            قرض‌ها و طلب‌ها
          </h3>
          <Button size="sm" onClick={() => setDialogOpen(true)} className="rounded-xl shahryar-gradient text-white h-8">
            <Plus className="w-4 h-4 ml-1" />
            ثبت جدید
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-rose-500/8 p-3">
            <p className="text-[10px] text-muted-foreground mb-1">مجموع بدهی من</p>
            <p className="text-lg font-black tabular-nums text-rose-500">{tomanShort(iOwe.reduce((s, d) => s + d.remainingAmount, 0))}</p>
            <p className="text-[9px] text-muted-foreground">{faNum(iOwe.length)} مورد باز</p>
          </div>
          <div className="rounded-2xl bg-emerald-500/8 p-3">
            <p className="text-[10px] text-muted-foreground mb-1">مجموع طلب من</p>
            <p className="text-lg font-black tabular-nums text-emerald-600">{tomanShort(owedToMe.reduce((s, d) => s + d.remainingAmount, 0))}</p>
            <p className="text-[9px] text-muted-foreground">{faNum(owedToMe.length)} مورد باز</p>
          </div>
        </div>
      </motion.div>

      {/* ─── لیست‌ها ─── */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-card animate-pulse border border-border/40" />
          ))}
        </div>
      ) : debts.length === 0 ? (
        <div className="rounded-3xl bg-card border border-border/60 p-10 text-center">
          <HandCoins className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium mb-1">قرضی ثبت نشده</p>
          <p className="text-xs text-muted-foreground">
            قرض‌های بین‌فامیلی و اقساط را ثبت کنید تا سرِ موعد غافلگیر نشوید
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {open.length > 0 && (
            <AnimatePresence>
              {open.map((d, i) => <DebtCard key={d.id} d={d} index={i} />)}
            </AnimatePresence>
          )}
          {settled.length > 0 && (
            <>
              <p className="text-xs font-bold text-muted-foreground px-2 pt-2">✓ تسویه‌شده‌ها</p>
              <AnimatePresence>
                {settled.map((d, i) => <DebtCard key={d.id} d={d} index={i} />)}
              </AnimatePresence>
            </>
          )}
        </div>
      )}

      {/* ─── دیالوگ ثبت ─── */}
      <AppDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        icon={HandCoins}
        size="sm"
        locked={saving}
        title="ثبت قرض / طلب"
        description="قرض‌هایت را ثبت کن تا یادت نرود"
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
                onClick={() => setForm({ ...form, direction: "i_owe" })}
                className={`py-3 rounded-2xl text-xs font-bold border transition-all ${
                  form.direction === "i_owe"
                    ? "bg-rose-500 text-white border-transparent shadow-md"
                    : "border-border/60 bg-card text-muted-foreground hover:bg-accent"
                }`}
              >
                من بدهکارم
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, direction: "owed_to_me" })}
                className={`py-3 rounded-2xl text-xs font-bold border transition-all ${
                  form.direction === "owed_to_me"
                    ? "bg-emerald-500 text-white border-transparent shadow-md"
                    : "border-border/60 bg-card text-muted-foreground hover:bg-accent"
                }`}
              >
                به من بدهکار است
              </button>
            </div>
            <div className="space-y-1.5">
              <Label>نام طرف حساب</Label>
              <Input
                value={form.personName} maxLength={80}
                onChange={(e) => setForm({ ...form, personName: e.target.value })}
                placeholder="مثلاً: علی (برادرزاده)"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>مبلغ کل (تومان)</Label>
              <Input
                dir="ltr" inputMode="numeric"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d]/g, "") })}
                placeholder="5000000"
                className="text-left font-bold tabular-nums h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>سررسید (اختیاری)</Label>
              <JalaliDatePicker value={form.dueDate} onChange={(v) => setForm({ ...form, dueDate: v })} />
            </div>
            <div className="space-y-1.5">
              <Label>توضیحات (اختیاری)</Label>
              <Input
                value={form.description} maxLength={300}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="مثلاً: برای تعمیر ماشین"
                className="h-11 rounded-xl"
              />
            </div>
          </div>
      </AppDialog>

      {/* ─── دیالوگ پرداخت ─── */}
      <AppDialog
        open={Boolean(payTarget)}
        onClose={() => setPayTarget(null)}
        icon={BanknoteArrowUp}
        size="xs"
        locked={saving}
        title={`${payTarget?.direction === "i_owe" ? "پرداخت" : "دریافت"} — ${payTarget?.personName || ""}`}
        description={payTarget ? `مانده: ${toman(payTarget.remainingAmount || 0)} تومان` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setPayTarget(null)} className="rounded-xl">انصراف</Button>
            <Button onClick={handlePay} disabled={saving} className="rounded-xl shahryar-gradient text-white font-bold">
              {saving ? "..." : "ثبت"}
            </Button>
          </>
        }
      >
            <Input
              dir="ltr" inputMode="numeric"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="مبلغ"
              className="text-left font-bold text-lg tabular-nums h-12 rounded-xl"
            />
            {payTarget && payAmount === "" && (
              <div className="flex gap-2">
                <button
                  onClick={() => setPayAmount(String(Math.round(payTarget.remainingAmount / 2)))}
                  className="flex-1 text-xs py-2 rounded-xl bg-muted hover:bg-accent transition-colors"
                >
                  نصف مانده
                </button>
                <button
                  onClick={() => setPayAmount(String(payTarget.remainingAmount))}
                  className="flex-1 text-xs py-2 rounded-xl bg-muted hover:bg-accent transition-colors"
                >
                  تسویه کامل
                </button>
              </div>
            )}
      </AppDialog>
    </div>
  );
}
