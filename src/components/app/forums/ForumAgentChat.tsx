// ═══ ایجنت انجمن — گفتگوی خصوصی ۱:۱ با دانش کامل انجمن ═══
// بازطراحی حرفه‌ای چندلول:
//  • هر کاربر (عضو یا مهمان) ترد خصوصی اختصاصی خودش را دارد — تردها
//    هرگز با هم مخلوط نمی‌شوند و هرگز تردهای دیگران دیده نمی‌شود
//  • هدر کارت: هویت ایجنت + وضعیت زنده + دکمه بازنشانی گفتگو
//  • حباب‌های متمایز + جداکننده تاریخ + ساعت + کپی پاسخ‌ها
//  • معرفی هیرو با سؤال‌های لمسی تمام-عرض (عضو: مشاوره / مهمان: معرفی)
//  • نوار حالت مهمان — پرامپت‌های معرفی‌محور حفظ شده است
import { Fragment, useEffect, useRef, useState } from "react";
import {
  ArrowDown, Bot, Check, Copy, Loader2, RotateCcw, Send, ShieldCheck, Sparkles, Info,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import AppDialog from "@/components/ui/app-dialog";
import { toast } from "@/hooks/use-toast";
import { del, get, post } from "@/lib/client/api";
import { faNum, faTime } from "@/lib/client/persian";
import { useAppStore } from "@/lib/client/store";
import type { ForumChatMessage, ForumDetailData } from "@/lib/modules/forums/types";
import MarkdownContent from "@/components/common/MarkdownContent";

const DEFAULT_PROMPTS = [
  "این انجمن چه هدفی دارد؟",
  "اعضای انجمن را معرفی کن",
  "رویدادهای پیش‌روی انجمن چیست؟",
  "چطور می‌توانم در انجمن فعال باشم؟",
];

// پرامپت‌های پیشنهادی مهمان — معرفی‌محور (اهداف، فعالیت‌ها، مسیر عضویت)
const GUEST_PROMPTS = [
  "این انجمن چه هدفی دارد؟",
  "فعالیت‌های انجمن را معرفی کن",
  "رویدادهای پیش‌روی انجمن چیست؟",
  "چطور می‌توانم عضو این انجمن شوم؟",
];

/** برچسب روز برای جداکنندهٔ تاریخ (امروز/دیروز/تاریخ جلالی) */
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

export default function ForumAgentChat({ forum }: { forum: ForumDetailData }) {
  const { user } = useAppStore();
  // مهمان = غیرعضو انجمن عمومی — تجربه معرفی (پرزنت اهداف و فعالیت‌ها)
  const isGuest = !forum.isMember;
  const prompts = isGuest ? GUEST_PROMPTS : DEFAULT_PROMPTS;
  const [messages, setMessages] = useState<ForumChatMessage[] | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);

  useEffect(() => {
    let active = true;
    (async () => {
      // ترد خصوصی من با ایجنت انجمن (عضو و مهمان یکسان)
      const res = await get<{ messages: ForumChatMessage[] }>(`/api/forums/${forum.id}/messages?thread=agent`);
      if (!active) return;
      if (res.success && res.data) setMessages(res.data.messages);
      else if (res.error) toast({ title: "خطا", description: res.error, variant: "destructive" });
    })();
    return () => {
      active = false;
    };
  }, [forum.id]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && nearBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages?.length, sending]);

  const copyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1800);
    } catch { /* ignore */ }
  };

  const send = async (preset?: string) => {
    const content = (preset ?? input).trim();
    if (!content || sending || messages === null) return;
    setInput("");
    setSending(true);
    nearBottomRef.current = true;

    const optimistic: ForumChatMessage = {
      id: `tmp-${Date.now()}`,
      thread: "AGENT",
      isFromAgent: false,
      senderId: user?.id || "me",
      senderName: user?.fullName || null,
      senderAvatarUrl: null,
      senderAvatarColor: null,
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages([...messages, optimistic]);

    const res = await post<{
      message: ForumChatMessage;
      agentReply: { id: string; content: string } | null;
    }>(`/api/forums/${forum.id}/messages`, { content, thread: "agent" });

    if (res.success && res.data) {
      const base = [...(messages || [])];
      const list: ForumChatMessage[] = base.filter((m) => m.id !== optimistic.id);
      list.push(res.data.message);
      if (res.data.agentReply) {
        list.push({
          id: res.data.agentReply.id,
          thread: "AGENT",
          isFromAgent: true,
          senderId: null,
          senderName: forum.agent.name,
          senderAvatarUrl: null,
          senderAvatarColor: null,
          content: res.data.agentReply.content,
          createdAt: new Date().toISOString(),
        });
      }
      setMessages(list);
    } else {
      setMessages((prev) => (prev || []).filter((m) => m.id !== optimistic.id));
      setInput(content);
      toast({ title: "ارسال نشد", description: res.error, variant: "destructive" });
    }
    setSending(false);
  };

  /** بازنشانی گفتگوی خصوصی من با ایجنت انجمن */
  const resetChat = async () => {
    if (resetting) return;
    setResetting(true);
    const res = await del<{ deletedMessages: number }>(`/api/forums/${forum.id}/messages?thread=agent`);
    setResetting(false);
    if (res.success) {
      setMessages([]);
      setResetOpen(false);
      toast({
        title: "گفتگو بازنشانی شد",
        description: `${faNum(String(res.data?.deletedMessages || 0))} پیام حذف شد — گفتگوی تازه را شروع کنید`,
      });
    } else {
      toast({ title: "بازنشانی نشد", description: res.error, variant: "destructive" });
    }
  };

  if (messages === null) {
    return (
      <div className="space-y-3 rounded-3xl border border-border/60 bg-card p-4">
        <div className="mx-auto max-w-md space-y-3 py-6 text-center">
          <Skeleton className="mx-auto size-14 rounded-2xl" />
          <Skeleton className="mx-auto h-4 w-40 rounded-lg" />
          <Skeleton className="mx-auto h-3 w-64 rounded-lg" />
        </div>
      </div>
    );
  }

  const canReset = messages.length > 0;
  const knowledgeCount = forum.agent.knowledgeCount || 0;

  return (
    <div className="flex h-[calc(100dvh-24rem)] min-h-[26rem] flex-col overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm sm:h-[calc(100dvh-22rem)] lg:h-[calc(100dvh-17rem)] lg:min-h-[32rem]" dir="rtl">
      {/* ═══ هدر کارت چت — هویت ایجنت + وضعیت + بازنشانی ═══ */}
      <div className="relative shrink-0 overflow-hidden bg-gradient-to-l from-teal-600 via-teal-600 to-cyan-700 text-white shadow-md">
        <div aria-hidden className="pattern-dots absolute inset-0 opacity-20" />
        <div aria-hidden className="absolute -top-10 start-8 size-28 rounded-full bg-white/15 blur-2xl" />
        <div aria-hidden className="absolute -bottom-12 end-8 size-28 rounded-full bg-cyan-300/20 blur-2xl" />
        <div className="relative flex items-center gap-3 px-4 py-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-white/30 bg-white/20 shadow-lg backdrop-blur-md md:size-12">
            <Bot className="size-5 md:size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-[15px] font-black leading-6" dir="auto">{forum.agent.name}</p>
              {isGuest ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/25 bg-white/15 px-2 py-0.5 text-[9.5px] font-bold backdrop-blur-md">
                  <Sparkles className="size-3" />
                  حالت معرفی
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] leading-4 text-white/85">
              <span className="relative flex size-1.5 shrink-0">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-300" />
              </span>
              گفتگوی خصوصی شما · {knowledgeCount > 0 ? `${faNum(String(knowledgeCount))} منبع دانش` : "دانش انجمن"}
            </p>
          </div>
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

      {/* نوار حالت مهمان — معرفی انجمن برای غیرعضو */}
      {isGuest ? (
        <div className="flex shrink-0 items-start gap-2 border-b border-teal-500/20 bg-gradient-to-l from-teal-500/10 to-transparent px-3.5 py-2 text-[10.5px] leading-5 text-teal-700 dark:text-teal-300">
          <ShieldCheck className="size-4 shrink-0" />
          <p>
            ایجنت انجمن، اهداف و فعالیت‌های انجمن را برایتان پرزنت می‌کند؛ برای مشارکت کامل، از دکمه «درخواست
            عضویت» در بالای صفحه اقدام کنید.
          </p>
        </div>
      ) : null}

      {/* ═══ پیام‌ها ═══ */}
      <div className="relative min-h-0 flex-1">
        {messages.length === 0 ? (
          <div className="h-full overflow-y-auto">
            {/* معرفی ایجنت — کارت هیرو */}
            <div className="relative mx-auto my-6 max-w-md overflow-hidden rounded-3xl border border-teal-500/25 bg-card p-5 text-center shadow-sm sm:p-6">
              <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-16 h-32 bg-gradient-to-b from-teal-500/15 to-transparent blur-2xl" />
              <div aria-hidden className="pointer-events-none absolute -start-10 -bottom-10 size-32 rounded-full bg-cyan-500/10 blur-2xl" />
              <div className="relative">
                <div className="mx-auto w-fit">
                  <span className="absolute inset-0 animate-ping rounded-3xl bg-teal-400/20 [animation-duration:2.5s]" />
                  <div className="relative flex size-16 animate-in zoom-in-50 items-center justify-center rounded-3xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/30">
                    <Bot className="size-8" />
                  </div>
                </div>
                <p className="mt-3.5 text-base font-black">{forum.agent.name}</p>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">
                  {forum.agent.greeting ||
                    (isGuest
                      ? `سلام! من ایجنت رسمی انجمن «${forum.title}» هستم؛ اهداف، فعالیت‌ها و رویدادهای انجمن را برایتان پرزنت می‌کنم — هرچه می‌خواهید بدانید بپرسید.`
                      : `من ایجنت رسمی انجمن «${forum.title}» هستم؛ انجمن و اعضایش را می‌شناسم و بر اساس دانش انجمن پاسخ می‌دهم.`)}
                  {knowledgeCount > 0 ? ` (${faNum(String(knowledgeCount))} منبع دانش دارم)` : ""}
                </p>
                <div className="mt-5 space-y-2 text-start">
                  <p className="text-[10.5px] font-bold text-muted-foreground">برای شروع، یکی از این‌ها را بپرس:</p>
                  {prompts.map((p, i) => (
                    <button
                      key={p}
                      onClick={() => send(p)}
                      className="group flex w-full items-center gap-2.5 rounded-2xl border border-teal-500/30 bg-gradient-to-l from-teal-500/10 to-transparent px-3.5 py-3 text-start text-xs font-bold text-teal-800 transition-all hover:border-teal-500/60 hover:shadow-md active:scale-[0.98] dark:text-teal-200 dark:hover:border-teal-400/40"
                    >
                      <span className="tnum flex size-6 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-[10px] font-black text-teal-700 dark:bg-teal-900/50 dark:text-teal-300">
                        {faNum(String(i + 1))}
                      </span>
                      <span className="min-w-0 flex-1 leading-5" dir="auto">{p}</span>
                      <ArrowDown className="size-3.5 shrink-0 -rotate-90 text-teal-500 transition-transform group-hover:-translate-x-0.5" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div
              ref={scrollRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 220;
                nearBottomRef.current = nearBottom;
                setShowJump(!nearBottom && messages.length > 3);
              }}
              className="h-full overflow-y-auto overscroll-contain"
            >
              <div className="mx-auto max-w-3xl space-y-2.5 px-3 py-4 md:space-y-3 md:px-4">
                {messages.map((m, idx) => (
                  <Fragment key={m.id}>
                    {(() => {
                      const day = dayLabel(m.createdAt);
                      const prevDay = idx > 0 ? dayLabel(messages[idx - 1].createdAt) : null;
                      const showDay = !!day && day !== prevDay;
                      return showDay ? (
                        <div className="flex items-center justify-center gap-3 pt-1 pb-0.5">
                          <div aria-hidden className="h-px flex-1 bg-gradient-to-l from-transparent to-border" />
                          <span className="rounded-full border border-border/50 bg-accent/70 px-3 py-1 text-[10px] font-medium text-muted-foreground">{day}</span>
                          <div aria-hidden className="h-px flex-1 bg-gradient-to-r from-transparent to-border" />
                        </div>
                      ) : null;
                    })()}
                    {m.isFromAgent ? (
                      <div className="flex animate-in fade-in-0 slide-in-from-bottom-2 items-start gap-2 md:gap-2.5">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-md">
                          <Bot className="size-4.5" />
                        </div>
                        <div className="group flex min-w-0 max-w-[calc(100%-3rem)] flex-col md:max-w-[85%]">
                          <div className="min-w-0 rounded-2xl rounded-bl-sm border border-teal-500/25 bg-teal-500/5 px-3.5 py-2.5 dark:border-teal-700/30 dark:bg-teal-900/15">
                            <MarkdownContent content={m.content} className="text-[13px] leading-7" />
                          </div>
                          <div className="mt-1 flex items-center gap-2 px-1">
                            <span className="text-[10px] text-muted-foreground/80 tnum">{faTime(m.createdAt)}</span>
                            <button
                              onClick={() => copyMessage(m.id, m.content)}
                              className="flex items-center gap-1 text-[10px] text-muted-foreground/70 transition-colors hover:text-foreground active:scale-95"
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
                    ) : (
                      <div className="flex animate-in fade-in-0 slide-in-from-bottom-2 justify-end">
                        <div className="min-w-0 max-w-[calc(100%-3rem)] rounded-2xl rounded-br-sm shahryar-gradient px-3.5 py-2 text-white md:max-w-[80%]">
                          <p className="whitespace-pre-line text-[13px] leading-6 break-words" dir="auto">{m.content}</p>
                          <p className="mt-1 text-end text-[10px] text-white/70 tnum">{faTime(m.createdAt)}</p>
                        </div>
                      </div>
                    )}
                  </Fragment>
                ))}

                {sending ? (
                  <div className="flex items-start gap-2 md:gap-2.5">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-md">
                      <Bot className="size-4.5" />
                    </div>
                    <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-teal-500/25 bg-teal-500/5 px-4 py-3 dark:border-teal-700/30 dark:bg-teal-900/15">
                      <span className="typing-dot inline-block size-2 rounded-full bg-teal-500/70" />
                      <span className="typing-dot inline-block size-2 rounded-full bg-teal-500/70" style={{ animationDelay: "0.15s" }} />
                      <span className="typing-dot inline-block size-2 rounded-full bg-teal-500/70" style={{ animationDelay: "0.3s" }} />
                      <span className="ms-1.5 text-[11px] text-muted-foreground">در حال پاسخ‌گویی…</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

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
          </>
        )}
      </div>

      {/* ═══ ورودی ═══ */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="shrink-0 border-t border-border/60 bg-card/80 backdrop-blur-md"
      >
        <div className="mx-auto max-w-3xl px-3 py-2.5 md:px-4">
          <div className="flex items-center gap-1.5 rounded-2xl border border-border/70 bg-accent/50 p-1.5 transition-colors focus-within:border-teal-500/50 dark:bg-accent/30">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={2000}
              placeholder={isGuest ? `از ${forum.agent.name} درباره انجمن بپرس…` : `از ${forum.agent.name} بپرس…`}
              aria-label="پرسش از ایجنت انجمن"
              dir="rtl"
              className="h-11 min-w-0 flex-1 border-0 bg-transparent text-start text-sm outline-none placeholder:text-muted-foreground/60 md:h-9"
            />
            {input.length > 1800 ? (
              <span className="shrink-0 text-[10px] text-muted-foreground tnum">{faNum(String(2000 - input.length))}</span>
            ) : null}
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-md transition-all hover:brightness-110 active:scale-90 disabled:opacity-40 disabled:shadow-none md:h-10 md:w-10"
              aria-label="ارسال پرسش"
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4 -scale-x-100" />}
            </button>
          </div>
          <p className="mt-1.5 flex items-center gap-1 px-1 text-[10px] leading-4 text-muted-foreground/70">
            <Sparkles className="size-3 shrink-0 text-teal-500" />
            {isGuest
              ? "پاسخ‌ها بر اساس دانش و اطلاعات عمومی انجمن است؛ گفتگوی شما برای رئیس انجمن به‌عنوان لید ثبت می‌شود"
              : "پاسخ‌ها بر اساس دانش انجمن و اطلاعات اعضاست؛ گفتگوی شما خصوصی است و فقط رئیس انجمن آن را می‌بیند"}
          </p>
        </div>
      </form>

      {/* ═══ دیالوگ تأیید بازنشانی گفتگو ═══ */}
      <AppDialog
        open={resetOpen}
        onClose={() => !resetting && setResetOpen(false)}
        title="بازنشانی گفتگو"
        description="تمام پیام‌های گفتگوی خصوصی شما با ایجنت انجمن برای همیشه حذف می‌شود. این کار قابل بازگشت نیست."
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
              onClick={resetChat}
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
            {faNum(String(messages.length))} پیام این گفتگو حذف خواهد شد و گفتگو با پرامپت‌های پیشنهادی از نو
            شروع می‌شود.
          </p>
        </div>
      </AppDialog>
    </div>
  );
}
