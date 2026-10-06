// ═══ اعلان‌ها و کمپین‌ها — ارسال فیلترشده + ردیابی ═══
"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Megaphone, Plus, Users, Eye, CheckCheck, Bell, Info, CheckCircle2,
  AlertTriangle, PartyPopper, Power, Trash2, X, Send, Target, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import AppDialog from "@/components/ui/app-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { get, post, patch, del } from "@/lib/client/api";
import { faNum, faRelative } from "@/lib/client/persian";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface NotificationRow {
  id: string; title: string; body: string; type: string;
  ctaLabel: string | null; ctaView: string | null; audience: string;
  isActive: boolean; createdAt: string;
  delivered: number; read: number;
}

interface AudienceFiltersState {
  gender?: string;
  activity?: string;
  hasAgent?: boolean;
  isVerified?: boolean;
}

const TYPE_META: Record<string, { icon: typeof Bell; label: string; classes: string; border: string }> = {
  info: { icon: Info, label: "اطلاع‌رسانی", classes: "bg-blue-500/15 text-blue-400", border: "border-blue-500/25" },
  success: { icon: CheckCircle2, label: "موفقیت", classes: "bg-emerald-500/15 text-emerald-400", border: "border-emerald-500/25" },
  warning: { icon: AlertTriangle, label: "هشدار", classes: "bg-amber-500/15 text-amber-400", border: "border-amber-500/25" },
  celebration: { icon: PartyPopper, label: "جشن", classes: "bg-rose-500/15 text-rose-400", border: "border-rose-500/25" },
  marketing: { icon: Megaphone, label: "مارکتینگ", classes: "bg-violet-500/15 text-violet-400", border: "border-violet-500/25" },
};

const CTA_VIEWS: Array<{ key: string; label: string }> = [
  { key: "", label: "بدون دکمه" },
  { key: "home", label: "خانه" },
  { key: "chat", label: "هوشیار" },
  { key: "goals", label: "اهداف من" },
  { key: "businesses", label: "اصناف" },
  { key: "finance", label: "امور مالی" },
  { key: "social", label: "شهریار" },
];

export default function NotificationsTab() {
  const [list, setList] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // فرم
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState("info");
  const [ctaView, setCtaView] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [filters, setFilters] = useState<AudienceFiltersState>({});
  // پیش‌نمایش
  const [preview, setPreview] = useState<{ count: number; labels: string[]; isFiltered: boolean; sample: string[] } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = useCallback(async () => {
    const res = await get<{ notifications: NotificationRow[] }>("/api/admin/notifications");
    if (res.success && res.data) setList(res.data.notifications);
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  // پیش‌نمایش مخاطبان (debounce)
  useEffect(() => {
    if (!composeOpen) return;
    const t = setTimeout(async () => {
      setPreviewLoading(true);
      const res = await post<typeof preview>("/api/admin/notifications/preview", { filters });
      if (res.success && res.data) setPreview(res.data);
      setPreviewLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [filters, composeOpen]);

  const resetForm = () => {
    setTitle(""); setBody(""); setType("info"); setCtaView(""); setCtaLabel(""); setFilters({});
    setPreview(null);
  };

  const send = async () => {
    if (!title.trim() || !body.trim()) {
      toast({ title: "عنوان و متن الزامی است", variant: "destructive" });
      return;
    }
    setBusy(true);
    const res = await post<{ message: string; recipients: number }>("/api/admin/notifications", {
      title: title.trim(),
      body: body.trim(),
      type,
      ctaView: ctaView || undefined,
      ctaLabel: ctaLabel.trim() || undefined,
      filters,
      sendNow: true,
    });
    setBusy(false);
    if (res.success) {
      toast({ title: "اعلان ارسال شد 🎉", description: res.data?.message });
      setComposeOpen(false);
      resetForm();
      load();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const toggleActive = async (n: NotificationRow) => {
    const res = await patch(`/api/admin/notifications/${n.id}`, { isActive: !n.isActive });
    if (res.success) {
      toast({ title: n.isActive ? "اعلان غیرفعال شد" : "اعلان فعال شد" });
      load();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const remove = async (n: NotificationRow) => {
    const res = await del(`/api/admin/notifications/${n.id}`);
    if (res.success) {
      toast({ title: "اعلان حذف شد" });
      load();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const activeFilters = Object.entries(filters).filter(([, v]) => v);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-white">اعلان‌ها و کمپین‌ها</h2>
          <p className="text-slate-400 text-sm mt-1">ارسال اعلان سراسری یا هدفمند به کاربران شهریار با ردیابی خوانده‌شدن</p>
        </div>
        <Button
          onClick={() => setComposeOpen(true)}
          className="shahryar-gradient text-white border-0 rounded-xl font-bold h-11 gap-2 shadow-lg shadow-primary/25"
        >
          <Plus className="size-4" />
          اعلان جدید
        </Button>
      </div>

      {/* لیست */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-dashed border-slate-800">
          <Megaphone className="w-12 h-12 mx-auto text-slate-600 mb-3" />
          <p className="text-slate-300 font-bold">هنوز اعلانی ارسال نشده</p>
          <p className="text-slate-500 text-xs mt-1.5">اولین اعلان را برای کاربران شهریار بسازید</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((n, i) => {
            const meta = TYPE_META[n.type] || TYPE_META.info;
            const readRate = n.delivered > 0 ? Math.round((n.read / n.delivered) * 100) : 0;
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={cn(
                  "rounded-2xl border bg-slate-900/70 p-4 transition-colors",
                  n.isActive ? `${meta.border} hover:border-slate-600` : "border-slate-800 opacity-60"
                )}
              >
                <div className="flex flex-wrap items-start gap-3">
                  <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", meta.classes)}>
                    <meta.icon className="size-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-white font-bold text-sm">{n.title}</p>
                      <Badge className={cn("text-[9px] border-0", meta.classes)}>{meta.label}</Badge>
                      {n.audience === "filtered" && (
                        <Badge className="text-[9px] border-0 bg-slate-500/15 text-slate-400 gap-1">
                          <Filter className="size-2.5" />
                          هدفمند
                        </Badge>
                      )}
                      {!n.isActive && <Badge className="text-[9px] border-0 bg-slate-700 text-slate-400">غیرفعال</Badge>}
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed line-clamp-2">{n.body}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1"><Send className="size-3" />{faNum(n.delivered)} تحویل</span>
                      <span className="flex items-center gap-1"><CheckCheck className="size-3" />{faNum(n.read)} خوانده ({faNum(readRate)}٪)</span>
                      {n.ctaView && <span className="flex items-center gap-1"><Target className="size-3" />دکمه: {CTA_VIEWS.find((v) => v.key === n.ctaView)?.label}</span>}
                      <span>{faRelative(n.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => toggleActive(n)}
                      className={cn(
                        "grid size-9 place-items-center rounded-lg transition-colors",
                        n.isActive
                          ? "text-amber-400/80 hover:text-amber-400 hover:bg-amber-500/10"
                          : "text-emerald-400/80 hover:text-emerald-400 hover:bg-emerald-500/10"
                      )}
                      title={n.isActive ? "غیرفعال‌سازی" : "فعال‌سازی"}
                    >
                      <Power className="size-4" />
                    </button>
                    <button
                      onClick={() => remove(n)}
                      className="grid size-9 place-items-center rounded-lg text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="حذف"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>

                {/* نوار خوانده‌شدن */}
                <div className="mt-3 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${readRate}%` }}
                    transition={{ delay: i * 0.05 }}
                    className="h-full rounded-full bg-gradient-to-l from-emerald-500 to-teal-400"
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ═══ دیالوگ ساخت اعلان ═══ */}
      <AppDialog
        open={composeOpen}
        onClose={() => { setComposeOpen(false); resetForm(); }}
        variant="admin"
        size="lg"
        icon={Megaphone}
        title="اعلان جدید"
        description="پیام شما در مرکز اعلان‌های کاربران نمایش داده می‌شود"
        locked={busy}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => { setComposeOpen(false); resetForm(); }} className="h-11 rounded-xl sm:h-9">انصراف</Button>
            <Button
              onClick={send}
              disabled={busy || !title.trim() || !body.trim()}
              className="h-11 rounded-xl sm:h-9 shahryar-gradient text-white border-0 font-bold gap-2 sm:min-w-32"
            >
              <Send className="size-4" />
              {busy ? "در حال ارسال..." : `ارسال${preview ? ` به ${faNum(preview.count)} کاربر` : ""}`}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          {/* نوع اعلان — پیل‌های رنگی */}
          <div>
            <p className="text-xs font-bold text-slate-300 mb-2">نوع اعلان</p>
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(TYPE_META).map(([key, meta]) => (
                <button
                  key={key}
                  onClick={() => setType(key)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-[9px] font-bold transition-all active:scale-95",
                    type === key
                      ? `${meta.border} ${meta.classes}`
                      : "border-slate-700 bg-slate-800/40 text-slate-400 hover:text-slate-200"
                  )}
                >
                  <meta.icon className="size-4.5" style={{ width: 18, height: 18 }} />
                  {meta.label}
                </button>
              ))}
            </div>
          </div>

          {/* عنوان و متن */}
          <div className="space-y-3">
            <div>
              <p className="text-xs font-bold text-slate-300 mb-1.5">عنوان <span className="text-rose-400">*</span></p>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثلاً: جشنواره پسته رفسنجان آغاز شد!"
                maxLength={80}
                className="h-11 rounded-xl bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500"
              />
              <p className="text-[9px] text-slate-500 text-left mt-1 tnum">{faNum(title.length)}/۸۰</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-300 mb-1.5">متن اعلان <span className="text-rose-400">*</span></p>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="توضیح کامل‌تر پیام..."
                maxLength={1000}
                className="min-h-24 rounded-xl bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500 leading-relaxed"
              />
              <p className="text-[9px] text-slate-500 text-left mt-1 tnum">{faNum(body.length)}/۱۰۰۰</p>
            </div>
          </div>

          {/* دکمه اقدام */}
          <div className="rounded-2xl border border-slate-700/60 bg-slate-800/30 p-3.5 space-y-3">
            <p className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Target className="size-3.5 text-primary" />
              دکمهٔ اقدام (اختیاری)
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <p className="text-[10px] text-slate-500 mb-1.5">مقصد دکمه</p>
                <Select value={ctaView} onValueChange={setCtaView}>
                  <SelectTrigger className="w-full rounded-xl h-10 bg-slate-800/60 border-slate-700 text-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {CTA_VIEWS.map((v) => (
                      <SelectItem key={v.key} value={v.key || "none"}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 mb-1.5">متن دکمه</p>
                <Input
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  placeholder="مثلاً: مشاهده اصناف"
                  maxLength={30}
                  disabled={!ctaView}
                  className="h-10 rounded-xl bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500 disabled:opacity-40"
                />
              </div>
            </div>
          </div>

          {/* فیلتر مخاطبان */}
          <div className="rounded-2xl border border-slate-700/60 bg-slate-800/30 p-3.5 space-y-3">
            <p className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Filter className="size-3.5 text-primary" />
              هدف‌گیری مخاطبان (اختیاری)
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <p className="text-[10px] text-slate-500 mb-1.5">جنسیت</p>
                <Select
                  value={filters.gender || "all"}
                  onValueChange={(v) => setFilters((f) => ({ ...f, gender: v === "all" ? undefined : v }))}
                >
                  <SelectTrigger className="w-full rounded-xl h-10 bg-slate-800/60 border-slate-700 text-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="all">همه</SelectItem>
                    <SelectItem value="male">آقایان</SelectItem>
                    <SelectItem value="female">خانم‌ها</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 mb-1.5">سطح فعالیت</p>
                <Select
                  value={filters.activity || "all"}
                  onValueChange={(v) => setFilters((f) => ({ ...f, activity: v === "all" ? undefined : v }))}
                >
                  <SelectTrigger className="w-full rounded-xl h-10 bg-slate-800/60 border-slate-700 text-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="all">همه کاربران</SelectItem>
                    <SelectItem value="active">فعال (ورود ۷ روز اخیر)</SelectItem>
                    <SelectItem value="new">اعضای جدید (۷ روز)</SelectItem>
                    <SelectItem value="dormant">غایب (۱۴+ روز)</SelectItem>
                    <SelectItem value="power">قدرتی (۱۰+ ورود)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilters((f) => ({ ...f, hasAgent: !f.hasAgent }))}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-bold transition-all active:scale-95",
                  filters.hasAgent
                    ? "border-violet-500/40 bg-violet-500/15 text-violet-300"
                    : "border-slate-700 bg-slate-800/40 text-slate-400 hover:text-slate-200"
                )}
              >
                <Users className="size-3.5" />
                فقط دارندگان ایجنت
              </button>
              <button
                onClick={() => setFilters((f) => ({ ...f, isVerified: !f.isVerified }))}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-bold transition-all active:scale-95",
                  filters.isVerified
                    ? "border-sky-500/40 bg-sky-500/15 text-sky-300"
                    : "border-slate-700 bg-slate-800/40 text-slate-400 hover:text-slate-200"
                )}
              >
                <Eye className="size-3.5" />
                فقط تیک‌آبی‌ها
              </button>
              {activeFilters.length > 0 && (
                <button
                  onClick={() => setFilters({})}
                  className="flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[10px] font-bold text-rose-400 transition-all active:scale-95"
                >
                  <X className="size-3.5" />
                  پاک‌کردن فیلترها
                </button>
              )}
            </div>

            {/* پیش‌نمایش زنده */}
            <div className={cn(
              "rounded-xl border p-3 transition-colors",
              preview?.isFiltered ? "border-primary/30 bg-primary/5" : "border-slate-700/50 bg-slate-800/40"
            )}>
              {previewLoading ? (
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <span className="size-3 animate-spin rounded-full border-2 border-slate-600 border-t-primary" />
                  محاسبهٔ مخاطبان...
                </div>
              ) : preview ? (
                <div className="space-y-1.5">
                  <p className="text-xs">
                    <span className="font-black text-white tnum">{faNum(preview.count)}</span>
                    <span className="text-slate-400"> کاربر این اعلان را دریافت می‌کند</span>
                    {!preview.isFiltered && <span className="text-[9px] text-slate-500"> (ارسال سراسری)</span>}
                  </p>
                  {preview.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {preview.labels.map((l) => (
                        <span key={l} className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">{l}</span>
                      ))}
                    </div>
                  )}
                  {preview.sample.length > 0 && (
                    <p className="text-[9px] text-slate-500 truncate">
                      نمونه: {preview.sample.join("، ")}
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {/* پیش‌نمایش بصری کارت */}
          {(title || body) && (
            <div className="rounded-2xl border border-slate-700/60 bg-slate-800/30 p-3.5">
              <p className="text-[10px] text-slate-500 mb-2.5">پیش‌نمایش نهایی در اپ کاربر</p>
              <div className="rounded-xl border border-primary/25 bg-primary/5 p-3.5">
                <div className="flex items-start gap-3">
                  {(() => {
                    const meta = TYPE_META[type] || TYPE_META.info;
                    return (
                      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", meta.classes)}>
                        <meta.icon className="size-5" />
                      </span>
                    );
                  })()}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-white">{title || "عنوان اعلان"}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400 line-clamp-3">{body || "متن اعلان اینجا نمایش داده می‌شود..."}</p>
                    {ctaView && (
                      <span className="shahryar-gradient mt-2 inline-block rounded-lg px-3 py-1.5 text-[10px] font-bold text-white">
                        {ctaLabel || "مشاهده"}
                      </span>
                    )}
                  </div>
                  <span className="size-2 shrink-0 rounded-full bg-primary" />
                </div>
              </div>
            </div>
          )}
        </div>
      </AppDialog>
    </div>
  );
}
