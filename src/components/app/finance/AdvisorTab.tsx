// ═══ تب مشاور مالی AI — چت فول-پیج راست‌چین (الگوی هوشیار) + تحلیل با کلیک کاربر ═══
"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Send, RotateCcw, ArrowRight, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MarkdownContent from "@/components/common/MarkdownContent";
import { post } from "@/lib/client/api";
import { toast } from "@/hooks/use-toast";
import { healthColor } from "@/lib/client/finance";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface HealthScore {
  score: number;
  components: Array<{ key: string; label: string; score: number; note: string }>;
}

const QUICK_QUESTIONS = [
  "چطور هزینه‌هایم را کم کنم؟",
  "برنامه‌ی پس‌انداز برایم بچین",
  "آیا توان خرید دارم؟",
  "وضعیت بدهی‌هایم چطور است؟",
];

export default function AdvisorTab({ onBack }: { onBack: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<HealthScore | null>(null);
  const [aiLive, setAiLive] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ⚠️ تحلیل خودکار حذف شد — کاربر باید خودش روی «نمایش تحلیل» کلیک کند
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const analyze = async (question: string) => {
    setLoading(true);
    const history = messages.slice(-8).map((m) => ({ role: m.role, content: m.content }));

    if (question) setMessages((prev) => [...prev, { role: "user", content: question }]);

    const res = await post<{ reply: string; health: HealthScore; aiGenerated: boolean }>(
      "/api/finance/ai/advisor",
      { question: question || undefined, history: question ? history : [] }
    );

    setLoading(false);
    if (res.success && res.data) {
      setMessages((prev) => [...prev, { role: "assistant", content: res.data!.reply }]);
      setHealth(res.data.health);
      setAiLive(res.data.aiGenerated);
    } else {
      toast({ title: "خطا", description: res.error || "تحلیل ناموفق بود", variant: "destructive" });
    }
  };

  const handleSend = () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    analyze(q);
  };

  const reset = () => {
    setMessages([]);
    setHealth(null);
  };

  const started = messages.length > 0 || loading;

  return (
    // موبایل: دقیقاً تا لبه‌ی ناوبری پایین — همان محاسبهٔ چت هوشیار؛ دسکتاپ: فول-بلید
    <div
      className="flex flex-col -mb-24 h-[calc(100dvh-3.5rem-3.75rem-env(safe-area-inset-bottom))] lg:mb-0 lg:h-[calc(100dvh-2rem)]"
      dir="rtl"
    >
      {/* ─── هدر چسبان ─── */}
      <div className="shrink-0 px-3 lg:px-4 py-2.5 border-b border-border/60 flex items-center gap-2.5 bg-card/80 backdrop-blur-md sticky top-14 lg:top-0 z-10">
        <button
          onClick={onBack}
          aria-label="بازگشت به امور مالی"
          className="p-2.5 rounded-xl hover:bg-accent transition-colors text-foreground/80 shrink-0"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
        <div className="w-10 h-10 rounded-2xl shahryar-gradient flex items-center justify-center shadow-md shrink-0">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="font-black text-sm truncate">مشاور مالی هوشمند</h2>
            <span
              className={cn("size-2 rounded-full shrink-0", aiLive ? "bg-emerald-500" : "bg-amber-500")}
              title={aiLive ? "موتور هوش مصنوعی فعال است" : "موتور AI در دسترس نیست — تحلیل قاعده‌محور"}
            />
          </div>
          <p className="text-[11px] text-muted-foreground truncate">
            تحلیلگر حرفه‌ای با داده‌های واقعی مالی شما
          </p>
        </div>
        {health && (
          <div className="text-center shrink-0 px-2.5 py-1 rounded-xl bg-muted/60">
            <p className="text-sm font-black leading-none tabular-nums" style={{ color: healthColor(health.score) }}>
              {health.score}
            </p>
            <p className="text-[8px] text-muted-foreground mt-0.5">سلامت مالی</p>
          </div>
        )}
        <button
          onClick={reset}
          disabled={loading || !started}
          className="p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30 shrink-0"
          title="شروع گفتگوی تازه"
        >
          <RotateCcw className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
        </button>
      </div>

      {/* ─── پیام‌ها ─── */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-3xl px-4 py-5 space-y-4">
          {!started ? (
            <EmptyAdvisor
              onAnalyze={() => analyze("")}
              onQuick={(q) => analyze(q)}
              aiLive={aiLive}
            />
          ) : (
            <>
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={cn("flex gap-2.5", m.role === "user" && "flex-row-reverse")}
                >
                  {m.role === "assistant" ? (
                    <div className="w-9 h-9 rounded-xl shahryar-gradient flex items-center justify-center shrink-0 mt-1 shadow-md">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center shrink-0 mt-1">
                      <User className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="max-w-[85%] md:max-w-[75%]">
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-3 text-sm leading-loose",
                        m.role === "user"
                          ? "shahryar-gradient text-white rounded-tr-md"
                          : "bg-accent/70 rounded-tl-md"
                      )}
                    >
                      {m.role === "assistant" ? (
                        <MarkdownContent content={m.content} />
                      ) : (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}

              {loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5">
                  <div className="w-9 h-9 rounded-xl shahryar-gradient flex items-center justify-center shrink-0 mt-1 shadow-md">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div className="rounded-2xl rounded-tl-md bg-accent/70 px-5 py-4 flex items-center gap-2.5">
                    <div className="flex gap-1.5">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="w-2 h-2 rounded-full bg-primary/60"
                          animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {messages.length === 0 ? "در حال تحلیل داده‌های مالی..." : "مشاور در حال پاسخ..."}
                    </span>
                  </div>
                </motion.div>
              )}
              <div ref={bottomRef} />
            </>
          )}
        </div>
      </div>

      {/* ─── نوار ورودی ─── */}
      <div className="shrink-0 border-t border-border/60 bg-card/80 backdrop-blur-md px-3 lg:px-4 py-3">
        <div className="mx-auto max-w-3xl flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="سؤال مالی خود را بپرسید..."
            disabled={loading}
            className="h-12 rounded-xl text-right flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="h-12 w-12 rounded-xl shahryar-gradient text-white border-0 hover:brightness-110 p-0 shrink-0"
          >
            <Send className="w-5 h-5 -scale-x-100" />
          </Button>
        </div>
        <p className="mx-auto max-w-3xl text-[10px] text-muted-foreground text-center mt-2 leading-4">
          مشاور بر اساس داده‌های ثبت‌شده‌ی شما در بخش مالی تحلیل می‌کند؛ توصیه‌های عمومی جای مشاور رسمی را نمی‌گیرند.
        </p>
      </div>
    </div>
  );
}

// ─── حالت خالی — دروازهٔ تحلیل: هیچ تحلیل خودکاری انجام نمی‌شود ───
function EmptyAdvisor({
  onAnalyze,
  onQuick,
  aiLive,
}: {
  onAnalyze: () => void;
  onQuick: (q: string) => void;
  aiLive: boolean;
}) {
  return (
    <div className="flex flex-col items-center text-center py-8">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 14 }}
        className="w-20 h-20 rounded-3xl shahryar-gradient flex items-center justify-center shadow-xl animate-float relative"
      >
        <Sparkles className="w-10 h-10 text-white" />
        <span className="absolute inset-0 rounded-3xl bg-primary/20 animate-pulse-ring" />
      </motion.div>
      <h3 className="text-lg md:text-xl font-black mt-5">تحلیلگر مالی‌ت آماده‌ست!</h3>
      <p className="text-muted-foreground text-sm mt-2 max-w-sm leading-relaxed">
        هر وقت خواستی، روی دکمه بزن تا وضعیت مالی‌ات را بر اساس حساب‌ها، تراکنش‌ها و بودجه‌هایت
        تحلیل کند — یا مستقیم هر سؤالی داری بپرس.
      </p>

      {!aiLive && (
        <p className="text-[10px] text-amber-600 bg-amber-500/10 rounded-xl px-3 py-2 mt-4">
          موتور AI موقتاً در دسترس نیست — تحلیل قاعده‌محور نمایش داده می‌شود
        </p>
      )}

      <Button
        onClick={onAnalyze}
        disabled={false}
        className="mt-6 h-12 px-6 rounded-2xl shahryar-gradient text-white border-0 font-bold shadow-lg shadow-primary/25 hover:brightness-110"
      >
        <Sparkles className="w-5 h-5" style={{ width: 20, height: 20 }} />
        نمایش تحلیل وضعیت مالی
      </Button>

      <div className="mt-8 w-full">
        <p className="text-xs font-bold text-muted-foreground mb-3">سؤالات پرکاربرد</p>
        <div className="flex flex-wrap justify-center gap-2">
          {QUICK_QUESTIONS.map((q, i) => (
            <motion.button
              key={q}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + i * 0.06 }}
              onClick={() => onQuick(q)}
              className="text-xs px-3.5 py-2 rounded-xl bg-card border border-border/60 hover:border-primary/40 hover:shadow-sm transition-all font-medium"
            >
              {q}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
