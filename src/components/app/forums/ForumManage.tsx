// ═══ پنل مدیریت انجمن — ویژه رئیس انجمن ═══
// زیربخش‌ها: درخواست‌های عضویت | اعضا | ایجنت انجمن (دانش + تنظیمات) | تنظیمات
"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Ban, Bot, Check, Crown, FilePlus2, Loader2, MessageSquare, Pencil, Plus,
  RefreshCcw, Settings2, ShieldCheck, Trash2, UserMinus, UserPlus, Users, X, Clock, Brain,
  Magnet, MessageSquareText, PhoneOutgoing, RotateCcw, Search, Sparkles, CheckCircle2, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { del, get, patch, post } from "@/lib/client/api";
import { faNum, faRelative } from "@/lib/client/persian";
import type { ForumDetailData, ForumKnowledgeDTO, ForumManageData, ForumMemberDTO } from "@/lib/modules/forums/types";
import type { LeadStatsDTO, LeadSummaryDTO } from "@/lib/modules/leads/service";
import { ForumRoleBadge, LeadStatusBadge, LEAD_STATUS_META } from "../social/leads/lead-ui";
import LeadDetailDialog from "../social/leads/LeadDetailDialog";

import { PersonAvatar } from "../social/social-ui";

type Section = "requests" | "members" | "agent" | "leads" | "settings";

export default function ForumManage({ forum, onChanged }: { forum: ForumDetailData; onChanged: () => void }) {
  const [section, setSection] = useState<Section>("requests");
  const [data, setData] = useState<ForumManageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [addQuery, setAddQuery] = useState("");

  // تنظیمات ایجنت
  const [agentForm, setAgentForm] = useState({
    enabled: forum.agent.enabled,
    name: "",
    greeting: "",
    instructions: "",
    description: forum.description || "",
  });
  const [agentSaving, setAgentSaving] = useState(false);

  // دانش
  const [knowledge, setKnowledge] = useState<ForumKnowledgeDTO[] | null>(null);
  const [kEditorOpen, setKEditorOpen] = useState(false);
  const [kEditing, setKEditing] = useState<ForumKnowledgeDTO | null>(null);
  const [kForm, setKForm] = useState({ title: "", content: "" });
  const [kSaving, setKSaving] = useState(false);

  // لیدهای ایجنت انجمن
  const [leadsData, setLeadsData] = useState<{ leads: LeadSummaryDTO[]; stats: LeadStatsDTO } | null>(null);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadQuery, setLeadQuery] = useState("");
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [manageRes, kRes] = await Promise.all([
      get<ForumManageData>(`/api/forums/${forum.id}/manage`),
      get<{ knowledge: ForumKnowledgeDTO[] }>(`/api/forums/${forum.id}/knowledge`),
    ]);
    if (manageRes.success && manageRes.data) setData(manageRes.data);
    if (kRes.success && kRes.data) setKnowledge(kRes.data.knowledge);
    setLoading(false);
  }, [forum.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- بارگذاری اولیه پنل مدیریت در mount (الگوی متعارف پروژه)
    load();
  }, [load]);

  // بارگذاری تنبل لیدها — فقط با ورود به بخش لیدها
  const loadLeads = useCallback(async () => {
    setLeadsLoading(true);
    const res = await get<{ leads: LeadSummaryDTO[]; stats: LeadStatsDTO }>(`/api/forums/${forum.id}/leads`);
    if (res.success && res.data) setLeadsData(res.data);
    else if (res.error) toast({ title: "خطا", description: res.error, variant: "destructive" });
    setLeadsLoading(false);
  }, [forum.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- بارگذاری تنزل بخش لیدها با ورود به آن
    if (section === "leads" && leadsData === null && !leadsLoading) loadLeads();
  }, [section, leadsData, leadsLoading, loadLeads]);

  const memberAction = async (member: ForumMemberDTO, action: "approve" | "reject" | "ban" | "unban" | "remove") => {
    if (busy) return;
    setBusy(member.id);
    const res = await patch<{ message: string }>(`/api/forums/${forum.id}/manage/members/${member.id}`, { action });
    setBusy(null);
    if (res.success) {
      toast({ title: res.data?.message || "انجام شد" });
      load();
      onChanged();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const addMember = async () => {
    if (busy || !addQuery.trim()) return;
    setBusy("add");
    const res = await post<{ message: string }>(`/api/forums/${forum.id}/manage/add-member`, { query: addQuery.trim() });
    setBusy(null);
    if (res.success) {
      toast({ title: res.data?.message || "عضو اضافه شد" });
      setAddQuery("");
      load();
      onChanged();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const saveAgentSettings = async () => {
    if (agentSaving) return;
    setAgentSaving(true);
    const res = await patch(`/api/forums/${forum.id}/manage`, {
      agentEnabled: agentForm.enabled,
      agentName: agentForm.name,
      agentGreeting: agentForm.greeting,
      agentInstructions: agentForm.instructions,
      description: agentForm.description,
    });
    setAgentSaving(false);
    if (res.success) {
      toast({ title: "تنظیمات ایجنت ذخیره شد" });
      load();
      onChanged();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const openKEitor = (entry?: ForumKnowledgeDTO) => {
    setKEditing(entry || null);
    setKForm({ title: entry?.title || "", content: entry?.content || "" });
    setKEditorOpen(true);
  };

  const saveKnowledge = async () => {
    if (kSaving) return;
    if (!kForm.title.trim()) return toast({ title: "عنوان منبع الزامی است", variant: "destructive" });
    if (!kForm.content.trim()) return toast({ title: "متن منبع خالی است", variant: "destructive" });
    setKSaving(true);
    const res = kEditing
      ? await patch(`/api/forums/${forum.id}/knowledge/${kEditing.id}`, kForm)
      : await post(`/api/forums/${forum.id}/knowledge`, kForm);
    setKSaving(false);
    if (res.success) {
      toast({ title: kEditing ? "منبع به‌روزرسانی شد" : "منبع جدید اضافه شد" });
      setKEditorOpen(false);
      load();
      onChanged();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const deleteKnowledge = async (entry: ForumKnowledgeDTO) => {
    const res = await del(`/api/forums/${forum.id}/knowledge/${entry.id}`);
    if (res.success) {
      toast({ title: "منبع حذف شد" });
      load();
      onChanged();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const sections: Array<{ id: Section; label: string; icon: typeof Users; badge?: number }> = [
    { id: "requests", label: "درخواست‌ها", icon: UserPlus, badge: data?.stats.pending },
    { id: "members", label: "اعضا", icon: Users },
    { id: "agent", label: "ایجنت انجمن", icon: Bot },
    { id: "leads", label: "لیدها", icon: Magnet, badge: leadsData?.stats.NEW },
    { id: "settings", label: "تنظیمات", icon: Settings2 },
  ];

  return (
    <div className="space-y-4" dir="rtl">
      {/* آمار کلی */}
      {data ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "اعضای فعال", value: data.stats.members, icon: Users },
            { label: "درخواست pending", value: data.stats.pending, icon: Clock },
            { label: "پیام تالار", value: data.stats.messages, icon: MessageSquare },
            { label: "پاسخ ایجنت", value: data.stats.agentMessages, icon: Bot },
            { label: "مقالات", value: data.stats.publishedArticles, icon: FilePlus2 },
            { label: "منابع دانش", value: data.stats.knowledge, icon: Brain },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-border/60 bg-card p-3 text-center">
              <s.icon className="mx-auto size-4 text-primary" />
              <p className="tnum mt-1.5 text-base font-black leading-none">{faNum(s.value)}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* زیرتب‌ها */}
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-border/60 bg-card/70 p-1" style={{ scrollbarWidth: "thin" }}>
        {sections.map((s) => {
          const active = section === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`relative flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-colors active:scale-95 ${
                active ? "text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {active && (
                <motion.span layoutId="forum-manage-pill" className="absolute inset-0 rounded-xl shahryar-gradient shadow-md" />
              )}
              <s.icon className="relative z-10 size-4" />
              <span className="relative z-10">{s.label}</span>
              {s.badge ? (
                <span className="relative z-10 grid min-w-4.5 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white">
                  {faNum(s.badge)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : (
        <motion.div key={section} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {/* ═══ درخواست‌های عضویت ═══ */}
          {section === "requests" ? (
            !data || data.pending.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border/60 bg-card p-8 text-center">
                <ShieldCheck className="size-10 text-muted-foreground/50" />
                <p className="text-sm font-black">درخواست جدیدی نیست</p>
                <p className="max-w-xs text-xs leading-6 text-muted-foreground">
                  درخواست‌های عضویت انجمن‌های عمومی اینجا نمایش داده می‌شوند تا تایید یا رد کنید.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {data.pending.map((m) => (
                  <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-sky-500/25 bg-sky-500/5 p-3.5">
                    <PersonAvatar name={m.name} color={m.avatarColor} size={44} radius="xl" className="shadow-none" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black">{m.name}</p>
                      <p className="text-[11px] text-muted-foreground tnum" dir="ltr">{m.phone}</p>
                      {m.requestNote ? (
                        <p className="mt-1.5 rounded-xl bg-card/70 p-2 text-[11px] leading-5 text-muted-foreground">«{m.requestNote}»</p>
                      ) : null}
                      <p className="mt-1 text-[10px] text-muted-foreground/70">{faRelative(m.joinedAt)}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        onClick={() => memberAction(m, "approve")}
                        disabled={busy === m.id}
                        size="sm"
                        className="h-10 rounded-xl bg-emerald-600 px-4 font-bold hover:bg-emerald-700 sm:h-9"
                      >
                        {busy === m.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                        تایید
                      </Button>
                      <Button
                        onClick={() => memberAction(m, "reject")}
                        disabled={busy === m.id}
                        variant="outline"
                        size="sm"
                        className="h-10 rounded-xl border-rose-500/30 px-4 font-bold text-rose-500 hover:bg-rose-500/10 sm:h-9"
                      >
                        <X className="size-4" />
                        رد
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : null}

          {/* ═══ اعضا ═══ */}
          {section === "members" ? (
            <div className="space-y-3">
              {/* افزودن مستقیم */}
              <div className="rounded-2xl border border-border/60 bg-card p-3.5">
                <Label className="mb-2 flex items-center gap-1.5 text-xs font-bold">
                  <UserPlus className="size-3.5 text-primary" />
                  افزودن عضو جدید (نام کامل یا شماره موبایل)
                </Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={addQuery}
                    onChange={(e) => setAddQuery(e.target.value)}
                    placeholder="مثلاً ۰۹۱۲۳۴۵۶۷۸۹ یا نام کاربر"
                    className="h-10 flex-1 rounded-xl"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addMember())}
                  />
                  <Button onClick={addMember} disabled={busy === "add" || !addQuery.trim()} className="h-10 rounded-xl font-bold">
                    {busy === "add" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                    عضو کردن
                  </Button>
                </div>
                <p className="mt-1.5 text-[10px] leading-5 text-muted-foreground">
                  عضو مستقیم بدون نیاز به درخواست عضویت اضافه می‌شود — مناسب انجمن‌های خصوصی و دعوت افراد منتخب.
                </p>
              </div>

              {/* فهرست اعضا */}
              {!data ? null : data.members.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-card p-3.5">
                  {m.avatarUrl ? (
                    <img src={m.avatarUrl} alt={m.name} className="size-11 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <PersonAvatar name={m.name} color={m.avatarColor} size={44} radius="xl" className="shadow-none" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-black">
                      <span className="truncate">{m.name}</span>
                      {m.role === "CHAIR" ? (
                        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400">
                          <Crown className="size-2.5" />
                          رئیس
                        </span>
                      ) : null}
                    </p>
                    {m.headline ? <p className="truncate text-[11px] text-muted-foreground">{m.headline}</p> : null}
                    <p className="mt-0.5 text-[10px] text-muted-foreground/70 tnum">
                      {faNum(m.messageCount)} پیام · عضو از {faRelative(m.joinedAt)}
                    </p>
                  </div>
                  {m.role !== "CHAIR" ? (
                    <div className="flex gap-1.5">
                      <Button
                        onClick={() => memberAction(m, "ban")}
                        disabled={busy === m.id}
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-xl border-amber-500/30 text-xs font-bold text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
                      >
                        <Ban className="size-3.5" />
                        مسدود
                      </Button>
                      <Button
                        onClick={() => memberAction(m, "remove")}
                        disabled={busy === m.id}
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-xl border-rose-500/30 text-xs font-bold text-rose-500 hover:bg-rose-500/10"
                      >
                        <UserMinus className="size-3.5" />
                        حذف
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}

              {/* مسدودشده‌ها */}
              {data && data.banned.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-muted-foreground">اعضای مسدودشده</p>
                  {data.banned.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-3">
                      <PersonAvatar name={m.name} color={m.avatarColor} size={40} radius="xl" className="shadow-none opacity-70" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-foreground/70">{m.name}</p>
                        <p className="text-[10px] text-muted-foreground">مسدودشده</p>
                      </div>
                      <Button
                        onClick={() => memberAction(m, "unban")}
                        disabled={busy === m.id}
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-xl text-xs font-bold"
                      >
                        <RefreshCcw className="size-3.5" />
                        رفع مسدودیت
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* ═══ ایجنت انجمن ═══ */}
          {section === "agent" ? (
            <div className="space-y-4">
              {/* دانش ایجنت */}
              <div className="rounded-2xl border border-border/60 bg-card p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Brain className="size-4.5 text-teal-500" />
                    <div>
                      <h4 className="text-sm font-black">دانش ایجنت</h4>
                      <p className="text-[11px] text-muted-foreground">
                        {knowledge ? `${faNum(knowledge.length)} منبع — ایجنت از این منابع پاسخ می‌دهد` : "…"}
                      </p>
                    </div>
                  </div>
                  <Button onClick={() => openKEitor()} size="sm" className="rounded-xl font-bold">
                    <Plus className="size-4" />
                    منبع جدید
                  </Button>
                </div>

                {!knowledge || knowledge.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-4 text-center text-xs leading-6 text-muted-foreground">
                    هنوز منبع دانشی بارگذاری نشده — درباره انجمن، فعالیت‌ها، قوانین و اطلاعات تخصصی را اینجا اضافه کنید
                    تا ایجنت دقیق و حرفه‌ای پاسخ بدهد.
                  </p>
                ) : (
                  <div className="max-h-72 space-y-2 overflow-y-auto pe-1" style={{ scrollbarWidth: "thin" }}>
                    {knowledge.map((k) => (
                      <div key={k.id} className="group flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 p-3">
                        <FilePlus2 className="mt-0.5 size-4 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-black">{k.title}</p>
                          <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-muted-foreground">{k.content}</p>
                          <p className="mt-1.5 text-[10px] text-muted-foreground/60">
                            {k.createdByName} · {faRelative(k.updatedAt)}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            onClick={() => openKEitor(k)}
                            className="grid size-8 place-items-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95"
                            aria-label="ویرایش منبع"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            onClick={() => deleteKnowledge(k)}
                            className="grid size-8 place-items-center rounded-lg border border-rose-500/30 text-rose-500 transition-colors hover:bg-rose-500/10 active:scale-95"
                            aria-label="حذف منبع"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* تنظیمات ایجنت */}
              <div className="space-y-4 rounded-2xl border border-border/60 bg-card p-4">
                <div className="flex items-center gap-2">
                  <Bot className="size-4.5 text-teal-500" />
                  <h4 className="text-sm font-black">تنظیمات ایجنت</h4>
                </div>

                <label className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 p-3.5">
                  <div>
                    <p className="text-xs font-bold">فعال‌بودن ایجنت انجمن</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">غیرفعال = بدون پاسخ‌گویی در تالار و گفتگوی خصوصی</p>
                  </div>
                  <Switch checked={agentForm.enabled} onCheckedChange={(v) => setAgentForm({ ...agentForm, enabled: v })} />
                </label>

                <div className="space-y-1.5">
                  <Label className="text-xs">نام نمایشی ایجنت (خالی = پیش‌فرض «ایجنت {forum.title}»)</Label>
                  <Input
                    value={agentForm.name}
                    onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })}
                    placeholder={`ایجنت ${forum.title}`}
                    className="rounded-xl"
                    maxLength={60}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">پیام خوش‌آمدگویی (اختیاری)</Label>
                  <Textarea
                    value={agentForm.greeting}
                    onChange={(e) => setAgentForm({ ...agentForm, greeting: e.target.value })}
                    placeholder="مثلاً: سلام! من دستیار انجمن هستم؛ هر سؤالی درباره انجمن و اعضایش دارید بپرسید."
                    className="min-h-16 rounded-xl text-sm"
                    maxLength={400}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">دستورالعمل اختصاصی ایجنت (اختیاری — اولویت بالا)</Label>
                  <Textarea
                    value={agentForm.instructions}
                    onChange={(e) => setAgentForm({ ...agentForm, instructions: e.target.value })}
                    placeholder="مثلاً: همیشه اعضا را به مشارکت در رویدادها دعوت کن؛ از جواب‌های طولانی پرهیز کن؛ لحن رسمی و گرم داشته باش."
                    className="min-h-20 rounded-xl text-sm leading-6"
                    maxLength={2000}
                  />
                </div>

                <Button onClick={saveAgentSettings} disabled={agentSaving} className="w-full rounded-xl font-bold">
                  {agentSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  ذخیره تنظیمات ایجنت
                </Button>
              </div>
            </div>
          ) : null}

          {/* ═══ لیدهای ایجنت انجمن ═══ */}
          {section === "leads" ? (
            <ForumLeadsSection
              forumId={forum.id}
              data={leadsData}
              loading={leadsLoading}
              query={leadQuery}
              onQuery={setLeadQuery}
              onOpenLead={(uid) => setOpenLeadId(uid)}
              onRefresh={loadLeads}
            />
          ) : null}

          {/* ═══ تنظیمات ═══ */}
          {section === "settings" ? (
            <div className="space-y-4 rounded-2xl border border-border/60 bg-card p-4">
              <div className="flex items-center gap-2">
                <Settings2 className="size-4.5 text-primary" />
                <h4 className="text-sm font-black">تنظیمات انجمن</h4>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">درباره انجمن (برای عموم نمایش داده می‌شود)</Label>
                <Textarea
                  value={agentForm.description}
                  onChange={(e) => setAgentForm({ ...agentForm, description: e.target.value })}
                  placeholder="معرفی کوتاه انجمن، اهداف و حوزه فعالیت…"
                  className="min-h-24 rounded-xl text-sm leading-6"
                  maxLength={600}
                />
              </div>
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-[11px] leading-6 text-muted-foreground">
                عنوان، نوع انجمن (عمومی/خصوصی)، وضعیت و رئیس انجمن از پنل مدیریت سامانه تغییر می‌کند؛
                برای تغییرات ساختاری با مدیر سیستم تماس بگیرید.
              </div>
              <Button onClick={saveAgentSettings} disabled={agentSaving} className="w-full rounded-xl font-bold">
                {agentSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                ذخیره توضیحات
              </Button>
            </div>
          ) : null}
        </motion.div>
      )}

      {/* ═══ ویرایشگر منبع دانش ═══ */}
      {kEditorOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true">
          <div className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-border/60 bg-card shadow-2xl sm:rounded-3xl" dir="rtl">
            <div className="flex shrink-0 items-center gap-2 border-b border-border/60 p-4">
              <Brain className="size-4.5 text-teal-500" />
              <h4 className="text-sm font-black">{kEditing ? "ویرایش منبع دانش" : "منبع دانش جدید"}</h4>
            </div>
            <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto p-4">
              <div className="space-y-1.5">
                <Label className="text-xs">عنوان منبع *</Label>
                <Input
                  value={kForm.title}
                  onChange={(e) => setKForm({ ...kForm, title: e.target.value })}
                  placeholder="مثلاً قوانین انجمن و راهنمای عضویت"
                  className="rounded-xl"
                  maxLength={120}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">متن منبع *</Label>
                <Textarea
                  value={kForm.content}
                  onChange={(e) => setKForm({ ...kForm, content: e.target.value })}
                  placeholder="اطلاعاتی که ایجنت باید بداند: درباره انجمن، فعالیت‌ها، رویدادهای ثابت، قوانین، اطلاعات تخصصی حوزه انجمن…"
                  className="min-h-40 rounded-xl text-sm leading-7"
                  maxLength={20000}
                />
                <p className="text-[10px] text-muted-foreground">
                  ایجنت انجمن بر اساس این منابع پاسخ می‌دهد — هرچه دقیق‌تر بنویسید، پاسخ‌ها حرفه‌ای‌تر خواهند بود.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2 border-t border-border/60 p-4">
              <Button onClick={saveKnowledge} disabled={kSaving} className="flex-1 rounded-xl font-bold">
                {kSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                {kEditing ? "ذخیره تغییرات" : "افزودن منبع"}
              </Button>
              <Button onClick={() => setKEditorOpen(false)} variant="outline" className="rounded-xl">
                انصراف
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ═══ دیالوگ جزئیات لید انجمن ═══ */}
      <LeadDetailDialog
        open={!!openLeadId}
        onClose={() => setOpenLeadId(null)}
        scope="forum"
        forumId={forum.id}
        userId={openLeadId}
        onUpdated={loadLeads}
        onDeleted={loadLeads}
      />
    </div>
  );
}

// ═══ بخش لیدهای ایجنت انجمن — آمار + فیلتر + کارت‌های لید ═══

function ForumLeadsSection({
  forumId: _forumId,
  data,
  loading,
  query,
  onQuery,
  onOpenLead,
  onRefresh,
}: {
  forumId: string;
  data: { leads: LeadSummaryDTO[]; stats: LeadStatsDTO } | null;
  loading: boolean;
  query: string;
  onQuery: (q: string) => void;
  onOpenLead: (userId: string) => void;
  onRefresh: () => void;
}) {
  void _forumId;
  const filtered = (data?.leads || []).filter((l) => {
    const q = query.trim();
    return !q || `${l.user.name} ${l.user.headline || ""}`.includes(q);
  });

  if (loading) {
    return (
      <div className="space-y-3 rounded-3xl border border-border/60 bg-card p-4">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-3xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* هدر معرفی + آمار */}
      <div className="relative overflow-hidden rounded-3xl border border-teal-500/25 bg-gradient-to-l from-teal-500/10 to-transparent p-4 sm:p-5">
        <div aria-hidden className="absolute -top-12 start-10 size-32 rounded-full bg-teal-500/10 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/25">
              <Magnet className="size-6" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black sm:text-base">لیدهای ایجنت انجمن</h3>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground sm:text-xs">
                هر کسی که با ایجنت انجمن گفتگو کند (عضو یا مهمان)، اینجا ثبت می‌شود — پروفایل و گفتگوی
                کاملش را ببینید و پیگیری کنید.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onRefresh} className="rounded-xl font-bold">
            <RefreshCcw className="size-3.5" />
            به‌روزرسانی
          </Button>
        </div>
      </div>

      {data ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { label: "کل لیدها", value: data.stats.total, icon: Users, cls: "from-sky-500 to-blue-600" },
            { label: "جدید", value: data.stats.NEW, icon: Sparkles, cls: "from-sky-400 to-cyan-500" },
            { label: "مهمان (غیرعضو)", value: data.stats.guests, icon: User, cls: "from-violet-500 to-purple-600" },
            { label: "تبدیل‌شده", value: data.stats.CONVERTED, icon: CheckCircle2, cls: "from-emerald-500 to-green-600" },
          ].map((s) => (
            <div key={s.label} className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-3.5">
              <div aria-hidden className={`absolute -top-6 -end-6 size-16 rounded-full bg-gradient-to-br ${s.cls} opacity-10`} />
              <s.icon className={`size-4.5 rounded-lg bg-gradient-to-br ${s.cls} p-1 text-white`} />
              <p className="mt-2 text-xl font-black leading-7 tnum">{faNum(String(s.value))}</p>
              <p className="text-[10px] font-bold text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* جستجو */}
      <div className="relative">
        <Search className="absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="جستجوی لید…"
          className="h-11 rounded-2xl border-border/70 bg-accent/40 pe-4 ps-10 text-sm focus-visible:border-primary/50 sm:h-10"
        />
      </div>

      {/* فهرست */}
      {filtered.length === 0 ? (
        data && data.leads.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border/60 bg-card p-10 text-center">
            <div className="flex size-16 items-center justify-center rounded-3xl bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-300">
              <Bot className="size-8" />
            </div>
            <p className="font-black">هنوز لیدی برای ایجنت انجمن ثبت نشده</p>
            <p className="max-w-sm text-xs leading-6 text-muted-foreground">
              هر کسی (عضو یا مهمانِ انجمن عمومی) با ایجنت انجمن گفتگو کند، خودکار اینجا ثبت می‌شود؛
              پروفایل و کل گفتگوی او قابل مشاهده و پیگیری است.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2.5 rounded-3xl border border-dashed border-border/60 bg-card p-8 text-center">
            <Search className="size-8 text-muted-foreground/40" />
            <p className="text-sm font-bold">لیدی پیدا نشد</p>
            <p className="text-xs text-muted-foreground">جستجو را تغییر دهید.</p>
          </div>
        )
      ) : (
        <div className="space-y-2.5">
          {filtered.map((lead, i) => {
            const meta = LEAD_STATUS_META[lead.status];
            const StatusIcon = meta.icon;
            return (
              <motion.button
                key={lead.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.3) }}
                onClick={() => onOpenLead(lead.user.userId)}
                className="group flex w-full items-center gap-3.5 rounded-3xl border border-border/60 bg-card p-3.5 text-right shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md active:scale-[0.99] sm:p-4"
              >
                <span className={`h-12 w-1 shrink-0 rounded-full ${meta.dot} opacity-70`} aria-hidden />
                <div className="relative shrink-0">
                  <PersonAvatar
                    name={lead.user.name}
                    avatarUrl={lead.user.avatarUrl}
                    color={lead.user.avatarColor}
                    size={48}
                    className="ring-2 ring-border/40"
                  />
                  <span className={`absolute -bottom-0.5 -end-0.5 grid size-5 place-items-center rounded-lg border-2 border-card text-white ${meta.solid}`}>
                    <StatusIcon className="size-2.5" />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-black leading-6" dir="auto">
                      {lead.user.name}
                    </p>
                    <span className="shrink-0 text-[10px] text-muted-foreground tnum">{faRelative(lead.lastMessageAt)}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    {lead.user.headline ? (
                      <p className="truncate text-[11px] font-bold text-primary/80" dir="auto">
                        {lead.user.headline}
                      </p>
                    ) : null}
                    {lead.user.memberRole ? <ForumRoleBadge role={lead.user.memberRole} /> : null}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-[11px] leading-5 text-muted-foreground" dir="auto">
                      {lead.wasReset ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <RotateCcw className="size-3" />
                          گفتگو بازنشانی شده
                        </span>
                      ) : (
                        lead.lastMessagePreview || "—"
                      )}
                    </p>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold text-muted-foreground tnum">
                      <MessageSquareText className="size-2.5" />
                      {faNum(String(lead.messageCount))} پیام
                    </span>
                  </div>
                </div>
                <LeadStatusBadge status={lead.status} size="xs" />
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}
