// ═════ بخش امور مالی شهریار — کانتینر اصلی با تب‌های انیمیشنی ═════
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, ArrowLeftRight, PieChart, Target,
  HandCoins, Wallet, Sparkles, Repeat,
} from "lucide-react";
import DashboardTab from "./DashboardTab";
import TransactionsTab from "./TransactionsTab";
import BudgetsTab from "./BudgetsTab";
import GoalsTab from "./GoalsTab";
import DebtsTab from "./DebtsTab";
import AccountsTab from "./AccountsTab";
import AdvisorTab from "./AdvisorTab";
import RecurringTab from "./RecurringTab";
import { moduleConfig } from "@/lib/client/store";

const ALL_TABS = [
  { id: "dashboard", label: "داشبورد", icon: LayoutDashboard },
  { id: "transactions", label: "تراکنش‌ها", icon: ArrowLeftRight },
  { id: "budgets", label: "بودجه‌ها", icon: PieChart, gate: "enableBudgets" },
  { id: "recurring", label: "تکرارشونده", icon: Repeat, gate: "enableRecurring" },
  { id: "goals", label: "اهداف مالی", icon: Target },
  { id: "debts", label: "قرض‌ها", icon: HandCoins, gate: "enableDebts" },
  { id: "accounts", label: "حساب‌ها", icon: Wallet },
  { id: "advisor", label: "مشاور هوشمند", icon: Sparkles, gate: "enableAdvisor" },
] as const;

type TabId = (typeof ALL_TABS)[number]["id"];

export default function FinanceView() {
  const [tab, setTab] = useState<TabId>("dashboard");

  // تب‌های فعال بر اساس کانفیگ CMS ماژول مالی
  const tabs = ALL_TABS.filter((t) =>
    "gate" in t && t.gate ? moduleConfig("finance", t.gate, true) === true : true
  ) as Array<{ id: TabId; label: string; icon: typeof Wallet }>;
  const visibleIds = new Set(tabs.map((t) => t.id));

  // تب‌های مخفی → برای پنهان‌کردن CTAهای داشبورد مالی
  const hiddenTabs = ALL_TABS.filter((t) =>
    "gate" in t && t.gate ? moduleConfig("finance", t.gate, true) !== true : false
  ).map((t) => t.id);

  // ناوبری امن: درخواست تب مخفی → داشبورد
  const navigate = (t: string) => {
    setTab(visibleIds.has(t as TabId) ? (t as TabId) : "dashboard");
  };

  // مشاور هوشمند: تجربهٔ چت فول-پیج مستقل (الگوی هوشیار) — با دکمهٔ بازگشت
  if (tab === "advisor") {
    return <AdvisorTab onBack={() => setTab("dashboard")} />;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-6 pt-2 lg:pt-0">
      {/* ─── سرتیتر بخش ─── */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 md:w-11 md:h-11 rounded-2xl shahryar-gradient flex items-center justify-center shadow-lg shrink-0">
          <Wallet className="w-5 h-5 md:w-6 md:h-6 text-white" />
        </div>
        <div>
          <h1 className="text-lg md:text-2xl font-black">امور مالی</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            مدیریت هوشمند پول، بودجه و پس‌انداز — همراه با مشاور AI
          </p>
        </div>
      </div>

      {/* ─── تب‌ها — اسکرول افقی موبایل ─── */}
      <div className="sticky top-14 lg:top-0 z-30 -mx-4 lg:mx-0 px-4 lg:px-0 py-2 bg-background/90 backdrop-blur-md">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar p-1 bg-card/70 rounded-2xl border border-border/60">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                  active ? "text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="finance-tab-pill"
                    className="absolute inset-0 rounded-xl shahryar-gradient shadow-md"
                    transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                  />
                )}
                <t.icon className="w-4 h-4 relative z-10" />
                <span className="relative z-10">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── محتوای تب با انیمیشن ─── */}
      <div className="mt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            {tab === "dashboard" && <DashboardTab onNavigate={navigate} hiddenTabs={hiddenTabs} />}
            {tab === "transactions" && <TransactionsTab />}
            {tab === "budgets" && visibleIds.has("budgets") && <BudgetsTab />}
            {tab === "recurring" && visibleIds.has("recurring") && <RecurringTab />}
            {tab === "goals" && <GoalsTab />}
            {tab === "debts" && visibleIds.has("debts") && <DebtsTab />}
            {tab === "accounts" && <AccountsTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
