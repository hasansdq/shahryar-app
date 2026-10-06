// ═══════════════════════════════════════════════════════════════
// صفحه پروفایل حرفه‌ای کاربر — نسخه بازطراحی‌شده (چندلول ارتقا)
//
// معماری:
//   موبایل  → ستون واحد: نوار بازگشت شناور + کارت هدر + تب‌ها
//   دسکتاپ  → شبکه دوستونه: ستون اصلی (راست) + ستون کناری چسبان (چپ)
//
// هدر: بنر تم + آواتار دایره‌ای هم‌پوشان + نام (موبایل: زیر آواتار،
//       دسکتاپ: کنار آواتار) + نوار آمار نواری + اقدامات + تب پیل لغزنده
// ═══════════════════════════════════════════════════════════════
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight, BadgeCheck, BookOpen, Bot, Briefcase, Building2, CalendarDays,
  ExternalLink, Eye, GraduationCap, Heart, Link2, Loader2, MapPin,
  MessageCircle, Pencil, Send, Share2, Sparkles, ThumbsUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { get, post } from "@/lib/client/api";
import { faNum, faRelative } from "@/lib/client/persian";
import { useAppStore } from "@/lib/client/store";
import { bannerGradient, type PublicProfileData } from "@/lib/modules/social/types";
import { AgentBadge, CityChip, PersonAvatar, SkillChip } from "./social-ui";
import FeedView from "./feed/FeedView";

type TabKey = "posts" | "about" | "agent";

type ProfileData = PublicProfileData & {
  postStats?: { total: number; likes: number };
  hasSocialProfile?: boolean; // false = کاربر هنوز پروفایل شهریار نساخته (نمای حداقلی)
};

/** نمایش‌دهنده اقدامات پروفایل — دو چیدمان: ردیفی (موبایل) و درون‌خطی (دسکتاپ) */
function ActionsRow({
  data,
  onOpenChat,
  onShare,
  variant,
}: {
  data: ProfileData;
  onOpenChat: (type: "dm" | "agent", userId: string) => void;
  onShare: () => void;
  variant: "stacked" | "inline";
}) {
  const stacked = variant === "stacked";
  const h = stacked ? "h-12 sm:h-11" : "h-10";
  const iconBox = stacked ? "size-12 sm:size-11" : "size-10";
  const label = stacked ? "text-[13px]" : "text-xs";

  const shareBtn = (
    <Button
      variant="outline"
      size="icon"
      onClick={onShare}
      aria-label="اشتراک‌گذاری پروفایل"
      className={`${iconBox} shrink-0 rounded-xl`}
    >
      <Share2 className="size-4" />
    </Button>
  );

  if (data.isMe) {
    return (
      <>
        <Button
          onClick={() => useAppStore.getState().setView("profile")}
          className={`${h} flex-1 rounded-xl border-0 ${label} font-bold shahryar-gradient`}
        >
          <Pencil className="size-4" />
          ویرایش پروفایل من
        </Button>
        {shareBtn}
      </>
    );
  }

  return (
    <>
      <Button
        onClick={() => onOpenChat("dm", data.userId)}
        className={`${h} flex-[1.35] rounded-xl border-0 ${label} font-bold shahryar-gradient`}
      >
        <MessageCircle className="size-4" />
        گفتگوی مستقیم
      </Button>
      {data.agentInfo?.enabled !== false ? (
        <Button
          onClick={() => onOpenChat("agent", data.userId)}
          variant="outline"
          className={`${h} flex-1 rounded-xl border-violet-300 ${label} font-bold text-violet-700 hover:bg-violet-50 hover:text-violet-800 dark:border-violet-700/50 dark:text-violet-300 dark:hover:bg-violet-900/30`}
        >
          <Bot className="size-4" />
          گفتگو با ایجنت
        </Button>
      ) : null}
      {shareBtn}
    </>
  );
}

/** سلول آمار — نوار نواری بدون شلوغی */
function StatCell({
  icon: Icon,
  value,
  label,
  bordered,
}: {
  icon: typeof Eye;
  value: number;
  label: string;
  bordered?: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-3 text-center ${
        bordered ? "border-s border-border/60" : ""
      }`}
    >
      <span className="tnum text-[17px] font-black leading-none">{faNum(value)}</span>
      <span className="flex items-center gap-1 whitespace-nowrap text-[10px] font-medium leading-none text-muted-foreground">
        <Icon className="size-3 shrink-0" />
        {label}
      </span>
    </div>
  );
}

export default function UserProfileView({
  userId,
  onOpenChat,
}: {
  userId: string;
  onOpenChat: (type: "dm" | "agent", userId: string) => void;
}) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("posts");
  const [endorsing, setEndorsing] = useState<string | null>(null);

  const loading = data === null && error === null;

  // بارگذاری پروفایل — فقط async داخل effect (remount با key={userId} از والد)
  useEffect(() => {
    let active = true;
    void (async () => {
      const res = await get<ProfileData>(`/api/social/profiles/${userId}`);
      if (!active) return;
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.error || "پروفایل یافت نشد");
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const shareProfile = async () => {
    if (!data) return;
    const text = `${data.name}${data.headline ? ` — ${data.headline}` : ""}\nپروفایل حرفه‌ای در شبکه اجتماعی شهریار 🏛️`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "پروفایل شهریار", text });
      } else {
        await navigator.clipboard.writeText(text);
        toast({ title: "کارت معرفی کپی شد ✨", description: "می‌توانید برای دوستانتان بفرستید" });
      }
    } catch {
      /* لغو */
    }
  };

  const toggleEndorse = async (skill: string) => {
    if (!data || data.isMe || endorsing) return;
    setEndorsing(skill);
    const res = await post<{ endorsed: boolean; skill: string }>("/api/social/endorse", {
      userId: data.userId,
      skill,
    });
    if (res.success && res.data) {
      setData((d) => {
        if (!d) return d;
        const counts = { ...d.skillEndorsements };
        const my = new Set(d.myEndorsements);
        if (res.data!.endorsed) {
          counts[skill] = (counts[skill] || 0) + 1;
          my.add(skill);
        } else {
          counts[skill] = Math.max(0, (counts[skill] || 0) - 1);
          my.delete(skill);
        }
        return {
          ...d,
          skillEndorsements: counts,
          myEndorsements: [...my],
          endorsementCount: d.endorsementCount + (res.data!.endorsed ? 1 : -1),
        };
      });
    } else if (res.error) {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
    setEndorsing(null);
  };

  const openProfile = (uid: string) => {
    // نویسنده دیدگاه/پست دیگر → پروفایل او (استور مسیر و view را هندل می‌کند)
    useAppStore.getState().openUserProfile(uid);
  };

  // عنوان صفحه = نام شخص — الگوی حرفه‌ای (مرورگر/تب) + بازگرداندن هنگام خروج
  useEffect(() => {
    if (!data?.name) return;
    const prev = document.title;
    document.title = `${data.name} — شهریار`;
    return () => {
      document.title = prev;
    };
  }, [data?.name]);

  const TABS: Array<{ id: TabKey; label: string; icon: typeof Briefcase }> = [
    { id: "posts", label: "پست‌ها", icon: Briefcase },
    { id: "about", label: "درباره", icon: BadgeCheck },
    { id: "agent", label: "ایجنت", icon: Bot },
  ];

  return (
    <div className="mx-auto max-w-5xl p-4 pb-8 lg:p-0 lg:pb-6" dir="rtl">
      {/* ─── نوار بازگشت — موبایل: پیل شناور چسبان / دسکتاپ: ردیف ساده ───
          نامِ شخص در نوار بالا نمایش داده می‌شود (جایگاه حرفه‌ای — همیشه دیده می‌شود) */}
      <div className="sticky top-[4.25rem] z-30 mb-4 flex items-center gap-2 rounded-2xl border border-border/60 bg-card/90 px-2 py-1.5 shadow-sm backdrop-blur-lg lg:static lg:mb-4 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:shadow-none lg:backdrop-blur-none">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => useAppStore.getState().closeUserProfile()}
          className="h-10 shrink-0 gap-1.5 rounded-xl px-3.5 text-xs font-bold"
        >
          <ArrowRight className="size-4" />
          بازگشت
        </Button>
        <p className="truncate text-xs font-bold text-muted-foreground" title={data?.name}>
          {data ? (
            <>
              <span className="text-foreground">{data.name}</span>
              <span className="mx-1.5 opacity-40">·</span>پروفایل
            </>
          ) : (
            "پروفایل حرفه‌ای"
          )}
        </p>
      </div>

      {loading ? (
        <ProfileSkeleton />
      ) : error || !data ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border/60 bg-card p-10 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
            <Eye className="size-8 text-muted-foreground" />
          </div>
          <p className="font-bold">{error || "پروفایل یافت نشد"}</p>
          <Button variant="outline" onClick={() => useAppStore.getState().closeUserProfile()} className="rounded-xl">
            بازگشت
          </Button>
        </div>
      ) : (
        <>
          {/* ═══ کارت هدر پروفایل ═══ */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden rounded-[1.6rem] border border-border/60 bg-card shadow-[0_12px_40px_-14px_rgba(2,8,23,0.15)]"
          >
            {/* ─── بنر ─── */}
            <div className="relative h-36 sm:h-44" style={{ background: bannerGradient(data.bannerTheme) }}>
              {data.bannerUrl ? (
                 
                <img src={data.bannerUrl} alt="بنر پروفایل" className="absolute inset-0 size-full object-cover" />
              ) : null}
              <div aria-hidden className="pattern-dots absolute inset-0 opacity-25" />
              <div aria-hidden className="absolute -start-14 -top-14 size-44 rounded-full bg-white/10 blur-2xl" />
              <div aria-hidden className="absolute -end-12 -bottom-16 size-40 rounded-full bg-white/10 blur-2xl" />
              {/* سایه ملایم پایین بنر برای عمق */}
              <div aria-hidden className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/20 to-transparent" />
              {data.hasAgent ? (
                <span className="absolute end-3 top-3">
                  <AgentBadge glass />
                </span>
              ) : null}
            </div>

            {/* ─── هویت ───
                موبایل: آواتار بالا، نام «زیر» آواتار (فضای کامل برای نام‌های طولانی)
                دسکتاپ (sm+): آواتار نیمه روی بنر؛ متنِ نام از لبه‌ی پایین بنر شروع می‌شود
                (pt-14 در برابر -mt-14) — نام هرگز زیر بنر نمی‌رود و کنتراست در هر دو تم پایدار است؛
                اقدامات هم‌تراز خط نام (lg+) */}
            <div className="px-4 pb-4 sm:px-6 sm:pb-5">
              {/* relative: با آواتارِ position-relative، بلوک نام هم باید در لایه‌ی positioned باشد
                  وگرنه نام زیر بنرِ position-relative رنگ می‌رود (ترتیب نقاشی CSS) */}
              <div className="relative -mt-12 flex flex-col sm:-mt-14 sm:flex-row sm:items-start sm:gap-5">
                {/* آواتار دایره‌ای — هم‌پوشان با بنر */}
                <div className="relative shrink-0 animate-in zoom-in-50 fade-in-0 duration-500">
                  {/* اندازه موبایل */}
                  <PersonAvatar
                    name={data.name}
                    avatarUrl={data.avatarUrl}
                    color={data.avatarColor}
                    size={96}
                    radius="full"
                    className="ring-4 ring-card sm:hidden"
                  />
                  {/* اندازه دسکتاپ */}
                  <PersonAvatar
                    name={data.name}
                    avatarUrl={data.avatarUrl}
                    color={data.avatarColor}
                    size={112}
                    radius="full"
                    className="hidden ring-4 ring-card shadow-xl sm:flex"
                  />
                </div>

                {/* نام و شناسه‌ها */}
                <div className="mt-3 min-w-0 flex-1 sm:mt-0 sm:pt-14">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h1 className="text-[22px] font-black leading-9 tracking-tight sm:text-2xl sm:leading-9" dir="auto">
                      {data.name}
                    </h1>
                    {data.isVerified ? (
                      <BadgeCheck
                        className="size-5 shrink-0 fill-primary text-white"
                        aria-label="حساب تأییدشده"
                      />
                    ) : null}
                  </div>
                  {data.headline ? (
                    <p className="mt-0.5 text-[13.5px] font-bold leading-6 text-primary sm:text-[15px]" dir="auto">
                      {data.headline}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
                    <CityChip city={data.city} />
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-3.5" />
                      عضو از {faRelative(data.joinedAt)}
                    </span>
                    {data.isMe ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        پروفایل شما
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* اقدامات — فقط دسکتاپ بزرگ (کنار نام) */}
                <div className="hidden shrink-0 gap-2 lg:flex lg:pt-14">
                  <ActionsRow data={data} onOpenChat={onOpenChat} onShare={() => void shareProfile()} variant="inline" />
                </div>
              </div>

              {/* ─── نوار آمار — نواری با جداکننده ─── */}
              <div className="mt-4 grid grid-cols-4 overflow-hidden rounded-2xl border border-border/60 bg-muted/40">
                <StatCell icon={Briefcase} value={data.postStats?.total ?? 0} label="پست" />
                <StatCell icon={Heart} value={data.postStats?.likes ?? 0} label="پسند فید" bordered />
                <StatCell icon={ThumbsUp} value={data.endorsementCount} label="تأیید مهارت" bordered />
                <StatCell icon={Eye} value={data.viewCount} label="بازدید" bordered />
              </div>

              {/* ─── اقدامات — موبایل و تبلت (تمام‌عرض زیر آمار) ─── */}
              <div className="mt-4 flex items-stretch gap-2 lg:hidden">
                <ActionsRow data={data} onOpenChat={onOpenChat} onShare={() => void shareProfile()} variant="stacked" />
              </div>
            </div>

            {/* ─── تب‌ها ─── */}
            <div role="tablist" aria-label="بخش‌های پروفایل" className="flex gap-1 border-t border-border/60 bg-muted/30 p-1.5">
              {TABS.map((t) => {
                const active = tab === t.id;
                const count = t.id === "posts" ? data.postStats?.total ?? 0 : null;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    role="tab"
                    aria-selected={active}
                    className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-bold transition-colors active:scale-95 ${
                      active ? "text-white" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {active ? (
                      <motion.span
                        layoutId="user-profile-tab"
                        className="absolute inset-0 rounded-xl shahryar-gradient shadow-md"
                        transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                      />
                    ) : null}
                    <t.icon className="relative z-10 size-4" />
                    <span className="relative z-10">{t.label}</span>
                    {count !== null && count > 0 ? (
                      <span
                        className={`tnum relative z-10 rounded-full px-1.5 py-px text-[10px] font-black leading-4 ${
                          active ? "bg-white/25 text-white" : "bg-foreground/10 text-muted-foreground"
                        }`}
                      >
                        {faNum(count)}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </motion.section>

          {/* ═══ ناحیه محتوا — دسکتاپ: دوستونه با ستون کناری چسبان ═══ */}
          <div className="mt-4 lg:mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-5">
            {/* ستون اصلی (راست در RTL) */}
            <div className="min-w-0">
              {tab === "posts" ? (
                <FeedView
                  authorId={data.userId}
                  showComposer={data.isMe}
                  pinnedFirst
                  onOpenProfile={openProfile}
                  onOpenChat={onOpenChat}
                  emptyTitle={data.isMe ? "هنوز پستی ندارید" : `${data.name.split(" ")[0]} هنوز پستی منتشر نکرده`}
                  emptyDesc={
                    data.isMe
                      ? "اولین پست خود را بنویسید — دستاورد، فرصت همکاری یا تجربه حرفه‌ای. پست‌های سنجاق‌شده همیشه بالای پروفایل شما می‌مانند."
                      : "به‌محض انتشار پست، اینجا نمایش داده می‌شود."
                  }
                />
              ) : tab === "about" ? (
                <AboutTab data={data} onEndorse={toggleEndorse} endorsing={endorsing} />
              ) : (
                <AgentTab data={data} onOpenChat={onOpenChat} />
              )}
            </div>

            {/* ستون کناری (چپ در RTL) — فقط دسکتاپ؛ خلاصه پروفایل همیشه دیده می‌شود */}
            <aside className="hidden lg:block">
              <div className="nice-scroll sticky top-6 max-h-[calc(100dvh-3rem)] space-y-4 overflow-y-auto pb-2 pe-1">
                {/* درباره — بیو */}
                {data.bio ? (
                  <SectionShell icon={BadgeCheck} title="درباره">
                    <p className="whitespace-pre-line text-[13px] leading-8 text-foreground/90" dir="auto">
                      {data.bio}
                    </p>
                  </SectionShell>
                ) : null}

                {/* مهارت‌ها */}
                {data.skills.length > 0 ? (
                  <SectionShell icon={Sparkles} title="مهارت‌ها">
                    <div className="flex flex-wrap gap-2">
                      {data.skills.map((s) => (
                        <SkillChip
                          key={s.name}
                          name={s.name}
                          level={s.level}
                          count={data.skillEndorsements[s.name] || 0}
                          endorsed={data.myEndorsements.includes(s.name)}
                          onClick={data.isMe ? undefined : () => void toggleEndorse(s.name)}
                        />
                      ))}
                    </div>
                    {!data.isMe ? (
                      <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
                        💡 روی هر مهارتی که واقعاً از او دیده‌ای ضربه بزن تا تأییدش کنی
                      </p>
                    ) : null}
                  </SectionShell>
                ) : null}

                {/* علایق */}
                {data.interests.length > 0 ? (
                  <SectionShell icon={Heart} title="علایق حرفه‌ای">
                    <div className="flex flex-wrap gap-1.5">
                      {data.interests.map((i) => (
                        <span
                          key={i}
                          className="rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-[11.5px] font-bold text-primary"
                          dir="auto"
                        >
                          {i}
                        </span>
                      ))}
                    </div>
                  </SectionShell>
                ) : null}

                {/* لینک‌ها */}
                {data.links.length > 0 ? (
                  <SectionShell icon={Link2} title="لینک‌ها">
                    <div className="space-y-2">
                      {data.links.map((l, i) => (
                        <a
                          key={i}
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-muted/30 p-2.5 transition-colors hover:border-primary/30 hover:bg-accent"
                        >
                          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                            <Link2 className="size-3.5" />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-primary" dir="auto">
                            {l.label}
                          </span>
                          <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                        </a>
                      ))}
                    </div>
                  </SectionShell>
                ) : null}

                {/* ایجنت — کارت کوچک */}
                <AgentMiniCard data={data} onOpenChat={onOpenChat} />
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// تب «درباره» — موبایل: همه بخش‌ها پشت‌سرهم
// دسکتاپ: سوابق و تحصیلات در ستون اصلی؛ بیو/مهارت/علایق/لینک در ستون کناری
// ═══════════════════════════════════════════════════════════════

function AboutTab({
  data,
  onEndorse,
  endorsing,
}: {
  data: ProfileData;
  onEndorse: (skill: string) => void;
  endorsing: string | null;
}) {
  const hasAnything =
    Boolean(data.bio) ||
    data.skills.length > 0 ||
    data.experience.length > 0 ||
    data.education.length > 0 ||
    data.interests.length > 0 ||
    data.links.length > 0;

  return (
    <div className="space-y-5">
      {/* بیو — فقط موبایل/تبلت (در دسکتاپ داخل ستون کناری است) */}
      {data.bio ? (
        <div className="lg:hidden">
          <SectionShell icon={BadgeCheck} title="درباره">
            <p className="whitespace-pre-line text-[13px] leading-8 text-foreground/90" dir="auto">
              {data.bio}
            </p>
          </SectionShell>
        </div>
      ) : null}

      {/* مهارت‌ها — فقط موبایل/تبلت */}
      {data.skills.length > 0 ? (
        <div className="lg:hidden">
          <SectionShell icon={Sparkles} title="مهارت‌ها">
            <div className="flex flex-wrap gap-2">
              {data.skills.map((s) => (
                <SkillChip
                  key={s.name}
                  name={s.name}
                  level={s.level}
                  count={data.skillEndorsements[s.name] || 0}
                  endorsed={data.myEndorsements.includes(s.name)}
                  onClick={data.isMe ? undefined : () => onEndorse(s.name)}
                />
              ))}
            </div>
            {!data.isMe ? (
              <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
                💡 روی هر مهارتی که واقعاً از او دیده‌ای ضربه بزن تا تأییدش کنی
              </p>
            ) : null}
          </SectionShell>
        </div>
      ) : null}

      {/* سوابق شغلی — تایم‌لاین */}
      {data.experience.length > 0 ? (
        <SectionShell icon={Briefcase} title="سوابق شغلی">
          <div className="relative space-y-5 ps-6">
            <div
              aria-hidden
              className="absolute inset-y-2 start-[7px] w-0.5 rounded-full bg-gradient-to-b from-primary/50 via-primary/20 to-transparent"
            />
            {data.experience.map((e, i) => (
              <div key={i} className="relative">
                <span
                  aria-hidden
                  className={`absolute -start-6 top-1.5 grid size-3.5 place-items-center rounded-full border-2 border-card shadow-sm ${
                    e.current ? "bg-emerald-500" : "bg-primary"
                  }`}
                />
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-[14.5px] font-black leading-6" dir="auto">
                    {e.role}
                  </p>
                  {e.current ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[9.5px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                      شغل فعلی
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted-foreground">
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <Building2 className="size-3.5 shrink-0" />
                    <span className="truncate" dir="auto">{e.company}</span>
                  </span>
                  {e.startYear ? (
                    <span className="tnum rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-bold">
                      {faNum(e.startYear)}
                      {e.endYear || e.current ? ` — ${faNum(e.endYear || "اکنون")}` : ""}
                    </span>
                  ) : null}
                </p>
                {e.description ? (
                  <p className="mt-2 text-[12.5px] leading-7 text-foreground/80" dir="auto">
                    {e.description}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </SectionShell>
      ) : null}

      {/* تحصیلات */}
      {data.education.length > 0 ? (
        <SectionShell icon={GraduationCap} title="تحصیلات">
          <div className="space-y-3">
            {data.education.map((e, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl bg-muted/40 p-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <GraduationCap className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black leading-6" dir="auto">
                    {e.degree ? `${e.degree} ` : ""}
                    {e.field}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-muted-foreground" dir="auto">
                    {e.school}
                  </p>
                  {e.startYear || e.note ? (
                    <p className="tnum mt-1.5 inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-[10.5px] font-bold text-muted-foreground">
                      <CalendarDays className="size-3" />
                      {e.startYear ? `${faNum(e.startYear)} — ${faNum(e.endYear || "در حال تحصیل")}` : ""}
                      {e.note ? ` · ${e.note}` : ""}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </SectionShell>
      ) : null}

      {/* علایق — فقط موبایل/تبلت */}
      {data.interests.length > 0 ? (
        <div className="lg:hidden">
          <SectionShell icon={Heart} title="علایق حرفه‌ای">
            <div className="flex flex-wrap gap-1.5">
              {data.interests.map((i) => (
                <span
                  key={i}
                  className="rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-[11.5px] font-bold text-primary"
                  dir="auto"
                >
                  {i}
                </span>
              ))}
            </div>
          </SectionShell>
        </div>
      ) : null}

      {/* لینک‌ها — فقط موبایل/تبلت */}
      {data.links.length > 0 ? (
        <div className="lg:hidden">
          <SectionShell icon={Link2} title="لینک‌ها">
            <div className="space-y-2">
              {data.links.map((l, i) => (
                <a
                  key={i}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-muted/30 p-2.5 transition-colors hover:border-primary/30 hover:bg-accent"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Link2 className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-primary" dir="auto">
                    {l.label}
                  </span>
                  <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                </a>
              ))}
            </div>
          </SectionShell>
        </div>
      ) : null}

      {/* حالت خالی */}
      {!hasAnything ? (
        <div className="flex flex-col items-center gap-2.5 rounded-3xl border border-dashed border-border/60 bg-card p-10 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
            <BadgeCheck className="size-8 text-muted-foreground" />
          </div>
          <p className="text-sm font-black">پروفایل هنوز کامل نشده</p>
          <p className="max-w-xs text-xs leading-6 text-muted-foreground">
            {data.isMe
              ? "از تب «پروفایل من» اطلاعات حرفه‌ای‌تان را تکمیل کنید تا اینجا حرفه‌ای دیده شود"
              : data.hasSocialProfile === false
                ? "این کاربر هنوز پروفایل حرفه‌ای شهریار را تکمیل نکرده است"
                : "اطلاعات حرفه‌ای ثبت نشده است"}
          </p>
        </div>
      ) : null}

      {endorsing ? (
        <p className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          در حال ثبت تأیید…
        </p>
      ) : null}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// تب «ایجنت» — کارت هیرو + سؤال‌های پیشنهادی
// ═══════════════════════════════════════════════════════════════

function AgentTab({
  data,
  onOpenChat,
}: {
  data: ProfileData;
  onOpenChat: (type: "dm" | "agent", userId: string) => void;
}) {
  const agentName = data.agentInfo?.name || `ایجنتِ ${data.name.split(" ")[0]}`;
  const enabled = data.agentInfo?.enabled !== false;
  const questions = data.agentInfo?.questions || [];

  return (
    <div className="space-y-4">
      {/* کارت هیرو ایجنت */}
      <div className="relative overflow-hidden rounded-3xl border border-violet-200/60 bg-gradient-to-bl from-violet-50 via-card to-indigo-50/60 dark:border-violet-800/40 dark:from-violet-900/20 dark:via-card dark:to-indigo-900/10">
        {/* تزئینات */}
        <div aria-hidden className="absolute -start-14 -top-14 size-40 rounded-full bg-violet-400/15 blur-2xl" />
        <div aria-hidden className="absolute -end-10 -bottom-14 size-36 rounded-full bg-indigo-400/15 blur-2xl" />
        <div aria-hidden className="pattern-dots absolute inset-0 opacity-[0.07]" />

        <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:gap-5 sm:p-6">
          {/* آواتار ایجنت */}
          <div className="relative shrink-0 self-start">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30">
              <Bot className="size-8" />
            </div>
            {data.hasAgent ? (
              <span className="absolute -bottom-1 -end-1 grid size-6 place-items-center rounded-full bg-card shadow-md">
                <Sparkles className="size-3.5 text-violet-500" />
              </span>
            ) : null}
          </div>

          {/* معرفی */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-base font-black sm:text-lg" dir="auto">
                {agentName}
              </p>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  enabled
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                }`}
              >
                <span aria-hidden className={`size-1.5 rounded-full ${enabled ? "animate-pulse bg-emerald-500" : "bg-amber-500"}`} />
                {enabled ? "فعال و آماده" : "غیرفعال"}
              </span>
            </div>
            <p className="mt-2 text-[12.5px] leading-7 text-muted-foreground sm:text-[13px]" dir="auto">
              {data.agentInfo?.greeting ||
                `ایجنت بر اساس دانش و پروفایل اختصاصیِ ${data.name.split(" ")[0]} به سؤالات شما درباره‌ی مهارت‌ها، سوابق و زمینه‌های همکاری پاسخ می‌دهد و او را بهترین شکل معرفی می‌کند.`}
            </p>
            {/* نشان‌ها */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {data.hasAgent ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-[10.5px] font-bold text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                  <BookOpen className="size-3" />
                  <span className="tnum">{faNum(data.knowledgeCount)}</span>
                  منبع دانش اختصاصی
                </span>
              ) : (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10.5px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  دانش‌پرور نشده
                </span>
              )}
              <span className="rounded-full bg-muted px-2.5 py-1 text-[10.5px] font-bold text-muted-foreground">
                پاسخ‌گوی شبانه‌روزی
              </span>
            </div>
          </div>
        </div>

        {/* اقدام */}
        <div className="relative border-t border-violet-200/40 p-4 sm:p-5 dark:border-violet-800/30">
          {!data.isMe ? (
            enabled ? (
              <Button
                onClick={() => onOpenChat("agent", data.userId)}
                className="h-12 w-full rounded-xl border-0 bg-gradient-to-l from-violet-600 to-purple-600 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition-all hover:from-violet-700 hover:to-purple-700 hover:shadow-violet-500/40 sm:h-11"
              >
                <Send className="size-4" />
                شروع گفتگو با ایجنت {data.name.split(" ")[0]}
              </Button>
            ) : (
              <p className="flex items-center justify-center gap-1.5 rounded-xl bg-muted/60 px-3 py-3.5 text-xs font-bold text-muted-foreground">
                <Bot className="size-4" />
                مالک پروفایل ایجنت را موقتاً غیرفعال کرده است
              </p>
            )
          ) : (
            <p className="flex items-center justify-center gap-1.5 rounded-xl bg-muted/40 px-3 py-3.5 text-center text-xs font-bold leading-6 text-muted-foreground">
              <BookOpen className="size-4 shrink-0" />
              شخصی‌سازی کامل ایجنت از تب «ایجنت من» در پروفایل خود
            </p>
          )}
        </div>
      </div>

      {/* سؤال‌های پیشنهادی — لیست عمودی با هدف لمسی بزرگ */}
      {questions.length > 0 && !data.isMe && enabled ? (
        <SectionShell icon={MessageCircle} title="سؤال‌های پیشنهادی برای شروع">
          <div className="overflow-hidden rounded-xl border border-border/50">
            {questions.map((q, i) => (
              <button
                key={i}
                onClick={() => onOpenChat("agent", data.userId)}
                className="flex w-full items-center gap-3 border-b border-border/40 p-3.5 text-right transition-colors last:border-0 hover:bg-accent active:bg-accent/70"
              >
                <span className="tnum grid size-7 shrink-0 place-items-center rounded-lg bg-violet-100 text-[11px] font-black text-violet-600 dark:bg-violet-900/40 dark:text-violet-300">
                  {faNum(i + 1)}
                </span>
                <span className="min-w-0 flex-1 text-[13px] font-bold leading-6" dir="auto">
                  {q}
                </span>
                <Send className="size-3.5 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        </SectionShell>
      ) : null}
    </div>
  );
}

// ═══════════ کارت کوچک ایجنت — ستون کناری دسکتاپ ═══════════

function AgentMiniCard({
  data,
  onOpenChat,
}: {
  data: ProfileData;
  onOpenChat: (type: "dm" | "agent", userId: string) => void;
}) {
  const agentName = data.agentInfo?.name || `ایجنتِ ${data.name.split(" ")[0]}`;
  const enabled = data.agentInfo?.enabled !== false;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-violet-200/60 bg-gradient-to-bl from-violet-50 to-indigo-50/50 p-4 dark:border-violet-800/40 dark:from-violet-900/20 dark:to-indigo-900/10">
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <div className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/25">
            <Bot className="size-5" />
          </div>
          {data.hasAgent ? (
            <span className="absolute -bottom-1 -end-1 grid size-4.5 place-items-center rounded-full bg-card shadow-sm">
              <Sparkles className="size-3 text-violet-500" />
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-black" dir="auto">
            {agentName}
          </p>
          <p className="mt-0.5 text-[10.5px] font-bold text-muted-foreground">
            {enabled
              ? data.hasAgent
                ? `فعال · ${faNum(data.knowledgeCount)} منبع دانش`
                : "فعال · بدون دانش اختصاصی"
              : "موقتاً غیرفعال"}
          </p>
        </div>
      </div>
      {!data.isMe && enabled ? (
        <Button
          onClick={() => onOpenChat("agent", data.userId)}
          className="mt-3 h-10 w-full rounded-xl border-0 bg-gradient-to-l from-violet-600 to-purple-600 text-xs font-bold text-white shadow-md transition-all hover:from-violet-700 hover:to-purple-700"
        >
          <Send className="size-3.5" />
          گفتگو با ایجنت
        </Button>
      ) : null}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// اجزای مشترک
// ═══════════════════════════════════════════════════════════════

/** پوسته بخش — کارت با نوار عنوان آیکون‌دار */
function SectionShell({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Sparkles;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="animate-in fade-in-0 slide-in-from-bottom-2 duration-500 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-border/50 px-4 py-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
        <h3 className="text-[14.5px] font-black">{title}</h3>
        <div aria-hidden className="h-px flex-1 bg-gradient-to-l from-border to-transparent" />
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

/** اسکلتون — هم‌شکل چیدمان جدید */
function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[1.6rem] border border-border/60 bg-card">
        <Skeleton className="h-36 w-full rounded-none sm:h-44" />
        <div className="px-4 pb-5 sm:px-6">
          <div className="relative -mt-12 flex flex-col sm:-mt-14 sm:flex-row sm:items-start sm:gap-5">
            <Skeleton className="size-24 rounded-full ring-4 ring-card sm:hidden" />
            <Skeleton className="hidden size-28 rounded-full ring-4 ring-card sm:block" />
            <div className="mt-3 flex-1 space-y-2.5 sm:mt-0 sm:pt-14">
              <Skeleton className="h-7 w-44 rounded-lg" />
              <Skeleton className="h-4.5 w-64 rounded-lg" />
              <Skeleton className="h-3.5 w-40 rounded-lg" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-4 overflow-hidden rounded-2xl border border-border/60">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 rounded-none border-s border-border/60 first:border-0" />
            ))}
          </div>
          <Skeleton className="mt-4 h-12 w-full rounded-xl lg:hidden" />
        </div>
        <div className="flex gap-1 border-t border-border/60 bg-muted/30 p-1.5">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 flex-1 rounded-xl" />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-11 rounded-2xl" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32 rounded-lg" />
                <Skeleton className="h-3 w-44 rounded-lg" />
              </div>
            </div>
            <Skeleton className="mt-3 h-4 w-full rounded-lg" />
            <Skeleton className="mt-2 h-4 w-3/4 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
