// ═══ مدیریت شبکه شهریار — پروفایل‌ها، ایجنت‌ها و تعامل ═══
"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Users, Search, BadgeCheck, Bot, Eye, ThumbsUp, BookOpen, MessageSquare,
  Sparkles, UserCheck, UserX, Globe2, ChevronLeft, ChevronRight, Brain,
  MessageCircle, ShieldCheck, ShieldOff, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import AppDialog from "@/components/ui/app-dialog";
import { get, patch } from "@/lib/client/api";
import { faNum, faRelative, maskPhone, avatarColor } from "@/lib/client/persian";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface SocialProfileRow {
  id: string; userId: string; headline: string | null; bio: string | null; city: string | null;
  bannerTheme: string; isDiscoverable: boolean; viewCount: number;
  agentEnabled: boolean; agentName: string | null; agentGreeting: string | null;
  agentStyle: string; agentInstructions: string | null; agentForbidden: string | null;
  agentQuestions: string[]; agentUseProfile: boolean; agentSuggestHandoff: boolean;
  updatedAt: string;
  user: {
    id: string; fullName: string | null; phone: string; avatarColor: string; avatarUrl: string | null;
    isVerified: boolean; status: string; lastLoginAt: string | null; loginCount: number;
  };
  skills: Array<{ name: string; level: number }>;
  interests: string[];
  stats: { knowledge: number; agentConvs: number; msgsSent: number; endorsements: number; views: number };
}

interface SocialData {
  overview: {
    profilesTotal: number; agentsEnabled: number; verifiedUsers: number;
    dmCount: number; agentConvCount: number; socialMsgs: number;
    endorsementsTotal: number; viewsTotal: number; knowledgeTotal: number; active7d: number;
  };
  profiles: SocialProfileRow[];
  topProfiles: Array<{ id: string; headline: string | null; viewCount: number; user: { fullName: string | null; isVerified: boolean } }>;
  pagination: { page: number; total: number; totalPages: number };
}

const AGENT_STYLE_LABELS: Record<string, string> = {
  professional: "حرفه‌ای",
  friendly: "صمیمی",
  marketing: "بازاریابانه",
  technical: "فنی",
  creative: "خلاقانه",
};

export default function SocialAdminTab() {
  const [data, setData] = useState<SocialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [agentsOnly, setAgentsOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<SocialProfileRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (query.trim()) params.set("q", query.trim());
    if (agentsOnly) params.set("agents", "1");
    const res = await get<SocialData>(`/api/admin/social?${params}`);
    if (res.success && res.data) setData(res.data);
    setLoading(false);
  }, [page, query, agentsOnly]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const updateProfile = async (userId: string, body: Record<string, unknown>, done: string) => {
    setBusy(true);
    const res = await patch(`/api/admin/social/${userId}`, body);
    setBusy(false);
    if (res.success) {
      toast({ title: done });
      if (selected?.userId === userId) {
        setSelected((s) => (s ? { ...s, ...(body as Partial<SocialProfileRow>) } : s));
      }
      load();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const o = data?.overview;
  const statCards = [
    { label: "پروفایل شهریار", value: o?.profilesTotal ?? 0, sub: `${faNum(o?.verifiedUsers ?? 0)} تیک‌آبی`, icon: Users, color: "from-blue-500 to-indigo-600" },
    { label: "ایجنت فعال", value: o?.agentsEnabled ?? 0, sub: `${faNum(o?.knowledgeTotal ?? 0)} منبع دانش`, icon: Bot, color: "from-violet-500 to-purple-600" },
    { label: "گفتگوهای شبکه", value: (o?.dmCount ?? 0) + (o?.agentConvCount ?? 0), sub: `${faNum(o?.agentConvCount ?? 0)} با ایجنت‌ها`, icon: MessageCircle, color: "from-sky-500 to-cyan-600" },
    { label: "پیام‌های ردوبدل", value: o?.socialMsgs ?? 0, sub: `${faNum(o?.active7d ?? 0)} در ۷ روز`, icon: MessageSquare, color: "from-emerald-500 to-teal-600" },
    { label: "تأیید مهارت‌ها", value: o?.endorsementsTotal ?? 0, sub: "اعتماد شبکه", icon: ThumbsUp, color: "from-amber-500 to-orange-600" },
    { label: "بازدید پروفایل‌ها", value: o?.viewsTotal ?? 0, sub: "نمای شبکی", icon: Eye, color: "from-rose-500 to-pink-600" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-white">شبکه شهریار</h2>
        <p className="text-slate-400 text-sm mt-1">مدیریت جامع پروفایل‌ها، ایجنت‌های شخصی و تعامل شبکه اجتماعی</p>
      </div>

      {/* آمار کلی */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {statCards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3.5 hover:border-slate-700 transition-colors">
              <div className={cn("mb-2.5 grid size-9 place-items-center rounded-xl bg-gradient-to-br shadow-lg", c.color)}>
                <c.icon className="size-4.5 text-white" style={{ width: 18, height: 18 }} />
              </div>
              <p className="text-xl font-black text-white tnum">{faNum(c.value)}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{c.label}</p>
              <p className="text-[9px] text-slate-500 mt-0.5">{c.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* برترین پروفایل‌ها */}
      {data?.topProfiles && data.topProfiles.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Zap className="size-4 text-amber-400" />
            پربازدیدترین پروفایل‌ها
          </p>
          <div className="flex flex-wrap gap-2">
            {data.topProfiles.map((p, i) => (
              <span key={p.id} className="inline-flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-800/60 px-3 py-2 text-xs">
                <span className="grid size-5 place-items-center rounded-md bg-amber-500/15 text-amber-400 font-black text-[10px] tnum">{faNum(i + 1)}</span>
                <span className="text-slate-200 font-bold">{p.user.fullName || "بی‌نام"}</span>
                {p.user.isVerified && <BadgeCheck className="size-3.5 text-sky-400" />}
                <span className="text-slate-500 tnum">{faNum(p.viewCount)} بازدید</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* فیلترها */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="جستجوی کاربر در شبکه..."
            className="pr-12 h-11 rounded-xl bg-slate-900/70 border-slate-800 text-white placeholder:text-slate-500"
          />
        </div>
        <button
          onClick={() => { setAgentsOnly(!agentsOnly); setPage(1); }}
          className={cn(
            "flex h-11 items-center gap-2 rounded-xl border px-4 text-xs font-bold transition-all",
            agentsOnly
              ? "border-violet-500/50 bg-violet-500/15 text-violet-300"
              : "border-slate-800 bg-slate-900/70 text-slate-400 hover:text-white"
          )}
        >
          <Bot className="size-4" />
          فقط ایجنت‌دارها
        </button>
      </div>

      {/* لیست پروفایل‌ها */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : !data || data.profiles.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-dashed border-slate-800">
          <Users className="w-12 h-12 mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400 text-sm">پروفایلی یافت نشد</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.profiles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 hover:border-slate-700 transition-colors"
            >
              <div className="flex flex-wrap items-center gap-3">
                {/* آواتار */}
                <div className={cn("size-12 shrink-0 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white font-bold text-base shadow-md", avatarColor(p.user.avatarColor))}>
                  {(p.user.fullName || "ک").charAt(0)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-white font-bold text-sm">{p.user.fullName || "بی‌نام"}</p>
                    {p.user.isVerified && (
                      <Badge className="text-[9px] border-0 bg-sky-500/15 text-sky-400 gap-1">
                        <BadgeCheck className="size-3" />
                        تأییدشده
                      </Badge>
                    )}
                    {p.agentEnabled && (
                      <Badge className="text-[9px] border-0 bg-violet-500/15 text-violet-400 gap-1">
                        <Bot className="size-3" />
                        {p.agentName || "ایجنت"}
                      </Badge>
                    )}
                    {!p.isDiscoverable && (
                      <Badge className="text-[9px] border-0 bg-slate-500/15 text-slate-400">پنهان</Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 truncate">{p.headline || "بدون عنوان شغلی"}</p>
                  {/* متادیتای جامع */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[10px] text-slate-500">
                    <span className="tnum" dir="ltr">{maskPhone(p.user.phone)}</span>
                    <span className="flex items-center gap-1"><Eye className="size-3" />{faNum(p.stats.views)}</span>
                    <span className="flex items-center gap-1"><ThumbsUp className="size-3" />{faNum(p.stats.endorsements)}</span>
                    <span className="flex items-center gap-1"><BookOpen className="size-3" />{faNum(p.stats.knowledge)} دانش</span>
                    <span className="flex items-center gap-1"><MessageSquare className="size-3" />{faNum(p.stats.agentConvs)} گفتگو</span>
                    <span>{faRelative(p.updatedAt)}</span>
                  </div>
                </div>

                {/* اقدامات */}
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => setSelected(p)}
                    className="rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 h-9 w-9 p-0" title="جزئیات و مدیریت ایجنت">
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm" variant="ghost" disabled={busy}
                    onClick={() => updateProfile(p.userId, { isVerified: !p.user.isVerified }, p.user.isVerified ? "تیک آبی برداشته شد" : "تیک آبی فعال شد")}
                    className={cn(
                      "rounded-lg h-9 w-9 p-0",
                      p.user.isVerified
                        ? "text-sky-400 hover:text-sky-300 hover:bg-sky-500/10"
                        : "text-slate-500 hover:text-sky-400 hover:bg-sky-500/10"
                    )}
                    title={p.user.isVerified ? "برداشتن تیک آبی" : "دادن تیک آبی"}
                  >
                    <BadgeCheck className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm" variant="ghost" disabled={busy}
                    onClick={() => updateProfile(p.userId, { agentEnabled: !p.agentEnabled }, p.agentEnabled ? "ایجنت غیرفعال شد" : "ایجنت فعال شد")}
                    className={cn(
                      "rounded-lg h-9 w-9 p-0",
                      p.agentEnabled
                        ? "text-violet-400 hover:text-violet-300 hover:bg-violet-500/10"
                        : "text-slate-500 hover:text-violet-400 hover:bg-violet-500/10"
                    )}
                    title={p.agentEnabled ? "غیرفعال‌سازی ایجنت" : "فعال‌سازی ایجنت"}
                  >
                    {p.agentEnabled ? <Bot className="w-4 h-4" /> : <Brain className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* صفحه‌بندی */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}
            className="rounded-xl bg-slate-900 border-slate-800 text-slate-300">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="text-slate-400 text-sm tnum">صفحه {faNum(page)} از {faNum(data.pagination.totalPages)}</span>
          <Button variant="outline" size="sm" disabled={page >= data.pagination.totalPages} onClick={() => setPage(page + 1)}
            className="rounded-xl bg-slate-900 border-slate-800 text-slate-300">
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* ═══ دیالوگ مدیریت جامع پروفایل + ایجنت ═══ */}
      <AppDialog
        open={!!selected}
        onClose={() => setSelected(null)}
        variant="admin"
        size="xl"
        icon={Users}
        title={selected?.user.fullName || "پروفایل"}
        description={selected?.headline || "مدیریت پروفایل شبکه و ایجنت شخصی"
        }
      >
        {selected && (
          <div className="space-y-5">
            {/* اقدامات سریع */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => updateProfile(selected.userId, { isVerified: !selected.user.isVerified }, selected.user.isVerified ? "تیک آبی برداشته شد" : "تیک آبی فعال شد")}
                disabled={busy}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-50",
                  selected.user.isVerified
                    ? "border-sky-500/40 bg-sky-500/10 text-sky-400"
                    : "border-slate-700 bg-slate-800/50 text-slate-300 hover:border-sky-500/40 hover:text-sky-400"
                )}
              >
                {selected.user.isVerified ? <ShieldOff className="size-4" /> : <ShieldCheck className="size-4" />}
                {selected.user.isVerified ? "برداشتن تیک آبی" : "دادن تیک آبی"}
              </button>
              <button
                onClick={() => updateProfile(selected.userId, { isDiscoverable: !selected.isDiscoverable }, selected.isDiscoverable ? "از دایرکتوری پنهان شد" : "در دایرکتوری نمایان شد")}
                disabled={busy}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-50",
                  selected.isDiscoverable
                    ? "border-slate-700 bg-slate-800/50 text-slate-300 hover:border-amber-500/40 hover:text-amber-400"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-400"
                )}
              >
                <Globe2 className="size-4" />
                {selected.isDiscoverable ? "پنهان از دایرکتوری" : "نمایان در دایرکتوری"}
              </button>
            </div>

            {/* ─── پنل ایجنت شخصی ─── */}
            <div className="rounded-2xl border border-violet-500/25 bg-violet-500/5 overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-violet-500/20 bg-violet-500/10 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg">
                    <Bot className="size-4.5 text-white" style={{ width: 18, height: 18 }} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white">{selected.agentName || `ایجنتِ ${selected.user.fullName?.charAt(0) || ""}`}</p>
                    <p className="text-[10px] text-violet-300/80">
                      سبک: {AGENT_STYLE_LABELS[selected.agentStyle] || selected.agentStyle} · {faNum(selected.stats.agentConvs)} گفتگو · {faNum(selected.stats.knowledge)} منبع دانش
                    </p>
                  </div>
                </div>
                <Switch
                  checked={selected.agentEnabled}
                  disabled={busy}
                  onCheckedChange={(v) => updateProfile(selected.userId, { agentEnabled: v }, v ? "ایجنت فعال شد" : "ایجنت غیرفعال شد")}
                />
              </div>

              <div className="space-y-4 p-4">
                {/* پیام خوش‌آمد */}
                {selected.agentGreeting && (
                  <div className="rounded-xl bg-slate-800/60 p-3">
                    <p className="text-[10px] text-slate-500 mb-1 flex items-center gap-1"><Sparkles className="size-3" /> پیام خوش‌آمدگویی</p>
                    <p className="text-xs text-slate-300 leading-relaxed">{selected.agentGreeting}</p>
                  </div>
                )}

                {/* سؤال‌های پیشنهادی */}
                {selected.agentQuestions.length > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-500 mb-1.5">سؤال‌های پیشنهادی شروع گفتگو</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.agentQuestions.map((q, i) => (
                        <span key={i} className="rounded-lg bg-violet-500/10 border border-violet-500/20 px-2.5 py-1.5 text-[10px] text-violet-300">{q}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* دستورالعمل اختصاصی */}
                {selected.agentInstructions && (
                  <div className="rounded-xl bg-slate-800/60 p-3">
                    <p className="text-[10px] text-slate-500 mb-1 flex items-center gap-1"><Brain className="size-3" /> دستورالعمل اختصاصی مالک</p>
                    <p className="text-xs text-slate-300 leading-relaxed line-clamp-6">{selected.agentInstructions}</p>
                  </div>
                )}

                {/* موضوعات ممنوعه */}
                {selected.agentForbidden && (
                  <div className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-3">
                    <p className="text-[10px] text-rose-400/80 mb-1 flex items-center gap-1"><UserX className="size-3" /> موضوعات ممنوعه</p>
                    <p className="text-xs text-rose-300/90 leading-relaxed">{selected.agentForbidden}</p>
                  </div>
                )}

                {/* تنظیمات رفتاری */}
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className={cn("rounded-lg px-2.5 py-2 font-bold", selected.agentUseProfile ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-800 text-slate-500")}>
                    {selected.agentUseProfile ? "✓" : "×"} استفاده از پروفایل عمومی
                  </div>
                  <div className={cn("rounded-lg px-2.5 py-2 font-bold", selected.agentSuggestHandoff ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-800 text-slate-500")}>
                    {selected.agentSuggestHandoff ? "✓" : "×"} دعوت به گفتگوی مستقیم
                  </div>
                </div>

                {/* آمار ایجنت */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "منبع دانش", value: selected.stats.knowledge, icon: BookOpen },
                    { label: "گفتگو", value: selected.stats.agentConvs, icon: MessageSquare },
                    { label: "پیام ارسالی", value: selected.stats.msgsSent, icon: MessageCircle },
                    { label: "بازدید پروفایل", value: selected.stats.views, icon: Eye },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl bg-slate-800/60 p-2.5 text-center">
                      <s.icon className="size-3.5 mx-auto text-violet-400 mb-1" />
                      <p className="text-sm font-black text-white tnum">{faNum(s.value)}</p>
                      <p className="text-[9px] text-slate-500">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* مهارت‌ها */}
            {selected.skills.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-300 mb-2">مهارت‌ها ({faNum(selected.skills.length)})</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.skills.map((s) => (
                    <span key={s.name} className="rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-[10px] text-slate-300">
                      {s.name}
                      <span className="text-slate-500 mr-1">· سطح {faNum(s.level)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* علایق */}
            {selected.interests.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-300 mb-2">علایق</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.interests.map((tag) => (
                    <span key={tag} className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-2.5 py-1.5 text-[10px] text-blue-300">{tag}</span>
                  ))}
                </div>
              </div>
            )}

            {/* درباره */}
            {selected.bio && (
              <div className="rounded-xl bg-slate-800/60 p-3.5">
                <p className="text-[10px] text-slate-500 mb-1.5">درباره</p>
                <p className="text-xs text-slate-300 leading-relaxed line-clamp-5">{selected.bio}</p>
              </div>
            )}
          </div>
        )}
      </AppDialog>
    </div>
  );
}
