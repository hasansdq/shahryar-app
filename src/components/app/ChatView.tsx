// ═════ چت هوشیار — دستیار هوش مصنوعی شهریار ═════
"use client";

import { useEffect, useRef, useState, useCallback, useMemo, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Send, Sparkles, Search, Brain, ImagePlus, Trash2,
  Plus, ChevronDown, MessageSquare, Globe, BadgeCheck, User,
  Paperclip, File as FileIcon, ImageIcon, X, Download, Copy, Check,
  FileText, FileSpreadsheet, FileType, Code2, FileCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import MarkdownContent from "@/components/common/MarkdownContent";
import HooshiarStages, { type StageEntry } from "@/components/app/HooshiarStages";
import { get, del, postChatStream } from "@/lib/client/api";
import { faTime, faNum, faDate } from "@/lib/client/persian";
import { uploadMedia, type MediaUploadResult } from "@/lib/client/media";
import { useAppStore, moduleConfig } from "@/lib/client/store";

type ChatMode = "chat" | "deep" | "search" | "image";

interface GeneratedFile {
  url: string;
  name: string;
  mime: string;
  size: number;
  kind: "docx" | "xlsx" | "pdf" | "csv" | "md" | "txt" | "html";
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string | null;
  searchUsed?: boolean;
  imageData?: string | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentMime?: string | null;
  generatedFiles?: GeneratedFile[] | null;
  createdAt?: string;
}

interface SessionInfo {
  id: string;
  title: string;
  mode: string;
  messageCount: number;
  updatedAt: string;
}

const MODES: Array<{ id: ChatMode; label: string; icon: typeof Bot; desc: string; gate?: string }> = [
  { id: "chat", label: "گفتگو", icon: Bot, desc: "گفتگوی صمیمانه با هوشیار" },
  { id: "deep", label: "تفکر عمیق", icon: Brain, desc: "تحلیل دقیق و چندمرحله‌ای", gate: "enableDeepThink" },
  { id: "search", label: "جستجوی وب", icon: Search, desc: "پاسخ با جدیدترین اطلاعات وب", gate: "enableWebSearch" },
  { id: "image", label: "تولید تصویر", icon: ImagePlus, desc: "ساخت تصویر از متن", gate: "enableImageGen" },
];

/** حالت‌های فعال بر اساس کانفیگ CMS — داخل کامپوننت محاسبه می‌شود تا با لود ماژول‌ها به‌روز شود */

const QUICK_PROMPTS = [
  "بهترین رستوران‌های رفسنجان کجان؟",
  "برنامه ورزشی ساده برای شروع بده",
  "تاریخچه پسته رفسنجان رو بگو",
  "چطور پس‌انداز کنم؟",
];

// ═══ فایل‌های تولیدی هوشیار — آیکون/رنگ/برچسب هر نوع ═══
const GENERATED_FILE_LABELS: Record<string, string> = {
  docx: "سند Word",
  xlsx: "صفحه گسترده Excel",
  pdf: "سند PDF",
  csv: "فایل CSV",
  md: "Markdown",
  txt: "متن ساده",
  html: "صفحه HTML",
};

function generatedFileIcon(kind: string) {
  switch (kind) {
    case "docx": return <FileText className="w-5 h-5" />;
    case "xlsx": return <FileSpreadsheet className="w-5 h-5" />;
    case "pdf": return <FileType className="w-5 h-5" />;
    case "csv": return <FileSpreadsheet className="w-5 h-5" />;
    case "html": return <Code2 className="w-5 h-5" />;
    case "md": return <FileCode className="w-5 h-5" />;
    default: return <FileIcon className="w-5 h-5" />;
  }
}

function generatedFileColor(kind: string): string {
  switch (kind) {
    case "docx": return "linear-gradient(135deg, #2B579A, #3E6DB5)";
    case "xlsx": return "linear-gradient(135deg, #1D6F42, #2E8B57)";
    case "pdf": return "linear-gradient(135deg, #C0392B, #E74C3C)";
    case "csv": return "linear-gradient(135deg, #1D6F42, #4CAF50)";
    case "html": return "linear-gradient(135deg, #E44D26, #F16529)";
    case "md": return "linear-gradient(135deg, #4756D7, #6B7AF8)";
    default: return "linear-gradient(135deg, #4756D7, #6B7AF8)";
  }
}

/** برچسب روز برای جداکنندهٔ تاریخ پیام‌ها — امروز/دیروز/تاریخ جلالی */
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
  return faDate(d);
}

export default function ChatView() {
  const { user } = useAppStore();
  // حالت‌های فعال (reactive — با بارگذاری کانفیگ CMS به‌روز می‌شود؛ fail-open قبل از لود)
  const chatConfig = useAppStore((s) => s.modules.chat?.config);
  const activeModes = useMemo(
    () => MODES.filter((m) => (m.gate ? chatConfig?.[m.gate] !== false : true)),
    [chatConfig]
  );
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<ChatMode>("chat");
  const [sending, setSending] = useState(false);
  const [sendingStartedAt, setSendingStartedAt] = useState(0);
  const [stages, setStages] = useState<StageEntry[]>([]);
  const [loadingSession, setLoadingSession] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [expandedThinking, setExpandedThinking] = useState<Record<string, boolean>>({});
  const [pendingAttachment, setPendingAttachment] = useState<MediaUploadResult | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // بارگذاری جلسات
  useEffect(() => {
    get<{ sessions: SessionInfo[] }>("/api/ai/sessions").then((res) => {
      if (res.success && res.data) setSessions(res.data.sessions);
    });
  }, []);

  // اسکرول به پایین
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const loadSession = useCallback(async (sessionId: string) => {
    setLoadingSession(true);
    setActiveSession(sessionId);
    setShowSessions(false);
    const res = await get<{ messages: ChatMessage[] }>(`/api/ai/sessions/${sessionId}`);
    if (res.success && res.data) {
      setMessages(res.data.messages);
    }
    setLoadingSession(false);
  }, []);

  const newChat = () => {
    setActiveSession(null);
    setMessages([]);
    setShowSessions(false);
    inputRef.current?.focus();
  };

  const deleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    const res = await del(`/api/ai/sessions/${sessionId}`);
    if (res.success) {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSession === sessionId) newChat();
    }
  };

  /** کپی متن پاسخ هوشیار — با fallback برای مرورگرهای بدون Clipboard API */
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

  /** انتخاب فایل برای پیوست — از موتور آپلود یکپارچه */
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // ریست برای انتخاب مجدد همان فایل
    if (!file) return;
    setUploadingAttachment(true);
    const result = await uploadMedia(file, "chat");
    setUploadingAttachment(false);
    if (result) setPendingAttachment(result);
  };

  const sendMessage = async (text?: string) => {
    const message = (text || input).trim();
    if ((!message && !pendingAttachment) || sending) return;

    const attachment = pendingAttachment;
    setInput("");
    setPendingAttachment(null);
    setSending(true);
    setStages([]);
    setSendingStartedAt(Date.now());

    // پیام کاربر به‌صورت بهینه
    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: message,
      attachmentUrl: attachment?.url,
      attachmentName: attachment?.originalName,
      attachmentMime: attachment?.mime,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    const res = await postChatStream<{ sessionId: string; reply: { content: string; thinking: string | null; searchUsed: boolean; imageData: string | null; generatedFiles?: GeneratedFile[] } }>(
      "/api/ai/chat",
      { message, sessionId: activeSession, mode, attachment: attachment ? { url: attachment.url, name: attachment.originalName, mime: attachment.mime } : undefined },
      (s) => setStages((prev) => [...prev, { ...s, at: Date.now() }])
    );

    if (res.success && res.data) {
      const { sessionId, reply } = res.data;
      setActiveSession(sessionId);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: reply.content,
          thinking: reply.thinking,
          searchUsed: reply.searchUsed,
          imageData: reply.imageData,
          generatedFiles: reply.generatedFiles || [],
          createdAt: new Date().toISOString(),
        },
      ]);
      // به‌روزرسانی لیست جلسات
      get<{ sessions: SessionInfo[] }>("/api/ai/sessions").then((r) => {
        if (r.success && r.data) setSessions(r.data.sessions);
      });
    } else {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: res.error || "خطایی رخ داد. دوباره تلاش کنید.",
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    setSending(false);
  };

  const activeMode = MODES.find((m) => m.id === mode)!;

  return (
    // موبایل: دقیقاً تا لبه‌ی ناوبری پایین (۶۰px + safe-area) — بدون نوار مرده؛ فول-بلید دسکتاپ
    <div className="flex -mb-24 h-[calc(100dvh-3.5rem-3.75rem-env(safe-area-inset-bottom))] lg:mb-0 lg:h-[calc(100dvh-2rem)]" dir="rtl">
      {/* ─── لیست گفتگوها — پنل تخت چسبیده به صفحه (دسکتاپ) ─── */}
      <div className="hidden lg:flex w-72 shrink-0 flex-col bg-card border-e border-border/60">
        <div className="p-4 border-b border-border/60">
          <Button
            onClick={newChat}
            className="w-full shahryar-gradient text-white border-0 hover:opacity-90 rounded-xl h-11 font-bold"
          >
            <Plus className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
            گفتگوی جدید
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.length === 0 && (
            <div className="text-center py-10 px-4">
              <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">هنوز گفتگویی ندارید</p>
            </div>
          )}
          {sessions.map((s) => {
            const ModeIcon = MODES.find((m) => m.id === s.mode)?.icon || Bot;
            return (
              <div
                key={s.id}
                onClick={() => loadSession(s.id)}
                className={`group flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer transition-colors ${
                  activeSession === s.id
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/60"
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <ModeIcon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {faNum(s.messageCount)} پیام · {faTime(s.updatedAt)}
                  </p>
                </div>
                <button
                  onClick={(e) => deleteSession(e, s.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1.5 rounded-lg hover:bg-destructive/10"
                  title="حذف گفتگو"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── ناحیه گفتگو — تمام‌صفحه، جزئی از خود صفحه ─── */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {/* هدر — موبایل: ردیف جمع‌وجور + نوار پیل حالت‌ها / دسکتاپ: تک‌ردیف آیکونی */}
        <div className="shrink-0 bg-card/70 backdrop-blur-md border-b border-border/60 z-10">
          <div className="flex items-center gap-2 lg:gap-3 px-3 lg:px-6 h-14 lg:h-auto py-2 lg:py-3">
            {/* گفتگوهای من (موبایل) — با شمارندهٔ جلسات */}
            <button
              onClick={() => setShowSessions(!showSessions)}
              className="lg:hidden relative p-2 -mr-1 rounded-xl hover:bg-accent transition-colors"
              aria-label="گفتگوهای من"
            >
              <MessageSquare className="w-5 h-5" />
              {sessions.length > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 rounded-full shahryar-gradient text-white text-[9px] font-bold flex items-center justify-center tnum leading-none">
                  {faNum(Math.min(sessions.length, 99))}
                </span>
              )}
            </button>

            <div className="w-10 h-10 lg:w-11 lg:h-11 rounded-2xl shahryar-gradient flex items-center justify-center shadow-md shrink-0">
              <Bot className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="font-black text-base lg:text-lg">هوشیار</h2>
                <BadgeCheck className="w-4 h-4 text-primary shrink-0" />
                <span className="lg:hidden flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  آنلاین
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">{activeMode.desc}</p>
            </div>

            {/* انتخاب حالت — دسکتاپ: آیکونی همان چیدمان قبلی */}
            <div className="hidden lg:flex gap-1 bg-accent/60 rounded-xl p-1 shrink-0">
              {activeModes.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  title={m.label}
                  className={`p-2 rounded-lg transition-all ${
                    mode === m.id ? "shahryar-gradient text-white shadow" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <m.icon className="w-4 h-4" />
                </button>
              ))}
            </div>

            {/* گفتگوی جدید (موبایل) */}
            <button
              onClick={newChat}
              className="lg:hidden p-2 -ml-1 rounded-xl hover:bg-accent transition-colors"
              aria-label="گفتگوی جدید"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* نوار حالت‌ها (موبایل) — پیل‌های لیبل‌دار اسکرول‌شونده */}
          <div className="lg:hidden px-3 pb-2">
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {activeModes.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border transition-all active:scale-95 ${
                    mode === m.id
                      ? "shahryar-gradient text-white border-transparent shadow"
                      : "bg-card border-border/70 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  <m.icon className="w-3.5 h-3.5" />
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* پیام‌ها — ستون خوانا؛ حالت خالی واقعاً وسط‌چین */}
        <div className="flex-1 overflow-y-auto overscroll-contain flex flex-col">
          <div className="mx-auto w-full max-w-3xl flex-1 flex flex-col px-3.5 md:px-4 py-4 md:py-5">
          {loadingSession ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-2/3 rounded-2xl" />
              <Skeleton className="h-24 w-3/4 rounded-2xl mr-auto" />
              <Skeleton className="h-12 w-1/2 rounded-2xl" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyChat userName={user?.fullName?.split(" ")[0]} onPrompt={(p) => sendMessage(p)} mode={mode} />
            </div>
          ) : (
            <div className="space-y-3 md:space-y-4">
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => {
                const day = dayLabel(msg.createdAt);
                const prevDay = i > 0 ? dayLabel(messages[i - 1].createdAt) : null;
                const showDay = !!day && day !== prevDay;
                return (
                  <Fragment key={msg.id}>
                    {showDay && (
                      <div className="flex justify-center pt-1 pb-0.5">
                        <span className="text-[10px] font-medium text-muted-foreground bg-accent/70 border border-border/50 rounded-full px-3 py-1">
                          {day}
                        </span>
                      </div>
                    )}
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-2 md:gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                    >
                      {msg.role === "assistant" ? (
                        <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl shahryar-gradient flex items-center justify-center shrink-0 mt-0.5 shadow-md">
                          <Bot className="w-4 h-4 md:w-5 md:h-5 text-white" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                          <User className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
                        </div>
                      )}

                      <div className={`flex flex-col min-w-0 max-w-[calc(100%-2.5rem)] md:max-w-[75%] ${msg.role === "user" ? "items-start" : "items-end"}`}>
                        {/* نشانگر جستجو */}
                        {msg.searchUsed && (
                          <div className="flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5 mb-1.5">
                            <Globe className="w-3 h-3" />
                            پاسخ با جستجوی وب
                          </div>
                        )}

                        {/* تفکر عمیق */}
                        {msg.thinking && (
                          <button
                            onClick={() => setExpandedThinking((p) => ({ ...p, [msg.id]: !p[msg.id] }))}
                            className="flex items-center gap-1 text-[10px] font-medium text-violet-600 dark:text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-full px-2 py-0.5 mb-1.5 active:scale-95 transition-transform"
                          >
                            <Brain className="w-3 h-3" />
                            فرآیند تفکر
                            <ChevronDown className={`w-3 h-3 transition-transform ${expandedThinking[msg.id] ? "rotate-180" : ""}`} />
                          </button>
                        )}
                        {msg.thinking && expandedThinking[msg.id] && (
                          <div className="text-xs text-muted-foreground bg-violet-50 dark:bg-violet-950/30 border border-violet-200/50 dark:border-violet-900/50 rounded-xl p-3 mb-2 leading-relaxed whitespace-pre-wrap">
                            {msg.thinking}
                          </div>
                        )}

                        {/* حباب پیام */}
                        <div
                          className={`rounded-2xl px-3.5 md:px-4 py-2.5 md:py-3 text-sm leading-loose ${
                            msg.role === "user"
                              ? "shahryar-gradient text-white rounded-tr-md"
                              : "bg-accent/70 rounded-tl-md"
                          }`}
                        >
                          {msg.role === "assistant" ? (
                            <MarkdownContent content={msg.content} />
                          ) : (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          )}
                        </div>

                        {/* پیوست کاربر */}
                        {msg.role === "user" && msg.attachmentUrl && (
                          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-2">
                            {msg.attachmentMime?.startsWith("image/") ? (
                              <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="block group relative">
                                { }
                                <img
                                  src={msg.attachmentUrl}
                                  alt={msg.attachmentName || "تصویر پیوست"}
                                  className="rounded-2xl border border-border/60 max-w-[16rem] shadow-md group-hover:brightness-105 transition-all"
                                />
                                <span className="absolute bottom-2 right-2 bg-black/55 text-white text-[10px] px-2 py-1 rounded-lg backdrop-blur-sm flex items-center gap-1">
                                  <ImageIcon className="w-3 h-3" />
                                  {msg.attachmentName}
                                </span>
                              </a>
                            ) : (
                              <a
                                href={msg.attachmentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2.5 bg-card border border-border/60 rounded-2xl p-3 hover:border-primary/50 transition-all shadow-sm group"
                              >
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                  <FileIcon className="w-5 h-5 text-primary" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold truncate group-hover:text-primary transition-colors">{msg.attachmentName}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">مشاهده و دانلود فایل</p>
                                </div>
                                <Download className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                              </a>
                            )}
                          </motion.div>
                        )}

                        {/* فایل‌های تولیدی هوشیار — کارت دانلود */}
                        {msg.role === "assistant" && msg.generatedFiles && msg.generatedFiles.length > 0 && (
                          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-2 w-full space-y-2">
                            {msg.generatedFiles.map((f) => {
                              const icon = generatedFileIcon(f.kind);
                              const label = GENERATED_FILE_LABELS[f.kind] || "فایل";
                              return (
                                <div
                                  key={f.url}
                                  className="flex items-center gap-3 bg-card border border-primary/25 rounded-2xl p-3 shadow-sm hover:border-primary/50 hover:shadow-md transition-all group"
                                >
                                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-white shadow-md" style={{ background: generatedFileColor(f.kind) }}>
                                    {icon}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold truncate">{f.name}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5 tnum">
                                      {label} · {(f.size / 1024).toFixed(0).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d])} کیلوبایت · ساخته‌شده توسط هوشیار
                                    </p>
                                  </div>
                                  <a
                                    href={`${f.url}?name=${encodeURIComponent(f.name)}`}
                                    download={f.name}
                                    className="shrink-0 h-10 px-4 rounded-xl shahryar-gradient text-white flex items-center gap-1.5 text-xs font-bold shadow-md hover:brightness-110 active:scale-95 transition-all"
                                  >
                                    <Download className="w-4 h-4" />
                                    دانلود
                                  </a>
                                </div>
                              );
                            })}
                          </motion.div>
                        )}

                        {/* تصویر تولیدی */}
                        {msg.imageData && (
                          <motion.img
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            src={`data:image/png;base64,${msg.imageData}`}
                            alt="تصویر تولیدشده توسط هوشیار"
                            className="mt-2 rounded-2xl border border-border/60 max-w-full shadow-md"
                          />
                        )}

                        {/* متادیتای پیام — ساعت + کپی پاسخ */}
                        <div className={`flex items-center gap-2 mt-1 px-1 ${msg.role === "user" ? "self-start" : "self-end"}`}>
                          {msg.createdAt && (
                            <span className="text-[10px] text-muted-foreground/80 tnum">{faTime(msg.createdAt)}</span>
                          )}
                          {msg.role === "assistant" && msg.content && (
                            <button
                              onClick={() => copyMessage(msg.id, msg.content)}
                              className="flex items-center gap-1 text-[10px] text-muted-foreground/70 hover:text-foreground transition-colors"
                              title="کپی متن پاسخ"
                            >
                              {copiedId === msg.id ? (
                                <><Check className="w-3 h-3 text-emerald-500" />کپی شد</>
                              ) : (
                                <><Copy className="w-3 h-3" />کپی</>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </Fragment>
                );
              })}
            </AnimatePresence>
            </div>
          )}

          {/* در حال تایپ — نمایش مرحله‌به‌مرحله کارهای هوشیار */}
          {sending && (
            <HooshiarStages stages={stages} mode={mode} startedAt={sendingStartedAt} />
          )}
          <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ورودی پیام — کامپوزر یکپارچهٔ مدرن (کلیپ + اینپوت + ارسال در یک کانتینر) */}
        <div className="shrink-0 border-t border-border/60 bg-card/80 backdrop-blur-md">
          <div className="mx-auto max-w-3xl px-3 md:px-4 py-2.5 md:py-3">
          {/* پیش‌نمایش پیوست انتخاب‌شده */}
          <AnimatePresence>
            {pendingAttachment && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-2"
              >
                <div className="flex items-center gap-2.5 bg-accent/60 border border-border/60 rounded-2xl p-2">
                  {pendingAttachment.mime.startsWith("image/") ? (
                     
                    <img
                      src={pendingAttachment.url}
                      alt={pendingAttachment.originalName}
                      className="w-11 h-11 rounded-xl object-cover border border-border/60"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <FileIcon className="w-5 h-5 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{pendingAttachment.originalName}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 tnum">
                      آماده ارسال · {(pendingAttachment.size / 1024).toFixed(0).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d])} کیلوبایت
                    </p>
                  </div>
                  <button
                    onClick={() => setPendingAttachment(null)}
                    className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="حذف پیوست"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-1 bg-accent/50 dark:bg-accent/30 border border-border/70 focus-within:border-primary/50 rounded-2xl p-1.5 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              accept=".png,.jpg,.jpeg,.webp,.gif,.avif,.pdf,.docx,.xlsx,.xls,.txt,.md,.mdx,.csv,.tsv,.json,.xml,.html,.htm,.log,.yml,.yaml,.toml,.ini,.env,.js,.jsx,.mjs,.cjs,.ts,.tsx,.css,.scss,.sass,.less,.vue,.svelte,.astro,.py,.ipynb,.rb,.go,.rs,.zig,.java,.kt,.scala,.groovy,.c,.h,.cpp,.hpp,.cs,.m,.mm,.swift,.dart,.php,.pl,.lua,.ex,.erl,.hs,.clj,.sh,.bash,.zsh,.bat,.cmd,.ps1,.sql,.graphql,.gql,.prisma,.tf,.proto,.dockerfile,.makefile"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || uploadingAttachment}
              className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-accent active:scale-90 transition-all disabled:opacity-50"
              title="پیوست فایل — هوشیار می‌خواند: تصویر، PDF، Word (docx)، Excel، متن و کد"
              aria-label="پیوست فایل"
            >
              {uploadingAttachment ? (
                <span className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              ) : (
                <Paperclip className="w-5 h-5" />
              )}
            </button>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={
                pendingAttachment
                  ? "پیامی برای همراه فایل بنویسید (اختیاری)..."
                  : mode === "image"
                  ? "تصویری که می‌خواهید را توصیف کنید..."
                  : `از هوشیار بپرسید... (${activeMode.label})`
              }
              aria-label="پیام شما"
              className="flex-1 min-w-0 h-10 bg-transparent border-0 outline-none text-sm text-start placeholder:text-muted-foreground/60 disabled:opacity-50"
              disabled={sending}
              autoComplete="off"
            />
            <button
              onClick={() => sendMessage()}
              disabled={sending || (!input.trim() && !pendingAttachment)}
              className="h-10 w-10 shrink-0 rounded-xl shahryar-gradient text-white flex items-center justify-center shadow-md hover:brightness-110 active:scale-90 transition-all disabled:opacity-40 disabled:shadow-none disabled:hover:brightness-100"
              aria-label="ارسال پیام"
            >
              <Send className="w-5 h-5 -scale-x-100" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground/80 text-center mt-2 px-2 leading-relaxed">
            هوشیار می‌تواند اشتباه کند؛ اطلاعات مهم را راستی‌آزمایی کنید
          </p>
          </div>
        </div>
      </div>

      {/* ─── درایور لیست جلسات موبایل — شیت حرفه‌ای با دستگیره و متادیتای کامل ─── */}
      <AnimatePresence>
        {showSessions && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSessions(false)}
              className="lg:hidden fixed inset-0 bg-black/40 z-[54]"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28 }}
              className="lg:hidden fixed bottom-0 inset-x-0 z-[55] bg-card rounded-t-3xl border-t border-border shadow-2xl max-h-[78vh] flex flex-col pb-[env(safe-area-inset-bottom)]"
            >
              {/* دستگیره */}
              <div className="pt-2.5 pb-1 flex justify-center shrink-0">
                <div className="w-10 h-1.5 rounded-full bg-border" />
              </div>
              <div className="px-4 py-2 flex items-center gap-2 border-b border-border/60 shrink-0">
                <h3 className="font-bold text-base flex-1">گفتگوهای من</h3>
                {sessions.length > 0 && (
                  <span className="text-[10px] font-bold tnum text-muted-foreground bg-accent rounded-full px-2 py-0.5">
                    {faNum(sessions.length)}
                  </span>
                )}
                <Button size="sm" onClick={newChat} className="shahryar-gradient text-white border-0 rounded-lg h-8 px-3">
                  <Plus className="w-4 h-4" />
                  جدید
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowSessions(false)} className="h-8">
                  بستن
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto overscroll-contain p-2 space-y-1">
                {sessions.map((s) => {
                  const ModeIcon = MODES.find((m) => m.id === s.mode)?.icon || Bot;
                  return (
                    <div
                      key={s.id}
                      onClick={() => loadSession(s.id)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer border transition-colors ${
                        activeSession === s.id
                          ? "bg-accent border-primary/30"
                          : "border-transparent hover:bg-accent/60 active:bg-accent"
                      }`}
                    >
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <ModeIcon className="w-4.5 h-4.5 text-primary" style={{ width: 18, height: 18 }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {MODES.find((m) => m.id === s.mode)?.label || "گفتگو"} · {faTime(s.updatedAt)} · {faNum(s.messageCount)} پیام
                        </p>
                      </div>
                      <button
                        onClick={(e) => deleteSession(e, s.id)}
                        className="text-muted-foreground/60 hover:text-destructive p-2 rounded-lg hover:bg-destructive/10 transition-colors"
                        title="حذف گفتگو"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
                {sessions.length === 0 && (
                  <div className="text-center py-10 px-4">
                    <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">گفتگویی وجود ندارد</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═════ حالت خالی چت ═════
function EmptyChat({ userName, onPrompt, mode }: { userName?: string; onPrompt: (p: string) => void; mode: ChatMode }) {
  return (
    <div className="w-full flex flex-col items-center text-center px-2 py-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-16 h-16 md:w-20 md:h-20 rounded-3xl shahryar-gradient flex items-center justify-center shadow-xl mb-4 animate-float relative"
      >
        <Bot className="w-8 h-8 md:w-10 md:h-10 text-white" />
        <span className="absolute inset-0 rounded-3xl bg-primary/20 animate-pulse-ring" />
      </motion.div>
      <h3 className="text-lg md:text-xl font-black">
        سلام {userName || "رفیق"}! من هوشیارم
      </h3>
      <p className="text-muted-foreground text-sm mt-2 max-w-md leading-relaxed">
        {mode === "image"
          ? "تصویری که در ذهنت هست را برام توصیف کن تا برات بسازمش"
          : mode === "deep"
          ? "سوال عمیقت رو بپرس تا با دقت بهش فکر کنم و کامل تحلیل کنم"
          : mode === "search"
          ? "هر چیزی که می‌خوای بدونی رو بپرس، تازه‌ترین اطلاعات وب رو برات پیدا می‌کنم"
          : "رفیق همراهت در رفسنجان! از اصناف شهر گرفته تا برنامه‌ریزی اهدافت، هر چی بخوای باهام در میونه"}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6 w-full max-w-lg">
        {QUICK_PROMPTS.map((p, i) => (
          <motion.button
            key={p}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.08 }}
            onClick={() => onPrompt(p)}
            className="text-right border border-border/70 rounded-xl px-3.5 py-2.5 text-sm hover:border-primary hover:bg-accent/50 transition-all flex items-center gap-2 group active:scale-[0.98]"
          >
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <span className="group-hover:text-primary transition-colors">{p}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
