// ═════ دیالوگ ثبت/ویرایش تراکنش مالی ═════
"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpCircle, ArrowDownCircle, ArrowLeftRight, Trash2, ReceiptText,
} from "lucide-react";
import AppDialog from "@/components/ui/app-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import JalaliDatePicker from "@/components/ui/jalali-date-picker";
import { post, patch, del } from "@/lib/client/api";
import { toast } from "@/hooks/use-toast";
import { faNum, enNum } from "@/lib/client/persian";
import { jalaliToISO, jalaliToday } from "@/lib/client/jalali";
import { toman, TX_TYPE_LABELS, ACCOUNT_TYPE_LABELS } from "@/lib/client/finance";

export interface Category {
  id: string; name: string; type: string; color: string; icon: string;
}
export interface Account {
  id: string; name: string; type: string; color: string; balance: number;
  isActive?: boolean;
}
export interface Transaction {
  id: string; type: string; amount: number; date: string;
  description: string | null; accountId: string; categoryId: string | null;
  transferToId: string | null;
  account?: { name: string; color: string };
  category?: { name: string; color: string; icon: string } | null;
  transferTo?: { name: string } | null;
}

const TYPES = [
  { id: "expense", label: "هزینه", icon: ArrowDownCircle, active: "bg-rose-500 text-white" },
  { id: "income", label: "درآمد", icon: ArrowUpCircle, active: "bg-emerald-500 text-white" },
  { id: "transfer", label: "انتقال", icon: ArrowLeftRight, active: "bg-sky-500 text-white" },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  categories: Category[];
  editing?: Transaction | null;
  onSaved: () => void;
}

export default function TransactionDialog({
  open, onOpenChange, accounts, categories, editing, onSaved,
}: Props) {
  // فرم از state اولیه (ویرایش/جدید) پر می‌شود؛ ریست کامل با key در والد
  // (هر باز شدن یا تغییر تراکنشِ در حال ویرایش → remount) — بدون effect-s setState
  const [type, setType] = useState<string>(editing?.type || "expense");
  const [amount, setAmount] = useState(editing ? faNum(editing.amount.toLocaleString("en-US")) : "");
  const [accountId, setAccountId] = useState(editing?.accountId || "");
  const [transferToId, setTransferToId] = useState(editing?.transferToId || "");
  const [categoryId, setCategoryId] = useState(editing?.categoryId || "");
  const [date, setDate] = useState(() => {
    if (editing) {
      const d = new Date(editing.date);
      return jalaliToISO(d.getFullYear(), d.getMonth() + 1, d.getDate());
    }
    const t = jalaliToday();
    return jalaliToISO(t.jy, t.jm, t.jd);
  });
  const [description, setDescription] = useState(editing?.description || "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // انتخاب پیش‌فرض حساب اول در فرم جدید (به‌محض رسیدن لیست حساب‌ها) —
  // الگوی رسمی React «تنظیم ستِیت در رندر» با گارد، بدون effect
  const [defaultAccountKey, setDefaultAccountKey] = useState<string | null>(null);
  if (!editing && !accountId && accounts[0] && defaultAccountKey !== accounts[0].id) {
    setDefaultAccountKey(accounts[0].id);
    setAccountId(accounts[0].id);
  }

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type]
  );

  const amountNum = Number(enNum(amount).replace(/[^\d]/g, "")) || 0;

  const handleSave = async () => {
    if (!amountNum || amountNum <= 0) {
      toast({ title: "مبلغ نامعتبر", description: "لطفاً مبلغ را وارد کنید", variant: "destructive" });
      return;
    }
    if (!accountId) {
      toast({ title: "حساب انتخاب نشده", variant: "destructive" });
      return;
    }
    if (type === "transfer" && (!transferToId || transferToId === accountId)) {
      toast({ title: "حساب مقصد انتقال نامعتبر است", variant: "destructive" });
      return;
    }

    setSaving(true);
    const payload = {
      type, amount: amountNum, accountId,
      categoryId: type === "transfer" ? null : categoryId || null,
      transferToId: type === "transfer" ? transferToId : null,
      date: date ? new Date(date).toISOString() : new Date().toISOString(),
      description: description.trim() || null,
    };

    const res = editing
      ? await patch(`/api/finance/transactions/${editing.id}`, payload)
      : await post("/api/finance/transactions", payload);

    setSaving(false);
    if (res.success) {
      toast({
        title: editing ? "تراکنش ویرایش شد" : "تراکنش ثبت شد",
        description: `${TX_TYPE_LABELS[type]} ${toman(amountNum)} تومان`,
      });
      onOpenChange(false);
      onSaved();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    setDeleting(true);
    const res = await del(`/api/finance/transactions/${editing.id}`);
    setDeleting(false);
    if (res.success) {
      toast({ title: "تراکنش حذف شد" });
      onOpenChange(false);
      onSaved();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  return (
    <AppDialog
      open={open}
      onClose={() => onOpenChange(false)}
      icon={ReceiptText}
      size="md"
      locked={saving}
      title={editing ? "ویرایش تراکنش" : "ثبت تراکنش جدید"}
      description={editing ? "جزئیات تراکنش را اصلاح کن" : "گردش مالی امروزت را ثبت کن"}
      footer={
        <>
          {editing && (
            <Button
              variant="ghost" onClick={handleDelete} disabled={deleting}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl"
            >
              <Trash2 className="w-4 h-4 ml-1" />
              حذف
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">انصراف</Button>
          <Button onClick={handleSave} disabled={saving} className="rounded-xl shahryar-gradient text-white font-bold">
            {saving ? "در حال ذخیره..." : editing ? "ذخیره تغییرات" : "ثبت تراکنش"}
          </Button>
        </>
      }
    >

        <div className="space-y-4 pt-2">
          {/* نوع تراکنش */}
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { setType(t.id); setCategoryId(""); }}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border text-xs font-bold transition-all ${
                  type === t.id
                    ? `${t.active} border-transparent shadow-md scale-[1.03]`
                    : "border-border/60 bg-card text-muted-foreground hover:bg-accent"
                }`}
              >
                <t.icon className="w-5 h-5" />
                {t.label}
              </button>
            ))}
          </div>

          {/* مبلغ */}
          <div className="space-y-1.5">
            <Label>مبلغ (تومان)</Label>
            <div className="relative">
              <Input
                dir="ltr"
                inputMode="numeric"
                value={amount}
                onChange={(e) => {
                  const raw = enNum(e.target.value).replace(/[^\d]/g, "");
                  if (Number(raw) > 2_000_000_000) return;
                  setAmount(raw ? faNum(Number(raw).toLocaleString("en-US")) : "");
                }}
                placeholder="۰"
                className="text-lg font-bold text-left tabular-nums h-12"
              />
              {amountNum > 0 && (
                <motion.span
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none"
                >
                  {faNum(amountNum.toLocaleString("en-US"))} تومان
                </motion.span>
              )}
            </div>
          </div>

          {/* حساب مبدأ */}
          <div className="space-y-1.5">
            <Label>{type === "transfer" ? "از حساب" : "حساب"}</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="انتخاب حساب" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({ACCOUNT_TYPE_LABELS[a.type] || a.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* حساب مقصد برای انتقال */}
          {type === "transfer" && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-1.5 overflow-hidden">
              <Label>به حساب</Label>
              <Select value={transferToId} onValueChange={setTransferToId}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="انتخاب حساب مقصد" /></SelectTrigger>
                <SelectContent>
                  {accounts.filter((a) => a.id !== accountId).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} ({ACCOUNT_TYPE_LABELS[a.type] || a.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </motion.div>
          )}

          {/* دسته‌بندی (بدون انتقال) */}
          {type !== "transfer" && (
            <div className="space-y-1.5">
              <Label>دسته‌بندی</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="انتخاب دسته" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {filteredCategories.map((c) => (
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
          )}

          {/* تاریخ */}
          <div className="space-y-1.5">
            <Label>تاریخ</Label>
            <JalaliDatePicker value={date} onChange={setDate} clearable={false} />
          </div>

          {/* توضیحات */}
          <div className="space-y-1.5">
            <Label>توضیحات (اختیاری)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مثلاً: خرید نان سنگک"
              maxLength={300}
              className="h-11 rounded-xl"
            />
          </div>
        </div>
    </AppDialog>
  );
}
