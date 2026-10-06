// ═══ نمایش مرحله‌به‌مرحله کارهای هوشیار — لودینگ زنده و جذاب ═══
// وقتی هوشیار کار خاصی می‌کند (خواندن سند، ساخت فایل، اجرای کد،
// جستجوی وب و...) این کامپوننت به‌صورت زنده نشان می‌دهد الان
// دقیقاً کجای کار است — با آیکون، توضیح، تایم‌لاین و پیشرفت.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, FileSearch, ImagePlus, Globe, Brain, PenLine, FileCog,
  Code2, Play, FileOutput, HardDriveDownload, RefreshCw, CheckCircle2,
  Sparkles, Send,
} from "lucide-react";

export interface StageEntry {
  stage: string;
  detail?: string;
  at: number; // timestamp دریافت
}

// ─── متادیتای هر مرحله — آیکون + عنوان + توضیح پیش‌فرض ───
const STAGE_META: Record<string, { icon: typeof Bot; title: string; desc: string; tint: string }> = {
  queued: {
    icon: Send, title: "پیام دریافت شد",
    desc: "هوشیار پیام شما را خواند", tint: "text-sky-500 bg-sky-500/10 border-sky-500/20",
  },
  reading_doc: {
    icon: FileSearch, title: "خواندن فایل پیوست",
    desc: "استخراج کامل محتوای سند", tint: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  },
  analyzing_image: {
    icon: ImagePlus, title: "تحلیل تصویر",
    desc: "مشاهده و درک محتوای تصویر", tint: "text-fuchsia-500 bg-fuchsia-500/10 border-fuchsia-500/20",
  },
  searching_web: {
    icon: Globe, title: "جستجوی وب",
    desc: "گردآوری جدیدترین اطلاعات از منابع", tint: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20",
  },
  thinking: {
    icon: Brain, title: "در حال فکر کردن",
    desc: "تحلیل درخواست و طراحی پاسخ", tint: "text-violet-500 bg-violet-500/10 border-violet-500/20",
  },
  writing: {
    icon: PenLine, title: "نگارش پاسخ",
    desc: "تدوین پاسخ دقیق و کامل", tint: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  },
  planning_file: {
    icon: FileCog, title: "طراحی ساختار فایل",
    desc: "برنامه‌ریزی ساختار و محتوای فایل", tint: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  },
  writing_code: {
    icon: Code2, title: "نوشتن کد پردازش",
    desc: "تولید کد دقیق برای داده‌ها", tint: "text-orange-500 bg-orange-500/10 border-orange-500/20",
  },
  running_code: {
    icon: Play, title: "اجرای کد روی داده‌ها",
    desc: "پردازش دقیق ردیف‌های فایل شما", tint: "text-rose-500 bg-rose-500/10 border-rose-500/20",
  },
  building_file: {
    icon: FileOutput, title: "ساخت فایل",
    desc: "تولید فایل با طراحی حرفه‌ای راست‌چین", tint: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
  },
  saving_file: {
    icon: HardDriveDownload, title: "ذخیره فایل",
    desc: "آماده‌سازی لینک دانلود", tint: "text-teal-500 bg-teal-500/10 border-teal-500/20",
  },
  retrying: {
    icon: RefreshCw, title: "بهبود و تلاش مجدد",
    desc: "اصلاح خودکار ساختار فایل", tint: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  },
  finalizing: {
    icon: CheckCircle2, title: "نهایی‌سازی",
    desc: "آماده‌سازی پاسخ نهایی", tint: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  },
};

/** وزن تقریبی هر مرحله برای نوار پیشرفت (0..1) */
const STAGE_WEIGHT: Record<string, number> = {
  queued: 0.03,
  reading_doc: 0.14,
  analyzing_image: 0.14,
  searching_web: 0.16,
  thinking: 0.3,
  writing: 0.45,
  planning_file: 0.55,
  writing_code: 0.62,
  running_code: 0.7,
  building_file: 0.82,
  saving_file: 0.92,
  retrying: 0.6,
  finalizing: 0.97,
};

/** عنوان پیش‌فرض قبل از رسیدن اولین رویداد — بر اساس حالت چت */
const MODE_HINT: Record<string, { icon: typeof Bot; title: string; tint: string }> = {
  chat: { icon: Bot, title: "هوشیار داره فکر می‌کنه...", tint: "text-violet-500 bg-violet-500/10 border-violet-500/20" },
  deep: { icon: Brain, title: "دارم عمیق فکر می‌کنم...", tint: "text-violet-500 bg-violet-500/10 border-violet-500/20" },
  search: { icon: Globe, title: "دارم وب رو جستجو می‌کنم...", tint: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20" },
  image: { icon: ImagePlus, title: "در حال ساخت تصویر...", tint: "text-fuchsia-500 bg-fuchsia-500/10 border-fuchsia-500/20" },
};

function faSec(s: number): string {
  return String(s).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
}

export default function HooshiarStages({
  stages,
  mode,
  startedAt,
}: {
  stages: StageEntry[];
  mode: string;
  startedAt: number;
}) {
  const [elapsed, setElapsed] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // شمارنده ثانیه — حس زنده بودن
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  const current = stages.length > 0 ? stages[stages.length - 1] : null;
  const meta = current ? STAGE_META[current.stage] : null;
  const hint = MODE_HINT[mode] || MODE_HINT.chat;

  // پیشرفت تجمعی — هر مرحله وزن دارد؛ تکرار یک مرحله وزن را اضافه نمی‌کند
  const progress = useMemo(() => {
    if (!current) return 0.02;
    const w = STAGE_WEIGHT[current.stage] ?? 0.5;
    return Math.min(0.99, w);
  }, [current]);

  // مراحل منحصربه‌فرد (برای تایم‌لاین) — حفظ ترتیب وقوع
  const uniqueStages = useMemo(() => {
    const seen = new Set<string>();
    const out: StageEntry[] = [];
    for (const s of stages) {
      if (!seen.has(s.stage)) {
        seen.add(s.stage);
        out.push(s);
      } else {
        // به‌روزرسانی جزئیات آخرین تکرار
        const idx = out.findIndex((o) => o.stage === s.stage);
        if (idx >= 0) out[idx] = s;
      }
    }
    return out;
  }, [stages]);

  // اسکرول نرم تایم‌لاین به پایین
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [stages.length]);

  const Icon = meta?.icon || hint.icon;
  const title = meta?.title || hint.title;
  const tint = meta?.tint || hint.tint;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-2 md:gap-2.5 mt-3 md:mt-4"
      dir="rtl"
    >
      {/* آواتار هوشیار — با حلقه چرخان هنگام کار */}
      <div className="relative w-8 h-8 md:w-9 md:h-9 shrink-0 mt-0.5">
        <span className="absolute -inset-1 rounded-2xl border-2 border-primary/25 border-t-primary animate-spin" style={{ animationDuration: "1.6s" }} aria-hidden />
        <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl shahryar-gradient flex items-center justify-center shadow-md">
          <Bot className="w-4 h-4 md:w-5 md:h-5 text-white" />
        </div>
      </div>

      {/* کارت مراحل */}
      <div className="bg-accent/70 rounded-2xl rounded-tl-md px-3.5 py-3 max-w-full flex-1 min-w-0">
        {/* مرحله جاری */}
        <div className="flex items-center gap-2.5">
          <AnimatePresence mode="wait">
            <motion.div
              key={current?.stage || "hint"}
              initial={{ scale: 0.5, opacity: 0, rotate: -12 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", damping: 14, stiffness: 260 }}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${tint}`}
            >
              <Icon className="w-4.5 h-4.5" style={{ width: 19, height: 19 }} />
            </motion.div>
          </AnimatePresence>
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.p
                key={current?.stage || "hint"}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
                className="text-[13px] font-bold leading-tight"
              >
                {title}
                {current?.detail ? (
                  <span className="font-normal text-muted-foreground"> · {current.detail}</span>
                ) : null}
              </motion.p>
            </AnimatePresence>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-primary/60 inline-block" />
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-primary/60 inline-block" />
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-primary/60 inline-block" />
              <span className="ms-1 tnum">{faSec(elapsed)} ثانیه</span>
            </p>
          </div>
        </div>

        {/* نوار پیشرفت */}
        <div className="mt-3 h-1.5 bg-primary/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full shahryar-gradient rounded-full"
            initial={{ width: "2%" }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ type: "spring", damping: 24, stiffness: 120 }}
          />
        </div>

        {/* تایم‌لاین مراحل انجام‌شده */}
        {uniqueStages.length > 1 && (
          <div ref={listRef} className="mt-3 max-h-28 overflow-y-auto space-y-1.5 nice-scroll">
            <AnimatePresence initial={false}>
              {uniqueStages.slice(0, -1).map((s) => {
                const m = STAGE_META[s.stage];
                if (!m) return null;
                const MIcon = m.icon;
                return (
                  <motion.div
                    key={s.stage}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="flex items-center gap-2 text-[11px] text-muted-foreground overflow-hidden"
                  >
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${m.tint}`}>
                      <MIcon style={{ width: 11, height: 11 }} />
                    </span>
                    <span className="line-through decoration-muted-foreground/40">{m.title}</span>
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mr-auto" />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* نکته جذاب وقتی کار خاصی در جریان است */}
        {(current?.stage === "running_code" || current?.stage === "building_file" || current?.stage === "writing_code") && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2.5 text-[10.5px] text-muted-foreground/80 flex items-center gap-1.5 border-t border-border/40 pt-2.5"
          >
            <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
            هوشیار همین الان دارد فایل شما را با دقت می‌سازد — محاسبات روی داده‌های واقعی انجام می‌شود
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}
