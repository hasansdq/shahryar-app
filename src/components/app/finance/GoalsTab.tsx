// ═════ تب اهداف مالی — پس‌انداز با حلقه پیشرفت و واریز ═════
"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Target, Trophy, Calendar, PiggyBank } from "lucide-react";
import AppDialog from "@/components/ui/app-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import JalaliDatePicker from "@/components/ui/jalali-date-picker";
import { get, post, patch, del } from "@/lib/client/api";
import { toast } from "@/hooks/use-toast";
import { faNum, enNum, faDate } from "@/lib/client/persian";
import { toman, tomanShort } from "@/lib/client/finance";

interface Goal {
  id: string; title: string; targetAmount: number; currentAmount: number;
  deadline: string | null; color: string; note: string | null;
  status: string; createdAt: string;
}

const GOAL_COLORS = ["#0e8a5a", "#2980b9", "#8e44ad", "#e67e22", "#c0392b", "#16a085"];

export default function GoalsTab() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [contributeGoal, setContributeGoal] = useState<Goal | null>(null);
  const [contributeAmount, setContributeAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", target: "", current: "", deadline: "", color: GOAL_COLORS[0], note: "" });

  const load = useCallback(async () => {
    const res = await get<{ goals: Goal[] }>("/api/finance/goals");
    if (res.success && res.data) setGoals(res.data.goals);
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const active = goals.filter((g) => g.status === "active");
  const completed = goals.filter((g) => g.status === "completed");
  const totalSaved = active.reduce((s, g) => s + g.currentAmount, 0);
  const totalTarget = active.reduce((s, g) => s + g.targetAmount, 0);

  const handleCreate = async () => {
    const target = Number(enNum(form.target).replace(/[^\d]/g, ""));
    if (!form.title.trim()) { toast({ title: "عنوان الزامی است", variant: "destructive" }); return; }
    if (!target || target <= 0) { toast({ title: "مبلغ هدف نامعتبر", variant: "destructive" }); return; }
    setSaving(true);
    const res = await post("/api/finance/goals", {
      title: form.title.trim(),
      targetAmount: target,
      currentAmount: Number(enNum(form.current).replace(/[^\d]/g, "")) || 0,
      deadline: form.deadline || undefined,
      color: form.color,
      note: form.note.trim() || undefined,
    });
    setSaving(false);
    if (res.success) {
      toast({ title: "هدف ساخته شد 🎯", description: form.title.trim() });
      setDialogOpen(false);
      setForm({ title: "", target: "", current: "", deadline: "", color: GOAL_COLORS[0], note: "" });
      load();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const handleContribute = async () => {
    if (!contributeGoal) return;
    const amount = Number(enNum(contributeAmount).replace(/[^\d]/g, ""));
    if (!amount || amount === 0) { toast({ title: "مبلغ نامعتبر", variant: "destructive" }); return; }
    setSaving(true);
    const res = await patch(`/api/finance/goals/${contributeGoal.id}`, { contribute: amount });
    setSaving(false);
    if (res.success) {
      const updated = res.data as { goal: Goal };
      const done = updated?.goal?.status === "completed";
      toast({
        title: done ? "🎉 هدف تکمیل شد!" : "واریز ثبت شد",
        description: done ? "تبریک! به هدفت رسیدی" : `${toman(amount)} تومان به «${contributeGoal.title}»`,
      });
      setContributeGoal(null); setContributeAmount("");
      load();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    const res = await del(`/api/finance/goals/${id}`);
    if (res.success) { toast({ title: "هدف حذف شد" }); load(); }
  };

  const GoalCard = ({ g, index }: { g: Goal; index: number }) => {
    const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0;
    const isDone = g.status === "completed";
    const r = 34;
    const circ = 2 * Math.PI * r;
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ delay: index * 0.06 }}
        className={`rounded-3xl bg-card border p-4 shadow-sm group ${isDone ? "border-emerald-500/30" : "border-border/60"}`}
      >
        <div className="flex items-center gap-4">
          {/* حلقه پیشرفت */}
          <div className="relative w-20 h-20 shrink-0">
            <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
              <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="7" opacity={0.08} />
              <motion.circle
                cx="40" cy="40" r={r} fill="none"
                stroke={isDone ? "#10b981" : g.color}
                strokeWidth="7" strokeLinecap="round"
                strokeDasharray={circ}
                initial={{ strokeDashoffset: circ }}
                animate={{ strokeDashoffset: circ * (1 - pct / 100) }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-black tabular-nums">{faNum(pct)}٪</span>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-sm truncate flex items-center gap-1.5">
                {isDone ? <Trophy className="w-4 h-4 text-amber-500 shrink-0" /> : <Target className="w-4 h-4 shrink-0" style={{ color: g.color }} />}
                {g.title}
              </p>
              <button
                onClick={() => handleDelete(g.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs mt-1 tabular-nums">
              <span className="font-bold" style={{ color: g.color }}>{toman(g.currentAmount)}</span>
              <span className="text-muted-foreground"> از {toman(g.targetAmount)} تومان</span>
            </p>
            {g.deadline && !isDone && (
              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                مهلت: {faDate(g.deadline)}
              </p>
            )}
            {!isDone && pct < 100 && (
              <button
                onClick={() => { setContributeGoal(g); setContributeAmount(""); }}
                className="mt-2 text-[11px] font-bold px-3 py-1.5 rounded-lg shahryar-gradient text-white hover:shadow-md transition-shadow inline-flex items-center gap-1"
              >
                <PiggyBank className="w-3.5 h-3.5" />
                واریز
              </button>
            )}
          </div>
        </div>
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
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            اهداف پس‌انداز من
          </h3>
          <Button size="sm" onClick={() => setDialogOpen(true)} className="rounded-xl shahryar-gradient text-white h-8">
            <Plus className="w-4 h-4 ml-1" />
            هدف جدید
          </Button>
        </div>
        {active.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-muted/50 p-3">
              <p className="text-[10px] text-muted-foreground mb-1">مجموع ذخیره‌شده</p>
              <p className="text-lg font-black tabular-nums text-emerald-600">{tomanShort(totalSaved)}</p>
              <p className="text-[9px] text-muted-foreground">تومان از {tomanShort(totalTarget)} هدف</p>
            </div>
            <div className="rounded-2xl bg-muted/50 p-3">
              <p className="text-[10px] text-muted-foreground mb-1">اهداف فعال / تکمیل</p>
              <p className="text-lg font-black">{faNum(active.length)} / {faNum(completed.length)}</p>
              <p className="text-[9px] text-muted-foreground">
                {totalTarget > 0 ? `پیشرفت کلی ${faNum(Math.round((totalSaved / totalTarget) * 100))}٪` : "—"}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">
            هنوز هدف پس‌اندازی ندارید — از یک هدف کوچک شروع کنید، مثلاً «خرید لپ‌تاپ ۲۵ میلیونی»
          </p>
        )}
      </motion.div>

      {/* ─── لیست اهداف ─── */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 rounded-3xl bg-card animate-pulse border border-border/40" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {active.length > 0 && (
            <AnimatePresence>
              {active.map((g, i) => <GoalCard key={g.id} g={g} index={i} />)}
            </AnimatePresence>
          )}
          {completed.length > 0 && (
            <>
              <p className="text-xs font-bold text-muted-foreground px-2 pt-2">✨ اهداف تکمیل‌شده</p>
              <AnimatePresence>
                {completed.map((g, i) => <GoalCard key={g.id} g={g} index={i} />)}
              </AnimatePresence>
            </>
          )}
          {goals.length === 0 && (
            <div className="rounded-3xl bg-card border border-border/60 p-10 text-center">
              <Target className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium mb-1">هدفی تعریف نشده</p>
              <p className="text-xs text-muted-foreground">
                اهداف پس‌انداز، انگیزه‌ی مدیریت پول را زنده نگه می‌دارند
              </p>
            </div>
          )}
        </div>
      )}

      {/* ─── دیالوگ ساخت هدف ─── */}
      <AppDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        icon={PiggyBank}
        size="sm"
        locked={saving}
        title="هدف پس‌انداز جدید"
        description="برای رؤیاهایت پس‌انداز کن"
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">انصراف</Button>
            <Button onClick={handleCreate} disabled={saving} className="rounded-xl shahryar-gradient text-white font-bold">
              {saving ? "..." : "ساخت هدف"}
            </Button>
          </>
        }
      >
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>عنوان هدف</Label>
              <Input
                value={form.title} maxLength={100}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="مثلاً: سفر نوروزی"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>مبلغ هدف (تومان)</Label>
                <Input
                  dir="ltr" inputMode="numeric"
                  value={form.target}
                  onChange={(e) => setForm({ ...form, target: e.target.value.replace(/[^\d]/g, "") })}
                  placeholder="25000000"
                  className="text-left font-bold tabular-nums h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>پس‌انداز فعلی (اختیاری)</Label>
                <Input
                  dir="ltr" inputMode="numeric"
                  value={form.current}
                  onChange={(e) => setForm({ ...form, current: e.target.value.replace(/[^\d]/g, "") })}
                  placeholder="0"
                  className="text-left font-bold tabular-nums h-11 rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>مهلت (اختیاری)</Label>
              <JalaliDatePicker value={form.deadline} onChange={(v) => setForm({ ...form, deadline: v })} />
            </div>
            <div className="space-y-1.5">
              <Label>رنگ</Label>
              <div className="flex gap-2">
                {GOAL_COLORS.map((c) => (
                  <button
                    key={c} type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className={`w-8 h-8 rounded-full transition-transform ${form.color === c ? "scale-125 ring-2 ring-offset-2 ring-offset-card" : "hover:scale-110"}`}
                    style={{ backgroundColor: c, boxShadow: form.color === c ? `0 0 0 2px ${c}` : undefined }}
                  />
                ))}
              </div>
            </div>
          </div>
      </AppDialog>

      {/* ─── دیالوگ واریز ─── */}
      <AppDialog
        open={Boolean(contributeGoal)}
        onClose={() => setContributeGoal(null)}
        icon={PiggyBank}
        size="xs"
        locked={saving}
        title={`واریز به «${contributeGoal?.title || ""}»`}
        description={contributeGoal ? `مانده تا هدف: ${toman((contributeGoal.targetAmount || 0) - (contributeGoal.currentAmount || 0))} تومان` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setContributeGoal(null)} className="rounded-xl">انصراف</Button>
            <Button onClick={handleContribute} disabled={saving} className="rounded-xl shahryar-gradient text-white font-bold">
              {saving ? "..." : "ثبت واریز"}
            </Button>
          </>
        }
      >
            <Input
              dir="ltr" inputMode="numeric"
              value={contributeAmount}
              onChange={(e) => setContributeAmount(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="مبلغ واریز (تومان)"
              className="text-left font-bold text-lg tabular-nums h-12 rounded-xl"
            />
      </AppDialog>
    </div>
  );
}
