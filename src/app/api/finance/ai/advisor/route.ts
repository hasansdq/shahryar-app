// ═════ مشاور مالی AI — POST /api/finance/ai/advisor ═════
// از هوش مصنوعی سراسریِ ست‌شده در سیستم استفاده می‌کند:
//   • ai_system_prompt (شخصیت/لحن/قوانین — قابل ویرایش در پنل مدیریت)
//   • ai_settings (حالت تفکر، دما و ... — قابل ویرایش در پنل مدیریت)
// تحلیل حرفه‌ای وضعیت مالی واقعی کاربر + چت مشاوره‌ای
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { rateLimit } from "@/lib/core/rate-limit";
import { guardAiBudget } from "@/lib/core/ai-budget";
import { chatCompletion, type ChatMsg } from "@/lib/modules/ai/zai";
import { createMeter } from "@/lib/modules/tokens/meter";
import { recordUsageSafe } from "@/lib/modules/tokens/usage";
import { buildFinanceSnapshot } from "@/lib/modules/finance/service";
import { financeSnapshotForAdvisor, FINANCIAL_ADVISOR_SYSTEM_PROMPT_BASE, toman } from "@/lib/modules/finance/ai-context";
import { isFinanceRelated } from "@/lib/modules/finance/ai-context";

interface GlobalPromptConfig {
  persona: string;
  tone: string;
  rules: string[];
}
interface GlobalAiSettings {
  thinkingEnabled?: boolean;
  temperature?: number;
  [k: string]: unknown;
}

/** خواندن پیکربندی سراسری AI از تنظیمات سیستم (پنل مدیریت) */
async function getGlobalAiConfig(): Promise<{
  prompt: GlobalPromptConfig;
  settings: GlobalAiSettings;
}> {
  const defaults: GlobalPromptConfig = {
    persona: "هوشیار",
    tone: "گرم، محترمانه و همراهانه",
    rules: [],
  };
  try {
    const [promptSetting, aiSetting] = await Promise.all([
      db.setting.findUnique({ where: { key: "ai_system_prompt" } }),
      db.setting.findUnique({ where: { key: "ai_settings" } }),
    ]);
    const prompt = promptSetting
      ? { ...defaults, ...JSON.parse(promptSetting.value) }
      : defaults;
    const settings: GlobalAiSettings = aiSetting ? JSON.parse(aiSetting.value) : {};
    return { prompt, settings };
  } catch {
    return { prompt: defaults, settings: {} };
  }
}

/** ساخت پرامپت سیستم مشاور بر پایه‌ی پیکربندی سراسری */
function buildAdvisorSystemPrompt(cfg: GlobalPromptConfig): string {
  const parts: string[] = [];
  parts.push(
    `تو «${cfg.persona}» هستی که در این نوبت در نقش «مشاور مالی هوشمند» — تحلیلگر حرفه‌ای مدیریت مالی شخصی در اپلیکیشن شهریار — پاسخ می‌دهی.`
  );
  parts.push(`لحن تو (طبق تنظیمات سراسری سیستم): ${cfg.tone}.`);
  parts.push(FINANCIAL_ADVISOR_SYSTEM_PROMPT_BASE);
  if (cfg.rules && cfg.rules.length > 0) {
    parts.push(
      `قوانین سراسری سیستم (در همه‌ی پاسخ‌هایت رعایت کن):\n${cfg.rules.map((r, i) => `${i + 1}. ${r}`).join("\n")}`
    );
  }
  return parts.join("\n\n");
}

/** تحلیل قاعده‌محور سریع (fallback وقتی AI در دسترس نیست) */
function ruleBasedAnalysis(snap: Awaited<ReturnType<typeof buildFinanceSnapshot>>): string {
  const parts: string[] = [];
  parts.push(`## 📋 خلاصه وضعیت مالی — ${snap.monthLabel}`);
  parts.push(`موجودی کل شما ${toman(snap.totalCash)} تومان است. درآمد و هزینه‌ی این ماه به‌ترتیب ${toman(snap.current.income)} و ${toman(snap.current.expense)} تومان بوده است.`);
  parts.push("");
  parts.push("## 📈 روند ۶ ماهه");
  parts.push(snap.trend.map((t) => `• ${t.label}: درآمد ${toman(t.income)} / هزینه ${toman(t.expense)} — پس‌مانده ${toman(t.net)}`).join("\n"));
  parts.push("");
  if (snap.topCategories.length > 0) {
    parts.push("## 🔍 پرهزینه‌ترین دسته‌های ماه");
    parts.push(snap.topCategories.slice(0, 5).map((c) => `• ${c.name}: ${toman(c.total)} تومان (${c.count} تراکنش)`).join("\n"));
    parts.push("");
  }
  parts.push(`## 💯 امتیاز سلامت مالی: ${snap.health.score}/100`);
  for (const c of snap.health.components) parts.push(`• ${c.label}: ${c.score}/100 — ${c.note}`);
  parts.push("");
  parts.push("## 💡 توصیه‌های فوری");
  if (snap.health.savingsRate < 10) parts.push("• نرخ پس‌انداز شما پایین است؛ هدف‌گذاری کنید حداقل ۱۰٪ هر درآمد کنار بماند.");
  if (snap.debts.iOwe > 0) parts.push(`• بدهی باز ${toman(snap.debts.iOwe)} تومان دارید؛ اولویت تسویه‌ی نزدیک‌ترین سررسید.`);
  if (snap.budgets.length === 0 && snap.topCategories.length > 0) parts.push("• هنوز بودجه‌ای تعریف نکرده‌اید؛ با سقف‌گذاری ۳ دسته‌ی پرهزینه شروع کنید.");
  if (snap.goals.length === 0) parts.push("• یک هدف پس‌انداز کوچک بسازید تا موتور انگیزه‌ی مالی روشن شود.");
  parts.push("• برای تحلیل عمیق‌تر و شخصی‌تر، کمی بعد دوباره تلاش کنید (اگر پیام مشاور در دسترس نبود).");
  return parts.join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("finance", "enableAdvisor");
    if (gate) return gate;

    const body = await parseJson<{
      question?: string; // سؤال اختیاری کاربر
      history?: Array<{ role: "user" | "assistant"; content: string }>; // گفتگوی مشاور
    }>(req);

    // ─── گارد هزینه AI: نرخ + سهمیه روزانه یکپارچه ───
    // این روت قبلاً هیچ محدودیتی نداشت — با ورودی نامحدود هر کاربر
    // می‌توانست هزینه توکن پلتفرم را بی‌نهایت کند
    const rl = rateLimit(`ai-advisor:${auth.id}`, 10, 60 * 60_000); // ۱۰ درخواست در ساعت
    if (!rl.allowed) {
      return fail(`درخواست‌های مشاور مالی زیاد است؛ ${rl.retryAfterSec} ثانیه دیگر تلاش کنید`, 429);
    }
    const budgetGate = await guardAiBudget(auth.id, "finance_advisor");
    if (budgetGate) return budgetGate;

    // ─── کپ ورودی‌ها (قبل از ساخت پرامپت) ───
    const MAX_QUESTION_CHARS = 2000;
    const userQuestion = typeof body?.question === "string" ? body.question.trim().slice(0, MAX_QUESTION_CHARS) : "";
    const history = (Array.isArray(body?.history) ? body.history : [])
      .slice(-8)
      .filter((m) => m && typeof m.content === "string" && m.content.trim())
      .map((m) => ({ role: m.role === "assistant" ? ("assistant" as const) : ("user" as const), content: m.content.slice(0, 2000) }));

    // ─── ساخت snapshot واقعی مالی ───
    const snap = await buildFinanceSnapshot(auth.id);
    const snapshotText = financeSnapshotForAdvisor(snap);

    // ─── پیکربندی سراسری AI سیستم (پنل مدیریت) ───
    const { prompt: globalPrompt, settings: globalSettings } = await getGlobalAiConfig();

    // ─── پیام‌های مدل ───
    const messages: ChatMsg[] = [
      { role: "system", content: buildAdvisorSystemPrompt(globalPrompt) },
      {
        role: "system",
        content: `${snapshotText}\n\nاین داده‌ها را مبنا قرار بده؛ اگر بخشی خالی است (مثلاً بدون تراکنش)، کاربر را دعوت به ثبت داده در بخش مالی اپ کن.`,
      },
    ];

    // تاریخچه‌ی گفتگو (هر پیام حداکثر ۲هزار کاراکتر — کپ سمت سرور)
    for (const m of history) {
      messages.push({ role: m.role, content: m.content.slice(0, 2000) });
    }

    if (userQuestion) {
      messages.push({
        role: "user",
        content: isFinanceRelated(userQuestion) || history.length > 0
          ? userQuestion
          : `${userQuestion}\n\n(یادآوری: پاسخ را در چارچوب مشاوره‌ی مالی با تمرکز بر وضعیت واقعی کاربر بده)`,
      });
    } else {
      messages.push({
        role: "user",
        content: "یک تحلیل کامل و حرفه‌ای از وضعیت مالی فعلی‌ام ارائه بده: نقاط قوت، ریسک‌ها، و برنامه‌ی عملی برای ۳ ماه آینده.",
      });
    }

    // ─── فراخوانی مدل با پارامترهای سراسری سیستم ───
    // thinkingEnabled و temperature از تنظیمات AI پنل مدیریت می‌آیند
    const thinking = globalSettings.thinkingEnabled !== false; // پیش‌فرض روشن
    const rawTemp = Number(globalSettings.temperature);
    const temperature = Number.isFinite(rawTemp) && rawTemp >= 0 && rawTemp <= 2 ? rawTemp : 0.6;

    let analysis: string | null = null;
    const meter = createMeter();
    try {
      const res = await meter.run(() =>
        chatCompletion(messages, {
          thinking,
          temperature,
          maxTokens: 4096,
        })
      );
      analysis = res?.choices?.[0]?.message?.content || null;
    } catch (err) {
      console.error("خطای مدل مشاور مالی:", err);
    }

    // ─── ثبت مصرف دقیق مشاور مالی ───
    const msnap = meter.snapshot();
    if (msnap.calls > 0) {
      await recordUsageSafe({
        userId: auth.id,
        feature: "finance_advisor",
        inputTokens: msnap.inputTokens,
        outputTokens: msnap.outputTokens,
        estimated: msnap.estimated,
        model: msnap.model,
        title: userQuestion ? `پرسش مشاور مالی` : "تحلیل کامل مالی",
        meta: {
          mode: userQuestion ? "question" : "analysis",
          healthScore: snap.health.score,
          thinking,
        },
      });
    }

    const content = analysis || ruleBasedAnalysis(snap);

    await logActivity({
      userId: auth.id,
      action: "ai.finance_advisor",
      entity: "finance",
      details: {
        mode: userQuestion ? "question" : "analysis",
        snapshotScore: snap.health.score,
        globalPersona: globalPrompt.persona,
        thinking,
      },
    });

    return ok({
      reply: content,
      health: snap.health,
      monthLabel: snap.monthLabel,
      aiGenerated: Boolean(analysis),
    });
  } catch (err) {
    console.error("خطای مشاور مالی:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
