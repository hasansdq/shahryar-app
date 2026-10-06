// ═══════════════════════════════════════════════════════════════
// گارت مصرف هوش مصنوعی — تک‌نقطه‌ی کنترل هزینه‌ی پلتفرم
//
// دو رژیم (تنظیم از CMS → اقتصاد توکن):
//  • اقتصاد «روشن» (پیش‌فرض): موجودی کیف توکن = اعتبار مصرف،
//    دقیقاً مثل API. هر فراخوانی واقعاً متر و کسر می‌شود؛
//    موجودی صفر → ۴۲۹ با راهنمای شارژ. سهمیه‌ی درخواست روزانه
//    اعمال نمی‌شود (پرداخت‌کننده محدود نیست).
//  • اقتصاد «خاموش»: دقیقاً رفتار قدیمی — سهمیه رایگان روزانه‌ی
//    مشترک (ai_settings.dailyMessageLimit، پیش‌فرض ۱۵۰) از
//    ActivityLog (اکشن‌های ai.*)؛ پر شد → ۴۲۹ کلاسیک.
// ═══════════════════════════════════════════════════════════════
import { fail } from "./api";
import { logActivity } from "./logger";
import { getTokenSettings } from "@/lib/modules/tokens/settings";
import { ensureWallet } from "@/lib/modules/tokens/service";
import { db } from "@/lib/db";
import type { TokenFeature } from "@/lib/modules/tokens/types";

const AI_ACTION_PREFIX = "ai.";

/** سقف روزانه از پنل مدیریت (ai_settings.dailyMessageLimit) — پیش‌فرض ۱۵۰ */
export async function getDailyAiLimit(): Promise<number> {
  try {
    const row = await db.setting.findUnique({ where: { key: "ai_settings" } });
    if (row) {
      const parsed = JSON.parse(row.value);
      const n = Number(parsed?.dailyMessageLimit);
      if (Number.isFinite(n) && n >= 1 && n <= 10000) return Math.round(n);
    }
  } catch {
    /* تنظیمات خراب → پیش‌فرض */
  }
  return 150;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** تعداد فراخوانی‌های AI کاربر از ابتدای امروز (همه‌ی سطوح) */
export async function countAiCallsToday(userId: string): Promise<number> {
  return db.activityLog.count({
    where: {
      userId,
      action: { startsWith: AI_ACTION_PREFIX },
      createdAt: { gte: startOfToday() },
    },
  });
}

export interface AiBudgetStatus {
  allowed: boolean;
  used: number;
  limit: number;
  retryAfterSec: number; // ثانیه تا نیمه‌شب (بازنشانی سهمیه)
}

/**
 * گارت مصرف — قبل از فراخوانی مدل صدا زده می‌شود.
 * خروجی null یعنی مجاز؛ وگرنه پاسخ ۴۲۹ آماده برای return.
 */
export async function guardAiBudget(
  userId: string,
  _feature: TokenFeature = "chat"
): Promise<ReturnType<typeof fail> | null> {
  const settings = await getTokenSettings();

  // ─── رژیم اقتصاد توکن: گیت موجودی (مثل API) ───
  if (settings.enabled) {
    const wallet = await ensureWallet(userId);
    if (wallet.balance >= 1) return null;
    return fail(
      "اعتبار توکن هوش مصنوعی شما به پایان رسیده است. از بخش «توکن‌ها» کیف پول خود را شارژ کنید تا در همه‌ی بخش‌های شهریار (هوشیار، ایجنت‌ها و...) ادامه دهید",
      429,
      { code: "TOKENS_EXHAUSTED", balance: 0 }
    );
  }

  // ─── رژیم کلاسیک (اقتصاد خاموش): سهمیه رایگان روزانه — دقیقاً رفتار قبلی ───
  const [used, limit] = await Promise.all([countAiCallsToday(userId), getDailyAiLimit()]);
  if (used < limit) return null;

  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const retryAfterSec = Math.max(60, Math.ceil((midnight.getTime() - now.getTime()) / 1000));
  const hours = Math.ceil(retryAfterSec / 3600).toLocaleString("fa-IR");
  const limitFa = limit.toLocaleString("fa-IR");

  return fail(
    `سهمیه هوش مصنوعی امروز شما تکمیل شده است (${limitFa} درخواست در همه‌ی بخش‌ها). حدود ${hours} ساعت دیگر دوباره در دسترس است`,
    429
  );
}

/**
 * ثبت مصرف — بعد از هر فراخوانی واقعی مدل (موفق یا ناموفق؛ هر دو هزینه
 * پلتفرم‌اند). اکشن باید با «ai.» شروع شود تا در شمارش بودجه بیاید.
 */
export async function logAiCall(
  userId: string,
  action: string,
  details: Record<string, unknown> = {},
  ip?: string,
  userAgent?: string
): Promise<void> {
  if (!action.startsWith(AI_ACTION_PREFIX)) {
    console.warn(`[ai-budget] اکشن «${action}» با پیشوند ai. شروع نمی‌شود — در بودجه شمرده نمی‌شود`);
  }
  try {
    await logActivity({ userId, action, entity: "ai", details: { ...details, budgetCounted: true }, ip, userAgent });
  } catch (err) {
    console.error("[ai-budget] خطای ثبت مصرف:", err);
  }
}
