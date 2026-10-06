// ═════ پیش‌نویس هوشمند وظایف — POST /api/goals/draft ═════
// هوشیار پیش از ساخت هدف، وظایف پیشنهادی تولید می‌کند (برای فرم ساخت هدف)
import { NextRequest } from "next/server";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { guardAiBudget } from "@/lib/core/ai-budget";
import { chatCompletion, type ChatMsg } from "@/lib/modules/ai/zai";
import { createMeter } from "@/lib/modules/tokens/meter";
import { recordUsageSafe } from "@/lib/modules/tokens/usage";

interface SuggestedTask {
  title: string;
  priority: string;
  dueInDays: number;
}

const VALID_PRIORITIES = ["low", "medium", "high", "critical"];
const CAT_FA: Record<string, string> = {
  personal: "شخصی", health: "سلامت", career: "شغلی",
  education: "تحصیلی", financial: "مالی", family: "خانوادگی",
};

function extractJsonArray(raw: string): SuggestedTask[] | null {
  const cleaned = raw.replace(/```(json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (!parsed || !Array.isArray(parsed.tasks)) return null;
    return parsed.tasks
      .filter((t: unknown): t is SuggestedTask =>
        typeof t === "object" && t !== null && typeof (t as SuggestedTask).title === "string")
      .slice(0, 10)
      .map((t) => ({
        title: t.title.trim().slice(0, 150),
        priority: VALID_PRIORITIES.includes(t.priority) ? t.priority : "medium",
        dueInDays: Math.min(90, Math.max(0, Math.round(Number(t.dueInDays) || 0))),
      }));
  } catch {
    return null;
  }
}

const FALLBACKS: Record<string, string[]> = {
  education: ["منابع و دوره‌های مناسب را جمع‌آوری کن", "برنامه‌ی مطالعه‌ی هفتگی بنویس", "اولین جلسه‌ی یادگیری را شروع کن", "روش سنجش پیشرفت تعریف کن", "با یک نفر مسیر‌رفته مشورت کن"],
  health: ["وضعیت فعلی را ثبت کن", "برنامه‌ی ورزشی هفتگی بچین", "رژیم غذایی را اصلاح کن", "یک چک‌آپ رزرو کن", "عادت کوچک روزانه را ۲۱ روز تکرار کن"],
  career: ["مهارت‌های کلیدی را فهرست کن", "نقاط ضعف فنی را اولویت‌بندی کن", "روزی ۳۰ دقیقه تمرین بگذار", "رزومه و نمونه‌کار را به‌روز کن", "با دو نفر از فعالان حوزه گفتگو کن"],
  financial: ["مبلغ هدف و مهلت تعیین کن", "پس‌انداز ماهانه را حساب کن", "هزینه‌های غیرضروری را شناسایی کن", "محل جدا برای پس‌انداز در نظر بگیر", "پیشرفت را پایان هر ماه ثبت کن"],
  family: ["با افراد درگیر هم‌رأی شو", "تقویم مشترک بچین", "اولین قرار کوچک را برگزار کن", "مسئولیت‌ها را تقسیم کن", "یک سنت کوچک برای تداوم بساز"],
  personal: ["هدف را به قدم‌های کوچک بشکن", "زمان مشخصی در هفته بگذار", "مانع اصلی را بنویس و راه‌حل بده", "ابزارهای موردنیاز را فراهم کن", "از یک دوست همراه بخواه"],
};

export async function POST(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("goals", "enableAIAssist");
    if (gate) return gate;

    // سهمیه روزانه یکپارچه AI — این روت قبلاً بدون هیچ محدودیتی بود
    const budgetGate = await guardAiBudget(auth.id, "goal_ai");
    if (budgetGate) return budgetGate;

    const body = await parseJson<{
      title?: string; description?: string | null; category?: string; deadline?: string | null;
    }>(req);
    const title = body?.title?.trim().slice(0, 120);
    if (!title) return fail("عنوان هدف الزامی است");

    const category = CAT_FA[body?.category || ""] ? body!.category! : "personal";

    const messages: ChatMsg[] = [
      {
        role: "system",
        content: `تو «هوشیار» هستی، برنامه‌ریز حرفه‌ای اهداف در اپلیکیشن شهریار. برای هدف جدیدِ کاربر ۶ تا ۸ وظیفه‌ی اجرایی پیشنهاد بده.

قواعد:
- هر وظیفه یک اقدام مشخص و قابل‌انجام (فعل اجرایی)
- ترتیب منطقی از شروع تا تکمیل
- اولویت فقط از: low | medium | high | critical
- dueInDays: ۰ تا ۹۰
- فارسی روان و کوتاه (~۶۰ کاراکتر)
- زمینه ایران: واقع‌بین و در دسترس

فقط JSON خالص:
{"tasks":[{"title":"...","priority":"medium","dueInDays":5}]}`,
      },
      {
        role: "user",
        content: `هدف: «${title}»\nدسته: ${CAT_FA[category]}${body?.description?.trim() ? `\nتوضیح: ${body.description.trim().slice(0, 500)}` : ""}`,
      },
    ];

    let suggestions: SuggestedTask[] | null = null;
    const meter = createMeter();
    try {
      const res = await meter.run(() => chatCompletion(messages, { temperature: 0.7, maxTokens: 2048 }));
      suggestions = extractJsonArray(res?.choices?.[0]?.message?.content || "");
    } catch (err) {
      console.error("خطای مدل پیش‌نویس هدف:", err);
    }

    // ─── ثبت مصرف دقیق هوش اهداف ───
    const snap = meter.snapshot();
    if (snap.calls > 0) {
      await recordUsageSafe({
        userId: auth.id,
        feature: "goal_ai",
        inputTokens: snap.inputTokens,
        outputTokens: snap.outputTokens,
        estimated: snap.estimated,
        model: snap.model,
        title: `پیش‌نویس هدف: ${title}`.slice(0, 120),
        meta: { action: "draft", category, count: suggestions?.length ?? 0 },
      });
    }

    if (!suggestions || suggestions.length === 0) {
      suggestions = (FALLBACKS[category] || FALLBACKS.personal).map((t, i) => ({
        title: t,
        priority: i < 2 ? "high" : "medium",
        dueInDays: (i + 1) * 3,
      }));
    }

    // ثبت مصرف در بودجه روزانه یکپارچه AI
    logActivity({
      userId: auth.id,
      action: "ai.goal_draft",
      entity: "goal",
      details: { title: title.slice(0, 60), count: suggestions.length },
    }).catch(() => {});

    return ok({ suggestions, aiGenerated: true });
  } catch (err) {
    console.error("خطای پیش‌نویس هدف:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
