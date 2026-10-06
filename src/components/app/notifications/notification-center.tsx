// ═══ مرکز اعلان‌های شهریار — زنگوله + دیالوگ اعلان‌ها ═══
// مصرف‌کنندهٔ API کاربر (/api/notifications) با تحویل تنبل
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell, BellRing, CheckCheck, Info, PartyPopper, Megaphone, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import AppDialog from "@/components/ui/app-dialog";
import { get, post } from "@/lib/client/api";
import { faRelative, faNum } from "@/lib/client/persian";
import { useAppStore, type AppView } from "@/lib/client/store";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: string; // info | success | warning | celebration | marketing
  ctaLabel: string | null;
  ctaView: string | null;
  createdAt: string;
  readAt: string | null;
}

const TYPE_META: Record<string, { icon: typeof Bell; classes: string }> = {
  info: { icon: Info, classes: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  success: { icon: CheckCircle2, classes: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  warning: { icon: AlertTriangle, classes: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  celebration: { icon: PartyPopper, classes: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  marketing: { icon: Megaphone, classes: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
};

export function useNotifications() {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await get<{ notifications: AppNotification[]; unread: number }>("/api/notifications");
      if (res.success && res.data) {
        setItems(res.data.notifications);
        setUnread(res.data.unread);
      }
    } catch {}
  }, []);

  // پایش اولیه + هر ۶۰ ثانیه (فقط وقتی تب دیدنی است)
  useEffect(() => {
    void (async () => {
      await refresh();
    })();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 60000);
    return () => clearInterval(t);
  }, [refresh]);

  const openCenter = async () => {
    setOpen(true);
    setLoading(true);
    await refresh();
    setLoading(false);
  };

  const markRead = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    setUnread((u) => Math.max(0, u - 1));
    await post("/api/notifications", { id });
  };

  const markAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    setUnread(0);
    const res = await post("/api/notifications", { all: true });
    if (res.success) toast({ title: "همه اعلان‌ها خوانده شد" });
  };

  return { unread, open, setOpen, items, loading, openCenter, markRead, markAllRead, refresh };
}

/** دکمهٔ زنگوله با شمارندهٔ خوانده‌نشده */
export function NotificationBell({
  hook,
  className,
}: {
  hook: ReturnType<typeof useNotifications>;
  className?: string;
}) {
  return (
    <button
      onClick={hook.openCenter}
      aria-label={hook.unread > 0 ? `اعلان‌ها (${faNum(hook.unread)} خوانده‌نشده)` : "اعلان‌ها"}
      className={cn(
        "relative grid size-10 place-items-center rounded-xl border border-border/60 bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground active:scale-95",
        className
      )}
    >
      {hook.unread > 0 ? (
        <BellRing className="size-5 text-primary" />
      ) : (
        <Bell className="size-5" />
      )}
      {hook.unread > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 15 }}
          className="absolute -end-1 -top-1 grid min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-black leading-5 text-white shadow-md"
        >
          {hook.unread > 9 ? "۹+" : faNum(hook.unread)}
        </motion.span>
      )}
    </button>
  );
}

/** دیالوگ مرکز اعلان‌ها */
export function NotificationsDialog({
  hook,
}: {
  hook: ReturnType<typeof useNotifications>;
}) {
  const { setView } = useAppStore();

  const openCta = (n: AppNotification) => {
    if (!n.ctaView) return;
    hook.setOpen(false);
    setView(n.ctaView as AppView);
  };

  return (
    <AppDialog
      open={hook.open}
      onClose={() => hook.setOpen(false)}
      icon={Bell}
      title="اعلان‌های شهریار"
      description={hook.unread > 0 ? `${faNum(hook.unread)} اعلان خوانده‌نشده دارید` : "همه‌چیز خوانده شده"}
      headerExtra={
        hook.items.some((n) => !n.readAt) ? (
          <Button
            variant="outline"
            size="sm"
            onClick={hook.markAllRead}
            className="h-9 rounded-xl gap-1.5 text-xs"
          >
            <CheckCheck className="size-3.5" />
            خواندن همه
          </Button>
        ) : undefined
      }
      footer={
        hook.items.length > 0 ? (
          <p className="text-center text-[10px] text-muted-foreground">
            اعلان‌های قدیمی به‌مرور حذف می‌شوند
          </p>
        ) : undefined
      }
    >
      {hook.loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : hook.items.length === 0 ? (
        <div className="py-10 text-center">
          <div className="mx-auto mb-3 grid size-16 place-items-center rounded-3xl bg-primary/10 text-primary">
            <Bell className="size-7" />
          </div>
          <p className="font-black">اعلانی ندارید</p>
          <p className="mt-1 text-xs text-muted-foreground">اخبار و پیام‌های شهریار اینجا نمایش داده می‌شوند</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence initial={false}>
            {hook.items.map((n) => {
              const meta = TYPE_META[n.type] || TYPE_META.info;
              return (
                <motion.div
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className={cn(
                    "group relative rounded-2xl border p-3.5 transition-colors",
                    n.readAt
                      ? "border-border/50 bg-card"
                      : "border-primary/25 bg-primary/5"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", meta.classes)}>
                      <meta.icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-black">{n.title}</p>
                        {!n.readAt && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="خوانده‌نشده" />}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-4">{n.body}</p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-muted-foreground/70">{faRelative(n.createdAt)}</span>
                        <div className="flex items-center gap-1.5">
                          {!n.readAt && (
                            <button
                              onClick={() => hook.markRead(n.id)}
                              className="rounded-lg px-2 py-1 text-[10px] font-bold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            >
                              علامت خوانده‌شده
                            </button>
                          )}
                          {n.ctaView && (
                            <button
                              onClick={() => { if (!n.readAt) hook.markRead(n.id); openCta(n); }}
                              className="shahryar-gradient rounded-lg px-3 py-1.5 text-[10px] font-bold text-white shadow-sm transition-transform active:scale-95"
                            >
                              {n.ctaLabel || "مشاهده"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </AppDialog>
  );
}
