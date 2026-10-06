// ═════ مدیریت کاربران ═════
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users, Search, ShieldCheck, ShieldOff, Trash2, ChevronLeft, ChevronRight,
  Eye, X, Target, MessageSquare, Brain, MonitorSmartphone, BadgeCheck, TimerOff,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import AppDialog from "@/components/ui/app-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { get, patch, del } from "@/lib/client/api";
import { faNum, faDate, faRelative, maskPhone, avatarColor } from "@/lib/client/persian";
import { toast } from "@/hooks/use-toast";

interface UserRow {
  id: string; phone: string; fullName: string | null; email: string | null;
  city: string; role: string; status: string; avatarColor: string;
  isVerified: boolean; restrictedUntil: string | null; restrictionReason: string | null;
  lastLoginAt: string | null; loginCount: number; createdAt: string;
  stats: { activeGoals: number; chatSessions: number; memories: number };
}
interface UserDetail {
  user: {
    id: string; phone: string; fullName: string | null; email: string | null;
    city: string; gender: string | null; birthYear: number | null; bio: string | null;
    role: string; status: string; avatarColor: string; avatarUrl: string | null;
    isVerified: boolean; verifiedAt: string | null; restrictedUntil: string | null; restrictionReason: string | null;
    socialProfile: { id: string; headline: string | null; isDiscoverable: boolean; viewCount: number; agentEnabled: boolean; agentName: string | null; agentStyle: string } | null;
    createdAt: string; lastLoginAt: string | null; loginCount: number;
    sessions: Array<{ id: string; ip: string | null; device: string | null; lastUsedAt: string; createdAt: string }>;
    activeSessions: number;
    counts: { goals: number; chatSessions: number; memories: number; reviews: number; knowledgeItems: number };
    recentChats: Array<{ id: string; title: string; mode: string; messageCount: number; updatedAt: string }>;
  };
}

export default function UsersTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [restrictOpen, setRestrictOpen] = useState(false);
  const [restrictTarget, setRestrictTarget] = useState<UserRow | null>(null);
  const [restrictDays, setRestrictDays] = useState("7");
  const [restrictReason, setRestrictReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "12" });
    if (query.trim()) params.set("q", query.trim());
    if (statusFilter !== "all") params.set("status", statusFilter);
    const res = await get<{ users: UserRow[]; pagination: { total: number; totalPages: number } }>(
      `/api/admin/users?${params}`
    );
    if (res.success && res.data) {
      setUsers(res.data.users);
      setTotalPages(res.data.pagination.totalPages);
      setTotal(res.data.pagination.total);
    }
    setLoading(false);
  }, [page, query, statusFilter]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    const res = await get<UserDetail>(`/api/admin/users/${id}`);
    if (res.success && res.data) setDetail(res.data);
    setDetailLoading(false);
  };

  const toggleStatus = async (u: UserRow) => {
    const newStatus = u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const res = await patch(`/api/admin/users/${u.id}`, { status: newStatus, revokeSessions: newStatus === "SUSPENDED" });
    if (res.success) {
      toast({
        title: newStatus === "SUSPENDED" ? "کاربر مسدود شد" : "کاربر فعال شد",
        description: u.fullName || u.phone,
      });
      load();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const deleteUser = async (u: UserRow) => {
    const res = await del(`/api/admin/users/${u.id}`);
    if (res.success) {
      toast({ title: "کاربر حذف شد (حذف نرم)" });
      load();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const toggleVerified = async (u: UserRow) => {
    const res = await patch(`/api/admin/users/${u.id}`, { isVerified: !u.isVerified });
    if (res.success) {
      toast({
        title: u.isVerified ? "تیک آبی برداشته شد" : "تیک آبی فعال شد",
        description: u.fullName || u.phone,
      });
      load();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const applyRestriction = async () => {
    if (!restrictTarget) return;
    const days = parseInt(restrictDays);
    if (!days || days < 1) {
      toast({ title: "مدت محدودیت نامعتبر است", variant: "destructive" });
      return;
    }
    const until = new Date(Date.now() + days * 86400000).toISOString();
    const res = await patch(`/api/admin/users/${restrictTarget.id}`, {
      restrictedUntil: until,
      restrictionReason: restrictReason.trim() || "محدودیت مدیریتی",
    });
    if (res.success) {
      toast({ title: `کاربر برای ${restrictDays} روز محدود شد`, description: restrictTarget.fullName || restrictTarget.phone });
      setRestrictOpen(false);
      setRestrictReason("");
      setRestrictDays("7");
      load();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const liftRestriction = async (u: UserRow) => {
    const res = await patch(`/api/admin/users/${u.id}`, { restrictedUntil: null });
    if (res.success) {
      toast({ title: "محدودیت برداشته شد", description: u.fullName || u.phone });
      load();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-white">مدیریت کاربران</h2>
        <p className="text-slate-400 text-sm mt-1">{faNum(total)} کاربر ثبت‌شده — تیک آبی، محدودیت و بلوک</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="جستجو در نام، موبایل، ایمیل..."
            className="pr-12 h-11 rounded-xl bg-slate-900/70 border-slate-800 text-white placeholder:text-slate-500"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40 rounded-xl h-11 bg-slate-900/70 border-slate-800 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all">همه وضعیت‌ها</SelectItem>
            <SelectItem value="ACTIVE">فعال</SelectItem>
            <SelectItem value="SUSPENDED">مسدود</SelectItem>
            <SelectItem value="DELETED">حذف‌شده</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-dashed border-slate-800">
          <Users className="w-12 h-12 mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400 text-sm">کاربری یافت نشد</p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <div
              key={u.id}
              className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition-colors"
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${avatarColor(u.avatarColor)} flex items-center justify-center text-white font-bold shrink-0`}>
                  {(u.fullName || "ک").charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-white font-bold text-sm">{u.fullName || "بی‌نام"}</p>
                    {u.isVerified && (
                      <Badge className="text-[9px] border-0 bg-sky-500/15 text-sky-400 gap-1">
                        <BadgeCheck className="w-3 h-3" />
                        تأییدشده
                      </Badge>
                    )}
                    {u.restrictedUntil && new Date(u.restrictedUntil) > new Date() && (
                      <Badge className="text-[9px] border-0 bg-amber-500/15 text-amber-400 gap-1">
                        <TimerOff className="w-3 h-3" />
                        محدود تا {faDate(u.restrictedUntil)}
                      </Badge>
                    )}
                    <Badge
                      className={`text-[9px] border-0 ${
                        u.status === "ACTIVE"
                          ? "bg-blue-500/15 text-blue-400"
                          : u.status === "SUSPENDED"
                          ? "bg-rose-500/15 text-rose-400"
                          : "bg-slate-500/15 text-slate-400"
                      }`}
                    >
                      {u.status === "ACTIVE" ? "فعال" : u.status === "SUSPENDED" ? "مسدود" : "حذف‌شده"}
                    </Badge>
                    {u.role === "ADMIN" && (
                      <Badge className="text-[9px] border-0 bg-violet-500/15 text-violet-400">مدیر</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                    <span className="tnum" dir="ltr">{maskPhone(u.phone)}</span>
                    <span>عضویت: {faDate(u.createdAt)}</span>
                    <span>{faNum(u.loginCount)} ورود</span>
                    <span className="flex items-center gap-1">
                      <Target className="w-3 h-3" /> {faNum(u.stats.activeGoals)} هدف
                    </span>
                    <span className="flex items-center gap-1">
                      <Brain className="w-3 h-3" /> {faNum(u.stats.memories)} حافظه
                    </span>
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => openDetail(u.id)}
                    className="rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 h-9 w-9 p-0">
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm" variant="ghost" onClick={() => toggleVerified(u)}
                    disabled={u.status === "DELETED"}
                    className={`rounded-lg h-9 w-9 p-0 ${
                      u.isVerified
                        ? "text-sky-400 hover:text-sky-300 hover:bg-sky-500/10"
                        : "text-slate-500 hover:text-sky-400 hover:bg-sky-500/10"
                    }`}
                    title={u.isVerified ? "برداشتن تیک آبی" : "دادن تیک آبی"}
                  >
                    <BadgeCheck className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => { if (u.restrictedUntil && new Date(u.restrictedUntil) > new Date()) liftRestriction(u); else { setRestrictTarget(u); setRestrictOpen(true); } }}
                    disabled={u.status !== "ACTIVE"}
                    className={`rounded-lg h-9 w-9 p-0 ${
                      u.restrictedUntil && new Date(u.restrictedUntil) > new Date()
                        ? "text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                        : "text-slate-500 hover:text-amber-400 hover:bg-amber-500/10"
                    }`}
                    title={u.restrictedUntil && new Date(u.restrictedUntil) > new Date() ? "برداشتن محدودیت" : "محدودسازی موقت"}
                  >
                    {u.restrictedUntil && new Date(u.restrictedUntil) > new Date() ? <ShieldCheck className="w-4 h-4" /> : <TimerOff className="w-4 h-4" />}
                  </Button>
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => toggleStatus(u)}
                    disabled={u.status === "DELETED"}
                    className={`rounded-lg h-9 w-9 p-0 ${
                      u.status === "ACTIVE"
                        ? "text-rose-400/80 hover:text-rose-400 hover:bg-rose-500/10"
                        : "text-blue-400/80 hover:text-blue-400 hover:bg-blue-500/10"
                    }`}
                    title={u.status === "ACTIVE" ? "مسدودسازی کامل" : "فعال‌سازی"}
                  >
                    {u.status === "ACTIVE" ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                  </Button>
                  <Button
                    size="sm" variant="ghost" onClick={() => deleteUser(u)}
                    disabled={u.status === "DELETED"}
                    className="rounded-lg text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/10 h-9 w-9 p-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
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

      {/* دیالوگ جزئیات کاربر */}
      <AppDialog
        open={!!detail || detailLoading}
        onClose={() => setDetail(null)}
        variant="admin"
        size="xl"
        hideHeader
        title="جزئیات کاربر"
      >
          {detailLoading ? (
            <div className="space-y-4 p-4">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-48 rounded-xl" />
            </div>
          ) : detail ? (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${avatarColor(detail.user.avatarColor)} flex items-center justify-center text-white text-lg font-bold shadow-lg`}>
                  {(detail.user.fullName || "ک").charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-white font-bold text-base">{detail.user.fullName || "بی‌نام"}</p>
                    {detail.user.isVerified && (
                      <Badge className="text-[9px] border-0 bg-sky-500/15 text-sky-400 gap-1">
                        <BadgeCheck className="w-3 h-3" />
                        تأییدشده
                      </Badge>
                    )}
                    {detail.user.socialProfile?.agentEnabled && (
                      <Badge className="text-[9px] border-0 bg-violet-500/15 text-violet-400 gap-1">
                        <Bot className="w-3 h-3" />
                        {detail.user.socialProfile.agentName || "ایجنت"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-slate-500 text-[11px] tnum" dir="ltr">{detail.user.phone}</p>
                </div>
              </div>
              <div className="space-y-5">
                {/* اطلاعات پایه */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: "موبایل", value: detail.user.phone, ltr: true },
                    { label: "ایمیل", value: detail.user.email || "—", ltr: true },
                    { label: "شهر", value: detail.user.city },
                    { label: "وضعیت", value: detail.user.status === "ACTIVE" ? "فعال" : detail.user.status === "SUSPENDED" ? "مسدود" : "حذف‌شده" },
                    { label: "عضویت", value: faDate(detail.user.createdAt) },
                    { label: "آخرین ورود", value: detail.user.lastLoginAt ? faRelative(detail.user.lastLoginAt) : "—" },
                  ].map((f) => (
                    <div key={f.label} className="bg-slate-800/50 rounded-xl p-3">
                      <p className="text-[11px] text-slate-500">{f.label}</p>
                      <p className={`text-white mt-1 ${f.ltr ? "tnum" : ""}`} dir={f.ltr ? "ltr" : "rtl"} style={f.ltr ? { textAlign: "right" } : undefined}>
                        {f.value}
                      </p>
                    </div>
                  ))}
                </div>

                {detail.user.bio && (
                  <div className="bg-slate-800/50 rounded-xl p-4">
                    <p className="text-[11px] text-slate-500 mb-1.5">درباره کاربر</p>
                    <p className="text-slate-300 text-sm leading-relaxed">{detail.user.bio}</p>
                  </div>
                )}

                {/* آمار فعالیت */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "اهداف", value: detail.user.counts.goals, icon: Target },
                    { label: "گفتگو", value: detail.user.counts.chatSessions, icon: MessageSquare },
                    { label: "حافظه", value: detail.user.counts.memories, icon: Brain },
                    { label: "نظر", value: detail.user.counts.reviews, icon: Eye },
                  ].map((s) => (
                    <div key={s.label} className="bg-slate-800/50 rounded-xl p-3 text-center">
                      <s.icon className="w-4 h-4 mx-auto text-blue-400 mb-1.5" />
                      <p className="text-lg font-black text-white tnum">{faNum(s.value)}</p>
                      <p className="text-[10px] text-slate-500">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* اقدامات سریع */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => detail && toggleVerified({ ...(detail.user as any), stats: detail.user.counts } as UserRow)}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold transition-all active:scale-[0.98] ${
                      detail.user.isVerified
                        ? "border-sky-500/40 bg-sky-500/10 text-sky-400"
                        : "border-slate-700 bg-slate-800/50 text-slate-300 hover:border-sky-500/40 hover:text-sky-400"
                    }`}
                  >
                    <BadgeCheck className="size-4" />
                    {detail.user.isVerified ? "برداشتن تیک آبی" : "دادن تیک آبی"}
                  </button>
                  {detail.user.socialProfile && (
                    <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/50 p-3">
                      <span className="flex items-center gap-2 text-xs font-bold text-slate-300">
                        <Bot className="size-4 text-violet-400" />
                        ایجنت فعال
                      </span>
                      <Badge className="text-[9px] border-0 bg-slate-700 text-slate-300">
                        {faNum(detail.user.counts.knowledgeItems)} منبع دانش
                      </Badge>
                    </div>
                  )}
                </div>

                {/* سشن‌های فعال */}
                <div>
                  <p className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                    <MonitorSmartphone className="w-4 h-4 text-blue-400" />
                    سشن‌های فعال ({faNum(detail.user.activeSessions)})
                  </p>
                  {detail.user.sessions.length > 0 ? (
                    <div className="space-y-2">
                      {detail.user.sessions.map((s) => (
                        <div key={s.id} className="flex items-center gap-3 text-xs bg-slate-800/50 rounded-xl p-3">
                          <span className="text-slate-300">{s.device || "نامشخص"}</span>
                          <span className="text-slate-500 tnum" dir="ltr">{s.ip}</span>
                          <span className="text-slate-500 mr-auto">{faRelative(s.lastUsedAt)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">سشن فعالی وجود ندارد</p>
                  )}
                </div>

                {/* آخرین گفتگوها */}
                {detail.user.recentChats.length > 0 && (
                  <div>
                    <p className="text-sm font-bold text-white mb-2">آخرین گفتگوها با هوشیار</p>
                    <div className="space-y-2">
                      {detail.user.recentChats.map((c) => (
                        <div key={c.id} className="flex items-center gap-3 text-xs bg-slate-800/50 rounded-xl p-3">
                          <MessageSquare className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                          <span className="text-slate-300 truncate flex-1">{c.title}</span>
                          <span className="text-slate-500 tnum shrink-0">{faNum(c.messageCount)} پیام</span>
                          <span className="text-slate-500 shrink-0">{faRelative(c.updatedAt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null}
      </AppDialog>

      {/* ═══ دیالوگ محدودیت موقت ═══ */}
      <AppDialog
        open={restrictOpen}
        onClose={() => setRestrictOpen(false)}
        variant="admin"
        icon={TimerOff}
        title={`محدودسازی موقت: ${restrictTarget?.fullName || restrictTarget?.phone || ""}`}
        description="کاربر تا پایان دوره محدودیت به حساب خود دسترسی نخواهد داشت"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setRestrictOpen(false)} className="h-11 rounded-xl sm:h-9">انصراف</Button>
            <Button onClick={applyRestriction} className="h-11 rounded-xl sm:h-9 bg-amber-500 hover:bg-amber-600 text-white border-0 font-bold">
              اعمال محدودیت
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="text-xs font-bold text-slate-300 mb-2">مدت محدودیت</p>
            <div className="grid grid-cols-4 gap-2">
              {["1", "3", "7", "30"].map((d) => (
                <button
                  key={d}
                  onClick={() => setRestrictDays(d)}
                  className={`rounded-xl border p-3 text-center transition-all active:scale-95 ${
                    restrictDays === d
                      ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                      : "border-slate-700 bg-slate-800/40 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <p className="text-lg font-black tnum">{faNum(d)}</p>
                  <p className="text-[9px] mt-0.5">روز</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-300 mb-1.5">دلیل محدودیت (برای گزارش داخلی)</p>
            <Input
              value={restrictReason}
              onChange={(e) => setRestrictReason(e.target.value)}
              placeholder="مثلاً: تخلف در نظرات اصناف"
              maxLength={200}
              className="h-11 rounded-xl bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-3 text-[11px] text-rose-300/90 leading-relaxed">
            در طول دورهٔ محدودیت، توکن کاربر بی‌اثر می‌شود و تمام درخواست‌های API او رد خواهد شد. پس از پایان دوره دسترسی به‌صورت خودکار برمی‌گردد.
          </div>
        </div>
      </AppDialog>
    </div>
  );
}
