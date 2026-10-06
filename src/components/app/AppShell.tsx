// ═══ پوسته اصلی اپلیکیشن شهریار ═══
"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown, Home, Bot, Target, Store, UserRound, LogOut, Wallet, PowerOff, Users,
  Menu, X, ChevronLeft, MessagesSquare, Coins,
} from "lucide-react";
import { useAppStore, moduleEnabled, type AppView } from "@/lib/client/store";
import { post, get } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import ThemeToggle from "@/components/theme/ThemeToggle";
import DashboardView from "./DashboardView";
import ChatView from "./ChatView";
import GoalsView from "./goals/GoalsView";
import BusinessesView from "./BusinessesView";
import ProfileView from "./ProfileView";
import FinanceView from "./finance/FinanceView";
import SocialView from "./social/SocialView";
import UserProfilePage from "./social/UserProfilePage";
import ForumsView from "./forums/ForumsView";
import TokenWalletView from "./tokens/TokenWalletView";
import UploadCenter from "@/components/common/UploadCenter";
import { useNotifications, NotificationBell, NotificationsDialog } from "./notifications/notification-center";

type NavItem = { id: AppView; label: string; icon: typeof Home };

const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "خانه", icon: Home },
  { id: "chat", label: "هوشیار", icon: Bot },
  { id: "finance", label: "امور مالی", icon: Wallet },
  { id: "goals", label: "اهداف من", icon: Target },
  { id: "businesses", label: "اصناف", icon: Store },
  { id: "social", label: "شهریار", icon: Users },
  { id: "forums", label: "انجمن‌ها", icon: MessagesSquare },
  { id: "tokens", label: "توکن‌ها", icon: Coins },
  { id: "profile", label: "پروفایل", icon: UserRound },
];

/** کاشی آیکن هر بخش — هویت رنگی ملایم برای سایدبار و دروور */
const NAV_TILES: Record<AppView, string> = {
  home: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  chat: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  finance: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  goals: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  businesses: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  social: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  forums: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  tokens: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  profile: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  userProfile: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

/** گروه‌بندی حرفه‌ای بخش‌ها — سایدبار دسکتاپ و دروور موبایل/تبلت */
const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  { label: "اصلی", items: [NAV_ITEMS[0], NAV_ITEMS[1]] },
  { label: "خدمات شهری", items: [NAV_ITEMS[4], NAV_ITEMS[5], NAV_ITEMS[6]] },
  { label: "شخصی", items: [NAV_ITEMS[2], NAV_ITEMS[3], NAV_ITEMS[7]] },
  { label: "حساب", items: [NAV_ITEMS[8]] },
];

/** ترتیب منوی پایین موبایل/تبلت — ۵ آیتم، خانه برجسته در مرکز */
const BOTTOM_ORDER: AppView[] = ["chat", "goals", "home", "social", "profile"];

/** مرکز افقی سلولِ خانه در گرید RTL — دکمه‌ی برجسته دقیقاً روی آن می‌نشیند */
const HOME_CENTER_PCT = `${
  ((BOTTOM_ORDER.length - 1 - BOTTOM_ORDER.indexOf("home") + 0.5) / BOTTOM_ORDER.length) * 100
}%`;

import { PersonAvatar } from "./social/social-ui";

const itemEnabled = (id: AppView) =>
  id === "home" || id === "profile" ? true : moduleEnabled(id);

/** آواتار کاربر — مشترک بین سایدبار، دروور و کارت پایین */
function UserAvatar({
  user,
  size,
  className,
}: {
  user: { avatarUrl?: string | null; fullName?: string | null; avatarColor?: string } | null;
  size: number;
  className?: string;
}) {
  return (
    <PersonAvatar
      name={user?.fullName || "ش"}
      avatarUrl={user?.avatarUrl}
      color={user?.avatarColor}
      size={size}
      className={className}
    />
  );
}

export default function AppShell() {
  const { user, view, setView, logout, setModules, setGoalCategories } = useAppStore();
  const [loggingOut, setLoggingOut] = useState(false);
  const notifications = useNotifications();
  const [menuOpen, setMenuOpen] = useState(false);

  // ─── وضعیت CMS: ماژول‌ها + دسته‌بندی اهداف ───
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [modsRes, catsRes] = await Promise.all([
        get<{ modules: Array<{ key: string; name: string; icon: string; isEnabled: boolean; isCore: boolean; config: Record<string, boolean | number> }> }>("/api/modules"),
        get<{ categories: Array<{ key: string; name: string; icon: string; color: string }> }>("/api/goal-categories"),
      ]);
      if (cancelled) return;
      if (modsRes.success && modsRes.data?.modules) setModules(modsRes.data.modules);
      if (catsRes.success && catsRes.data?.categories) setGoalCategories(catsRes.data.categories);
    })();
    return () => {
      cancelled = true;
    };
  }, [setModules, setGoalCategories]);

  // ─── بازگشت از درگاه پرداخت زرین‌پال (?tokens=paid|failed|canceled) ───
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const payState = params.get("tokens");
    if (!payState) return;
    // پاک‌سازی URL بدون رفرش
    params.delete("tokens");
    params.delete("ref");
    params.delete("reason");
    const clean = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (clean ? `?${clean}` : ""));
    setView("tokens");
    if (payState === "paid") {
      toast({ title: "پرداخت موفق ✓", description: "توکن‌های خریداری‌شده به کیف شما اضافه شد" });
    } else if (payState === "canceled") {
      toast({ title: "پرداخت لغو شد", description: "شما در درگاه پرداخت انصراف دادید" });
    } else {
      toast({ title: "پرداخت ناموفق", description: "تراکنش تأیید نشد؛ مبلغی کسر نشده است", variant: "destructive" });
    }
  }, []);

  // ─── دروور: قفل اسکرول بدن + بستن با Escape ───
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // آیا ماژولِ نمای فعلی غیرفعال شده؟ (مثلاً کاربر داخل بخش بوده و مدیر آن را خاموش کرده)
  const viewDisabled =
    view !== "home" && view !== "profile" && !moduleEnabled(view);
  const disabledModuleName = useAppStore((s) => s.modules[view]?.name) || "این بخش";

  // گروه‌های قابل نمایش (ماژول‌های غیرفعال حذف می‌شوند؛ گروه خالی نمایش داده نمی‌شود)
  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((it) => itemEnabled(it.id)),
  })).filter((g) => g.items.length > 0);

  const handleLogout = async () => {
    setLoggingOut(true);
    await post("/api/auth/logout");
    setLoggingOut(false);
    logout();
    setMenuOpen(false);
    toast({ title: "خارج شدید", description: "به امید دیدار دوباره!" });
  };

  const goTo = (id: AppView) => {
    setView(id);
    setMenuOpen(false);
  };

  const ViewComponent = {
    home: DashboardView,
    chat: ChatView,
    finance: FinanceView,
    goals: GoalsView,
    businesses: BusinessesView,
    social: SocialView,
    forums: ForumsView,
    tokens: TokenWalletView,
    profile: ProfileView,
    userProfile: UserProfilePage,
  }[view];

  return (
    <div
      className="min-h-screen bg-background flex flex-col lg:flex-row lg:gap-6 lg:p-4"
      dir="rtl"
    >
      {/* ═══════════ نوار بالای موبایل/تبلت — همبرگری + برند + تم ═══════════ */}
      <header className="lg:hidden sticky top-0 z-40 border-b border-border/60 bg-card/80 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-3 px-4">
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="باز کردن منوی اصلی"
            className="grid size-10 shrink-0 place-items-center rounded-xl border border-border/60 bg-accent/40 text-foreground/80 transition-all hover:bg-accent active:scale-95"
          >
            <Menu className="size-5" />
          </button>
          <button
            onClick={() => setView("home")}
            className="flex min-w-0 items-center gap-2.5"
            aria-label="شهریار — خانه"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-xl shahryar-gradient shadow-md">
              <Crown className="size-4.5 text-white" style={{ width: 17, height: 17 }} />
            </span>
            <span className="truncate font-black">شهریار</span>
          </button>
          <div className="flex-1" />
          <NotificationBell hook={notifications} className="lg:hidden" />
          <ThemeToggle variant="icon" />
        </div>
      </header>

      {/* ═══════════ سایدبار دسکتاپ — ارتقای چندلایه ═══════════ */}
      <aside
        className="hidden lg:sticky lg:top-4 lg:flex w-64 xl:w-[17.5rem] 2xl:w-[18.75rem] shrink-0 flex-col self-start overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm"
        style={{ height: "calc(100dvh - 2rem)" }}
      >
        {/* خط گرادیانی تاج بالای سایدبار */}
        <div aria-hidden className="shahryar-gradient absolute inset-x-0 top-0 h-1" />
        {/* هالهٔ تزئینی گوشه */}
        <div aria-hidden className="absolute -top-24 -start-24 size-56 rounded-full bg-primary/10 blur-3xl" />

        {/* برند */}
        <div className="relative flex items-center gap-3 px-5 pb-4 pt-6">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl shahryar-gradient shadow-blue-glow">
            <Crown className="size-6 text-white" style={{ width: 24, height: 24 }} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-black leading-none">شهریار</h1>
            <p className="mt-1.5 truncate text-[11px] text-muted-foreground">رفسنجانِ هوشمند</p>
          </div>
        </div>

        {/* ناوبری گروه‌بندی‌شده — اسکرول ایمن در نمایشگرهای کوتاه */}
        <nav className="relative min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-2">
          {visibleGroups.map((g, gi) => (
            <div key={g.label}>
              <p className="mb-1.5 px-3 text-[10px] font-bold tracking-wide text-muted-foreground/70">
                {g.label}
              </p>
              <div className="space-y-1">
                {g.items.map((item, ii) => {
                  const active = view === item.id;
                  return (
                    <motion.button
                      key={item.id}
                      onClick={() => setView(item.id)}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.04 * (gi + ii), duration: 0.3 }}
                      whileHover={{ x: -2 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        "group relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "shahryar-gradient text-white shadow-md"
                          : "text-foreground/75 hover:bg-accent hover:text-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-lg transition-colors",
                          active ? "bg-white/20 text-white" : NAV_TILES[item.id]
                        )}
                      >
                        <item.icon style={{ width: 17, height: 17 }} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-right">{item.label}</span>
                      {active && <span className="size-1.5 shrink-0 rounded-full bg-white" />}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* کاربر، تم، اعلان و خروج */}
        <div className="relative border-t border-border/60 p-3">
          <div className="mb-2 flex items-center gap-2">
            <ThemeToggle variant="sidebar" className="flex-1" />
            <NotificationBell hook={notifications} />
          </div>
          <button
            onClick={() => setView("profile")}
            className="mb-2 flex w-full items-center gap-3 rounded-xl p-2.5 text-right transition-colors hover:bg-accent"
          >
            <UserAvatar user={user} size={40} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{user?.fullName || "کاربر شهریار"}</p>
              <p className="truncate text-[11px] text-muted-foreground">{user?.phone}</p>
            </div>
            <ChevronLeft className="size-4 shrink-0 text-muted-foreground/50" />
          </button>
          <Button
            variant="ghost"
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl"
          >
            <LogOut className="size-5" style={{ width: 20, height: 20 }} />
            خروج از حساب
          </Button>
        </div>
      </aside>

      {/* ═══════════ محتوای اصلی با انیمیشن انتقال ═══════════ */}
      <main className="flex-1 min-w-0 pb-24 lg:pb-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {viewDisabled ? (
              <ModuleDisabledNotice
                moduleName={disabledModuleName}
                onBack={() => setView("home")}
              />
            ) : (
              <ViewComponent />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ═══════════ منوی پایین موبایل/تبلت — ۴ آیکون + خانهٔ برجستهٔ مرکزی ═══════════ */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-50"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="relative border-t border-border/60 bg-card/95 shadow-[0_-8px_30px_rgba(2,8,23,0.10)] backdrop-blur-xl dark:shadow-[0_-8px_30px_rgba(0,0,0,0.5)]">
          {/* ارتفاع دقیق 3.75rem — محاسبهٔ ارتفاع چت فول‌پیج به آن وابسته است */}
          <div className="grid h-[3.75rem] grid-cols-5">
            {BOTTOM_ORDER.map((id) => {
              if (id === "home") {
                // خانهٔ مرکز توسط دکمهٔ برجستهٔ بیرون‌زده رندر می‌شود
                return <div key="home" aria-hidden className="pointer-events-none" />;
              }
              if (!itemEnabled(id)) {
                // جای‌نگهدار — مرکز همیشه وسط بماند
                return <div key={id} aria-hidden className="pointer-events-none" />;
              }
              const item = NAV_ITEMS.find((n) => n.id === id)!;
              const active = view === id;
              return (
                <button
                  key={id}
                  onClick={() => setView(id)}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-1 transition-colors",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {active && (
                    <span className="absolute top-0 h-1 w-9 rounded-b-full shahryar-gradient" />
                  )}
                  <item.icon style={{ width: 22, height: 22 }} />
                  <span className="text-[10px] font-medium leading-none">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* دکمهٔ خانه — بزرگ‌تر، برجسته از بدنهٔ نوار، گرادیان برند — روی سلول خودش در گرید ۵تایی */}
          <button
            onClick={() => setView("home")}
            aria-label="خانه"
            aria-current={view === "home" ? "page" : undefined}
            style={{ left: HOME_CENTER_PCT }}
            className={cn(
              "absolute -top-[1.15rem] grid size-14 -translate-x-1/2 place-items-center rounded-full shahryar-gradient ring-4 ring-card transition-all duration-300 active:scale-90",
              view === "home"
                ? "scale-105 shadow-blue-glow-lg"
                : "shadow-xl shadow-primary/30 hover:scale-105"
            )}
          >
            <Home className="text-white" style={{ width: 26, height: 26 }} />
            {/* درخشش داخلی لطیف بالای دکمه */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-2 top-1 h-1/3 rounded-full bg-white/25 blur-[6px]"
            />
          </button>
        </div>
      </nav>

      {/* ═══════════ دروور همبرگری — بازشونده از سمت راست ═══════════ */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* پردهٔ پس‌زمینه */}
            <motion.div
              key="drawer-backdrop"
              className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
            />
            {/* پنل منو */}
            <motion.aside
              key="drawer-panel"
              role="dialog"
              aria-modal="true"
              aria-label="منوی اصلی شهریار"
              dir="rtl"
              className="fixed inset-y-0 right-0 z-[61] flex w-[86%] max-w-[20rem] flex-col overflow-hidden rounded-e-3xl border-s border-border/60 bg-card shadow-2xl lg:hidden"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 320 }}
            >
              {/* هدر کاربر — گرادیان برند */}
              <div className="relative overflow-hidden px-5 pb-6 pt-5 text-white shahryar-gradient">
                <div aria-hidden className="pattern-dots absolute inset-0 opacity-25" />
                <div aria-hidden className="absolute -bottom-16 -start-10 size-40 rounded-full bg-white/10 blur-2xl" />
                <button
                  onClick={() => setMenuOpen(false)}
                  aria-label="بستن منو"
                  className="absolute end-4 top-4 z-10 grid size-9 place-items-center rounded-xl border border-white/25 bg-white/15 text-white backdrop-blur-md transition-colors hover:bg-white/30"
                >
                  <X style={{ width: 18, height: 18 }} />
                </button>
                <button
                  onClick={() => goTo("profile")}
                  className="relative flex w-full items-center gap-3.5 text-right"
                >
                  <UserAvatar
                    user={user}
                    size={48}
                    className="shrink-0 ring-2 ring-white/30"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black">{user?.fullName || "کاربر شهریار"}</p>
                    <p className="mt-0.5 truncate text-xs text-blue-100/85">{user?.phone}</p>
                  </div>
                  <ChevronLeft className="size-4 shrink-0 text-white/70" />
                </button>
              </div>

              {/* بدنه — همهٔ بخش‌ها با ترتیب دقیق و انیمیشن پلکانی */}
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4">
                {visibleGroups.map((g, gi) => (
                  <div key={g.label}>
                    <p className="mb-1.5 px-3 text-[10px] font-bold tracking-wide text-muted-foreground/70">
                      {g.label}
                    </p>
                    <div className="space-y-1">
                      {g.items.map((item, ii) => {
                        const active = view === item.id;
                        const delay = 0.08 + gi * 0.05 + ii * 0.04;
                        return (
                          <motion.button
                            key={item.id}
                            onClick={() => goTo(item.id)}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay, duration: 0.3 }}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                              active
                                ? "shahryar-gradient text-white shadow-md"
                                : "text-foreground/75 hover:bg-accent hover:text-foreground"
                            )}
                          >
                            <span
                              className={cn(
                                "grid size-8 shrink-0 place-items-center rounded-lg",
                                active ? "bg-white/20 text-white" : NAV_TILES[item.id]
                              )}
                            >
                              <item.icon style={{ width: 17, height: 17 }} />
                            </span>
                            <span className="min-w-0 flex-1 truncate text-right">{item.label}</span>
                            <ChevronLeft
                              className={cn(
                                "size-4 shrink-0",
                                active ? "text-white/80" : "text-muted-foreground/40"
                              )}
                            />
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* شخصی‌سازی — تغییر تم */}
                <div>
                  <p className="mb-1.5 px-3 text-[10px] font-bold tracking-wide text-muted-foreground/70">
                    شخصی‌سازی
                  </p>
                  <ThemeToggle variant="sidebar" />
                </div>
              </div>

              {/* پابرگ — خروج */}
              <div className="border-t border-border/60 p-3">
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl"
                >
                  <LogOut style={{ width: 20, height: 20 }} />
                  خروج از حساب
                </Button>
                <p className="mt-2 text-center text-[10px] text-muted-foreground/60">
                  شهریار — دستیار هوشمند شهر رفسنجان
                </p>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ─── مرکز آپلود شناور ─── */}
      <UploadCenter />

      {/* ─── مرکز اعلان‌ها ─── */}
      <NotificationsDialog hook={notifications} />
    </div>
  );
}

// ─── اعلان ماژول غیرفعال ───
function ModuleDisabledNotice({
  moduleName,
  onBack,
}: {
  moduleName: string;
  onBack: () => void;
}) {
  return (
    <div className="max-w-md mx-auto px-4 py-16 flex flex-col items-center text-center" dir="rtl">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 14 }}
        className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center mb-5 shadow-sm"
      >
        <PowerOff className="w-10 h-10 text-muted-foreground" />
      </motion.div>
      <h2 className="text-xl font-black mb-2">بخش «{moduleName}» موقتاً غیرفعال است</h2>
      <p className="text-sm text-muted-foreground leading-relaxed mb-6">
        مدیریت سامانه این بخش را برای به‌روزرسانی یا تنظیمات موقتاً غیرفعال کرده است.
        به‌زودی دوباره در دسترس قرار می‌گیرد.
      </p>
      <Button onClick={onBack} className="shahryar-gradient text-white border-0 rounded-xl font-bold px-6">
        <Home className="w-4 h-4" />
        بازگشت به خانه
      </Button>
    </div>
  );
}
