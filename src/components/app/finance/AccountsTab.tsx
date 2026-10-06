// ═════ تب حساب‌ها — کیف پول، بانک، کارت با موجودی زنده ═════
"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Wallet, Landmark, CreditCard, Coins, Archive } from "lucide-react";
import AppDialog from "@/components/ui/app-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { get, post, patch, del } from "@/lib/client/api";
import { toast } from "@/hooks/use-toast";
import { faNum, enNum } from "@/lib/client/persian";
import { toman, tomanShort, ACCOUNT_TYPE_LABELS } from "@/lib/client/finance";

interface Account {
  id: string; name: string; type: string; initialBalance: number;
  color: string; note: string | null; isActive: boolean;
  balance: number; createdAt: string;
}

const TYPE_META: Record<string, { label: string; icon: typeof Wallet; classes: string }> = {
  cash: { label: "نقدی", icon: Coins, classes: "bg-amber-100 dark:bg-amber-900/40 text-amber-600" },
  bank: { label: "حساب بانکی", icon: Landmark, classes: "bg-sky-100 dark:bg-sky-900/40 text-sky-600" },
  card: { label: "کارت بانکی", icon: CreditCard, classes: "bg-violet-100 dark:bg-violet-900/40 text-violet-600" },
  wallet: { label: "کیف پول", icon: Wallet, classes: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600" },
};

const ACCOUNT_COLORS = ["#0e8a5a", "#2980b9", "#8e44ad", "#e67e22", "#c0392b", "#16a085"];

export default function AccountsTab() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);
  // فرم از state اولیه (ویرایش/جدید) پر می‌شود؛ ریست کامل با key روی
  // دیالوگ — بدون effect-s setState (سازگار با React Compiler)
  const [form, setForm] = useState(() => editing
    ? {
        name: editing.name, type: editing.type,
        initialBalance: faNum(editing.initialBalance.toLocaleString("en-US")),
        color: editing.color, note: editing.note || "",
      }
    : { name: "", type: "cash", initialBalance: "", color: ACCOUNT_COLORS[0], note: "" });

  const load = useCallback(async () => {
    const res = await get<{ accounts: Account[]; total: number }>("/api/finance/accounts");
    if (res.success && res.data) setAccounts(res.data.accounts);
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const active = accounts.filter((a) => a.isActive);
  const archived = accounts.filter((a) => !a.isActive);
  const total = active.reduce((s, a) => s + a.balance, 0);

  const handleSave = async () => {
    const initialBalance = Number(enNum(form.initialBalance).replace(/[^\d-]/g, "")) || 0;
    if (!form.name.trim()) { toast({ title: "نام حساب الزامی است", variant: "destructive" }); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      type: form.type,
      initialBalance,
      color: form.color,
      note: form.note.trim() || undefined,
    };
    const res = editing
      ? await patch(`/api/finance/accounts/${editing.id}`, payload)
      : await post("/api/finance/accounts", payload);
    setSaving(false);
    if (res.success) {
      toast({ title: editing ? "حساب ویرایش شد" : "حساب ساخته شد", description: form.name.trim() });
      setDialogOpen(false); setEditing(null);
      load();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    const res = await del(`/api/finance/accounts/${id}`);
    if (res.success) {
      const data = res.data as { archived?: boolean };
      toast({ title: data?.archived ? "حساب بایگانی شد" : "حساب حذف شد" });
      load();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const handleActivate = async (id: string) => {
    const res = await patch(`/api/finance/accounts/${id}`, { isActive: true });
    if (res.success) { toast({ title: "حساب فعال شد" }); load(); }
  };

  const AccountCard = ({ a, index }: { a: Account; index: number }) => {
    const meta = TYPE_META[a.type] || TYPE_META.cash;
    const Icon = meta.icon;
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ delay: index * 0.06 }}
        className={`rounded-3xl bg-card border p-4 shadow-sm group relative overflow-hidden ${a.isActive ? "border-border/60" : "border-border/40 opacity-60"}`}
      >
        {/* نوار رنگی */}
        <div className="absolute top-0 right-0 w-1.5 h-full" style={{ backgroundColor: a.color }} />
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${meta.classes}`}>
            <Icon className="w-5.5 h-5.5" style={{ width: 22, height: 22 }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">{a.name}</p>
            <p className="text-[11px] text-muted-foreground">{meta.label}{a.note ? ` · ${a.note}` : ""}</p>
          </div>
          <button
            onClick={() => handleDelete(a.id)}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1 shrink-0"
            title={a.isActive ? "حذف/بایگانی" : "حذف"}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className={`text-base md:text-xl font-black tabular-nums ${a.balance >= 0 ? "" : "text-rose-500"}`}>
              {tomanShort(a.balance)}
            </p>
            <p className="text-[9px] text-muted-foreground">
              تومان {a.initialBalance !== 0 ? `· آغازین ${tomanShort(a.initialBalance)}` : ""}
            </p>
          </div>
          <button
            onClick={() => { setEditing(a); setDialogOpen(true); }}
            className="text-[11px] font-bold text-primary hover:underline"
          >
            ویرایش
          </button>
        </div>
        {!a.isActive && (
          <button
            onClick={() => handleActivate(a.id)}
            className="w-full mt-3 text-xs py-2 rounded-xl bg-muted hover:bg-accent transition-colors flex items-center justify-center gap-1.5"
          >
            <Archive className="w-3.5 h-3.5" />
            فعال‌سازی مجدد
          </button>
        )}
      </motion.div>
    );
  };

  return (
    <div className="space-y-4">
      {/* ─── کارت مجموع ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl shahryar-gradient p-6 text-white shadow-lg relative overflow-hidden"
      >
        <div className="absolute -top-8 -left-8 w-36 h-36 rounded-full bg-white/10" />
        <div className="absolute -bottom-12 -right-4 w-28 h-28 rounded-full bg-white/10" />
        <p className="text-xs opacity-90 mb-1.5">موجودی کل حساب‌های فعال</p>
        <p className="text-xl md:text-3xl font-black tabular-nums">{toman(total)}</p>
        <p className="text-[10px] opacity-80 mt-1.5">تومان · {faNum(active.length)} حساب فعال</p>
      </motion.div>

      {/* ─── دکمه ساخت ─── */}
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="rounded-xl shahryar-gradient text-white font-bold">
          <Plus className="w-4 h-4 ml-1" />
          حساب جدید
        </Button>
      </div>

      {/* ─── لیست حساب‌ها ─── */}
      {loading ? (
        <div className="grid md:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-3xl bg-card animate-pulse border border-border/40" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-3xl bg-card border border-border/60 p-10 text-center">
          <Wallet className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium mb-1">هنوز حسابی نساخته‌اید</p>
          <p className="text-xs text-muted-foreground mb-4">
            با یک حساب «نقدی» یا «بانکی» شروع کنید تا تراکنش‌ها جایی ثبت شوند
          </p>
          <Button onClick={() => setDialogOpen(true)} className="rounded-xl shahryar-gradient text-white">
            ساخت اولین حساب
          </Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          <AnimatePresence>
            {active.map((a, i) => <AccountCard key={a.id} a={a} index={i} />)}
          </AnimatePresence>
          {archived.length > 0 && (
            <>
              <p className="text-xs font-bold text-muted-foreground px-1 pt-2 md:col-span-2 flex items-center gap-1.5">
                <Archive className="w-3.5 h-3.5" />
                بایگانی‌شده
              </p>
              {archived.map((a, i) => <AccountCard key={a.id} a={a} index={i} />)}
            </>
          )}
        </div>
      )}

      {/* ─── دیالوگ ساخت/ویرایش حساب ─── */}
      <AppDialog
        key={`${editing ? editing.id : "new"}-${dialogOpen}`}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        icon={Wallet}
        size="sm"
        locked={saving}
        title={editing ? "ویرایش حساب" : "حساب جدید"}
        description={editing ? "جزئیات حساب را به‌روز کن" : "حساب‌هایت را تفکیک کن"}
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">انصراف</Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl shahryar-gradient text-white font-bold">
              {saving ? "..." : editing ? "ذخیره" : "ساخت حساب"}
            </Button>
          </>
        }
      >
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>نام حساب</Label>
              <Input
                value={form.name} maxLength={60}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="مثلاً: بانک ملت"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>نوع حساب</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_META).map(([id, m]) => (
                    <SelectItem key={id} value={id}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>موجودی اولیه (تومان)</Label>
              <Input
                dir="ltr" inputMode="numeric"
                value={form.initialBalance}
                onChange={(e) => {
                  const raw = enNum(e.target.value).replace(/[^\d]/g, "");
                  if (Number(raw) > 2_000_000_000) return;
                  setForm({ ...form, initialBalance: raw ? faNum(Number(raw).toLocaleString("en-US")) : "" });
                }}
                placeholder="۰"
                className="text-left font-bold tabular-nums h-11 rounded-xl"
              />
              {editing && (
                <p className="text-[10px] text-muted-foreground">
                  توجه: تغییر موجودی اولیه، محاسبه‌ی موجودی فعلی را جابه‌جا می‌کند
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>رنگ</Label>
              <div className="flex gap-2">
                {ACCOUNT_COLORS.map((c) => (
                  <button
                    key={c} type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className={`w-8 h-8 rounded-full transition-transform ${form.color === c ? "scale-125" : "hover:scale-110"}`}
                    style={{ backgroundColor: c, boxShadow: form.color === c ? `0 0 0 2px ${c}` : undefined }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>یادداشت (اختیاری)</Label>
              <Input
                value={form.note} maxLength={200}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="مثلاً: حساب حقوق"
                className="h-11 rounded-xl"
              />
            </div>
          </div>
      </AppDialog>
    </div>
  );
}
