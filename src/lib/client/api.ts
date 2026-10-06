// ═════ کلاینت API شهریار — مدیریت درخواست‌ها با احراز هویت کوکی ═════
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/** آیا این وضعیت، اختلال گذرای سرور است (ری‌استارت/در دسترس نبودن موقت)? */
function isTransientStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

/**
 * پیام خطای دقیق بر اساس کد وضعیت — دیگر «پاسخ نامعتبر از سرور» مبهم نیست.
 * (پیش‌تر وقتی Caddy هنگام ری‌استارت سرور، صفحه HTML خطا ۵۰۲ برمی‌گرداند،
 * کاربر پیام نامفهوم «پاسخ نامعتبر از سرور» می‌دید.)
 */
function statusErrorMessage(status: number): string {
  switch (status) {
    case 502:
    case 503:
    case 504:
      return "سرور در حال راه‌اندازی مجدد است. چند لحظه بعد دوباره تلاش کنید";
    case 429:
      return "تعداد درخواست‌ها زیاد است. کمی صبر کنید و دوباره تلاش کنید";
    case 500:
      return "خطای داخلی سرور. لطفاً دوباره تلاش کنید";
    default:
      return `خطای سرور (کد ${status})`;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchOnce<T>(path: string, options: RequestInit): Promise<ApiResponse<T> & { status?: number }> {
  try {
    const res = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      credentials: "include",
    });

    const json = await res.json().catch(() => null);
    if (json && typeof json === "object" && "success" in json) {
      return { ...(json as ApiResponse<T>), status: res.status };
    }

    // بدنه پاسخ JSON معتبر نبود (مثلاً صفحه HTML خطای پراکسی)
    return {
      success: false,
      error: statusErrorMessage(res.status),
      status: res.status,
    };
  } catch {
    return { success: false, error: "ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید" };
  }
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  let res = await fetchOnce<T>(path, options);

  // یک تلاش خودکار برای اختلالات گذرا (ری‌استارت سرور/محدودیت نرخ لحظه‌ای) —
  // فقط وقتی بدنه درخواست قابل ارسال مجدد است (string body یا بدون body)
  if (!res.success && res.status !== undefined && isTransientStatus(res.status)) {
    await sleep(1200);
    res = await fetchOnce<T>(path, options);
  }

  return res;
}

export const get = <T = unknown>(path: string) => api<T>(path);
export const post = <T = unknown>(path: string, body?: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body || {}) });
export const patch = <T = unknown>(path: string, body?: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(body || {}) });
export const put = <T = unknown>(path: string, body?: unknown) =>
  api<T>(path, { method: "PUT", body: JSON.stringify(body || {}) });
export const del = <T = unknown>(path: string) =>
  api<T>(path, { method: "DELETE" });

// ═══ چت هوشیار — استریم مراحل زنده (NDJSON) ═══

export interface ChatStreamStage {
  stage: string;
  detail?: string;
}

/**
 * POST چت با استریم NDJSON — مراحل زنده هوشیار را via onStage
 * گزارش می‌کند و نتیجه نهایی را برمی‌گرداند.
 * اگر سرور/پراکسی استریم را پشتیبانی نکرد (JSON معمولی برگشت)،
 * خودکار به حالت غیراستریم برمی‌گردد (fallback شفاف).
 */
export async function postChatStream<T = unknown>(
  path: string,
  body: unknown,
  onStage?: (stage: ChatStreamStage) => void
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Progress-Events": "1",
      },
      body: JSON.stringify(body || {}),
      credentials: "include",
    });

    const contentType = res.headers.get("content-type") || "";

    // سرور استریم را پشتیبانی نکرد → JSON معمولی
    if (!contentType.includes("x-ndjson")) {
      const json = await res.json().catch(() => null);
      if (json && typeof json === "object" && "success" in json) {
        return json as ApiResponse<T>;
      }
      return { success: false, error: "پاسخ نامعتبر از سرور" };
    }

    if (!res.body) {
      return { success: false, error: "ارتباط با سرور برقرار نشد" };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalResult: ApiResponse<T> | null = null;

    const handleLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const evt = JSON.parse(trimmed) as {
          type: string;
          stage?: string;
          detail?: string;
          data?: T;
          error?: string;
        };
        if (evt.type === "stage" && evt.stage) {
          onStage?.({ stage: evt.stage, detail: evt.detail });
        } else if (evt.type === "result") {
          finalResult = { success: true, data: evt.data as T };
        } else if (evt.type === "error") {
          finalResult = { success: false, error: evt.error || "خطای نامشخص" };
        }
      } catch {
        // خط ناقص/نامعتبر → نادیده
      }
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // آخرین خط ممکن ناقص باشد
      for (const line of lines) handleLine(line);
    }
    if (buffer) handleLine(buffer);

    if (finalResult) return finalResult;
    return { success: false, error: "پاسخ سرور ناقص بود. دوباره تلاش کنید" };
  } catch {
    return { success: false, error: "ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید" };
  }
}
