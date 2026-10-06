// ═════ لاگ فعالیت‌های سیستم ═════
"use client";

import { useEffect, useState, useCallback } from "react";
import { ScrollText, Search, ChevronLeft, ChevronRight, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { get } from "@/lib/client/api";
import { faNum, faDateTime, faRelative } from "@/lib/client/persian";

interface LogRow {
  id: string;
  action: string;
  actorType: string;
  level: string;
  entity: string | null;
  entityId: string | null;
  details: string | null;
  ip: string | null;
  createdAt: string;
  user: { fullName: string | null; phone: string } | null;
}

const LEVEL_CONFIG: Record<string, { label: string; badge: string; icon: typeof Info }> = {
  info: { label: "اطلاعات", badge: "bg-blue-500/15 text-blue-400", icon: Info },
  warning: { label: "هشدار", badge: "bg-amber-500/15 text-amber-400", icon: AlertTriangle },
  error: { label: "خطا", badge: "bg-rose-500/15 text-rose-400", icon: AlertCircle },
};

const ACTION_LABELS: Record<string, string> = {
  "auth.register": "ثبت‌نام کاربر",
  "auth.login": "ورود کاربر",
  "auth.login_failed": "ورود ناموفق",
  "auth.logout": "خروج کاربر",
  "auth.login_rate_limited": "محدودیت ورود",
  "user.profile_update": "ویرایش پروفایل",
  "user.password_change": "تغییر رمز عبور",
  "ai.chat": "گفتگو با هوشیار",
  "ai.session_delete": "حذف گفتگو",
  "ai.memory_delete": "حذف حافظه",
  "ai.memory_clear_all": "پاک‌سازی حافظه",
  "goal.create": "ساخت هدف",
  "goal.update": "ویرایش هدف",
  "goal.delete": "حذف هدف",
  "task.create": "ساخت وظیفه",
  "task.update": "ویرایش وظیفه",
  "task.move": "جابجایی وظیفه",
  "task.delete": "حذف وظیفه",
  "business.review": "ثبت نظر",
  "admin.login": "ورود مدیر",
  "admin.login_failed": "ورود ناموفق مدیر",
  "admin.logout": "خروج مدیر",
  "admin.credentials_change": "تغییر اعتبارنامه مدیر",
  "admin.business_create": "ثبت کسب‌وکار",
  "admin.business_update": "ویرایش کسب‌وکار",
  "admin.business_delete": "حذف کسب‌وکار",
  "admin.category_create": "ساخت دسته‌بندی",
  "admin.category_update": "ویرایش دسته‌بندی",
  "admin.category_delete": "حذف دسته‌بندی",
  "admin.user_update": "مدیریت کاربر",
  "admin.user_delete": "حذف کاربر",
  "admin.ai_settings_update": "تنظیمات هوش مصنوعی",
  "admin.citydata_create": "ثبت داده شهری",
  "admin.citydata_update": "ویرایش داده شهری",
  "admin.citydata_delete": "حذف داده شهری",
  "admin.settings_update": "تنظیمات سیستم",
  "system.seed": "راه‌اندازی سیستم",
};

export default function LogsTab() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState("all");
  const [actor, setActor] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ errorCount: 0, warningCount: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (level !== "all") params.set("level", level);
    if (actor !== "all") params.set("actorType", actor);
    if (query.trim()) params.set("action", query.trim());
    const res = await get<{
      logs: LogRow[];
      stats: { errorCount: number; warningCount: number };
      pagination: { total: number; totalPages: number };
    }>(`/api/admin/logs?${params}`);
    if (res.success && res.data) {
      setLogs(res.data.logs);
      setStats(res.data.stats);
      setTotalPages(res.data.pagination.totalPages);
      setTotal(res.data.pagination.total);
    }
    setLoading(false);
  }, [page, level, actor, query]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-white">لاگ فعالیت‌های سیستم</h2>
          <p className="text-slate-400 text-sm mt-1">
            {faNum(total)} رکورد ·
            <span className="text-rose-400"> {faNum(stats.errorCount)} خطا</span> ·
            <span className="text-amber-400"> {faNum(stats.warningCount)} هشدار</span>
          </p>
        </div>
      </div>

      {/* فیلترها */}
      <div className="flex flex-wrap gap-2">
        {["all", "info", "warning", "error"].map((l) => (
          <button
            key={l}
            onClick={() => { setLevel(l); setPage(1); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              level === l
                ? "shahryar-gradient text-white shadow"
                : "bg-slate-900/70 border border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {l === "all" ? "همه سطوح" : LEVEL_CONFIG[l].label}
          </button>
        ))}
        <div className="w-px bg-slate-800 mx-1" />
        {["all", "user", "admin", "system"].map((a) => (
          <button
            key={a}
            onClick={() => { setActor(a); setPage(1); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              actor === a
                ? "bg-slate-700 text-white"
                : "bg-slate-900/70 border border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {a === "all" ? "همه عامل‌ها" : a === "user" ? "کاربران" : a === "admin" ? "مدیران" : "سیستم"}
          </button>
        ))}
        <div className="relative flex-1 min-w-40">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="جستجوی عملیات..."
            className="pr-10 h-9 rounded-xl bg-slate-900/70 border-slate-800 text-white placeholder:text-slate-500 text-xs"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-dashed border-slate-800">
          <ScrollText className="w-12 h-12 mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400 text-sm">لاگی یافت نشد</p>
        </div>
      ) : (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
          {logs.map((log, i) => {
            const cfg = LEVEL_CONFIG[log.level] || LEVEL_CONFIG.info;
            return (
              <div
                key={log.id}
                className={`flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-slate-800/40 transition-colors ${
                  i !== 0 ? "border-t border-slate-800/60" : ""
                }`}
              >
                <cfg.icon className={`w-4 h-4 shrink-0 ${
                  log.level === "error" ? "text-rose-400" : log.level === "warning" ? "text-amber-400" : "text-blue-400"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-white font-medium">
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                    <Badge className={`text-[9px] border-0 ${cfg.badge}`}>{cfg.label}</Badge>
                    <span className="text-[10px] text-slate-500">
                      {log.actorType === "admin" ? "مدیر" : log.actorType === "system" ? "سیستم" : log.user?.fullName || "کاربر"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                    <code className="font-mono" dir="ltr">{log.action}</code>
                    {log.ip && <span className="tnum" dir="ltr">{log.ip}</span>}
                    <span>{faDateTime(log.createdAt)}</span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-600 shrink-0">{faRelative(log.createdAt)}</span>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}
            className="rounded-xl bg-slate-900 border-slate-800 text-slate-300">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="text-slate-400 text-sm tnum">صفحه {faNum(page)} از {faNum(totalPages)}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}
            className="rounded-xl bg-slate-900 border-slate-800 text-slate-300">
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
