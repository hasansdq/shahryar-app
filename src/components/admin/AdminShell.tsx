// ═════ پوسته پنل مدیریت شهریار ═════
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Crown, LayoutDashboard, Store, FolderTree, Users, Brain, MessageSquare,
  Newspaper, ScrollText, Activity, Settings, LogOut, Menu, X, ExternalLink,
  Blocks, Target, Wallet, Users2, BarChart3, Megaphone, MessagesSquare, Coins,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { post } from "@/lib/client/api";
import { toast } from "@/hooks/use-toast";
import DashboardTab from "./DashboardTab";
import BusinessesTab from "./BusinessesTab";
import CategoriesTab from "./CategoriesTab";
import UsersTab from "./UsersTab";
import AITab from "./AITab";
import ChatLogsTab from "./ChatLogsTab";
import CityDataTab from "./CityDataTab";
import LogsTab from "./LogsTab";
import SystemTab from "./SystemTab";
import SettingsTab from "./SettingsTab";
import ModulesTab from "./ModulesTab";
import GoalsAdminTab from "./GoalsAdminTab";
import FinanceAdminTab from "./FinanceAdminTab";
import SocialAdminTab from "./SocialAdminTab";
import FeedAdminTab from "./FeedAdminTab";
import ForumsAdminTab from "./ForumsAdminTab";
import AnalyticsTab from "./AnalyticsTab";
import NotificationsTab from "./NotificationsTab";
import TokensTab from "./tokens/TokensTab";
import UploadCenter from "@/components/common/UploadCenter";

export type AdminTab =
  | "dashboard" | "businesses" | "categories" | "users" | "ai"
  | "chatlogs" | "citydata" | "logs" | "system" | "settings"
  | "modules" | "goalsAdmin" | "financeAdmin"
  | "socialAdmin" | "feedAdmin" | "forumsAdmin" | "analytics" | "notifications"
  | "tokensAdmin";

const TABS: Array<{ id: AdminTab; label: string; icon: typeof LayoutDashboard; group: string }> = [
  { id: "dashboard", label: "داشبورد", icon: LayoutDashboard, group: "اصلی" },
  { id: "socialAdmin", label: "شبکه شهریار", icon: Users2, group: "مدیریت محتوا" },
  { id: "feedAdmin", label: "فید شهریار", icon: Newspaper, group: "مدیریت محتوا" },
  { id: "forumsAdmin", label: "انجمن‌ها", icon: MessagesSquare, group: "مدیریت محتوا" },
  { id: "businesses", label: "اصناف و کسب‌وکارها", icon: Store, group: "مدیریت محتوا" },
  { id: "categories", label: "دسته‌بندی‌ها", icon: FolderTree, group: "مدیریت محتوا" },
  { id: "citydata", label: "پایگاه دانش شهری", icon: Newspaper, group: "مدیریت محتوا" },
  { id: "analytics", label: "تحلیل و مارکتینگ", icon: BarChart3, group: "رشد و کمپین" },
  { id: "notifications", label: "اعلان‌ها و کمپین‌ها", icon: Megaphone, group: "رشد و کمپین" },
  { id: "modules", label: "ماژول‌ها و امکانات", icon: Blocks, group: "ماژول‌های اپ" },
  { id: "goalsAdmin", label: "اهداف کاربران", icon: Target, group: "ماژول‌های اپ" },
  { id: "financeAdmin", label: "امور مالی", icon: Wallet, group: "ماژول‌های اپ" },
  { id: "tokensAdmin", label: "اقتصاد توکن", icon: Coins, group: "ماژول‌های اپ" },
  { id: "ai", label: "مدیریت هوش مصنوعی", icon: Brain, group: "هوش مصنوعی" },
  { id: "chatlogs", label: "گفتگوهای هوشیار", icon: MessageSquare, group: "هوش مصنوعی" },
  { id: "users", label: "کاربران", icon: Users, group: "سیستم" },
  { id: "logs", label: "لاگ فعالیت‌ها", icon: ScrollText, group: "سیستم" },
  { id: "system", label: "سلامت و نسخه", icon: Activity, group: "سیستم" },
  { id: "settings", label: "تنظیمات", icon: Settings, group: "سیستم" },
];

export default function AdminShell({
  admin,
  onLogout,
}: {
  admin: { id: string; username: string; name: string; role: string };
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<AdminTab>("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await post("/api/admin/auth/logout");
    onLogout();
    toast({ title: "خارج شدید", description: "جلسه مدیریت پایان یافت" });
  };

  const TabComponent = {
    dashboard: DashboardTab,
    businesses: BusinessesTab,
    categories: CategoriesTab,
    users: UsersTab,
    ai: AITab,
    chatlogs: ChatLogsTab,
    citydata: CityDataTab,
    logs: LogsTab,
    system: SystemTab,
    settings: SettingsTab,
    modules: ModulesTab,
    goalsAdmin: GoalsAdminTab,
    financeAdmin: FinanceAdminTab,
    socialAdmin: SocialAdminTab,
    feedAdmin: FeedAdminTab,
    forumsAdmin: ForumsAdminTab,
    analytics: AnalyticsTab,
    notifications: NotificationsTab,
    tokensAdmin: TokensTab,
  }[tab];

  const groups = [...new Set(TABS.map((t) => t.group))];

  const sidebarNode = (
    <>
      <div className="flex items-center gap-3 p-5 border-b border-blue-200/10">
        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", damping: 12 }}
          className="w-11 h-11 rounded-2xl shahryar-gradient flex items-center justify-center shadow-blue-glow"
        >
          <Crown className="w-6 h-6 text-white" />
        </motion.div>
        <div className="min-w-0">
          <h1 className="text-white font-black text-lg leading-none">شهریار</h1>
          <p className="text-[11px] text-slate-400 mt-1.5">پنل مدیریت سامانه</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-4">
        {groups.map((group, gi) => (
          <div key={group}>
            <p className="text-[10px] font-bold text-slate-500 px-3 mb-2 tracking-wide">{group}</p>
            <div className="space-y-1">
              {TABS.filter((t) => t.group === group).map((t, ti) => {
                const active = tab === t.id;
                return (
                  <motion.button
                    key={t.id}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.03 * (gi + ti), duration: 0.3 }}
                    onClick={() => {
                      setTab(t.id);
                      setMenuOpen(false);
                    }}
                    whileHover={{ x: -3 }}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-colors ${
                      active
                        ? "shahryar-gradient text-white shadow-lg font-bold"
                        : "text-slate-400 hover:text-white hover:bg-blue-300/10"
                    }`}
                  >
                    <t.icon className="shrink-0" style={{ width: 18, height: 18 }} />
                    {t.label}
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-blue-200/10 space-y-2">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-blue-400 px-3 py-2 rounded-xl hover:bg-blue-300/10 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          مشاهده اپلیکیشن
        </a>
        <div className="flex items-center gap-3 p-2 rounded-xl bg-blue-300/8">
          <div className="w-9 h-9 rounded-xl shahryar-gradient flex items-center justify-center text-white font-bold text-sm shrink-0">
            {admin.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-bold truncate">{admin.name}</p>
            <p className="text-[10px] text-slate-500">{admin.role === "SUPER_ADMIN" ? "مدیر کل" : "مدیر"}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start gap-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl text-sm"
        >
          <LogOut className="w-4 h-4" />
          خروج
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#0a0f1e] relative flex" dir="rtl">
      {/* هاله‌های نوری پس‌زمینه */}
      <div className="pointer-events-none fixed -top-40 -right-40 w-[36rem] h-[36rem] rounded-full bg-[oklch(0.45_0.15_260_/_0.12)] blur-3xl" />
      <div className="pointer-events-none fixed -bottom-48 -left-40 w-[32rem] h-[32rem] rounded-full bg-[oklch(0.5_0.14_240_/_0.08)] blur-3xl" />

      {/* سایدبار دسکتاپ */}
      <aside className="hidden lg:flex w-72 shrink-0 flex-col bg-[#0d1526]/90 backdrop-blur-xl border-l border-blue-200/10 sticky top-0 h-screen z-10">
        {sidebarNode}
      </aside>

      {/* سایدبار موبایل */}
      {menuOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="lg:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
            onClick={() => setMenuOpen(false)}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="lg:hidden fixed inset-y-0 right-0 w-72 z-50 flex flex-col bg-[#0d1526] border-l border-blue-200/10"
          >
            <button
              onClick={() => setMenuOpen(false)}
              className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebarNode}
          </motion.aside>
        </>
      )}

      {/* محتوا */}
      <main className="flex-1 min-w-0 relative z-10">
        <header className="lg:hidden sticky top-0 z-30 bg-[#0d1526]/95 backdrop-blur border-b border-blue-200/10 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(true)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-blue-300/10"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg shahryar-gradient flex items-center justify-center">
              <Crown className="text-white" style={{ width: 18, height: 18 }} />
            </div>
            <span className="font-bold text-white text-sm">پنل مدیریت شهریار</span>
          </div>
        </header>

        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 12, scale: 0.995 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="p-4 md:p-6 max-w-7xl"
        >
          <TabComponent />
        </motion.div>
      </main>

      {/* مرکز آپلود شناور */}
      <UploadCenter />
    </div>
  );
}
