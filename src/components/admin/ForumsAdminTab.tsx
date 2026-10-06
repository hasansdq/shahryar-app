// ═══ مدیریت انجمن‌ها — پنل CMS ═══
// ایجاد/ویرایش/حذف انجمن + تعیین رئیس + تنظیمات ایجنت + آمار جامع
// تنها مسیر ایجاد انجمن در کل سامانه — مطابق سیاست محصول
"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Bot, Crown, Globe2, Loader2, Lock, MessagesSquare, Pencil, Plus, Search,
  ShieldCheck, Trash2, Users, MessageSquare, CalendarDays, Newspaper, Brain, Power, CheckCircle2, PowerOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { get, post, patch, del } from "@/lib/client/api";
import { faDateTime, faNum } from "@/lib/client/persian";

interface AdminForumRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverImage: string | null;
  type: "PUBLIC" | "PRIVATE";
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  agentEnabled: boolean;
  agentName: string | null;
  chair: { id: string; name: string; phone: string; avatarUrl: string | null; avatarColor: string };
  stats: {
    members: number; pending: number; allMemberRows: number;
    messages: number; events: number; articles: number; knowledge: number;
  };
  createdAt: string;
}

interface Overview {
  total: number; public: number; private: number; active: number;
  members: number; messages: number; articles: number; events: number;
}

interface ChairCandidate {
  id: string; name: string; phone: string; avatarUrl: string | null; avatarColor: string; headline: string | null;
}

const emptyForm = {
  title: "",
  description: "",
  type: "PUBLIC" as "PUBLIC" | "PRIVATE",
  chairId: "",
  chairName: "",
  agentName: "",
  agentGreeting: "",
  agentInstructions: "",
  status: "ACTIVE" as "ACTIVE" | "PAUSED" | "ARCHIVED",
};

export default function ForumsAdminTab() {
  const [forums, setForums] = useState<AdminForumRow[] | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminForumRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [chairQuery, setChairQuery] = useState("");
  const [candidates, setCandidates] = useState<ChairCandidate[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async (query = "") => {
    setLoading(true);
    const res = await get<{ forums: AdminForumRow[]; overview: Overview }>(
      `/api/admin/forums${query ? `?q=${encodeURIComponent(query)}` : ""}`
    );
    if (res.success && res.data) {
      setForums(res.data.forums);
      setOverview(res.data.overview);
    } else if (res.error) {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  // جستجوی کاربر برای رئیس (debounce) — پاک‌سازی سنکرون در handlerهای
  // ورودی/دیالوگ انجام می‌شود؛ بدنه‌ی effect فقط subscribe است
  useEffect(() => {
    if (!dialogOpen || chairQuery.trim().length < 2) return;
    const t = setTimeout(async () => {
      setSearching(true);
      const res = await get<{ users: ChairCandidate[] }>(
        `/api/admin/forums/users?q=${encodeURIComponent(chairQuery.trim())}`
      );
      setSearching(false);
      if (res.success && res.data) setCandidates(res.data.users);
    }, 400);
    return () => clearTimeout(t);
  }, [chairQuery, dialogOpen]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setChairQuery("");
    setCandidates([]);
    setDialogOpen(true);
  };

  const openEdit = (f: AdminForumRow) => {
    setEditing(f);
    setForm({
      title: f.title,
      description: f.description || "",
      type: f.type,
      chairId: f.chair.id,
      chairName: f.chair.name,
      agentName: f.agentName || "",
      agentGreeting: "",
      agentInstructions: "",
      status: f.status,
    });
    setChairQuery(f.chair.name);
    setCandidates([]);
    setDialogOpen(true);
  };

  const save = async () => {
    if (saving) return;
    if (!form.title.trim()) return toast({ title: "عنوان انجمن الزامی است", variant: "destructive" });
    if (!form.chairId) return toast({ title: "انتخاب رئیس انجمن الزامی است", variant: "destructive" });
    setSaving(true);
    const body = {
      title: form.title.trim(),
      description: form.description.trim(),
      type: form.type,
      chairId: form.chairId,
      status: form.status,
      ...(form.agentName.trim() ? { agentName: form.agentName.trim() } : {}),
      ...(form.agentGreeting.trim() ? { agentGreeting: form.agentGreeting.trim() } : {}),
      ...(form.agentInstructions.trim() ? { agentInstructions: form.agentInstructions.trim() } : {}),
    };
    const res = editing
      ? await patch<{ message: string }>(`/api/admin/forums/${editing.id}`, body)
      : await post<{ message: string }>("/api/admin/forums", body);
    setSaving(false);
    if (res.success) {
      toast({ title: res.data?.message || (editing ? "انجمن به‌روزرسانی شد" : "انجمن ایجاد شد") });
      setDialogOpen(false);
      setCandidates([]); // پاک‌سازی نتیجه جستجو هنگام بستن دیالوگ (در handler، نه effect)
      load(q);
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const removeForum = async (f: AdminForumRow) => {
    if (deleting) return;
    setDeleting(f.id);
    const res = await del<{ message: string }>(`/api/admin/forums/${f.id}`);
    setDeleting(null);
    if (res.success) {
      toast({ title: res.data?.message || "انجمن حذف شد" });
      load(q);
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const toggleStatus = async (f: AdminForumRow) => {
    const next = f.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    const res = await patch(`/api/admin/forums/${f.id}`, { status: next });
    if (res.success) {
      toast({ title: next === "ACTIVE" ? "انجمن فعال شد" : "انجمن موقتاً غیرفعال شد" });
      load(q);
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-5" dir="rtl">
      {/* ═══ هدر ═══ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-white">
            <MessagesSquare className="size-6 text-teal-400" />
            مدیریت انجمن‌ها
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            ایجاد و مدیریت انجمن‌های شهری — تعیین رئیس، نوع انجمن و ایجنت هوشمند
          </p>
        </div>
        <Button onClick={openCreate} className="rounded-xl bg-teal-600 font-bold text-white hover:bg-teal-700">
          <Plus className="size-4" />
          ایجاد انجمن جدید
        </Button>
      </div>

      {/* ═══ آمار ═══ */}
      {overview ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
          {[
            { label: "کل انجمن‌ها", value: overview.total, icon: MessagesSquare },
            { label: "فعال", value: overview.active, icon: CheckCircle2 },
            { label: "عمومی", value: overview.public, icon: Globe2 },
            { label: "خصوصی", value: overview.private, icon: Lock },
            { label: "کل اعضا", value: overview.members, icon: Users },
            { label: "پیام‌ها", value: overview.messages, icon: MessageSquare },
            { label: "مقالات", value: overview.articles, icon: Newspaper },
            { label: "رویدادها", value: overview.events, icon: CalendarDays },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 text-center">
              <s.icon className="mx-auto size-4 text-teal-400" />
              <p className="tnum mt-1.5 text-lg font-black leading-none text-white">{faNum(s.value)}</p>
              <p className="mt-1 text-[10px] text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* ═══ جستجو ═══ */}
      <div className="relative">
        <Search className="absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            load(e.target.value);
          }}
          placeholder="جستجوی انجمن…"
          className="h-10 rounded-xl border-slate-700 bg-slate-800/70 text-white placeholder:text-slate-500 ps-10"
        />
      </div>

      {/* ═══ لیست انجمن‌ها ═══ */}
      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-44 rounded-2xl bg-slate-800/60" />
          ))}
        </div>
      ) : !forums || forums.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-slate-700 bg-slate-900/50 p-10 text-center">
          <MessagesSquare className="size-10 text-slate-600" />
          <p className="font-black text-white">هنوز انجمنی ایجاد نشده</p>
          <p className="max-w-md text-xs leading-6 text-slate-500">
            اولین انجمن شهری را بسازید: عنوان، رئیس انجمن و نوع آن را مشخص کنید — تالار گفتگو، ایجنت،
            تقویم رویدادها و نشریه به‌صورت خودکار برایش فعال می‌شود.
          </p>
          <Button onClick={openCreate} className="rounded-xl bg-teal-600 font-bold text-white hover:bg-teal-700">
            <Plus className="size-4" />
            ایجاد اولین انجمن
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {forums.map((f, i) => (
            <motion.article
              key={f.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70"
            >
              <div className="flex items-start gap-3 p-4">
                <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-teal-500/20 to-cyan-500/10 text-teal-400">
                  <MessagesSquare className="size-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-black text-white">{f.title}</h3>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold ${
                      f.type === "PUBLIC"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : "border-slate-500/30 bg-slate-700/40 text-slate-300"
                    }`}>
                      {f.type === "PUBLIC" ? <Globe2 className="size-2.5" /> : <Lock className="size-2.5" />}
                      {f.type === "PUBLIC" ? "عمومی" : "خصوصی"}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold ${
                      f.status === "ACTIVE"
                        ? "border-teal-500/30 bg-teal-500/10 text-teal-400"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                    }`}>
                      {f.status === "ACTIVE" ? "فعال" : f.status === "PAUSED" ? "مکث" : "بایگانی"}
                    </span>
                    {f.stats.pending > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[9px] font-bold text-rose-400">
                        {faNum(f.stats.pending)} درخواست
                      </span>
                    ) : null}
                  </div>

                  {/* رئیس */}
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Crown className="size-3.5 text-amber-400" />
                    رئیس: <span className="font-bold text-slate-200">{f.chair.name}</span>
                    <span className="tnum text-slate-500" dir="ltr">({f.chair.phone})</span>
                    {f.agentEnabled ? (
                      <>
                        <span className="text-slate-600">·</span>
                        <Bot className="size-3.5 text-teal-400" />
                        <span className="text-teal-400">{f.agentName || "ایجنت فعال"}</span>
                      </>
                    ) : null}
                  </div>

                  {f.description ? (
                    <p className="mt-1.5 line-clamp-1 text-[11px] leading-5 text-slate-500">{f.description}</p>
                  ) : null}

                  {/* آمار */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500">
                    <span className="tnum inline-flex items-center gap-1"><Users className="size-3" />{faNum(f.stats.members)} عضو</span>
                    <span className="tnum inline-flex items-center gap-1"><MessageSquare className="size-3" />{faNum(f.stats.messages)} پیام</span>
                    <span className="tnum inline-flex items-center gap-1"><CalendarDays className="size-3" />{faNum(f.stats.events)} رویداد</span>
                    <span className="tnum inline-flex items-center gap-1"><Newspaper className="size-3" />{faNum(f.stats.articles)} مقاله</span>
                    <span className="tnum inline-flex items-center gap-1"><Brain className="size-3" />{faNum(f.stats.knowledge)} دانش</span>
                    <span className="tnum ms-auto text-slate-600">{faDateTime(f.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* اقدامات */}
              <div className="flex gap-1.5 border-t border-slate-800 bg-slate-900/40 p-2.5">
                <Button onClick={() => openEdit(f)} variant="outline" size="sm" className="h-9 flex-1 rounded-lg border-slate-700 text-xs font-bold text-slate-200 hover:bg-slate-800">
                  <Pencil className="size-3.5" />
                  ویرایش
                </Button>
                <Button
                  onClick={() => toggleStatus(f)}
                  variant="outline"
                  size="sm"
                  className="h-9 flex-1 rounded-lg border-slate-700 text-xs font-bold text-slate-200 hover:bg-slate-800"
                >
                  {f.status === "ACTIVE" ? <><PowerOff className="size-3.5" />غیرفعال</> : <><Power className="size-3.5" />فعال‌سازی</>}
                </Button>
                <Button
                  onClick={() => {
                    if (confirm(`انجمن «${f.title}» با تمام اعضا، پیام‌ها، رویدادها، مقالات و دانشش حذف شود؟`)) removeForum(f);
                  }}
                  disabled={deleting === f.id}
                  variant="outline"
                  size="sm"
                  className="h-9 flex-1 rounded-lg border-rose-500/30 text-xs font-bold text-rose-400 hover:bg-rose-500/10"
                >
                  {deleting === f.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  حذف
                </Button>
              </div>
            </motion.article>
          ))}
        </div>
      )}

      {/* ═══ دیالوگ ایجاد/ویرایش ═══ */}
      {dialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true">
          <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-slate-800 bg-[#0d1526] shadow-2xl sm:rounded-3xl">
            <div className="flex shrink-0 items-center gap-2 border-b border-slate-800 p-4">
              <MessagesSquare className="size-5 text-teal-400" />
              <h4 className="text-sm font-black text-white">{editing ? `ویرایش انجمن «${editing.title}»` : "ایجاد انجمن جدید"}</h4>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              {/* عنوان */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">عنوان انجمن *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="مثلاً انجمن کسب‌وکارهای پسته رفسنجان"
                  className="h-10 rounded-xl border-slate-700 bg-slate-800/70 text-white placeholder:text-slate-500"
                  maxLength={80}
                />
              </div>

              {/* نوع */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">نوع انجمن *</Label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: "PUBLIC", label: "عمومی", desc: "همه می‌بینند؛ عضویت با درخواست + تایید رئیس", icon: Globe2 },
                    { id: "PRIVATE", label: "خصوصی", desc: "فقط اعضای دعوت‌شده؛ سایرین اصلاً نمی‌بینند", icon: Lock },
                  ] as const).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setForm({ ...form, type: t.id })}
                      className={`rounded-xl border p-3 text-right transition-all active:scale-95 ${
                        form.type === t.id
                          ? "border-teal-500/50 bg-teal-500/10"
                          : "border-slate-700 bg-slate-800/40 hover:bg-slate-800/70"
                      }`}
                    >
                      <p className={`flex items-center gap-1.5 text-xs font-bold ${form.type === t.id ? "text-teal-400" : "text-slate-300"}`}>
                        <t.icon className="size-4" />
                        {t.label}
                      </p>
                      <p className="mt-1 text-[10px] leading-4 text-slate-500">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* رئیس انجمن — جستجوی کاربر */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1 text-xs text-slate-300">
                  <Crown className="size-3.5 text-amber-400" />
                  رئیس انجمن * (جستجو با نام یا شماره موبایل)
                </Label>
                {form.chairId && !candidates.length ? (
                  <div className="flex items-center justify-between rounded-xl border border-teal-500/40 bg-teal-500/10 p-2.5">
                    <p className="text-xs font-bold text-teal-300">
                      رئیس انتخاب‌شده: {form.chairName}
                    </p>
                    <button
                      onClick={() => setForm({ ...form, chairId: "", chairName: "" })}
                      className="text-[10px] font-bold text-rose-400 hover:underline"
                    >
                      تغییر
                    </button>
                  </div>
                ) : (
                  <>
                    <Input
                      value={chairQuery}
                      onChange={(e) => {
                        const v = e.target.value;
                        setChairQuery(v);
                        // پاک‌سازی سنکرون در handler (نه در effect) — سازگار با React Compiler
                        if (v.trim().length < 2) setCandidates([]);
                      }}
                      placeholder="حداقل ۲ حرف از نام یا شماره موبایل…"
                      className="h-10 rounded-xl border-slate-700 bg-slate-800/70 text-white placeholder:text-slate-500"
                      dir="rtl"
                    />
                    {searching ? (
                      <p className="flex items-center gap-1.5 text-[10px] text-slate-500">
                        <Loader2 className="size-3 animate-spin" /> در حال جستجو…
                      </p>
                    ) : null}
                    {candidates.length > 0 ? (
                      <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-slate-700 bg-slate-800/50 p-1.5" style={{ scrollbarWidth: "thin" }}>
                        {candidates.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => {
                              setForm({ ...form, chairId: c.id, chairName: c.name });
                              setChairQuery(c.name);
                              setCandidates([]);
                            }}
                            className="flex w-full items-center gap-2.5 rounded-lg p-2 text-right transition-colors hover:bg-slate-700/60"
                          >
                            <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-teal-500/20 text-[11px] font-bold text-teal-300">
                              {c.name.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-bold text-slate-200">{c.name}</p>
                              <p className="tnum truncate text-[10px] text-slate-500" dir="ltr">{c.phone}</p>
                            </div>
                            {c.headline ? <p className="max-w-28 truncate text-[9px] text-slate-500">{c.headline}</p> : null}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </>
                )}
              </div>

              {/* توضیح */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">درباره انجمن (اختیاری)</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="معرفی انجمن، اهداف و حوزه فعالیت…"
                  className="min-h-20 rounded-xl border-slate-700 bg-slate-800/70 text-white placeholder:text-slate-500 text-sm leading-6"
                  maxLength={600}
                />
              </div>

              {/* ایجنت */}
              <div className="space-y-3 rounded-2xl border border-slate-700/60 bg-slate-800/30 p-3.5">
                <p className="flex items-center gap-1.5 text-xs font-black text-slate-200">
                  <Bot className="size-4 text-teal-400" />
                  تنظیمات ایجنت انجمن (اختیاری)
                </p>
                <Input
                  value={form.agentName}
                  onChange={(e) => setForm({ ...form, agentName: e.target.value })}
                  placeholder={`نام نمایشی ایجنت — خالی = «ایجنت ${form.title || "انجمن"}»`}
                  className="h-10 rounded-xl border-slate-700 bg-slate-800/70 text-white placeholder:text-slate-500"
                  maxLength={60}
                />
                <Textarea
                  value={form.agentInstructions}
                  onChange={(e) => setForm({ ...form, agentInstructions: e.target.value })}
                  placeholder="دستورالعمل اختصاصی ایجنت — مثلاً: لحن رسمی و حرفه‌ای؛ اعضا را به رویدادها دعوت کن"
                  className="min-h-16 rounded-xl border-slate-700 bg-slate-800/70 text-white placeholder:text-slate-500 text-sm leading-6"
                  maxLength={2000}
                />
                {!editing ? (
                  <p className="text-[10px] leading-5 text-slate-500">
                    خوش‌آمدگویی، دانش و تنظیمات تکمیلی ایجنت بعداً توسط رئیس انجمن از پنل مدیریت انجمن قابل تغییر است.
                  </p>
                ) : null}
              </div>

              {/* وضعیت — فقط ویرایش */}
              {editing ? (
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">وضعیت انجمن</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["ACTIVE", "PAUSED", "ARCHIVED"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setForm({ ...form, status: s })}
                        className={`rounded-xl border py-2 text-xs font-bold transition-all active:scale-95 ${
                          form.status === s
                            ? "border-teal-500/50 bg-teal-500/10 text-teal-400"
                            : "border-slate-700 bg-slate-800/40 text-slate-400 hover:bg-slate-800/70"
                        }`}
                      >
                        {s === "ACTIVE" ? "فعال" : s === "PAUSED" ? "مکث موقت" : "بایگانی"}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 gap-2 border-t border-slate-800 p-4">
              <Button onClick={save} disabled={saving} className="flex-1 rounded-xl bg-teal-600 font-bold text-white hover:bg-teal-700">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                {editing ? "ذخیره تغییرات" : "ایجاد انجمن"}
              </Button>
              <Button onClick={() => setDialogOpen(false)} variant="outline" className="rounded-xl border-slate-700 text-slate-300 hover:bg-slate-800">
                انصراف
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
