// ═══════════════════════════════════════════════════════════════
// پخش‌کننده صوتی موج‌دار شهریار — نمایش حرفه‌ای پیوست صوتی پست
// دیکد واقعی فایل با WebAudio → استخراج peaks → رندر Canvas
// با fallback موج شبیه‌سازی‌شده اگر دیکد ممکن نشد
// ═══════════════════════════════════════════════════════════════
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Pause, Play, Volume2 } from "lucide-react";
import { faNum } from "@/lib/client/persian";

/** ثانیه → «۰۱:۲۴» فارسی */
function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return faNum(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
}

/** استخراج peaks واقعی فایل صوتی — هر باکت حداکثر amplitude */
async function extractPeaks(url: string, buckets: number): Promise<number[] | null> {
  try {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const ctx = new AC();
    try {
      const audio = await ctx.decodeAudioData(buf);
      const data = audio.getChannelData(0);
      const step = Math.floor(data.length / buckets) || 1;
      const peaks: number[] = [];
      for (let i = 0; i < buckets; i++) {
        let max = 0;
        const start = i * step;
        // نمونه‌گیری برای سرعت (هر ۲۵ نمونه یکی)
        for (let j = start; j < start + step && j < data.length; j += 25) {
          const v = Math.abs(data[j]);
          if (v > max) max = v;
        }
        peaks.push(max);
      }
      // نرمال‌سازی + کف حداقلی برای زیبایی
      const top = Math.max(...peaks, 0.01);
      return peaks.map((p) => Math.max(0.08, Math.min(1, (p / top) ** 0.85)));
    } finally {
      ctx.close().catch(() => {});
    }
  } catch {
    return null;
  }
}

/** موج شبیه‌سازی‌شده طبیعی (برای فرمت‌های غیرقابل دیکد) — دترمینیستیک بر اساس seed */
function fakePeaks(buckets: number, seedStr: string): number[] {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  const rand = () => {
    // LCG — پایدار بین رندرها
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const out: number[] = [];
  for (let i = 0; i < buckets; i++) {
    // موج با پیک‌ها و دره‌های طبیعی
    const wave =
      0.35 +
      0.3 * Math.sin((i / buckets) * Math.PI * 6 + rand() * 2) +
      0.25 * Math.sin((i / buckets) * Math.PI * 17 + rand() * 4) +
      0.2 * rand();
    out.push(Math.max(0.1, Math.min(1, Math.abs(wave))));
  }
  return out;
}

const SPEEDS = [1, 1.25, 1.5, 2] as const;

export default function WaveformPlayer({
  src,
  title,
  compact = false,
}: {
  src: string;
  title?: string;
  compact?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0);

  const bucketCount = compact ? 42 : 72;
  const loading = peaks === null; // تا رسیدن peaks (واقعی یا شبیه‌سازی)

  // ─── دیکد فایل → peaks (async — بدون setState همگام در effect) ───
  useEffect(() => {
    let alive = true;
    void (async () => {
      const real = await extractPeaks(src, bucketCount);
      if (!alive) return;
      setPeaks(real || fakePeaks(bucketCount, src));
    })();
    return () => {
      alive = false;
    };
  }, [src, bucketCount]);

  // ─── audio element ───
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.src = src;
    audioRef.current = audio;

    const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onTime = () => {
      setCurrent(audio.currentTime);
      if (audio.duration > 0) setProgress(audio.currentTime / audio.duration);
    };
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
      setCurrent(0);
    };
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
      audioRef.current = null;
    };
  }, [src]);

  // ─── رندر موج ───
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !peaks) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (w === 0 || h === 0) return;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const n = peaks.length;
    const gap = Math.max(1.5, (w / n) * 0.32);
    const barW = Math.max(1.5, w / n - gap);
    const radius = Math.min(barW / 2, 2);
    const mid = h / 2;

    // تشخیص دارک‌مود برای رنگ‌های مناسب
    const dark = document.documentElement.classList.contains("dark");

    for (let i = 0; i < n; i++) {
      const x = i * (barW + gap);
      const ph = Math.max(3, peaks[i] * (h - 4));
      const done = i / n <= progress;
      if (done) {
        // پخش‌شده — گرادیان برند
        const grad = ctx.createLinearGradient(0, mid - ph / 2, 0, mid + ph / 2);
        grad.addColorStop(0, dark ? "#38bdf8" : "#0284c7");
        grad.addColorStop(0.5, dark ? "#818cf8" : "#4f46e5");
        grad.addColorStop(1, dark ? "#38bdf8" : "#0284c7");
        ctx.fillStyle = grad;
      } else {
        // باقی‌مانده
        ctx.fillStyle = dark ? "rgba(148,163,184,0.35)" : "rgba(100,116,139,0.30)";
      }
      ctx.beginPath();
      ctx.roundRect(x, mid - ph / 2, barW, ph, radius);
      ctx.fill();
    }
  }, [peaks, progress]);

  // رندر اولیه + روی resize
  useEffect(() => {
    draw();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  // حلقه انیمیشن حین پخش برای نرمی
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = () => {
      const audio = audioRef.current;
      if (audio && audio.duration > 0) {
        setProgress(audio.currentTime / audio.duration);
        setCurrent(audio.currentTime);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.playbackRate = SPEEDS[speedIdx];
      audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => undefined);
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const wrap = wrapRef.current;
    const audio = audioRef.current;
    if (!wrap || !audio || !audio.duration) return;
    const rect = wrap.getBoundingClientRect();
    // RTL — راست = صفر
    const ratio = (rect.right - e.clientX) / rect.width;
    const t = Math.max(0, Math.min(1, ratio)) * audio.duration;
    audio.currentTime = t;
    setProgress(t / audio.duration);
    setCurrent(t);
  };

  const cycleSpeed = () => {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next];
  };

  const totalTime = useMemo(() => duration || 0, [duration]);

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-border/60 bg-gradient-to-l from-sky-50/80 to-indigo-50/50 p-3 transition-colors dark:border-slate-700/60 dark:from-slate-800/60 dark:to-slate-800/30 ${
        compact ? "sm:gap-2.5 sm:p-2.5" : "sm:gap-3.5 sm:p-3.5"
      }`}
      dir="rtl"
    >
      {/* دکمه پخش — گرادیان برند با حلقه هاله */}
      <button
        onClick={toggle}
        aria-label={playing ? "توقف" : "پخش"}
        className={`grid shrink-0 place-items-center rounded-full text-white shadow-lg transition-transform active:scale-90 ${
          compact ? "size-10" : "size-12"
        } bg-gradient-to-br from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 ${
          playing ? "ring-4 ring-sky-500/25" : ""
        }`}
      >
        {loading ? (
          <Loader2 className="animate-spin" style={{ width: compact ? 16 : 20, height: compact ? 16 : 20 }} />
        ) : playing ? (
          <Pause style={{ width: compact ? 16 : 20, height: compact ? 16 : 20 }} />
        ) : (
          <Play className="translate-x-[1px]" style={{ width: compact ? 16 : 20, height: compact ? 16 : 20 }} />
        )}
      </button>

      {/* موج + زمان */}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1.5 truncate text-[11px] font-bold text-slate-600 dark:text-slate-300">
            <Volume2 className="size-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
            <span className="truncate" dir="auto">{title || "پیوست صوتی"}</span>
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={cycleSpeed}
              className="tnum rounded-md bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 transition-colors hover:bg-slate-300/70 dark:bg-slate-700/60 dark:text-slate-300 dark:hover:bg-slate-600/60"
              aria-label="سرعت پخش"
            >
              ×{faNum(SPEEDS[speedIdx].toString().replace(".", "٫"))}
            </button>
            <span className="tnum text-[10px] font-bold text-slate-500 dark:text-slate-400">
              {fmtTime(current)} / {fmtTime(totalTime)}
            </span>
          </div>
        </div>
        <div
          ref={wrapRef}
          onClick={seek}
          role="slider"
          aria-label="جایگاه پخش صوت"
          aria-valuenow={Math.round(progress * 100)}
          tabIndex={0}
          className={`relative w-full cursor-pointer select-none ${compact ? "h-9" : "h-12 sm:h-14"}`}
        >
          <canvas ref={canvasRef} className="absolute inset-0" />
        </div>
      </div>
    </div>
  );
}
