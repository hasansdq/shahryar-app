// ═════ سلامت و نسخه سیستم ═════
"use client";

import { useEffect, useState } from "react";
import {
  Activity, CheckCircle2, AlertTriangle, Database, Cpu, HardDrive,
  Clock, GitBranch, RefreshCw, ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { get } from "@/lib/client/api";
import { faNum, faRelative } from "@/lib/client/persian";

interface SystemData {
  version: string;
  buildDate: string;
  environment: string;
  nodeVersion: string;
  uptime: number; // ثانیه
  memory: { heapUsedMB: number; heapTotalMB: number; rssMB: number };
  database: {
    sizeMB: number;
    provider: string;
    tables: Record<string, number>;
  };
  checks: Array<{ name: string; status: "ok" | "warn"; detail: string }>;
  recentErrors: Array<{ action: string; createdAt: string; ip: string | null }>;
}

const TABLE_LABELS: Record<string, string> = {
  users: "کاربران", businesses: "کسب‌وکارها", categories: "دسته‌بندی‌ها",
  goals: "اهداف", tasks: "وظایف", chatSessions: "جلسات گفتگو",
  chatMessages: "پیام‌ها", memories: "حافظه‌ها", reviews: "نظرات",
  cityData: "داده شهری", logs: "لاگ‌ها", sessions: "سشن کاربران",
  adminSessions: "سشن مدیران", settings: "تنظیمات",
};

export default function SystemTab() {
  const [data, setData] = useState<SystemData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await get<SystemData>("/api/admin/system");
    if (res.success && res.data) setData(res.data);
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await get<SystemData>("/api/admin/system");
      if (active && res.success && res.data) setData(res.data);
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-2xl" />
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  const uptimeStr = data.uptime > 3600
    ? `${faNum(Math.floor(data.uptime / 3600))} ساعت و ${faNum(Math.floor((data.uptime % 3600) / 60))} دقیقه`
    : `${faNum(Math.floor(data.uptime / 60))} دقیقه`;

  const healthScore = Math.round((data.checks.filter((c) => c.status === "ok").length / data.checks.length) * 100);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-white">سلامت و نسخه سیستم</h2>
          <p className="text-slate-400 text-sm mt-1">پایش لحظه‌ای زیرساخت شهریار</p>
        </div>
        <Button onClick={load} variant="outline"
          className="rounded-xl bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800">
          <RefreshCw className="w-4 h-4" />
          بررسی مجدد
        </Button>
      </div>

      {/* نوار سلامت کلی */}
      <Card className="rounded-2xl bg-slate-900/70 border-slate-800 overflow-hidden">
        <div className="shahryar-gradient p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-blue-100/80 text-sm">امتیاز سلامت کلی سامانه</p>
              <p className="text-4xl font-black text-white mt-1 tnum">{faNum(healthScore)}٪</p>
            </div>
            <div className="flex flex-wrap gap-6">
              <div className="text-center">
                <p className="text-white font-bold text-lg">{data.version}</p>
                <p className="text-blue-100/70 text-[11px] mt-1">نسخه فعلی</p>
              </div>
              <div className="text-center">
                <p className="text-white font-bold text-lg">{data.environment === "production" ? "تولید" : "توسعه"}</p>
                <p className="text-blue-100/70 text-[11px] mt-1">محیط اجرا</p>
              </div>
              <div className="text-center">
                <p className="text-white font-bold text-lg">{data.database.provider}</p>
                <p className="text-blue-100/70 text-[11px] mt-1">پایگاه داده</p>
              </div>
            </div>
          </div>
          <div className="mt-4 h-2 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all" style={{ width: `${healthScore}%` }} />
          </div>
        </div>
      </Card>

      {/* چک‌های سلامت */}
      <Card className="rounded-2xl bg-slate-900/70 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
            بررسی‌های سلامت
          </CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          {data.checks.map((c) => (
            <div
              key={c.name}
              className={`flex items-center gap-3 rounded-xl p-3.5 border ${
                c.status === "ok"
                  ? "bg-blue-500/5 border-blue-500/20"
                  : "bg-amber-500/5 border-amber-500/20"
              }`}
            >
              {c.status === "ok"
                ? <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" />
                : <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />}
              <div>
                <p className="text-sm font-bold text-white">{c.name}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{c.detail}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* منابع سیستم */}
        <Card className="rounded-2xl bg-slate-900/70 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-violet-400" />
              منابع سیستم
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { icon: HardDrive, label: "حافظه پشته", value: `${faNum(data.memory.heapUsedMB)} از ${faNum(data.memory.heapTotalMB)} مگابایت`, pct: Math.round((data.memory.heapUsedMB / Math.max(data.memory.heapTotalMB, 1)) * 100) },
              { icon: Activity, label: "حافظه کل (RSS)", value: `${faNum(data.memory.rssMB)} مگابایت`, pct: Math.min(Math.round((data.memory.rssMB / 1024) * 100), 100) },
              { icon: Database, label: "حجم دیتابیس", value: `${faNum(data.database.sizeMB)} مگابایت`, pct: Math.min(Math.round((data.database.sizeMB / 100) * 100), 100) },
              { icon: Clock, label: "زمان فعالیت", value: uptimeStr, pct: 100 },
            ].map((r) => (
              <div key={r.label}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-slate-300 flex items-center gap-2">
                    <r.icon className="w-4 h-4 text-slate-500" />
                    {r.label}
                  </span>
                  <span className="text-slate-400 text-xs">{r.value}</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full shahryar-gradient rounded-full" style={{ width: `${r.pct}%` }} />
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-1">
              <GitBranch className="w-3.5 h-3.5" />
              Node {data.nodeVersion} · ساخت {data.buildDate}
            </div>
          </CardContent>
        </Card>

        {/* آمار جداول */}
        <Card className="rounded-2xl bg-slate-900/70 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-400" />
              آمار جداول دیتابیس
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(data.database.tables).map(([table, count]) => (
                <div key={table} className="flex items-center justify-between bg-slate-800/40 rounded-xl px-3 py-2.5">
                  <span className="text-xs text-slate-400">{TABLE_LABELS[table] || table}</span>
                  <span className="text-sm font-black text-white tnum">{faNum(count)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* آخرین خطاها */}
      {data.recentErrors.length > 0 && (
        <Card className="rounded-2xl bg-slate-900/70 border-rose-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              آخرین خطاهای ثبت‌شده
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recentErrors.map((e, i) => (
              <div key={i} className="flex items-center gap-3 text-xs bg-rose-500/5 rounded-xl p-3">
                <code className="text-rose-300 font-mono" dir="ltr">{e.action}</code>
                {e.ip && <span className="text-slate-500 tnum" dir="ltr">{e.ip}</span>}
                <span className="text-slate-500 mr-auto">{faRelative(e.createdAt)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
