// ═══ بخش شهریار — شبکه اجتماعی حرفه‌ای (لینکدین هوشمند رفسنجان) ═════
// دایرکتوری افراد + فید پست‌ها + گفتگوها (DM/ایجنت) + پروفایل عمومی
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  BadgeCheck, Bot, ChevronLeft, Clock, Crown, MessageCircle, Newspaper, Search, Sparkles, TrendingUp, UserPlus, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { get, post } from "@/lib/client/api";
import { faNum, faRelative } from "@/lib/client/persian";
import { useAppStore } from "@/lib/client/store";
import type { ConversationSummary, PersonCardData } from "@/lib/modules/social/types";
import { AgentBadge, CityChip, MiniBanner, PersonAvatar, SuggestionCard, SkillChip, StatRow } from "./social-ui";
import ChatPanel from "./ChatPanel";
import FeedView from "./feed/FeedView";

type DirectoryData = {
  people: PersonCardData[];
  suggestions: PersonCardData[];
  stats: { total: number; withAgent: number };
};

const SORTS = [
  { key: "relevant", label: "مرتبط‌ترین", icon: Sparkles },
  { key: "new", label: "تازه‌ترین", icon: Clock },
  { key: "popular", label: "محبوب‌ترین", icon: TrendingUp },
];

type SocialTab = "people" | "feed" | "chats";

export default function SocialView() {
  const { user, setView, openUserProfile } = useAppStore();
  const [tab, setTab] = useState<SocialTab>("feed");
  const [directory, setDirectory] = useState<DirectoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("relevant");

  // گفتگوها
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [chatsLoading, setChatsLoading] = useState(false);

  // پنل چت فعال
  const [activeChat, setActiveChat] = useState<string | null>(null);

  // جستجوی debounce شده
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadDirectory = useCallback(async (query: string, sortKey: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (sortKey !== "relevant") params.set("sort", sortKey);
    const res = await get<DirectoryData>(`/api/social/directory?${params.toString()}`);
    if (res.success && res.data) setDirectory(res.data);
    else if (res.error) toast({ title: "خطا", description: res.error, variant: "destructive" });
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- بارگذاری اولیه دایرکتوری در mount (الگوی متعارف پروژه)
    loadDirectory("", "relevant");
  }, [loadDirectory]);

  // ─── بازکردن گفتگوی در انتظار (آزمایش ایجنت از تب «ایجنت من») ───
  useEffect(() => {
    const pending = sessionStorage.getItem("social:openChat");
    if (pending) {
      sessionStorage.removeItem("social:openChat");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- بازیابی گفتگوی در انتظار در mount
      setActiveChat(pending);
    }
  }, []);

  const loadChats = useCallback(async () => {
    setChatsLoading(true);
    const res = await get<{ conversations: ConversationSummary[] }>("/api/social/conversations");
    if (res.success && res.data) setConversations(res.data.conversations);
    setChatsLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- لود تنبل فهرست گفتگوها با اولین ورود به تب
    if (tab === "chats" && conversations === null) loadChats();
  }, [tab, conversations, loadChats]);

  // بازکردن چت (dm یا agent) — گفتگو را find-or-create می‌کنیم
  const openChat = async (type: "dm" | "agent", userId: string) => {
    const res = await post<{ conversationId: string; type: string }>("/api/social/conversations", { type, userId });
    if (res.success && res.data) {
      setConversations(null); // فهرست دوباره خوانده شود
      setActiveChat(res.data.conversationId);
      setTab("chats");
    } else {
      toast({ title: "شروع گفتگو نشد", description: res.error, variant: "destructive" });
    }
  };

  // ─── نمای چت فعال — تمام‌صفحه (full-bleed)، کل ناحیه اصلی ───
  if (activeChat) {
    return (
      // موبایل: دقیقاً تا لبه‌ی ناوبری پایین (۶۰px + safe-area) — بدون نوار مرده؛ دسکتاپ: کل ناحیه محتوا
      <div className="-mb-24 h-[calc(100dvh-3.5rem-3.75rem-env(safe-area-inset-bottom))] lg:mb-0 lg:h-[calc(100dvh-2rem)]" dir="rtl">
        <ChatPanel
          conversationId={activeChat}
          onBack={() => {
            setActiveChat(null);
            setConversations(null);
            if (tab === "chats") loadChats();
          }}
        />
      </div>
    );
  }

  const hasAnyProfile = directory !== null && (directory.people.length > 0 || directory.suggestions.length > 0);

  return (
    // p-4 موبایل + max-w-6xl دسکتاپ — هم‌تراز با بخش اصناف؛ گرید حرفه‌ای lg:3 ستونه
    <div className="mx-auto max-w-6xl space-y-5 p-4 lg:p-0" dir="rtl">
      {/* ═══ هدر بخش ═══ */}
      <div className="relative overflow-hidden rounded-3xl shahryar-gradient p-4 text-white shadow-lg sm:p-6">
        <div aria-hidden className="pattern-dots absolute inset-0 opacity-25" />
        <div aria-hidden className="absolute -start-16 -top-16 size-48 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden className="absolute -end-12 -bottom-20 size-44 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col gap-3.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
          {/* عنوان + دکمهٔ فشردهٔ موبایل در همین ردیف */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/25 bg-white/15 shadow-lg backdrop-blur-md sm:size-12 md:size-14">
              <Users className="size-5 sm:size-6 md:size-7" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-black sm:text-lg md:text-2xl">شبکه‌ی شهریار</h2>
              <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-white/85 sm:mt-1.5 sm:text-sm sm:leading-6">
                فضای حرفه‌ای معرفی استعدادهای رفسنجان — پست بگذار، پروفایل بساز، ایجنتت را آموزش بده
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => setView("profile")}
              className="h-9 shrink-0 rounded-xl border-0 bg-white/90 px-3 text-xs font-bold text-primary hover:bg-white sm:hidden"
            >
              <UserPlus className="size-4" />
              پروفایل من
            </Button>
          </div>

          {/* دکمه — دسکتاپ */}
          <div className="flex items-center gap-4 max-sm:hidden">
            <Button
              variant="secondary"
              onClick={() => setView("profile")}
              className="rounded-xl border-0 bg-white/90 font-bold text-primary hover:bg-white"
            >
              <UserPlus className="size-4" />
              پروفایل من
            </Button>
          </div>
        </div>
      </div>

      {/* ═══ تب‌ها — سگمنت یکپارچه با پیل گرادیانی برند ═══ */}
      <div className="flex gap-1 rounded-2xl border border-border/60 bg-card/70 p-1">
        {([
          { id: "people", label: "افراد", icon: Users },
          { id: "feed", label: "فید", icon: Newspaper },
          { id: "chats", label: "گفتگوها", icon: MessageCircle },
        ] as const).map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              role="tab"
              aria-selected={active}
              className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-colors active:scale-95 ${
                active ? "text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="social-tab-pill"
                  className="absolute inset-0 rounded-xl shahryar-gradient shadow-md"
                  transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                />
              )}
              <t.icon className="relative z-10 size-4" />
              <span className="relative z-10">{t.label}</span>
            </button>
          );
        })}
      </div>

      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="mt-4 space-y-5"
      >
        {tab === "people" ? (
          <>
          {/* جستجو + مرتب‌سازی — استایل یکپارچه با زبان فیلترهای اپ */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  if (debounceRef.current) clearTimeout(debounceRef.current);
                  debounceRef.current = setTimeout(() => loadDirectory(e.target.value, sort), 350);
                }}
                placeholder="جستجو در نام، مهارت، علاقه… مثلاً «برنامه‌نویس» یا «طراح»"
                className="h-10 rounded-xl border-border/70 bg-accent/40 pe-4 ps-10 focus-visible:border-primary/50"
              />
            </div>
            {/* مرتب‌سازی: موبایل ۳ دکمهٔ هم‌عرض تمام-ردیف / دسکتاپ کنار جستجو — فعال = گرادیان برند */}
            <div className="grid grid-cols-3 gap-1.5 sm:flex">
              {SORTS.map((s) => {
                const active = sort === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => {
                      setSort(s.key);
                      loadDirectory(q, s.key);
                    }}
                    className={`flex h-10 items-center justify-center gap-1 rounded-xl border px-3 text-xs font-bold transition-all active:scale-95 ${
                      active
                        ? "border-transparent shahryar-gradient text-white shadow-md"
                        : "border-border/60 bg-card text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    <s.icon className="size-3.5 shrink-0" />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* پیشنهادها */}
          {directory && directory.suggestions.length > 0 && !q ? (
            <section>
              <SectionTitle icon={Sparkles} title="افرادی که ممکن است بشناسید" />
              <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2" style={{ scrollbarWidth: "thin" }}>
                {directory.suggestions.map((p) => (
                  <SuggestionCard key={p.userId} person={p} onClick={() => openUserProfile(p.userId)} />
                ))}
              </div>
            </section>
          ) : null}

          {/* کارت‌های افراد — گرید واکنش‌گرا: موبایل ۱ / sm ۲ / lg ۳ ستون (هم‌تراز اصناف) */}
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="overflow-hidden rounded-2xl border border-border/60 bg-card">
                  <Skeleton className="h-16 rounded-none" />
                  <div className="relative z-10 space-y-3 px-4 pb-4">
                    <div className="-mt-7"><Skeleton className="size-14 rounded-2xl ring-4 ring-card" /></div>
                    <Skeleton className="h-5 w-36 rounded-lg" />
                    <Skeleton className="h-4 w-52 rounded-lg" />
                    <div className="flex gap-2"><Skeleton className="h-6 w-16 rounded-full" /><Skeleton className="h-6 w-20 rounded-full" /></div>
                  </div>
                </div>
              ))}
            </div>
          ) : directory && directory.people.length === 0 ? (
            <EmptyPeople hasAny={hasAnyProfile} onBuildProfile={() => setView("profile")} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {directory?.people.map((p, i) => (
                <PersonCard
                  key={p.userId}
                  person={p}
                  index={i}
                  onOpen={() => openUserProfile(p.userId)}
                  onChat={(t) => openChat(t, p.userId)}
                />
              ))}
            </div>
          )}
          </>
        ) : tab === "feed" ? (
          <FeedView
            showComposer
            onOpenProfile={(uid) => openUserProfile(uid)}
            onOpenChat={openChat}
          />
        ) : (
          <>
          {/* ═══ تب گفتگوها ═══ */}
          {chatsLoading || conversations === null ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4">
                  <Skeleton className="size-12 rounded-2xl" />
                  <div className="flex-1 space-y-2"><Skeleton className="h-4 w-32 rounded-lg" /><Skeleton className="h-3.5 w-48 rounded-lg" /></div>
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border/60 bg-card p-10 text-center">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
                <MessageCircle className="size-8 text-muted-foreground" />
              </div>
              <p className="font-black">هنوز گفتگویی نداری</p>
              <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                از تب «افراد» پروفایل کاربران را باز کن و با آن‌ها یا با ایجنتشان گفتگو را شروع کن.
              </p>
              <Button onClick={() => setTab("people")} className="shahryar-gradient rounded-xl border-0 font-bold">
                <Users className="size-4" />
                دیدن افراد
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveChat(c.id)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-card p-3.5 text-right shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
                >
                  {c.type === "agent" ? (
                    <div className="relative shrink-0">
                      <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md">
                        <Bot className="size-5" />
                      </div>
                      <span className="absolute -bottom-1 -end-1">
                        <PersonAvatar name={c.otherUserName} avatarUrl={c.otherUserAvatar} color={c.otherUserAvatarColor} size={18} radius="lg" className="shadow-none ring-2 ring-card" />
                      </span>
                    </div>
                  ) : (
                    <PersonAvatar name={c.otherUserName} avatarUrl={c.otherUserAvatar} color={c.otherUserAvatarColor} size={48} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-black text-sm">
                        {c.type === "agent" ? `ایجنتِ ${c.otherUserName.split(" ")[0]}` : c.otherUserName}
                        {c.myRole === "agent-owner" ? (
                          <span className="ms-1.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                            با ایجنت شما
                          </span>
                        ) : null}
                      </p>
                      <span className="shrink-0 text-[10px] text-muted-foreground tnum">{faRelative(c.lastMessageAt)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.lastMessage}</p>
                  </div>
                  <ChevronLeft className="size-4 shrink-0 self-center text-muted-foreground/50" aria-hidden />
                </button>
              ))}
            </div>
          )}
          </>
        )}
      </motion.div>
    </div>
  );
}

/** کارت حرفه‌ای فرد در دایرکتوری — ساختار با ارتفاع‌های یکنواخت و راستچین کامل
 *  ⚠️ بدنه‌ی کارت relative z-10 دارد تا آواتارِ روی بنر، روی گرادیان بنشیند (باگ قبلی: زیر گرادیان می‌رفت) */
function PersonCard({
  person,
  index,
  onOpen,
  onChat,
}: {
  person: PersonCardData;
  index: number;
  onOpen: () => void;
  onChat: (type: "dm" | "agent") => void;
}) {
  return (
    <article
      className="group flex animate-in fade-in-0 slide-in-from-bottom-3 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl active:scale-[0.99]"
      style={{ animationDelay: `${Math.min(index * 60, 400)}ms` }}
    >
      <button onClick={onOpen} className="flex min-h-0 w-full flex-1 flex-col text-right" title={`پروفایل ${person.name}`}>
        {/* بنر هویتی — نشان ایجنت شیشه‌ای برای خوانایی روی گرادیان تیره */}
        <MiniBanner theme={person.bannerTheme} url={person.bannerUrl} className="h-16 shrink-0">
          {person.hasAgent ? (
            // end (چپ در RTL): دور از آواتاری که سمتِ start (راست) روی بنر نشسته — فاصله‌گیری بصری
            <span className="absolute end-2.5 top-2.5"><AgentBadge compact glass /></span>
          ) : null}
        </MiniBanner>

        {/* بدنه — relative z-10: ترتیب رندر بالای بنر (رفع باگ پنهان‌شدن نیمی از تصویر پروفایل) */}
        <div className="relative z-10 flex flex-1 flex-col px-4 pb-3">
          <div className="-mt-7 mb-2 flex items-end justify-between gap-2">
            <PersonAvatar
              name={person.name}
              avatarUrl={person.avatarUrl}
              color={person.avatarColor}
              size={56}
              className="shrink-0 ring-4 ring-card"
            />
            {/* «مشاهده پروفایل ←» فقط دسکتاپ (hover) — در موبایل فوتر دکمهٔ اختصاصی دارد */}
            <span className="hidden pb-1 text-[10px] font-bold text-primary opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:block">
              مشاهده پروفایل ←
            </span>
          </div>

          {/* نام — تک‌خطی برای تراز یکنواخت همه‌ی کارت‌ها؛ نام کامل با title و در پروفایل */}
          <h3 className="line-clamp-1 flex items-center gap-1 text-right text-[15px] font-black leading-6" dir="auto" title={person.name}>
            <span className="truncate">{person.name}</span>
            {person.isVerified && <BadgeCheck className="size-4 shrink-0 fill-primary text-white" aria-label="تأییدشده" />}
          </h3>
          {/* عنوان شغلی — ارتفاع ثابت برای تراز شدن کارت‌ها کنار هم */}
          <p className="mt-0.5 line-clamp-1 min-h-4 text-right text-xs font-bold text-primary" dir="auto">
            {person.headline || ""}
          </p>

          {/* شهر + آمار — wrap شونده تا در کارت‌های باریک سرریز نکند */}
          <div className="mt-2 flex min-h-4 flex-wrap items-center gap-x-3 gap-y-0.5">
            <CityChip city={person.city} />
            <StatRow views={person.viewCount} endorsements={person.endorsementCount} />
          </div>

          {/* مهارت‌ها — چسبان به پایین بدنه تا فوتر همه‌ی کارت‌ها هم‌تراز بماند */}
          {person.skills.length > 0 ? (
            <div className="mt-auto flex min-h-7 flex-wrap content-start gap-1.5 pt-3">
              {person.skills.slice(0, 3).map((s) => (
                <SkillChip key={s.name} name={s.name} level={s.level} />
              ))}
              {person.skills.length > 3 ? (
                <span className="tnum self-center text-[10px] font-bold text-muted-foreground">
                  +{faNum(person.skills.length - 3)}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="mt-auto min-h-7 pt-3" aria-hidden />
          )}
        </div>
      </button>
      {/* نوار اقدام — همیشه به پایین کارت چسبان است (تراز یکنواخت در گرید)؛ موبایل: دکمه‌های ۴۴px لمسی */}
      <div className="flex shrink-0 gap-2 border-t border-border/60 bg-muted/30 p-2.5 sm:p-2">
        <Button onClick={onOpen} variant="outline" size="sm" className="h-11 flex-1 rounded-lg text-xs font-bold sm:h-8">
          <Users className="size-3.5" />
          پروفایل
        </Button>
        <Button onClick={() => onChat("dm")} variant="outline" size="sm" className="h-11 flex-1 rounded-lg text-xs font-bold sm:h-8">
          <MessageCircle className="size-3.5" />
          گفتگو
        </Button>
        <Button
          onClick={() => onChat("agent")}
          size="sm"
          className="h-11 flex-1 rounded-lg border-0 bg-gradient-to-l from-violet-600 to-purple-600 text-xs font-bold text-white hover:from-violet-700 hover:to-purple-700 sm:h-8"
        >
          <Bot className="size-3.5" />
          ایجنت
        </Button>
      </div>
    </article>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: typeof Sparkles; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
      <h3 className="text-sm font-black">{title}</h3>
      <div aria-hidden className="h-px flex-1 bg-gradient-to-l from-border to-transparent" />
    </div>
  );
}

/** حالت خالی — هنوز کسی پروفایل نساخته */
function EmptyPeople({ hasAny, onBuildProfile }: { hasAny: boolean; onBuildProfile: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border/60 bg-card p-10 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
        <Users className="size-8 text-muted-foreground" />
      </div>
      {hasAny ? (
        <>
          <p className="font-black">چیزی پیدا نشد</p>
          <p className="max-w-sm text-sm leading-6 text-muted-foreground">
            عبارت دیگری را جستجو کن یا مرتب‌سازی را عوض کن.
          </p>
        </>
      ) : (
        <>
          <p className="font-black">دایرکتوری در حال روشن‌شدن است ✨</p>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            هنوز همکار حرفه‌ای‌ای با این مشخصات نیست. اولین باشید! پروفایل حرفه‌ای‌تان را بسازید،
            مهارت‌ها را ثبت کنید و ایجنت شخصی‌تان را با دانش اختصاصی پرورش دهید.
          </p>
          <Button onClick={onBuildProfile} className="shahryar-gradient rounded-xl border-0 font-bold">
            <Crown className="size-4" />
            ساخت پروفایل من
          </Button>
        </>
      )}
    </div>
  );
}
