// ═════ تب تراکنش‌ها — لیست با فیلتر ماه جلالی، نوع و جستجو ═════
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, ArrowUpCircle, ArrowDownCircle, ArrowLeftRight,
  ChevronRight, ChevronLeft, Search, Pencil, Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { get } from "@/lib/client/api";
import { toast } from "@/hooks/use-toast";
import { toman, txDateLabel, TX_TYPE_LABELS, monthLabel } from "@/lib/client/finance";
import TransactionDialog, { type Transaction, type Account, type Category } from "./TransactionDialog";

const TYPE_FILTERS = [
  { id: "", label: "همه" },
  { id: "expense", label: "هزینه‌ها" },
  { id: "income", label: "درآمدها" },
  { id: "transfer", label: "انتقال‌ها" },
];

export default function TransactionsTab() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [month, setMonth] = useState<string>(""); // فعلی — بعد از لود ست می‌شود
  const [type, setType] = useState<string>("");
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const query = useMemo(() => search.trim(), [search]);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (month) params.set("month", month);
    if (type) params.set("type", type);
    if (query) params.set("q", query);
    params.set("limit", "100");

    const [txRes, accRes, catRes] = await Promise.all([
      get<{ transactions: Transaction[]; total: number; months: string[]; currentMonth: string }>(
        `/api/finance/transactions?${params.toString()}`
      ),
      get<{ accounts: Account[] }>("/api/finance/accounts"),
      get<{ categories: Category[] }>("/api/finance/categories"),
    ]);

    if (txRes.success && txRes.data) {
      setTransactions(txRes.data.transactions);
      setTotal(txRes.data.total);
      if (months.length === 0 && txRes.data.months?.length) {
        setMonths(txRes.data.months);
        setMonth(txRes.data.currentMonth);
      }
    } else if (txRes.error) {
      toast({ title: "خطا", description: txRes.error, variant: "destructive" });
    }
    if (accRes.success && accRes.data) setAccounts(accRes.data.accounts);
    if (catRes.success && catRes.data) setCategories(catRes.data.categories);
    setLoading(false);
  }, [month, type, query, months.length]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  // جستجو با debounce
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const activeAccounts = accounts.filter((a) => a.isActive !== false);

  // تغییر ماه
  const shiftMonth = (dir: 1 | -1) => {
    const idx = months.indexOf(month);
    const next = idx + dir;
    if (next >= 0 && next < months.length) setMonth(months[next]);
  };
  const monthIdx = months.indexOf(month);

  // گروه‌بندی روزانه
  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of transactions) {
      const d = new Date(t.date);
      const key = d.toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return [...map.entries()];
  }, [transactions]);

  return (
    <div className="space-y-4">
      {/* ─── نوار فیلتر ─── */}
      <div className="rounded-3xl bg-card border border-border/60 p-3.5 shadow-sm space-y-3">
        {/* ناوبری ماه */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftMonth(1)} disabled={monthIdx >= months.length - 1}
            className="p-2 rounded-xl hover:bg-accent disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="flex-1 text-center font-bold text-sm">
            {month === "all" ? "همه ماه‌ها" : monthLabel(month)}
          </div>
          <button
            onClick={() => shiftMonth(-1)} disabled={monthIdx <= 0}
            className="p-2 rounded-xl hover:bg-accent disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* فیلتر نوع + جستجو */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex gap-1 bg-muted/60 rounded-xl p-1">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setType(f.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  type === f.id ? "bg-card shadow-sm font-bold" : "text-muted-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-40">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="جستجو در توضیحات..."
              className="h-9 rounded-xl pr-9 text-xs"
            />
          </div>
          <button
            onClick={() => setMonth("all")}
            className="text-[11px] text-primary hover:underline px-1"
          >
            همه ماه‌ها
          </button>
        </div>
      </div>

      {/* ─── خلاصه‌ی فیلتر ─── */}
      <div className="flex items-center justify-between px-2 text-xs text-muted-foreground">
        <span>{faCount(total)} تراکنش</span>
        <span className="flex gap-3">
          <span className="text-emerald-600">▼ {toman(transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0))}</span>
          <span className="text-rose-500">▲ {toman(transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0))}</span>
        </span>
      </div>

      {/* ─── لیست تراکنش‌ها ─── */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-card animate-pulse border border-border/40" />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="rounded-3xl bg-card border border-border/60 p-10 text-center">
          <Receipt className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium mb-1">تراکنشی یافت نشد</p>
          <p className="text-xs text-muted-foreground">
            برای این {month === "all" ? "بازه" : "ماه"} تراکنشی ثبت نشده یا فیلترها چیزی نشان نمی‌دهند
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([day, txs]) => (
            <div key={day}>
              <p className="text-[11px] font-bold text-muted-foreground px-2 mb-1.5">
                {txDateLabel(txs[0].date)}
              </p>
              <div className="space-y-2">
                {txs.map((t, i) => {
                  const isIn = t.type === "income";
                  const isTransfer = t.type === "transfer";
                  return (
                    <motion.button
                      key={t.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => { setEditing(t); setDialogOpen(true); }}
                      className="w-full flex items-center gap-3 rounded-2xl bg-card border border-border/60 p-3.5 shadow-sm hover:shadow-md hover:border-border transition-all text-right group"
                    >
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isIn ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600"
                            : isTransfer ? "bg-sky-100 dark:bg-sky-900/40 text-sky-600"
                            : "bg-rose-100 dark:bg-rose-900/40 text-rose-500"
                        }`}
                      >
                        {isIn ? <ArrowUpCircle className="w-5 h-5" /> : isTransfer ? <ArrowLeftRight className="w-5 h-5" /> : <ArrowDownCircle className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {t.description || t.category?.name || TX_TYPE_LABELS[t.type]}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {isTransfer && t.transferTo
                            ? `${t.account?.name} → ${t.transferTo.name}`
                            : `${t.category?.name || "بدون دسته"} · ${t.account?.name || ""}`}
                        </p>
                      </div>
                      <div className="text-left shrink-0">
                        <p className={`text-sm font-black tabular-nums ${isIn ? "text-emerald-600" : isTransfer ? "text-sky-600" : "text-rose-500"}`}>
                          {isIn ? "+" : "−"}{toman(t.amount)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">تومان</p>
                      </div>
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── دکمه شناور ثبت ─── */}
      <AnimatePresence>
        <motion.button
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => { setEditing(null); setDialogOpen(true); }}
          className="fixed bottom-24 md:bottom-8 left-4 md:left-auto md:right-0 md:-translate-x-2 z-40 w-14 h-14 rounded-2xl shahryar-gradient text-white shadow-xl flex items-center justify-center"
          title="ثبت تراکنش جدید"
        >
          <Plus className="w-7 h-7" />
        </motion.button>
      </AnimatePresence>

      <TransactionDialog
        key={`${editing ? editing.id : "new"}-${dialogOpen}`}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        accounts={activeAccounts}
        categories={categories}
        editing={editing}
        onSaved={load}
      />
    </div>
  );
}

function faCount(n: number): string {
  return new Intl.NumberFormat("fa-IR").format(n);
}
