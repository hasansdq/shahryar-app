// ═══ بخش انجمن‌های شهریار — لیست انجمن‌ها + ناوبری داخلی ═══
// انجمن‌های عمومی (همه) + انجمن‌های خصوصیِ عضو — ورود به جزئیات انجمن
// ایجاد انجمن فقط از پنل مدیریت (CMS) انجام می‌شود
"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Bot, CalendarDays, ChevronLeft, Crown, Globe2, Lock, MessagesSquare,
  Newspaper, Search, ShieldCheck, UserCheck, Users, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { get } from "@/lib/client/api";
import { faNum } from "@/lib/client/persian";
import { PersonAvatar } from "../social/social-ui";
import type { ForumSummary, MyForumRelation } from "@/lib/modules/forums/types";
import ForumDetail from "./ForumDetail";

/** نشان وضعیت من نسبت به انجمن */
function RelationBadge({ relation }: { relation: MyForumRelation }) {
  if (relation === "none") return null;
  const map: Record<Exclude<MyForumRelation, "none">, { label: string; cls: string; icon: typeof Crown }> = {
    chair: { label: "رئیس انجمن", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30", icon: Crown },
    member: { label: "عضو", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30", icon: UserCheck },
    pending: { label: "در انتظار تایید", cls: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30", icon: Clock },
    rejected: { label: "رد شده", cls: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30", icon: ShieldCheck },
    banned: { label: "مسدود", cls: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30", icon: ShieldCheck },
  };
  const { label, cls, icon: Icon } = map[relation];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${cls}`}>
      <Icon className="size-3" />
      {label}
    </span>
  );
}

/** آواتار کوچک — هم‌سبک شبکه اجتماعی */
function MiniAvatar({ name, url, color, size = 24 }: { name: string; url: string | null; color: string; size?: number }) {
  return <PersonAvatar name={name} avatarUrl={url} color={color} size={size} radius="lg" className="shadow-none" />;
}

export default function ForumsView() {
  const [forums, setForums] = useState<ForumSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [activeForum, setActiveForum] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await get<{ forums: ForumSummary[] }>("/api/forums");
    if (res.success && res.data) setForums(res.data.forums);
    else if (res.error) toast({ title: "خطا", description: res.error, variant: "destructive" });
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  // ─── نمای جزئیات انجمن فعال ───
  if (activeForum) {
    return (
      <ForumDetail
        key={activeForum} // remount کامل هنگام تغییر انجمن — stateها و بارگذاری تازه
        forumId={activeForum}
        onBack={() => {
          setActiveForum(null);
          load(); // وضعیت عضویت ممکن است تغییر کرده باشد
        }}
      />
    );
  }

  const filtered = (forums || []).filter(
    (f) => !q.trim() || f.title.includes(q.trim()) || (f.description || "").includes(q.trim())
  );
  const myForums = filtered.filter((f) => f.isMember);
  const otherForums = filtered.filter((f) => !f.isMember);

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 lg:p-0" dir="rtl">
      {/* ═══ هدر بخش ═══ */}
      <div className="relative overflow-hidden rounded-3xl shahryar-gradient p-4 text-white shadow-lg sm:p-6">
        <div aria-hidden className="pattern-dots absolute inset-0 opacity-25" />
        <div aria-hidden className="absolute -start-16 -top-16 size-48 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden className="absolute -end-12 -bottom-20 size-44 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/25 bg-white/15 shadow-lg backdrop-blur-md sm:size-12 md:size-14">
              <MessagesSquare className="size-5 sm:size-6 md:size-7" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-black sm:text-lg md:text-2xl">انجمن‌های شهریار</h2>
              <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-white/85 sm:mt-1.5 sm:text-sm sm:leading-6">
                انجمن‌های تخصصی شهر — گفتگو، ایجنت هوشمند، رویدادها و نشریه هر انجمن
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ راهنما ═══ */}
      <div className="flex items-start gap-3 rounded-2xl border border-teal-500/20 bg-teal-500/5 p-3.5">
        <ShieldCheck className="size-5 shrink-0 text-teal-500" />
        <p className="text-[11px] leading-6 text-muted-foreground sm:text-xs">
          <span className="font-bold text-teal-600 dark:text-teal-400">انجمن عمومی</span> را همه می‌بینند و
          می‌توانند با ایجنت آن گفتگو کنند تا اهداف و فعالیت‌هایش را بشناسند؛ برای مشارکت در گفتگوها درخواست
          عضویت بدهید که رئیس انجمن تاییدش می‌کند.{" "}
          <span className="font-bold text-teal-600 dark:text-teal-400">انجمن خصوصی</span> فقط برای اعضای دعوت‌شده قابل
          مشاهده است. ایجاد انجمن جدید از طریق مدیریت سامانه انجام می‌شود.
        </p>
      </div>

      {/* ═══ جستجو ═══ */}
      <div className="relative">
        <Search className="absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="جستجوی انجمن… مثلاً «کسب‌وکار» یا «ورزش»"
          className="h-10 rounded-xl border-border/70 bg-accent/40 pe-4 ps-10 focus-visible:border-primary/50"
        />
      </div>

      {/* ═══ محتوا ═══ */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <Skeleton className="h-24 rounded-none" />
              <div className="space-y-3 p-4">
                <Skeleton className="h-5 w-36 rounded-lg" />
                <Skeleton className="h-4 w-52 rounded-lg" />
                <Skeleton className="h-7 w-24 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border/60 bg-card p-10 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
            <MessagesSquare className="size-8 text-muted-foreground" />
          </div>
          <p className="font-black">{forums && forums.length > 0 ? "انجمنی پیدا نشد" : "هنوز انجمنی ایجاد نشده"}</p>
          <p className="max-w-sm text-sm leading-6 text-muted-foreground">
            {forums && forums.length > 0
              ? "عبارت دیگری را جستجو کنید."
              : "انجمن‌ها توسط مدیریت سامانه ایجاد می‌شوند؛ به‌زودی انجمن‌های تخصصی شهر رفسنجان اینجا جمع می‌شوند."}
          </p>
        </div>
      ) : (
        <>
          {/* انجمن‌های من */}
          {myForums.length > 0 ? (
            <section>
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <UserCheck className="size-4" />
                </div>
                <h3 className="text-sm font-black">انجمن‌های من</h3>
                <div aria-hidden className="h-px flex-1 bg-gradient-to-l from-border to-transparent" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {myForums.map((f, i) => (
                  <ForumCard key={f.id} forum={f} index={i} onOpen={() => setActiveForum(f.id)} />
                ))}
              </div>
            </section>
          ) : null}

          {/* سایر انجمن‌ها */}
          {otherForums.length > 0 ? (
            <section>
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Globe2 className="size-4" />
                </div>
                <h3 className="text-sm font-black">سایر انجمن‌ها</h3>
                <div aria-hidden className="h-px flex-1 bg-gradient-to-l from-border to-transparent" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {otherForums.map((f, i) => (
                  <ForumCard key={f.id} forum={f} index={i} onOpen={() => setActiveForum(f.id)} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

/** کارت انجمن — بنر + هویت + آمار + وضعیت من */
function ForumCard({ forum, index, onOpen }: { forum: ForumSummary; index: number; onOpen: () => void }) {
  return (
    <article
      className="group flex animate-in fade-in-0 slide-in-from-bottom-3 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl active:scale-[0.99]"
      style={{ animationDelay: `${Math.min(index * 60, 400)}ms` }}
    >
      <button onClick={onOpen} className="flex min-h-0 w-full flex-1 flex-col text-right" title={forum.title}>
        {/* بنر */}
        <div className="relative h-24 shrink-0 overflow-hidden bg-gradient-to-br from-teal-500/25 via-sky-500/15 to-primary/20">
          {forum.coverImage ? (
            <img src={forum.coverImage} alt={`کاور ${forum.title}`} className="size-full object-cover" />
          ) : (
            <div aria-hidden className="pattern-dots absolute inset-0 opacity-30" />
          )}
          <span
            className={`absolute end-2.5 top-2.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold backdrop-blur-md ${
              forum.type === "PUBLIC"
                ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-100"
                : "border-slate-400/40 bg-slate-700/50 text-slate-100"
            }`}
          >
            {forum.type === "PUBLIC" ? <Globe2 className="size-3" /> : <Lock className="size-3" />}
            {forum.type === "PUBLIC" ? "عمومی" : "خصوصی"}
          </span>
        </div>

        {/* بدنه */}
        <div className="flex flex-1 flex-col p-4">
          <h3 className="line-clamp-1 text-[15px] font-black leading-6" title={forum.title}>
            {forum.title}
          </h3>
          {forum.description ? (
            <p className="mt-1 line-clamp-2 min-h-8 text-xs leading-5 text-muted-foreground">{forum.description}</p>
          ) : (
            <div className="min-h-8" aria-hidden />
          )}

          {/* رئیس انجمن + وضعیت من */}
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 py-0.5 pe-2.5 ps-1">
              <MiniAvatar name={forum.chair.name} url={forum.chair.avatarUrl} color={forum.chair.avatarColor} />
              <span className="max-w-28 truncate text-[10px] font-bold text-muted-foreground">
                {forum.chair.name}
              </span>
            </span>
            <RelationBadge relation={forum.myRelation} />
          </div>

          {/* آمار — چسبان به پایین */}
          <div className="mt-auto flex items-center gap-3.5 pt-3 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" />
              {faNum(forum.memberCount)} عضو
            </span>
            <span className="inline-flex items-center gap-1">
              <Newspaper className="size-3.5" />
              {faNum(forum.articleCount)} مقاله
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" />
              {faNum(forum.eventCount)} رویداد
            </span>
            <span className="ms-auto text-[10px] font-bold text-primary opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              ورود ←
            </span>
          </div>
        </div>
      </button>

      {/* نوار اقدام */}
      <div className="flex shrink-0 border-t border-border/60 bg-muted/30 p-2.5">
        <Button onClick={onOpen} size="sm" className="h-11 w-full rounded-lg text-xs font-bold sm:h-8">
          {forum.isMember ? (
            <>
              <MessagesSquare className="size-3.5" />
              ورود به انجمن
            </>
          ) : (
            <>
              <Bot className="size-3.5" />
              مشاهده و عضویت
            </>
          )}
        </Button>
      </div>
    </article>
  );
}
