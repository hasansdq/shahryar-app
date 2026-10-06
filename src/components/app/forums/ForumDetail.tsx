// ═══ جزئیات انجمن — پوسته تب‌دار + درباره/عضویت ═══
// تب‌ها: تالار گفتمان | ایجنت انجمن | تقویم رویدادها | اعضا | نشریه (+ مدیریت برای رئیس)
// دسترسی هر تب از سرور (canView) می‌آید — انجمن خصوصیِ غیرعضو اصلاً اینجا نمی‌رسد
// مهمان (غیرعضو انجمن عمومی): تب ایجنت برایش باز است تا اهداف و فعالیت‌های
// انجمن را پرزنت بگیرد؛ تب پیش‌فرض او هم همین تب است (تجربه معرفی‌محور)
"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight, Bot, CalendarDays, Crown, Globe2, Lock, MessagesSquare,
  Newspaper, Send, Settings2, ShieldCheck, UserPlus, Users, Clock, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { get, post } from "@/lib/client/api";
import { faNum } from "@/lib/client/persian";
import { PersonAvatar } from "../social/social-ui";
import type { ForumDetailData } from "@/lib/modules/forums/types";
import ForumChat from "./ForumChat";
import ForumAgentChat from "./ForumAgentChat";
import ForumEvents from "./ForumEvents";
import ForumMembers from "./ForumMembers";
import ForumArticles from "./ForumArticles";
import ForumManage from "./ForumManage";

type Tab = "chat" | "agent" | "events" | "members" | "articles" | "manage";

export default function ForumDetail({ forumId, onBack }: { forumId: string; onBack: () => void }) {
  const [forum, setForum] = useState<ForumDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("chat");
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinNote, setJoinNote] = useState("");
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    const res = await get<{ forum: ForumDetailData }>(`/api/forums/${forumId}`);
    if (res.success && res.data) {
      setForum(res.data.forum);
      setError(null);
    } else {
      setError(res.error || "انجمن یافت نشد");
    }
    setLoading(false);
  }, [forumId]);

  useEffect(() => {
    // یک مسیر fetch واحد (load) با فراخوانی غیرسنکرون — loading اولیه true
    // است و کامپوننت با key=forumId از والد mount می‌شود (سازگار با React Compiler)
    void (async () => {
      await load();
    })();
  }, [load]);

  const requestJoin = async () => {
    if (joining) return;
    setJoining(true);
    const res = await post<{ message: string }>(`/api/forums/${forumId}/join`, { note: joinNote });
    setJoining(false);
    if (res.success) {
      toast({ title: "درخواست ثبت شد", description: res.data?.message });
      setJoinOpen(false);
      setJoinNote("");
      load();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4 lg:p-0" dir="rtl">
        <Skeleton className="h-28 rounded-3xl" />
        <Skeleton className="h-12 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (error || !forum) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center gap-3 p-10 text-center" dir="rtl">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
          <ShieldCheck className="size-8 text-muted-foreground" />
        </div>
        <p className="font-bold">{error || "انجمن یافت نشد"}</p>
        <Button variant="outline" onClick={onBack}>
          <ArrowRight className="size-4" />
          بازگشت به انجمن‌ها
        </Button>
      </div>
    );
  }

  // تب پیش‌فرض بر اساس دسترسی:
  //  • عضو → تالار گفتمان
  //  • مهمان (غیرعضو انجمن عمومی) → ایجنت انجمن (تجربه پرزنت) و در نبود آن نشریه/رویدادها
  const tabs: Array<{ id: Tab; label: string; icon: typeof MessagesSquare; visible: boolean; badge?: number }> = [
    { id: "chat", label: "تالار گفتمان", icon: MessagesSquare, visible: forum.canView.chat },
    { id: "agent", label: "ایجنت انجمن", icon: Bot, visible: forum.canView.agent },
    { id: "events", label: "رویدادها", icon: CalendarDays, visible: forum.canView.events },
    { id: "members", label: "اعضا", icon: Users, visible: forum.canView.members },
    { id: "articles", label: "نشریه", icon: Newspaper, visible: forum.canView.articles },
    { id: "manage", label: "مدیریت", icon: Settings2, visible: forum.isChair, badge: forum.pendingCount },
  ];
  const visibleTabs = tabs.filter((t) => t.visible);

  // زنجیره اولویت تب پیش‌فرض — اولین تبِ قابل‌مشاهده بر اساس نقش کاربر
  const defaultTab: Tab = forum.canView.chat
    ? "chat"
    : forum.canView.agent
      ? "agent"
      : forum.canView.articles
        ? "articles"
        : forum.canView.events
          ? "events"
          : visibleTabs[0]?.id ?? "chat";

  // اگر تب فعلی قابل مشاهده نیست (مثلاً مهمان روی تالار گفتمان)، به تب پیش‌فرض برمی‌گردد
  const effectiveTab: Tab = visibleTabs.some((t) => t.id === tab) ? tab : defaultTab;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 lg:p-0" dir="rtl">
      {/* ═══ هدر انجمن ═══ */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm">
        <div className="relative h-28 overflow-hidden bg-gradient-to-br from-teal-500/30 via-sky-500/20 to-primary/25 sm:h-32">
          {forum.coverImage ? (
            <img src={forum.coverImage} alt={`کاور ${forum.title}`} className="size-full object-cover" />
          ) : (
            <div aria-hidden className="pattern-dots absolute inset-0 opacity-30" />
          )}
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
          <button
            onClick={onBack}
            className="absolute start-3 top-3 z-10 flex h-10 items-center gap-1.5 rounded-xl border border-white/25 bg-black/25 px-3 text-xs font-bold text-white backdrop-blur-md transition-colors hover:bg-black/40 active:scale-95"
          >
            <ArrowRight className="size-4" />
            انجمن‌ها
          </button>
          <span
            className={`absolute end-3 top-3 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold backdrop-blur-md ${
              forum.type === "PUBLIC"
                ? "border-emerald-400/40 bg-emerald-500/25 text-emerald-50"
                : "border-slate-400/40 bg-slate-800/50 text-slate-100"
            }`}
          >
            {forum.type === "PUBLIC" ? <Globe2 className="size-3" /> : <Lock className="size-3" />}
            {forum.type === "PUBLIC" ? "انجمن عمومی" : "انجمن خصوصی"}
          </span>
        </div>

        <div className="relative -mt-8 px-4 pb-4 sm:-mt-9 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-end gap-3">
              <div className="grid size-14 shrink-0 place-items-center rounded-2xl border border-border/60 bg-card text-primary shadow-md sm:size-16">
                <MessagesSquare className="size-6 sm:size-7" />
              </div>
              <div className="min-w-0 pb-1">
                <h2 className="text-lg font-black leading-7 sm:text-xl">{forum.title}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <PersonAvatar name={forum.chair.name} avatarUrl={forum.chair.avatarUrl} color={forum.chair.avatarColor} size={20} radius="md" className="shadow-none" />
                    <Crown className="size-3 text-amber-500" />
                    رئیس: <span className="font-bold text-foreground/80">{forum.chair.name}</span>
                  </span>
                  <span className="tnum inline-flex items-center gap-1">
                    <Users className="size-3.5" />
                    {faNum(forum.memberCount)} عضو فعال
                  </span>
                  {forum.agent.enabled ? (
                    <span className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400">
                      <Bot className="size-3.5" />
                      {forum.agent.name}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {/* اقدام عضویت */}
            {!forum.isMember ? (
              forum.myRelation === "pending" ? (
                <span className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-[11px] font-bold text-sky-600 dark:text-sky-400">
                  <Clock className="size-3.5" />
                  درخواست شما در انتظار تایید رئیس انجمن است
                </span>
              ) : forum.myRelation === "rejected" || forum.myRelation === "banned" ? (
                <span className="mb-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                  دسترسی عضویت شما در این انجمن فعال نیست
                </span>
              ) : forum.type === "PUBLIC" ? (
                joinOpen ? (
                  <div className="mb-1 w-full max-w-sm space-y-2">
                    <Textarea
                      value={joinNote}
                      onChange={(e) => setJoinNote(e.target.value)}
                      placeholder="پیام شما برای رئیس انجمن (اختیاری) — مثلاً سابقه و انگیزه عضویت"
                      className="min-h-16 rounded-xl text-sm"
                      maxLength={300}
                    />
                    <div className="flex gap-2">
                      <Button onClick={requestJoin} disabled={joining} size="sm" className="rounded-lg text-xs font-bold">
                        {joining ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                        ارسال درخواست
                      </Button>
                      <Button onClick={() => setJoinOpen(false)} variant="outline" size="sm" className="rounded-lg text-xs">
                        انصراف
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button onClick={() => setJoinOpen(true)} size="sm" className="mb-1 rounded-xl font-bold">
                    <UserPlus className="size-4" />
                    درخواست عضویت
                  </Button>
                )
              ) : null
            ) : forum.isChair ? (
              <span className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                <Crown className="size-3.5" />
                شما رئیس این انجمن هستید
              </span>
            ) : null}
          </div>

          {forum.description ? (
            <p className="mt-3 rounded-2xl bg-muted/40 p-3 text-xs leading-6 text-muted-foreground">
              {forum.description}
            </p>
          ) : null}
        </div>
      </div>

      {/* ═══ نوار راهنمای مهمان (غیرعضوِ انجمن عمومی) ═══ */}
      {!forum.isMember && forum.type === "PUBLIC" ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-3.5 text-[11px] leading-6 text-muted-foreground">
          <ShieldCheck className="size-5 shrink-0 text-amber-500" />
          {forum.canView.agent ? (
            <span>
              شما به‌عنوان مهمان در حال مشاهده این انجمن هستید؛ در تب «ایجنت انجمن» می‌توانید گفتگو کنید تا
              اهداف، فعالیت‌ها و رویدادهای انجمن را برایتان پرزنت کند. برای مشارکت در تالار گفتمان و دیدن
              اعضا، درخواست عضویت بدهید تا رئیس انجمن تایید کند.
            </span>
          ) : (
            <span>
              شما اطلاعات عمومی این انجمن (نشریه و رویدادها) را می‌بینید؛ برای مشارکت در تالار گفتمان و دیدن
              اعضا، درخواست عضویت بدهید تا رئیس انجمن تایید کند.
            </span>
          )}
        </div>
      ) : null}

      {/* ═══ تب‌ها ═══ */}
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-border/60 bg-card/70 p-1" style={{ scrollbarWidth: "thin" }}>
        {visibleTabs.map((t) => {
          const active = effectiveTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              role="tab"
              aria-selected={active}
              className={`relative flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-colors active:scale-95 sm:text-sm ${
                active ? "text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="forum-tab-pill"
                  className="absolute inset-0 rounded-xl shahryar-gradient shadow-md"
                  transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                />
              )}
              <t.icon className="relative z-10 size-4" />
              <span className="relative z-10">{t.label}</span>
              {t.badge ? (
                <span className="relative z-10 grid min-w-4.5 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white">
                  {faNum(t.badge)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* ═══ محتوای تب ═══ */}
      <motion.div
        key={effectiveTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        {effectiveTab === "chat" ? <ForumChat forum={forum} /> : null}
        {effectiveTab === "agent" ? <ForumAgentChat forum={forum} /> : null}
        {effectiveTab === "events" ? <ForumEvents forum={forum} onChanged={load} /> : null}
        {effectiveTab === "members" ? <ForumMembers forum={forum} /> : null}
        {effectiveTab === "articles" ? <ForumArticles forum={forum} /> : null}
        {effectiveTab === "manage" ? <ForumManage forum={forum} onChanged={load} /> : null}
      </motion.div>
    </div>
  );
}
