// ═════ هوشیارِ اهداف — POST /api/goals/[id]/ai ═════
// دو قابلیت:
//  1) breakdown  → تفکیک هوشمند هدف به وظایف اجرایی (JSON ساخت‌یافته)
//  2) coaching   → تحلیل و مربی‌گری هدف با داده‌های واقعی (Markdown)
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { guardAiBudget } from "@/lib/core/ai-budget";
import { chatCompletion, type ChatMsg } from "@/lib/modules/ai/zai";
import { createMeter } from "@/lib/modules/tokens/meter";
import { recordUsageSafe } from "@/lib/modules/tokens/usage";
import { daysLeft, GOAL_CATEGORIES, GOAL_PRIORITIES } from "@/lib/modules/goals/service";

// ─── برچسب‌های فارسی برای پرامپت ───
const CAT_FA: Record<string, string> = {
  personal: "شخصی", health: "سلامت", career: "شغلی",
  education: "تحصیلی", financial: "مالی", family: "خانوادگی",
};
const PRIO_FA: Record<string, string> = { low: "کم", medium: "متوسط", high: "زیاد", critical: "بحرانی" };

interface SuggestedTask {
  title: string;
  priority: string;
  dueInDays: number;
}

/** استخراج JSON از پاسخ مدل (تحمل code-fence و متن اضافه) */
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
        typeof t === "object" && t !== null && typeof (t as SuggestedTask).title === "string" && (t as SuggestedTask).title.trim().length > 0)
      .slice(0, 12)
      .map((t) => ({
        title: t.title.trim().slice(0, 150),
        priority: GOAL_PRIORITIES.includes((t.priority || "medium") as typeof GOAL_PRIORITIES[number]) ? t.priority : "medium",
        dueInDays: Math.min(90, Math.max(0, Math.round(Number(t.dueInDays) || 0))),
      }));
  } catch {
    return null;
  }
}

/** تفکیک قاعده‌محور (fallback وقتی AI در دسترس نیست) */
function heuristicBreakdown(category: string, title: string): SuggestedTask[] {
  const templates: Record<string, string[]> = {
    education: ["منابع و دوره‌های مناسب را جمع‌آوری کن", "برنامه‌ی مطالعه‌ی هفتگی بنویس", "اولین جلسه‌ی یادگیری را همین هفته شروع کن", " یک روش سنجش پیشرفت تعریف کن (آزمون/پروژه)", "با یک نفر که این مسیر را رفته مشورت کن"],
    health: ["وضعیت فعلی را ثبت کن (وزن/قد/آزمایش)", "برنامه‌ی ورزشی هفتگی ساده بچین", "رژیم غذایی را اصلاح کن", "یک جلسه‌ی مشاوره یا چک‌آپ رزرو کن", "عادت کوچک روزانه را ۲۱ روز تکرار کن"],
    career: ["مهارت‌های کلیدی این مسیر را فهرست کن", "نقاط ضعف فنی‌ات را اولویت‌بندی کن", "روزی ۳۰ دقیقه تمرین/یادگیری بگذار", "رزومه و نمونه‌کارها را به‌روز کن", "با دو نفر از فعالان این حوزه گفتگو کن"],
    financial: ["مبلغ هدف و مهلت دقیق تعیین کن", "ماهانه چقدر باید پس‌انداز شود حساب کن", "هزینه‌های غیرضروری ماه را شناسایی کن", "یک حساب/محل جدا برای این هدف در نظر بگیر", "پیشرفت را پایان هر ماه ثبت کن"],
    family: ["با افراد درگیر صحبت و هم‌رأی شو", "تقویم مشترک برای برنامه‌ها بچین", "اولین قرار کوچک را همین هفته برگزار کن", "مسئولیت‌ها را تقسیم کن", "یک سنت کوچک برای تداوم بساز"],
    personal: ["هدف را به قدم‌های کوچک قابل‌اندازه‌گیری بشکن", "زمان مشخصی در هفته به آن اختصاص بده", "مانع اصلی‌ات را بنویس و راه‌حل بده", "ابزارهای موردنیاز را فراهم کن", "از یک دوست همراه بخواه"],
  };
  return (templates[category] || templates.personal).map((t, i) => ({
    title: t,
    priority: i < 2 ? "high" : "medium",
    dueInDays: (i + 1) * 3,
  }));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("goals", "enableAIAssist");
    if (gate) return gate;

    // سهمیه روزانه یکپارچه AI — این روت قبلاً بدون هیچ محدودیتی بود
    const budgetGate = await guardAiBudget(auth.id, "goal_ai");
    if (budgetGate) return budgetGate;

    const { id } = await params;
    const goal = await db.goal.findFirst({
      where: { id, userId: auth.id },
      include: { tasks: { orderBy: { sortOrder: "asc" } } },
    });
    if (!goal) return fail("هدف یافت نشد", 404);

    const body = await parseJson<{ mode?: "breakdown" | "coaching"; question?: string }>(req);
    const mode = body?.mode === "coaching" ? "coaching" : "breakdown";

    // ─── آمار واقعی هدف ───
    const done = goal.tasks.filter((t) => t.status === "done").length;
    const inProgress = goal.tasks.filter((t) => t.status === "in_progress").length;
    const now = new Date();
    const overdue = goal.tasks.filter((t) => t.dueDate && t.dueDate < now && t.status !== "done").length;
    const left = daysLeft(goal.deadline);
    const remaining = goal.tasks.length - done;

    const contextText = [
      `هدف: «${goal.title}»`,
      `دسته: ${CAT_FA[goal.category] || goal.category} | اولویت: ${PRIO_FA[goal.priority] || goal.priority}`,
      goal.description ? `توضیح کاربر: ${goal.description}` : null,
      `پیشرفت فعلی: ${goal.progress}٪ (${done} از ${goal.tasks.length} وظیفه انجام شده، ${inProgress} در حال انجام، ${remaining} باقی‌مانده)`,
      left !== null
        ? `مهلت: ${left >= 0 ? `${left} روز مانده` : `${Math.abs(left)} روز گذشته (عقب‌افتادگی!)`}`
        : "مهلت: تعیین‌نشده",
      `وظایف دارای تأخیر: ${overdue}`,
      goal.tasks.length > 0
        ? `وظایف موجود:\n${goal.tasks.slice(0, 20).map((t) => `- [${t.status === "done" ? "انجام‌شده" : t.status === "in_progress" ? "در حال انجام" : "در انتظار"}${t.dueDate ? `، موعد: ${new Date(t.dueDate).toISOString().slice(0, 10)}` : ""}] ${t.title}`).join("\n")}`
        : "هیچ وظیفه‌ای هنوز تعریف نشده است",
    ].filter(Boolean).join("\n");

    // ═════ حالت ۱: تفکیک هوشمند وظایف ═════
    if (mode === "breakdown") {
      const messages: ChatMsg[] = [
        {
          role: "system",
          content: `تو «هوشیار» هستی، برنامه‌ریز حرفه‌ای اهداف در اپلیکیشن شهریار. کاربر یک هدف دارد؛ وظایف اجرایی دقیق و عملی برای آن تولید کن.

قواعد:
- دقیقاً ۶ تا ۹ وظیفه؛ هر یک یک اقدام مشخص و قابل‌انجام باشد (با فعل اجرایی شروع شود)
- ترتیب منطقی: از groundwork تا تکمیل
- اولویت‌ها فقط از این مقادیر: low | medium | high | critical
- dueInDays: فاصله تا موعد بر حسب روز (۰ تا ۹۰)
- اگر وظایف موجودند، مکملشان باش — تکرار نکن
- متن فارسی روان و کوتاه (حداکثر ~۶۰ کاراکتر)
- زمینه ایران: واقع‌بین و در دسترس

فقط JSON خالص، بدون هیچ متن اضافه:
{"tasks":[{"title":"...","priority":"medium","dueInDays":5}]}`,
        },
        { role: "user", content: contextText },
      ];

      let suggestions: SuggestedTask[] | null = null;
      const meter = createMeter();
      try {
        const res = await meter.run(() => chatCompletion(messages, { temperature: 0.7, maxTokens: 2048 }));
        suggestions = extractJsonArray(res?.choices?.[0]?.message?.content || "");
      } catch (err) {
        console.error("خطای مدل تفکیک اهداف:", err);
      }

      // ─── ثبت مصرف دقیق ───
      const snap = meter.snapshot();
      if (snap.calls > 0) {
        await recordUsageSafe({
          userId: auth.id,
          feature: "goal_ai",
          inputTokens: snap.inputTokens,
          outputTokens: snap.outputTokens,
          estimated: snap.estimated,
          model: snap.model,
          title: `تفکیک هدف: ${goal.title}`.slice(0, 120),
          refId: goal.id,
          meta: { action: "breakdown", progress: goal.progress, tasks: goal.tasks.length },
        });
      }

      if (!suggestions || suggestions.length === 0) {
        suggestions = heuristicBreakdown(goal.category, goal.title);
      }

      await logActivity({
        userId: auth.id, action: "ai.goal_breakdown", entity: "goal", entityId: goal.id,
        details: { count: suggestions.length, aiGenerated: true },
      });

      return ok({ mode, suggestions, aiGenerated: true });
    }

    // ═════ حالت ۲: تحلیل و مربی‌گری ═════
    const question = body?.question?.trim().slice(0, 500) || "";
    const coachingMessages: ChatMsg[] = [
      {
        role: "system",
        content: `تو «هوشیار» هستی، مربی و تحلیلگر حرفه‌ای اهداف در اپلیکیشن شهریار. تحلیل دقیق و داده‌محور از وضعیت هدف کاربر ارائه بده.

ساختار پاسخ (Markdown فارسی):
## 📊 وضعیت فعلی — خلاصه‌ی داده‌محور با اعداد واقعی
## 💪 نقاط قوت — چه چیزهایی خوب پیش می‌رود
## ⚠️ ریسک‌ها و گلوگاه‌ها — صادقانه و مشخص
## 🎯 برنامه‌ی عملی هفته‌ی آینده — ۳ اقدام مشخص با روز/زمان تقریبی
## ✨ یک جمله‌ی انگیزشی کوتاه و گرم

قواعد: به اعداد واقعی اشاره کن (درصد پیشرفت، روزهای مانده، وظایف معوق). لحن گرم و خودمانی مثل یک مربی خوب، اما حرفه‌ای. اگر هدف عقب افتاده، صادق باش و اولویت‌بندی واقعی بده. کوتاه و پرکاربرد — نه موعظه‌ی کلی.`,
      },
      { role: "system", content: `داده‌های واقعی هدف:\n${contextText}` },
    ];
    if (question) coachingMessages.push({ role: "user", content: question });
    else coachingMessages.push({
      role: "user",
      content: "تحلیل کامل این هدف را با داده‌های بالا ارائه بده.",
    });

    let reply: string | null = null;
    const meter = createMeter();
    try {
      const res = await meter.run(() => chatCompletion(coachingMessages, { thinking: true, temperature: 0.6, maxTokens: 4096 }));
      reply = res?.choices?.[0]?.message?.content || null;
    } catch (err) {
      console.error("خطای مدل مربی‌گری اهداف:", err);
    }

    // ─── ثبت مصرف دقیق ───
    const snap = meter.snapshot();
    if (snap.calls > 0) {
      await recordUsageSafe({
        userId: auth.id,
        feature: "goal_ai",
        inputTokens: snap.inputTokens,
        outputTokens: snap.outputTokens,
        estimated: snap.estimated,
        model: snap.model,
        title: `مربی‌گری هدف: ${goal.title}`.slice(0, 120),
        refId: goal.id,
        meta: { action: "coaching", progress: goal.progress, tasks: goal.tasks.length, question: question.slice(0, 200) },
      });
    }

    // fallback قاعده‌محور
    if (!reply) {
      const parts: string[] = [];
      parts.push(`## 📊 وضعیت فعلی`);
      parts.push(`پیشرفت **${goal.progress}٪** — ${done} از ${goal.tasks.length} وظیفه انجام شده و ${remaining} وظیفه باقی مانده.`);
      if (inProgress > 0) parts.push(`${inProgress} وظیفه در حال انجام است.`);
      parts.push("");
      parts.push(`## 💪 نقاط قوت`);
      parts.push(done > 0 ? `• تاکنون ${done} وظیفه را تمام کرده‌ای — مسیر درست است، ادامه بده.` : "• هدف را تعریف کرده‌ای؛ قدم اولِ هر مسیری همین است.");
      parts.push("");
      parts.push(`## ⚠️ ریسک‌ها و گلوگاه‌ها`);
      if (left !== null && left < 0) parts.push(`• مهلت ${Math.abs(left)} روز گذشته است! اولویت‌بندی مجدد یا تمدید مهلت لازم است.`);
      else if (left !== null && left <= 7 && goal.progress < 80) parts.push(`• فقط ${left} روز تا مهلت مانده و پیشرفت ${goal.progress}٪ است — سرعت را افزایش بده.`);
      if (overdue > 0) parts.push(`• ${overdue} وظیفه‌ی دارای موعدِ گذشته داری.`);
      if (goal.progress === 0) parts.push("• هنوز شروع نشده؛ یک وظیفه‌ی کوچک امروز انجام بده تا یخِ شروع بشکند.");
      if (parts[parts.length - 1] === `## ⚠️ ریسک‌ها و گلوگاه‌ها`) parts.push("• وضعیت کنترل‌شده است.");
      parts.push("");
      parts.push(`## 🎯 برنامه‌ی عملی هفته‌ی آینده`);
      parts.push(`• امروز: یک وظیفه‌ی کوچک از ستون «در انتظار» را شروع کن`);
      parts.push(`• تا پایان هفته: پیشرفت را به دست کم ${Math.min(100, goal.progress + 20)}٪ برسان`);
      if (inProgress > 0) parts.push("• وظایف نیمه‌کاره را قبل از شروع کار جدید ببند");
      parts.push("");
      parts.push(`## ✨`);
      parts.push(`هر قدم کوچک، سنگِ بنای «${goal.title}» است. ادامه بده! 🌱`);
      reply = parts.join("\n");
    }

    await logActivity({
      userId: auth.id, action: "ai.goal_coaching", entity: "goal", entityId: goal.id,
      details: { mode: question ? "question" : "analysis" },
    });

    return ok({ mode, reply, aiGenerated: true });
  } catch (err) {
    console.error("خطای هوشیار اهداف:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
