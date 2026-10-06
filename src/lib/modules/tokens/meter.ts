// ═══════════════════════════════════════════════════════════════
// مترینگ مصرف توکن — بافتار درخواست‌محور (AsyncLocalStorage)
//
// هدف: «دقیقاً مثل صورتحساب API» مصرف واقعی هر فراخوانی مدل را
// ثبت کنیم — حتی وقتی یک درخواست HTTP چندین فراخوانی مدل دارد
// (موتور حافظه، خواننده سند، تفکر عمیق، سنتز جستجو...).
//
// الگو: روت API یک «متر» می‌سازد، پردازش را داخل آن اجرا می‌کند؛
// لایه zai.ts بعد از هر فراخوانی مدل، مصرف را به متر جاری
// می‌افزاید (خارج از بافتار → no-op). در پایان روت، snapshot
// دقیق مصرف را در TokenUsage ثبت و از کیف کسر می‌کند.
// ═══════════════════════════════════════════════════════════════
import { AsyncLocalStorage } from "async_hooks";

export interface MeterState {
  inputTokens: number;
  outputTokens: number;
  calls: number;
  estimated: boolean; // حداقل یک فراخوانی برآوردی بود (سرویس usage گزارش نداد)
  model: string | null;
}

function newState(): MeterState {
  return { inputTokens: 0, outputTokens: 0, calls: 0, estimated: false, model: null };
}

const meterAls = new AsyncLocalStorage<MeterState>();

export interface MeterHandle {
  /** اجرای تابع داخل بافتار مترینگ */
  run<T>(fn: () => Promise<T>): Promise<T>;
  /** وضعیت انباشته تا این لحظه (ایمن برای فراخوانی خارج از بافتار) */
  snapshot(): MeterState;
}

/** ساخت متر برای یک درخواست HTTP */
export function createMeter(): MeterHandle {
  const state = newState();
  return {
    run: <T>(fn: () => Promise<T>) => meterAls.run(state, fn),
    snapshot: () => ({ ...state }),
  };
}

/**
 * ثبت مصرف یک فراخوانی مدل — فقط داخل بافتار مترینگ فعال اثر دارد.
 * (فراخوانی‌های خارج از بافتار — تست ادمین، پیش‌نمایش داخلی — نادیده گرفته می‌شوند)
 */
export function addMeteredUsage(u: {
  inputTokens: number;
  outputTokens: number;
  estimated?: boolean;
  model?: string | null;
}): void {
  const state = meterAls.getStore();
  if (!state) return;
  state.inputTokens += Math.max(0, Math.round(u.inputTokens));
  state.outputTokens += Math.max(0, Math.round(u.outputTokens));
  state.calls += 1;
  if (u.estimated) state.estimated = true;
  if (u.model && !state.model) state.model = String(u.model).slice(0, 60);
}

// ─── استخراج usage واقعی از پاسخ سرویس‌ها ───

export interface ProviderUsage {
  inputTokens: number;
  outputTokens: number;
  /** true = سرویس اعداد واقعی گزارش کرد (نه برآورد) */
  hasUsage: boolean;
  model: string | null;
}

/**
 * استخراج usage از پاسخ مدل — پشتیبانی از قالب‌های:
 *  • OpenAI/ZAI (GLM): usage.prompt_tokens / completion_tokens
 *  • Anthropic: usage.input_tokens / output_tokens
 * خروجی همیشه مدل (در صورت وجود) را هم برمی‌گرداند.
 */
export function extractProviderUsage(res: unknown): ProviderUsage | null {
  if (!res || typeof res !== "object") return null;
  const r = res as Record<string, unknown>;
  const num = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  };

  const u = r.usage;
  let input: number | null = null;
  let output: number | null = null;
  if (u && typeof u === "object") {
    const uu = u as Record<string, unknown>;
    input = num(uu.prompt_tokens ?? uu.input_tokens ?? uu.promptTokens);
    output = num(uu.completion_tokens ?? uu.output_tokens ?? uu.completionTokens);
  }

  return {
    inputTokens: input ?? 0,
    outputTokens: output ?? 0,
    hasUsage: input !== null || output !== null,
    model: typeof r.model === "string" ? r.model.slice(0, 60) : null,
  };
}

/** برآورد توکن از طول متن (سرویس usage گزارش ندهد) — فارسی/انگلیسی ≈ ۳ کاراکتر به ازای هر توکن */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3);
}

/** برآورد توکن یک تصویر ورودی (مدل بینایی — برآورد محافظه‌کارانه) */
export const ESTIMATED_IMAGE_TOKENS = 1000;
