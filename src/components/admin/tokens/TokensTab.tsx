// ═════ اقتصاد توکن شهریار — تب مدیریت جامع ═════
// بخش‌ها: نمای کلی · قیمت‌گذاری و درگاه · اهدا · تراکنش‌ها
"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Coins, BarChart3, SlidersHorizontal, Gift, History, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { get } from "@/lib/client/api";
import type { AdminTokenStats } from "@/lib/modules/tokens/types";
import OverviewSection from "./OverviewSection";
import SettingsSection from "./SettingsSection";
import { GrantSection, TransactionsSection } from "./GrantSection";
import { cn } from "@/lib/utils";

type SectionId = "overview" | "settings" | "grant" | "txs";

const SECTIONS: Array<{ id: SectionId; label: string; icon: typeof Coins }> = [
  { id: "overview", label: "نمای کلی", icon: BarChart3 },
  { id: "settings", label: "قیمت‌گذاری و درگاه", icon: SlidersHorizontal },
  { id: "grant", label: "اهدا و کسر", icon: Gift },
  { id: "txs", label: "تراکنش‌ها", icon: History },
];

export default function TokensTab() {
  const [section, setSection] = useState<SectionId>("overview");
  const [stats, setStats] = useState<AdminTokenStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const loadStats = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setStatsLoading(true);
    const res = await get<AdminTokenStats>("/api/admin/tokens/overview");
    if (res.success && res.data) setStats(res.data);
    if (showSkeleton) setStatsLoading(false);
  }, []);

  useEffect(() => {
    if (section !== "overview") return;
    const t = setTimeout(() => loadStats(true), 0);
    return () => clearTimeout(t);
  }, [section, loadStats]);

  // آمار پس از تغییر بسته‌ها/تنظیمات تازه شود
  const refreshStats = useCallback(() => {
    loadStats(false);
  }, [loadStats]);

  return (
    <div className="space-y-5">
      {/* ─── سرتیتر ─── */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Coins className="size-6" />
        </span>
        <div className="flex-1 min-w-56">
          <h2 className="text-lg font-black">اقتصاد توکن</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            مدیریت اعتبار هوش مصنوعی کاربران — قیمت‌گذاری دقیق مصرف، درگاه زرین‌پال و تراکنش‌ها
          </p>
        </div>
        {section === "overview" && (
          <Button variant="outline" size="sm" onClick={() => loadStats(false)} disabled={statsLoading}>
            <RefreshCw className={cn("size-4", statsLoading && "animate-spin")} />
            به‌روزرسانی
          </Button>
        )}
      </div>

      {/* ─── ناوبری بخش‌ها ─── */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {SECTIONS.map((s) => {
          const active = section === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={cn(
                "flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold whitespace-nowrap transition-all border",
                active
                  ? "shahryar-gradient text-white border-transparent shadow-md"
                  : "border-border/60 bg-card text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <s.icon className="size-4" />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* ─── محتوای بخش ─── */}
      <motion.div
        key={section}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        {section === "overview" &&
          (stats ? <OverviewSection stats={stats} /> : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-3xl" />)}
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <Skeleton className="h-80 rounded-3xl xl:col-span-2" />
                <Skeleton className="h-80 rounded-3xl" />
              </div>
            </div>
          ))}

        {section === "settings" && <SettingsSection onChanged={refreshStats} />}
        {section === "grant" && <GrantSection onChanged={refreshStats} />}
        {section === "txs" && <TransactionsSection />}
      </motion.div>
    </div>
  );
}
