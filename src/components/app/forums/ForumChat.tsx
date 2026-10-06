// ═══ تالار گفتمان انجمن — چت گروهی اعضا + ایجنت با @agent ═══
// همه اعضا پیام می‌بینند و می‌فرستند؛ اگر پیامی شامل @agent یا @ایجنت باشد
// ایجنت انجمن در همان گفتگو پاسخ می‌دهد (پاسخ برای همه اعضا قابل مشاهده است).
// polling سبک + نشان «ایجنت در حال پاسخ‌گویی» تا رسیدن پاسخ.
"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowRight, Bot, Check, Copy, Info, Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { get, post } from "@/lib/client/api";
import { faTime } from "@/lib/client/persian";
import { PersonAvatar } from "../social/social-ui";
import { useAppStore } from "@/lib/client/store";
import type { ForumChatMessage, ForumDetailData } from "@/lib/modules/forums/types";
import MarkdownContent from "@/components/common/MarkdownContent";

const POLL_MS = 5000;

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr);
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

export default function ForumChat({ forum }: { forum: ForumDetailData }) {
  const { user, openUserProfile } = useAppStore();
  const [messages, setMessages] = useState<ForumChatMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [agentTyping, setAgentTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);
  const lastAgentCountRef = useRef(0);

  // بارگذاری اولیه — stateهای اولیه خودشان null هستند؛ این کامپوننت
  // با key انجمن از والد mount می‌شود (forum.id در عمرش ثابت است)
  useEffect(() => {
    let active = true;
    (async () => {
      const res = await get<{ messages: ForumChatMessage[] }>(`/api/forums/${forum.id}/messages?thread=forum`);
      if (!active) return;
      if (res.success && res.data) {
        setMessages(res.data.messages);
        lastCountRef.current = res.data.messages.length;
        lastAgentCountRef.current = res.data.messages.filter((m) => m.isFromAgent).length;
      } else {
        setError(res.error || "گفتگو در دسترس نیست");
      }
    })();
    return () => {
      active = false;
    };
  }, [forum.id]);

  // اسکرول به آخر
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages?.length, agentTyping]);

  // polling — پیام‌های جدید اعضا و پاسخ ایجنت
  useEffect(() => {
    if (messages === null) return;
    const t = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const res = await get<{ messages: ForumChatMessage[] }>(`/api/forums/${forum.id}/messages?thread=forum`);
      if (res.success && res.data) {
        const list = res.data.messages;
        if (list.length !== lastCountRef.current) {
          lastCountRef.current = list.length;
          setMessages(list);
        }
        const agentCount = list.filter((m) => m.isFromAgent).length;
        if (agentCount > lastAgentCountRef.current) {
          lastAgentCountRef.current = agentCount;
          setAgentTyping(false); // پاسخ ایجنت رسید
        }
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [forum.id, messages === null]);

  const copyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1800);
    } catch { /* ignore */ }
  };

  const sendMessage = async (preset?: string) => {
    const content = (preset ?? input).trim();
    if (!content || sending || !messages) return;
    setInput("");
    setSending(true);

    const optimistic: ForumChatMessage = {
      id: `tmp-${Date.now()}`,
      thread: "FORUM",
      isFromAgent: false,
      senderId: user?.id || "me",
      senderName: user?.fullName || null,
      senderAvatarUrl: null,
      senderAvatarColor: null,
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages([...messages, optimistic]);

    const res = await post<{ message: ForumChatMessage; agentPending: boolean }>(
      `/api/forums/${forum.id}/messages`,
      { content, thread: "forum" }
    );

    if (res.success && res.data) {
      setMessages((prev) => {
        const list = (prev || []).filter((m) => m.id !== optimistic.id);
        list.push(res.data!.message);
        lastCountRef.current = list.length;
        return list;
      });
      if (res.data.agentPending) setAgentTyping(true); // ایجنت در پس‌زمینه پاسخ می‌سازد
    } else {
      setMessages((prev) => (prev || []).filter((m) => m.id !== optimistic.id));
      setInput(content);
      toast({ title: "ارسال نشد", description: res.error, variant: "destructive" });
    }
    setSending(false);
  };

  if (error) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center">
        <Info className="size-8 text-muted-foreground" />
        <p className="text-sm font-bold">{error}</p>
      </div>
    );
  }

  if (messages === null) {
    return (
      <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2.5">
            <Skeleton className="size-9 rounded-xl" />
            <Skeleton className="h-12 flex-1 rounded-2xl" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-26rem)] min-h-80 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card sm:h-[calc(100dvh-24rem)] lg:h-[calc(100dvh-19rem)]">
      {/* نوار اعلان تریگر ایجنت */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 bg-teal-500/5 px-3.5 py-2 text-[11px] text-muted-foreground">
        <Sparkles className="size-3.5 shrink-0 text-teal-500" />
        <span className="min-w-0 flex-1 truncate">
          برای فراخوانی <span className="font-bold text-teal-600 dark:text-teal-400">{forum.agent.name}</span> در همین تالار،
          در پیام خود <span className="rounded bg-teal-500/15 px-1 font-mono font-bold text-teal-600 dark:text-teal-400" dir="ltr">@agent</span> یا{" "}
          <span className="rounded bg-teal-500/15 px-1 font-bold text-teal-600 dark:text-teal-400">@ایجنت</span> بنویسید — پاسخ برای همه اعضا نمایش داده می‌شود
        </span>
        <button
          onClick={() => setInput((v) => (v ? `${v} @agent ` : "@agent "))}
          className="shrink-0 rounded-lg border border-teal-500/30 bg-teal-500/10 px-2 py-1 text-[10px] font-bold text-teal-600 transition-colors hover:bg-teal-500/20 active:scale-95 dark:text-teal-400"
        >
          درج @agent
        </button>
      </div>

      {/* پیام‌ها */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-3xl space-y-2.5 px-3 py-4 md:px-4">
          {messages.length === 0 ? (
            <div className="py-10 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <MessagesIcon />
              </div>
              <p className="mt-3 text-sm font-black">تالار گفتمان آماده است</p>
              <p className="mx-auto mt-1.5 max-w-xs text-xs leading-6 text-muted-foreground">
                اولین پیام را شما بنویسید؛ برای دریافت پاسخ هوشمند از {forum.agent.name}، @agent را فراخوانی کنید.
              </p>
            </div>
          ) : null}

          {messages.map((m, i) => {
            const day = dayLabel(m.createdAt);
            const prevDay = i > 0 ? dayLabel(messages[i - 1].createdAt) : null;
            const showDay = !!day && day !== prevDay;
            const mine = !m.isFromAgent && m.senderId === user?.id;

            return (
              <Fragment key={m.id}>
                {showDay ? (
                  <div className="flex justify-center pt-1 pb-0.5">
                    <span className="rounded-full border border-border/50 bg-accent/70 px-3 py-1 text-[10px] font-medium text-muted-foreground">
                      {day}
                    </span>
                  </div>
                ) : null}

                {m.isFromAgent ? (
                  // ─── پیام ایجنت — برای همه برجسته ───
                  <div className="flex animate-in fade-in-0 slide-in-from-bottom-2 items-start gap-2 md:gap-2.5">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-md">
                      <Bot className="size-4.5" />
                    </div>
                    <div className="flex min-w-0 max-w-[calc(100%-3rem)] flex-col md:max-w-[85%]">
                      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-black text-teal-600 dark:text-teal-400">
                        {m.senderName || forum.agent.name}
                        <span className="rounded-full bg-teal-500/15 px-1.5 py-px text-[9px] font-bold">ایجنت انجمن</span>
                      </p>
                      <div className="min-w-0 rounded-2xl rounded-bl-sm border border-teal-500/25 bg-teal-500/5 px-3.5 py-2.5">
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
                  // ─── پیام عضو — گروهی با نام و آواتار ───
                  <div className={`flex animate-in fade-in-0 slide-in-from-bottom-2 items-end gap-2 md:gap-2.5 ${mine ? "justify-end" : "justify-start"}`}>
                    {!mine ? (
                      <button
                        onClick={() => m.senderId && openUserProfile(m.senderId)}
                        aria-label={`پروفایل ${m.senderName || "عضو"}`}
                        className="shrink-0 rounded-xl transition-transform hover:scale-105 active:scale-95"
                      >
                        <PersonAvatar name={m.senderName || "ش"} color={m.senderAvatarColor} size={32} radius="xl" className="shadow-none" />
                      </button>
                    ) : null}
                    <div
                      className={`min-w-0 max-w-[calc(100%-3rem)] rounded-2xl px-3.5 py-2 md:max-w-[80%] ${
                        mine
                          ? "rounded-br-sm shahryar-gradient text-white"
                          : "rounded-bl-sm border border-border/60 bg-muted/60 text-foreground/90"
                      }`}
                    >
                      {!mine && m.senderName ? (
                        <button
                          onClick={() => m.senderId && openUserProfile(m.senderId)}
                          className="mb-1 text-[10px] font-bold text-primary hover:underline"
                          dir="auto"
                        >
                          {m.senderName}
                        </button>
                      ) : null}
                      <p className="whitespace-pre-line text-[13px] leading-6 break-words" dir="auto">{m.content}</p>
                      <p className={`mt-1 text-[10px] tnum ${mine ? "text-white/70" : "text-end text-muted-foreground"}`}>
                        {faTime(m.createdAt)}
                      </p>
                    </div>
                  </div>
                )}
              </Fragment>
            );
          })}

          {agentTyping ? (
            <div className="flex items-start gap-2 md:gap-2.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-md">
                <Bot className="size-4.5" />
              </div>
              <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-teal-500/25 bg-teal-500/5 px-4 py-3">
                <span className="typing-dot inline-block size-2 rounded-full bg-teal-500/70" />
                <span className="typing-dot inline-block size-2 rounded-full bg-teal-500/70" style={{ animationDelay: "0.15s" }} />
                <span className="typing-dot inline-block size-2 rounded-full bg-teal-500/70" style={{ animationDelay: "0.3s" }} />
                <span className="ms-1.5 text-[11px] text-muted-foreground">
                  {forum.agent.name} در حال پاسخ‌گویی…
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* ورودی */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="shrink-0 border-t border-border/60 bg-card/80 backdrop-blur-md"
      >
        <div className="mx-auto max-w-3xl px-3 py-2.5 md:px-4">
          <div className="flex items-center gap-1.5 rounded-2xl border border-border/70 bg-accent/50 p-1.5 transition-colors focus-within:border-primary/50 dark:bg-accent/30">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={2000}
              placeholder={`پیام در تالار ${forum.title}…`}
              aria-label="متن پیام تالار گفتمان"
              dir="rtl"
              className="h-11 min-w-0 flex-1 border-0 bg-transparent text-start text-sm outline-none placeholder:text-muted-foreground/60 md:h-9"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shahryar-gradient text-white shadow-md transition-all hover:brightness-110 active:scale-90 disabled:opacity-40 disabled:shadow-none md:h-10 md:w-10"
              aria-label="ارسال پیام"
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4 -scale-x-100" />}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function MessagesIcon() {
  return <Send className="size-6" />;
}
