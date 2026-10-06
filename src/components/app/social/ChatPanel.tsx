// ═══ پنل گفتگوی اجتماعی — DM کاربر↔کاربر و کاربر↔ایجنت ═════
// بازطراحی حرفه‌ای چندلول:
//  • هدر هیروی ایجنت: نوار گرادیانی بنفش + آواتار درخشان + وضعیت زنده + دکمه بازنشانی
//  • پیام‌ها: حباب‌های متمایز دوطرفه + جداکننده تاریخ + ساعت + کپی پاسخ ایجنت
//  • معرفی ایجنت: کارت هیرو با گوی‌های نور و سؤال‌های لمسی تمام-عرض
//  • کامپوزر یکپارچه با focus-ring و دکمه ارسال گرادیانی
//  • دکمه شناور «رفتن به آخر» هنگام اسکرول به بالا
// موبایل: تمام‌صفحه با لمس ۴۴px · دسکتاپ: ستون خوانای مرکزی max-w-3xl
"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import {
  ArrowRight, ArrowDown, Bot, Check, Copy, Info, Loader2, MessageCircle,
  RotateCcw, Send, ShieldCheck, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import AppDialog from "@/components/ui/app-dialog";
import { toast } from "@/hooks/use-toast";
import { del, get, post } from "@/lib/client/api";
import { faNum, faTime } from "@/lib/client/persian";
import { useAppStore } from "@/lib/client/store";
import type { SocialChatMessage } from "@/lib/modules/social/types";
import { PersonAvatar } from "./social-ui";
import MarkdownContent from "@/components/common/MarkdownContent";

interface AgentConfig {
  enabled: boolean;
  name: string | null;
  greeting: string | null;
  questions: string[];
  styleLabel: string | null;
}

interface ChatData {
  conversation: { id: string; type: "dm" | "agent"; myRole: "participant" | "agent-owner" };
  other: { userId: string; name: string; avatarUrl: string | null; avatarColor: string; headline: string | null } | null;
  agentStats: { items: number; totalChars: number } | null;
  agentConfig: AgentConfig | null;
  messages: SocialChatMessage[];
}

const DEFAULT_AGENT_PROMPTS = [
  "خودت و صاحبت را معرفی کن",
  "چه مهارت‌ها و سوابقی دارد؟",
  "برای پروژه‌ی من مناسب است؟",
  "بهترین راه همکاری با او چیست؟",
];

/** برچسب روز برای جداکنندهٔ تاریخ پیام‌ها — امروز/دیروز/تاریخ جلالی (هم‌زمان با هوشیار) */
function dayLabel(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(d.getTime())) return "";
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit",
  });
  const today = fmt.format(new Date());
  const yesterday = fmt.format(new Date(Date.now() - 86400000));
  const that = fmt.format(d);
  if (that === today) return "امروز";
  if (that === yesterday) return "دیروز";
  return new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", month: "long", day: "numeric" }).format(d);
}

export default function ChatPanel({
  conversationId,
  onBack,
}: {
  conversationId: string;
  onBack: () => void;
}) {
  const { user, openUserProfile } = useAppStore();
  const [data, setData] = useState<ChatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);
  const nearBottomRef = useRef(true);

  // ─── بارگذاری اولیه ───
  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ریست و بارگذاری اولیه گفتگو در mount/تغییر گفتگو (الگوی متعارف پروژه)
    setLoading(true);
    setError(null);
    setData(null);
    lastCountRef.current = 0;
    (async () => {
      const res = await get<ChatData>(`/api/social/conversations/${conversationId}`);
      if (!active) return;
      if (res.success && res.data) {
        setData(res.data);
        lastCountRef.current = res.data.messages.length;
      } else {
        setError(res.error || "گفتگو یافت نشد");
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [conversationId]);

  // ─── اسکرول هوشمند: فقط وقتی کاربر نزدیک پایین است خودکار اسکرول کن ───
  useEffect(() => {
    const el = scrollRef.current;
    if (el && nearBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [data?.messages.length, sending]);

  // ─── polling فقط برای DM (رسیدن پیام طرف مقابل) ───
  const isDm = data?.conversation.type === "dm";
  useEffect(() => {
    if (!isDm) return;
    const t = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const res = await get<ChatData>(`/api/social/conversations/${conversationId}`);
      if (res.success && res.data) {
        if (res.data.messages.length !== lastCountRef.current) {
          lastCountRef.current = res.data.messages.length;
          setData(res.data);
        }
      }
    }, 8000);
    return () => clearInterval(t);
  }, [isDm, conversationId]);

  /** کپی متن پاسخ ایجنت — Clipboard API با fallback اجرای دستور کپی */
  const copyMessage = async (id: string, text: string) => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1800);
    }
  };

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    setInput("");
    setSending(true);
    nearBottomRef.current = true;

    // پیام خوش‌بینانه‌ی محلی
    const optimistic: SocialChatMessage = {
      id: `tmp-${Date.now()}`,
      senderType: "user",
      senderId: user?.id || "me",
      senderName: user?.fullName || null,
      content,
      createdAt: new Date().toISOString(),
    };
    setData((d) => (d ? { ...d, messages: [...d.messages, optimistic] } : d));

    const res = await post<{ userMessage: SocialChatMessage; agentReply: SocialChatMessage | null }>(
      `/api/social/conversations/${conversationId}`,
      { content }
    );

    if (res.success && res.data) {
      setData((d) => {
        if (!d) return d;
        const messages = d.messages.filter((m) => m.id !== optimistic.id);
        messages.push(res.data!.userMessage);
        if (res.data!.agentReply) messages.push(res.data!.agentReply);
        lastCountRef.current = messages.length;
        return { ...d, messages };
      });
    } else {
      // برگرداندن پیام به input در صورت خطا
      setData((d) => (d ? { ...d, messages: d.messages.filter((m) => m.id !== optimistic.id) } : d));
      setInput(content);
      toast({ title: "ارسال نشد", description: res.error || "خطا در ارسال پیام", variant: "destructive" });
    }
    setSending(false);
  };

  /** بازنشانی گفتگو — حذف همه‌ی پیام‌ها و شروع تازه */
  const resetConversation = async () => {
    if (resetting) return;
    setResetting(true);
    const res = await del<{ deletedMessages: number }>(`/api/social/conversations/${conversationId}`);
    setResetting(false);
    if (res.success) {
      setData((d) => (d ? { ...d, messages: [] } : d));
      lastCountRef.current = 0;
      setResetOpen(false);
      toast({
        title: "گفتگو بازنشانی شد",
        description: `${faNum(String(res.data?.deletedMessages || 0))} پیام حذف شد — گفتگوی تازه را از همین‌جا شروع کنید`,
      });
    } else {
      toast({ title: "بازنشانی نشد", description: res.error, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-11 rounded-2xl" />
          <Skeleton className="h-5 w-36 rounded-lg" />
        </div>
        <Skeleton className="h-16 w-2/3 rounded-2xl" />
        <Skeleton className="ms-12 h-12 w-1/2 rounded-2xl" />
        <Skeleton className="h-16 w-3/5 rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
          <MessageCircle className="size-8 text-muted-foreground" />
        </div>
        <p className="font-bold">{error || "گفتگو یافت نشد"}</p>
        <Button variant="outline" onClick={onBack}>بازگشت</Button>
      </div>
    );
  }

  const isAgent = data.conversation.type === "agent";
  const readOnly = data.conversation.myRole === "agent-owner";
  const other = data.other;
  const otherName = other?.name || "کاربر شهریار";
  const firstName = otherName.split(" ")[0];
  const agentCfg = data.agentConfig;
  const agentDisplayName = isAgent ? agentCfg?.name || `ایجنتِ ${firstName}` : otherName;
  const suggestedQuestions =
    isAgent && agentCfg && agentCfg.questions.length > 0 ? agentCfg.questions : DEFAULT_AGENT_PROMPTS;
  const knowledgeCount = data.agentStats?.items || 0;
  const canReset = isAgent && !readOnly && data.messages.length > 0;

  return (
    <div className="flex h-full flex-col bg-background" dir="rtl">
      {/* ═══ هدر گفتگو ═══ */}
      {isAgent && !readOnly ? (
        // ─── هدر هیروی ایجنت — نوار گرادیانی بنفش با آواتار درخشان ───
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-l from-violet-600 via-purple-600 to-violet-700 text-white shadow-lg">
          <div aria-hidden className="pattern-dots absolute inset-0 opacity-20" />
          <div aria-hidden className="absolute -top-10 start-6 size-28 rounded-full bg-white/15 blur-2xl" />
          <div aria-hidden className="absolute -bottom-14 end-10 size-32 rounded-full bg-fuchsia-400/20 blur-2xl" />
          <div className="relative flex items-center gap-2.5 px-3 py-3 md:gap-3 md:px-6">
            <button
              onClick={onBack}
              aria-label="بازگشت"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/15 backdrop-blur-md transition-colors hover:bg-white/25 active:scale-95 md:size-9"
            >
              <ArrowRight className="size-5" />
            </button>
            {/* آواتار ایجنت + نشان صاحب */}
            <div className="relative shrink-0">
              <div className="flex size-11 items-center justify-center rounded-2xl border border-white/30 bg-white/20 shadow-lg backdrop-blur-md md:size-12">
                <Bot className="size-5 md:size-6" />
              </div>
              <span className="absolute -bottom-1 -end-1 rounded-full border-2 border-violet-600">
                <PersonAvatar name={otherName} avatarUrl={other?.avatarUrl} color={other?.avatarColor} size={20} radius="lg" className="shadow-none" />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-[15px] font-black leading-6" dir="auto">{agentDisplayName}</p>
                <span className="hidden shrink-0 items-center gap-1 rounded-full border border-white/25 bg-white/15 px-2 py-0.5 text-[9.5px] font-bold backdrop-blur-md sm:inline-flex">
                  <Sparkles className="size-3" />
                  ایجنت هوشمند
                </span>
              </div>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] leading-4 text-white/85">
                <span className="relative flex size-1.5 shrink-0">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-emerald-300" />
                </span>
                {knowledgeCount > 0
                  ? `فعال و آماده پاسخ · ${faNum(String(knowledgeCount))} منبع دانش · نماینده‌ی ${firstName}`
                  : `فعال و آماده پاسخ · نماینده‌ی دیجیتال ${firstName}`}
              </p>
            </div>
            {/* دکمه بازنشانی گفتگو — فقط چت‌کننده */}
            {canReset ? (
              <button
                onClick={() => setResetOpen(true)}
                aria-label="بازنشانی گفتگو"
                title="بازنشانی گفتگو"
                className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/15 backdrop-blur-md transition-all hover:bg-white/25 active:scale-95 md:size-9"
              >
                <RotateCcw className="size-4.5" />
              </button>
            ) : null}
          </div>
        </div>
      ) : isAgent && readOnly ? (
        // ─── نمای مالک: گفتگوی لید با ایجنت من (فقط مشاهده) ───
        <div className="flex shrink-0 items-center gap-2.5 border-b border-border/60 bg-card/70 px-3 py-2.5 backdrop-blur-md md:gap-3 md:px-6 md:py-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="size-10 shrink-0 rounded-xl md:size-9" aria-label="بازگشت">
            <ArrowRight className="size-5" />
          </Button>
          <button
            onClick={() => other && openUserProfile(other.userId)}
            aria-label={`پروفایل ${otherName}`}
            className="shrink-0 transition-transform hover:scale-105 active:scale-95"
          >
            <PersonAvatar name={otherName} avatarUrl={other?.avatarUrl} color={other?.avatarColor} size={44} />
          </button>
          <div className="min-w-0 flex-1">
            <button
              onClick={() => other && openUserProfile(other.userId)}
              className="block max-w-full truncate text-[15px] font-black leading-6 hover:underline md:text-sm md:leading-5"
              dir="auto"
            >
              {otherName}
            </button>
            <p className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground" dir="auto">
              گفتگوی او با ایجنت شما · {faNum(String(data.messages.length))} پیام ثبت‌شده
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-violet-300/60 bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700 dark:border-violet-700/40 dark:bg-violet-900/30 dark:text-violet-300">
            <Bot className="size-3" />
            ایجنت شما
          </span>
        </div>
      ) : (
        // ─── هدر DM ───
        <div className="flex shrink-0 items-center gap-2.5 border-b border-border/60 bg-card/70 px-3 py-2.5 backdrop-blur-md md:gap-3 md:px-6 md:py-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="size-10 shrink-0 rounded-xl md:size-9" aria-label="بازگشت">
            <ArrowRight className="size-5" />
          </Button>
          <button
            onClick={() => other && openUserProfile(other.userId)}
            aria-label={`پروفایل ${otherName}`}
            className="shrink-0 transition-transform hover:scale-105 active:scale-95"
          >
            <PersonAvatar name={otherName} avatarUrl={other?.avatarUrl} color={other?.avatarColor} size={44} />
          </button>
          <div className="min-w-0 flex-1">
            <button
              onClick={() => other && openUserProfile(other.userId)}
              className="block max-w-full truncate text-[15px] font-black leading-6 hover:underline md:text-sm md:leading-5"
              dir="auto"
            >
              {otherName}
            </button>
            <p className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground md:mt-0" dir="auto">
              {other?.headline || "کاربر شبکه‌ی شهریار"}
            </p>
          </div>
        </div>
      )}

      {/* ═══ پیام‌ها — با دکمه شناور «رفتن به آخر» ═══ */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 220;
            nearBottomRef.current = nearBottom;
            setShowJump(!nearBottom && data.messages.length > 3);
          }}
          className="h-full overflow-y-auto overscroll-contain"
        >
          <div className="mx-auto max-w-3xl space-y-2.5 px-3 py-4 md:space-y-3 md:px-4">
            {data.messages.length === 0 && isAgent && !readOnly ? (
              <AgentIntro
                name={agentDisplayName}
                ownerName={firstName}
                greeting={agentCfg?.greeting || null}
                questions={suggestedQuestions}
                onPrompt={(p) => sendMessage(p)}
                stats={data.agentStats}
              />
            ) : null}

            {data.messages.map((m, i) => {
              const day = dayLabel(m.createdAt);
              const prevDay = i > 0 ? dayLabel(data.messages[i - 1].createdAt) : null;
              const showDay = !!day && day !== prevDay;
              const mine = m.senderType === "user" && m.senderId === user?.id;

              if (m.senderType === "agent") {
                return (
                  <Fragment key={m.id}>
                    {showDay ? <DaySeparator day={day} /> : null}
                    <div className="flex animate-in fade-in-0 slide-in-from-bottom-2 items-start gap-2 md:gap-2.5">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md">
                        <Bot className="size-4" />
                      </div>
                      <div className="group flex min-w-0 max-w-[calc(100%-2.75rem)] flex-col md:max-w-[85%]">
                        <div className="min-w-0 rounded-2xl rounded-bl-sm border border-violet-200/70 bg-violet-50/80 px-3.5 py-2.5 dark:border-violet-800/50 dark:bg-violet-900/25">
                          {/* پاسخ ایجنت — مارک‌داون کامل: بولد، لیست، تیتر، جدول */}
                          <MarkdownContent content={m.content} className="text-[13px] leading-7" />
                        </div>
                        {/* متادیتا: ساعت + کپی — زیر حباب (الگوی هوشیار) */}
                        <div className="mt-1 flex items-center gap-2 px-1">
                          <span className="text-[10px] text-muted-foreground/80 tnum">{faTime(m.createdAt)}</span>
                          <button
                            onClick={() => copyMessage(m.id, m.content)}
                            className="flex items-center gap-1 text-[10px] text-muted-foreground/70 transition-colors hover:text-foreground active:scale-95"
                            title="کپی متن پاسخ"
                          >
                            {copiedId === m.id ? (
                              <><Check className="size-3 text-emerald-500" />کپی شد</>
                            ) : (
                              <><Copy className="size-3" />کپی</>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </Fragment>
                );
              }
              return (
                <Fragment key={m.id}>
                  {showDay ? <DaySeparator day={day} /> : null}
                  <div className={`flex animate-in fade-in-0 slide-in-from-bottom-2 items-end gap-2 md:gap-2.5 ${mine ? "justify-end" : "justify-start"}`}>
                    {!mine ? (
                      <PersonAvatar name={m.senderName || otherName} avatarUrl={other?.avatarUrl} color={other?.avatarColor} size={30} radius="xl" className="shadow-none" />
                    ) : null}
                    <div
                      className={`min-w-0 max-w-[calc(100%-2.75rem)] rounded-2xl px-3.5 py-2 md:max-w-[85%] ${
                        mine
                          ? "rounded-br-sm shahryar-gradient text-white"
                          : "rounded-bl-sm border border-border/60 bg-muted/60 text-foreground/90"
                      }`}
                    >
                      {!mine && m.senderName ? (
                        <p className="mb-1 text-[10px] font-bold text-primary" dir="auto">{m.senderName}</p>
                      ) : null}
                      <p className="whitespace-pre-line text-[13px] leading-6" dir="auto">{m.content}</p>
                      <p className={`mt-1 text-[10px] tnum ${mine ? "text-white/70" : "text-end text-muted-foreground"}`}>{faTime(m.createdAt)}</p>
                    </div>
                  </div>
                </Fragment>
              );
            })}

            {sending && isAgent ? (
              <div className="flex items-start gap-2 md:gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md">
                  <Bot className="size-4" />
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-violet-200/70 bg-violet-50 px-4 py-3 dark:border-violet-800/50 dark:bg-violet-900/25">
                  <span className="typing-dot inline-block size-2 rounded-full bg-violet-500/70" />
                  <span className="typing-dot inline-block size-2 rounded-full bg-violet-500/70" style={{ animationDelay: "0.15s" }} />
                  <span className="typing-dot inline-block size-2 rounded-full bg-violet-500/70" style={{ animationDelay: "0.3s" }} />
                  <span className="ms-1.5 text-[11px] text-muted-foreground">ایجنت در حال فکر کردن است…</span>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* دکمه شناور پرش به آخرین پیام */}
        {showJump ? (
          <button
            onClick={() => {
              const el = scrollRef.current;
              if (el) {
                el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
                nearBottomRef.current = true;
              }
            }}
            aria-label="رفتن به آخرین پیام"
            className="absolute bottom-4 end-4 flex size-10 items-center justify-center rounded-full border border-border/60 bg-card text-foreground shadow-lg transition-all hover:shadow-xl active:scale-90"
          >
            <ArrowDown className="size-4.5" />
          </button>
        ) : null}
      </div>

      {/* ═══ ورودی پیام / نوار مشاهده ═══ */}
      {readOnly ? (
        <div className="flex shrink-0 items-center justify-center gap-2 border-t border-border/60 bg-muted/30 px-4 py-3.5 text-[11px] text-muted-foreground md:py-3">
          <ShieldCheck className="size-3.5 shrink-0 text-violet-500" />
          این گفتگو فقط برای مشاهده است — {firstName} با ایجنت شما صحبت می‌کند
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="shrink-0 border-t border-border/60 bg-card/80 backdrop-blur-md"
        >
          <div className="mx-auto max-w-3xl px-3 py-2.5 md:px-4 md:py-3">
            <div className={`flex items-center gap-1.5 rounded-2xl border border-border/70 bg-accent/50 p-1.5 transition-colors focus-within:border-primary/50 dark:bg-accent/30 md:gap-1 md:p-1.5 ${isAgent ? "focus-within:border-violet-400/60" : ""}`}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={2000}
                placeholder={isAgent ? `از ${agentDisplayName} بپرس…` : `پیام به ${firstName}…`}
                aria-label="متن پیام"
                dir="rtl"
                className="h-11 min-w-0 flex-1 border-0 bg-transparent text-start text-sm outline-none placeholder:text-muted-foreground/60 md:h-9"
              />
              {input.length > 1800 ? (
                <span className="shrink-0 text-[10px] text-muted-foreground tnum">{faNum(String(2000 - input.length))}</span>
              ) : null}
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-md transition-all hover:brightness-110 active:scale-90 disabled:opacity-40 disabled:shadow-none md:h-10 md:w-10 ${
                  isAgent ? "bg-gradient-to-br from-violet-600 to-purple-600" : "shahryar-gradient"
                }`}
                aria-label="ارسال پیام"
              >
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4 -scale-x-100" />}
              </button>
            </div>
            {isAgent ? (
              <p className="mt-1.5 flex items-center gap-1 px-1 text-[10px] leading-4 text-muted-foreground/70">
                <Sparkles className="size-3 shrink-0 text-violet-400" />
                پاسخ‌ها بر اساس دانش و پروفایل {firstName} ساخته می‌شود؛ صاحب ایجنت این گفتگو را در لیدهای خود می‌بیند
              </p>
            ) : null}
          </div>
        </form>
      )}

      {/* ═══ دیالوگ تأیید بازنشانی گفتگو ═══ */}
      <AppDialog
        open={resetOpen}
        onClose={() => !resetting && setResetOpen(false)}
        title="بازنشانی گفتگو"
        description="تمام پیام‌های این گفتگو برای همیشه حذف می‌شود و گفتگو از نو شروع می‌شود. این کار قابل بازگشت نیست."
        icon={RotateCcw}
        iconClassName="bg-gradient-to-br from-rose-500 to-red-600"
        size="sm"
        locked={resetting}
        footer={
          <div className="flex w-full gap-2">
            <Button
              variant="outline"
              onClick={() => setResetOpen(false)}
              disabled={resetting}
              className="flex-1 rounded-xl font-bold"
            >
              انصراف
            </Button>
            <Button
              onClick={resetConversation}
              disabled={resetting}
              className="flex-1 rounded-xl border-0 bg-gradient-to-br from-rose-500 to-red-600 font-bold text-white hover:from-rose-600 hover:to-red-700"
            >
              {resetting ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
              بازنشانی کن
            </Button>
          </div>
        }
      >
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs leading-6 text-amber-700 dark:text-amber-300">
          <Info className="size-4.5 shrink-0" />
          <p>
            {faNum(String(data.messages.length))} پیام این گفتگو حذف خواهد شد. تاریخچه‌ی گفتگو برای شما تازه می‌شود و
            می‌توانید پرسش‌های جدید را از ابتدا بپرسید.
          </p>
        </div>
      </AppDialog>
    </div>
  );
}

/** جداکنندهٔ تاریخ بین پیام‌ها — چیپ مرکزی (امروز/دیروز/تاریخ جلالی) */
function DaySeparator({ day }: { day: string }) {
  return (
    <div className="flex items-center justify-center gap-3 pt-1 pb-0.5">
      <div aria-hidden className="h-px flex-1 bg-gradient-to-l from-transparent to-border" />
      <span className="rounded-full border border-border/50 bg-accent/70 px-3 py-1 text-[10px] font-medium text-muted-foreground">
        {day}
      </span>
      <div aria-hidden className="h-px flex-1 bg-gradient-to-r from-transparent to-border" />
    </div>
  );
}

/** معرفی ایجنت + سؤال‌های پیشنهادی (چت خالی) — کارت هیرو با گوی‌های نور و چیپ‌های لمسی */
function AgentIntro({
  name,
  ownerName,
  greeting,
  questions,
  onPrompt,
  stats,
}: {
  name: string;
  ownerName: string;
  greeting: string | null;
  questions: string[];
  onPrompt: (p: string) => void;
  stats: { items: number; totalChars: number } | null;
}) {
  return (
    <div className="relative mx-auto my-4 max-w-md overflow-hidden rounded-3xl border border-violet-200/60 bg-card p-5 text-center shadow-sm sm:my-6 sm:p-6 dark:border-violet-800/40">
      {/* گوی‌های نور پس‌زمینه */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-16 h-32 bg-gradient-to-b from-violet-500/15 to-transparent blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -end-10 -bottom-10 size-36 rounded-full bg-purple-500/10 blur-2xl" />

      <div className="relative">
        <div className="mx-auto w-fit">
          <span className="absolute inset-0 animate-ping rounded-3xl bg-violet-400/20 [animation-duration:2.5s]" />
          <div className="relative flex size-16 animate-in zoom-in-50 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30">
            <Bot className="size-8" />
          </div>
        </div>
        <p className="mt-3.5 text-base font-black" dir="auto">{name}</p>
        <p className="mt-2 text-xs leading-6 text-muted-foreground" dir="auto">
          {greeting ||
            `من نماینده‌ی دیجیتالِ ${ownerName} هستم؛ بر اساس دانش و پروفایل اختصاصی او پاسخ می‌دهم و او را برای همکاری‌های شما معرفی می‌کنم.`}
        </p>
        {stats && stats.items > 0 ? (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-violet-300/50 bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700 dark:border-violet-700/40 dark:bg-violet-900/30 dark:text-violet-300">
              <Sparkles className="size-3" />
              {faNum(String(stats.items))} منبع دانش شخصی
            </span>
          </div>
        ) : null}
        {questions.length > 0 ? (
          <div className="mt-5 space-y-2 text-start">
            <p className="text-[10.5px] font-bold text-muted-foreground">برای شروع، یکی از این‌ها را بپرس:</p>
            {questions.map((p, i) => (
              <button
                key={p}
                onClick={() => onPrompt(p)}
                className="group flex w-full items-center gap-2.5 rounded-2xl border border-violet-200/60 bg-gradient-to-l from-violet-50/80 to-transparent px-3.5 py-3 text-start text-xs font-bold text-violet-800 transition-all hover:border-violet-400/60 hover:shadow-md active:scale-[0.98] dark:border-violet-800/40 dark:from-violet-900/20 dark:text-violet-200 dark:hover:border-violet-600/50"
              >
                <span className="tnum flex size-6 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-[10px] font-black text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                  {faNum(String(i + 1))}
                </span>
                <span className="min-w-0 flex-1 leading-5" dir="auto">{p}</span>
                <ArrowDown className="size-3.5 shrink-0 -rotate-90 text-violet-400 transition-transform group-hover:-translate-x-0.5" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
