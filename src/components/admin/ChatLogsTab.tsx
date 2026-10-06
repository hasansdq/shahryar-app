// ═════ لاگ گفتگوهای هوشیار ═════
"use client";

import { useEffect, useState, useCallback } from "react";
import { MessageSquare, Search, ChevronLeft, ChevronRight, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import AppDialog from "@/components/ui/app-dialog";
import { get } from "@/lib/client/api";
import { faNum, faRelative, faDateTime, avatarColor, maskPhone } from "@/lib/client/persian";

interface SessionRow {
  id: string; title: string; mode: string; messageCount: number;
  updatedAt: string; createdAt: string;
  user: { fullName: string | null; phone: string; avatarColor: string };
  messagesCount: number;
}
interface MessageDetail {
  id: string; role: string; content: string; thinking: string | null;
  searchUsed: boolean; imageData: string | null; createdAt: string;
}

const MODE_LABELS: Record<string, string> = {
  chat: "گفتگو", deep: "تفکر عمیق", search: "جستجوی وب", image: "تولید تصویر",
};
const MODE_COLORS: Record<string, string> = {
  chat: "bg-blue-500/15 text-blue-400",
  deep: "bg-violet-500/15 text-violet-400",
  search: "bg-amber-500/15 text-amber-400",
  image: "bg-pink-500/15 text-pink-400",
};

export default function ChatLogsTab() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modeFilter, setModeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [messages, setMessages] = useState<MessageDetail[] | null>(null);
  const [detailTitle, setDetailTitle] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "15" });
    if (modeFilter !== "all") params.set("mode", modeFilter);
    const res = await get<{ sessions: SessionRow[]; pagination: { total: number; totalPages: number } }>(
      `/api/admin/chat-logs?${params}`
    );
    if (res.success && res.data) {
      setSessions(res.data.sessions);
      setTotalPages(res.data.pagination.totalPages);
      setTotal(res.data.pagination.total);
    }
    setLoading(false);
  }, [page, modeFilter]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const openSession = async (s: SessionRow) => {
    setDetailLoading(true);
    setDetailTitle(s.title);
    setMessages(null);
    const res = await get<{ messages: MessageDetail[] }>(`/api/ai/sessions/${s.id}`);
    if (res.success && res.data) setMessages(res.data.messages);
    setDetailLoading(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-white">گفتگوهای هوشیار</h2>
          <p className="text-slate-400 text-sm mt-1">{faNum(total)} جلسه گفتگو ثبت‌شده</p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {["all", "chat", "deep", "search", "image"].map((m) => (
            <button
              key={m}
              onClick={() => { setModeFilter(m); setPage(1); }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                modeFilter === m
                  ? "shahryar-gradient text-white shadow"
                  : "bg-slate-900/70 border border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {m === "all" ? "همه" : MODE_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-dashed border-slate-800">
          <MessageSquare className="w-12 h-12 mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400 text-sm">گفتگویی یافت نشد</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => openSession(s)}
              className="w-full text-right bg-slate-900/70 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition-colors"
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${avatarColor(s.user.avatarColor)} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                  {(s.user.fullName || "ک").charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm truncate">{s.title}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-slate-400">
                    <span>{s.user.fullName || maskPhone(s.user.phone)}</span>
                    <span>·</span>
                    <span>{faNum(s.messagesCount)} پیام</span>
                    <span>·</span>
                    <span>{faRelative(s.updatedAt)}</span>
                  </div>
                </div>
                <Badge className={`text-[9px] border-0 ${MODE_COLORS[s.mode] || "bg-slate-500/15 text-slate-400"}`}>
                  {MODE_LABELS[s.mode] || s.mode}
                </Badge>
              </div>
            </button>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}
            className="rounded-xl bg-slate-900 border-slate-800 text-slate-300">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="text-slate-400 text-sm tnum">صفحه {faNum(page)} از {faNum(totalPages)}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}
            className="rounded-xl bg-slate-900 border-slate-800 text-slate-300">
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* دیالوگ پیام‌ها */}
      <AppDialog
        open={!!detailTitle}
        onClose={() => setDetailTitle("")}
        variant="admin"
        icon={MessageSquare}
        size="xl"
        title={detailTitle}
        description="گفتگوی کامل کاربر با هوشیار"
      >
          {detailLoading ? (
            <div className="space-y-3 py-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {(messages || []).map((m) => (
                <div key={m.id} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    m.role === "assistant" ? "shahryar-gradient" : "bg-slate-700"
                  }`}>
                    {m.role === "assistant"
                      ? <Bot className="w-4 h-4 text-white" />
                      : <User className="w-4 h-4 text-slate-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`rounded-xl p-3 text-sm leading-relaxed ${
                      m.role === "user" ? "bg-slate-800 text-white" : "bg-slate-800/60 text-slate-300"
                    }`}>
                      <p className="whitespace-pre-wrap">{m.content.slice(0, 1500)}</p>
                      {m.imageData && (
                        <img src={`data:image/png;base64,${m.imageData}`} alt="" className="mt-2 rounded-lg max-w-xs" />
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {faDateTime(m.createdAt)}
                      {m.searchUsed ? " · با جستجوی وب" : ""}
                      {m.thinking ? " · با تفکر عمیق" : ""}
                    </p>
                  </div>
                </div>
              ))}
              {messages?.length === 0 && (
                <p className="text-center text-slate-500 text-sm py-8">پیامی در این گفتگو وجود ندارد</p>
              )}
            </div>
          )}
      </AppDialog>
    </div>
  );
}
