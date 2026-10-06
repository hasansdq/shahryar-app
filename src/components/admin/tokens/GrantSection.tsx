// ═════ اقتصاد توکن — اهدا/کسر توکن کاربران + کاوشگر تراکنش‌ها ═════
"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Gift, Minus, Search, ChevronLeft, ChevronRight, History, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { get, post } from "@/lib/client/api";
import { faNum, faDateTime } from "@/lib/client/persian";
import { TX_TYPE_LABELS } from "@/lib/modules/tokens/types";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ─── انواع ───

interface TxRow {
  id: string;
  user: string;
  phone: string;
  type: string;
  amount: number;
  balanceAfter: number;
  feature: string | null;
  note: string | null;
  createdAt: string;
}

const FEATURE_LABELS: Record<string, string> = {
  chat: "گفتگو", deep_think: "تفکر عمیق", web_search: "جستجوی وب", image_gen: "تولید تصویر",
  finance_advisor: "مشاور مالی", goal_ai: "اهداف", forum_agent: "ایجنت انجمن",
  social_agent: "ایجنت شخصی", document_read: "خواندن اسناد", file_gen: "ساخت فایل",
};

// ═════ اهدا / کسر ═════

export function GrantSection({ onChanged }: { onChanged?: () => void }) {
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<"grant" | "deduct">("grant");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const n = Number(amount.replace(/[^0-9-]/g, ""));
    if (!/^09\d{9}$/.test(phone.trim())) {
      return toast({ title: "شماره موبایل معتبر نیست", description: "فرمت: 09xxxxxxxxx", variant: "destructive" });
    }
    if (!Number.isFinite(n) || n === 0) {
      return toast({ title: "مقدار توکن نامعتبر است", variant: "destructive" });
    }
    setBusy(true);
    const res = await post<{ balance: number; user: { fullName: string | null } }>("/api/admin/tokens/grant", {
      phone: phone.trim(),
      amount: mode === "grant" ? Math.abs(n) : -Math.abs(n),
      note: note.trim() || undefined,
    });
    setBusy(false);
    if (res.success && res.data) {
      toast({
        title: mode === "grant" ? "توکن اهدا شد" : "توکن کسر شد",
        description: `${res.data.user.fullName || phone} — موجودی جدید: ${faNum(res.data.balance)}`,
      });
      setAmount("");
      setNote("");
      onChanged?.();
    } else {
      toast({ title: "خطا", description: res.error || "انجام نشد", variant: "destructive" });
    }
  };

  return (
    <div className="max-w-xl space-y-4">
      <div className="rounded-3xl border border-border/60 bg-card p-5 space-y-4">
        {/* انتخاب حالت */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-accent/40">
          {(["grant", "deduct"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "rounded-xl py-2.5 text-sm font-black transition-all flex items-center justify-center gap-2",
                mode === m
                  ? m === "grant"
                    ? "bg-emerald-600 text-white shadow"
                    : "bg-rose-600 text-white shadow"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m === "grant" ? <Gift className="size-4" /> : <Minus className="size-4" />}
              {m === "grant" ? "اهدای توکن" : "کسر توکن"}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label>شماره موبایل کاربر *</Label>
          <div className="relative">
            <Phone className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09xxxxxxxxx"
              className="ps-10"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>مقدار توکن *</Label>
          <Input
            dir="ltr" inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="مثلاً 500"
          />
          {mode === "deduct" && (
            <p className="text-[11px] text-rose-600 dark:text-rose-400">کسر بیشتر از موجودی کاربر مجاز نیست</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>یادداشت (اختیاری)</Label>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="مثلاً جبران اختلال سرور"
          />
        </div>

        <Button
          onClick={submit}
          disabled={busy}
          className={cn(
            "w-full font-bold text-white",
            mode === "grant" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
          )}
        >
          {busy ? "..." : mode === "grant" ? "اهدای توکن به کاربر" : "کسر توکن از کاربر"}
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        هر اهدا/کسر با ثبت تراکنش دائمی و لاگ مدیریتی همراه است و در کاوشگر تراکنش‌ها قابل ردگیری خواهد بود.
      </p>
    </div>
  );
}

// ═════ کاوشگر تراکنش‌ها ═════

export function TransactionsSection() {
  const [rows, setRows] = useState<TxRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [page, setPage] = useState(1);
  const [type, setType] = useState<string>("all");
  const [phone, setPhone] = useState("");

  const load = useCallback(async () => {
    setRows(null);
    const params = new URLSearchParams({ page: String(page) });
    if (type !== "all") params.set("type", type);
    const res = await get<{ total: number; pageCount: number; transactions: TxRow[] }>(
      `/api/admin/tokens/transactions?${params.toString()}`
    );
    if (res.success && res.data) {
      setRows(res.data.transactions);
      setTotal(res.data.total);
      setPageCount(res.data.pageCount);
    } else {
      setRows([]);
    }
  }, [page, type]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  // جستجوی شماره → به userId تبدیل نمی‌کنیم؛ سرور userId می‌گیرد.
  // برای سادگی، فیلتر محلی روی نتیجه‌ی صفحه اعمال می‌شود.
  const filtered = rows?.filter((r) => !phone.trim() || r.phone.includes(phone.trim())) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="فیلتر شماره موبایل در این صفحه..."
            className="ps-10"
          />
        </div>
        <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="نوع تراکنش" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه انواع</SelectItem>
            {Object.entries(TX_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground font-bold">{faNum(total)} تراکنش</span>
      </div>

      {filtered === null ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">
          تراکنشی یافت نشد
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((t, i) => {
            const positive = t.amount > 0;
            return (
              <motion.li
                key={t.id}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3"
              >
                <span className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-xl text-xs font-black",
                  positive ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                )}>
                  {positive ? "+" : "−"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">
                    {t.user}
                    <span className="text-muted-foreground font-normal"> — {TX_TYPE_LABELS[t.type] ?? t.type}</span>
                    {t.feature && <span className="text-muted-foreground font-normal"> ({FEATURE_LABELS[t.feature] ?? t.feature})</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {faDateTime(t.createdAt)}
                    {t.note && <span className="ms-1">· {t.note}</span>}
                  </p>
                </div>
                <div className="text-end shrink-0">
                  <p className={cn("font-black tabular-nums text-sm", positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                    {positive ? "+" : ""}{faNum(t.amount)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">موجودی: {faNum(t.balanceAfter)}</p>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="icon" className="size-8" disabled={page === 1} onClick={() => setPage(page - 1)}>
            <ChevronRight className="size-4" />
          </Button>
          <span className="text-xs font-bold text-muted-foreground">صفحه {faNum(page)} از {faNum(pageCount)}</span>
          <Button variant="outline" size="icon" className="size-8" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>
            <ChevronLeft className="size-4" />
          </Button>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
        <History className="size-3.5" />
        تراکنش‌ها تغییرناپذیرند و تاریخ کامل مالی اقتصاد توکن را تشکیل می‌دهند.
      </p>
    </div>
  );
}
