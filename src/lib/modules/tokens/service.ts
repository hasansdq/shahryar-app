// ═══════════════════════════════════════════════════════════════
// اقتصاد توکن — سرویس کیف پول (عملیات اتمیک)
//
// اصل طلایی: موجودی فقط از طریق عملیات اتمیک تغییر می‌کند؛
// کسر مصرف (recordUsage در usage.ts) با «کاهش شرطی اتمیک»
// انجام می‌شود تا در درخواست‌های موازی هرگز موجودی منفی نشود.
// ═══════════════════════════════════════════════════════════════
import { db } from "@/lib/db";
import { getTokenSettings } from "./settings";
import { getUserUsageAnalytics } from "./usage";
import type { WalletSummaryDto, WalletTransactionDto } from "./types";

const TX_PAGE_SIZE = 30;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * دریافت/ساخت کیف پول — اولین ساخت، «هدیه خوش‌آمد» را هم اتمیک
 * اعمال می‌کند (هم کاربران جدید هم قدیمی‌ها در اولین مراجعه).
 */
export async function ensureWallet(userId: string) {
  const existing = await db.tokenWallet.findUnique({ where: { userId } });
  if (existing) return existing;

  const settings = await getTokenSettings();
  const bonus = settings.enabled ? settings.signupBonus : 0;

  return db.$transaction(async (tx) => {
    // رقابت دو درخواست هم‌زمان روی ساخت کیف پول — upsert ایمن
    const wallet = await tx.tokenWallet.upsert({
      where: { userId },
      create: {
        userId,
        balance: bonus,
        lifetimeGranted: bonus,
      },
      update: {},
    });
    // اگر همین الان ساخته شد و هدیه دارد → ثبت تراکنش هدیه
    if (bonus > 0 && wallet.balance === bonus && wallet.lifetimeGranted === bonus) {
      const dup = await tx.tokenTransaction.findFirst({
        where: { userId, type: "signup_bonus" },
        select: { id: true },
      });
      if (!dup) {
        await tx.tokenTransaction.create({
          data: {
            walletId: wallet.id,
            userId,
            type: "signup_bonus",
            amount: bonus,
            balanceAfter: bonus,
            note: "هدیه خوش‌آمدگویی شهریار",
          },
        });
      }
    }
    return wallet;
  });
}

export interface GrantInput {
  userId: string;
  amount: number; // علامت‌دار
  type: "purchase" | "daily_bonus" | "admin_grant" | "admin_deduct" | "refund" | "economy_upgrade";
  feature?: string | null;
  refId?: string | null;
  note?: string | null;
}

/** افزایش/کاهش مدیریتی یا اعتبار خرید — اتمیک با ثبت تراکنش */
export async function applyGrant(input: GrantInput): Promise<{ balance: number }> {
  const amount = Math.round(input.amount);
  if (amount === 0) throw new Error("مقدار توکن نمی‌تواند صفر باشد");

  const wallet = await ensureWallet(input.userId);

  const result = await db.$transaction(async (tx) => {
    const w = await tx.tokenWallet.update({
      where: { userId: input.userId },
      data: {
        balance: { increment: amount },
        lifetimeGranted: amount > 0 ? { increment: amount } : undefined,
        lifetimePurchased: input.type === "purchase" && amount > 0 ? { increment: amount } : undefined,
        lifetimeSpent: input.type === "admin_deduct" && amount < 0 ? { increment: -amount } : undefined,
        lastDailyBonusAt: input.type === "daily_bonus" ? new Date() : undefined,
      },
    });
    await tx.tokenTransaction.create({
      data: {
        walletId: w.id,
        userId: input.userId,
        type: input.type,
        amount,
        balanceAfter: w.balance,
        feature: input.feature ?? null,
        refId: input.refId ?? null,
        note: input.note ?? null,
      },
    });
    return w;
  });

  return { balance: result.balance };
}

/** آیا پاداش روزانه امروز دریافت شده؟ */
export async function isDailyBonusAvailable(userId: string): Promise<boolean> {
  const wallet = await ensureWallet(userId);
  if (!wallet.lastDailyBonusAt) return true;
  return wallet.lastDailyBonusAt < startOfToday();
}

/** دریافت پاداش روزانه — idempotent در برابر روز */
export async function claimDailyBonus(userId: string): Promise<{ granted: number; balance: number }> {
  const settings = await getTokenSettings();
  const amount = settings.enabled ? settings.dailyBonus : 0;
  if (amount <= 0) return { granted: 0, balance: (await ensureWallet(userId)).balance };

  const available = await isDailyBonusAvailable(userId);
  if (!available) {
    return { granted: 0, balance: (await ensureWallet(userId)).balance };
  }

  const res = await applyGrant({
    userId,
    amount,
    type: "daily_bonus",
    note: "پاداش روزانه حضور",
  });
  return { granted: amount, balance: res.balance };
}

/** خلاصه کامل کیف پول برای UI کاربر — موجودی، قیمت‌گذاری، تحلیل مصرف و دفتر */
export async function getWalletSummary(userId: string): Promise<WalletSummaryDto> {
  const settings = await getTokenSettings();
  const [wallet, bonusAvailable, txs, analytics] = await Promise.all([
    ensureWallet(userId),
    isDailyBonusAvailable(userId),
    db.tokenTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: TX_PAGE_SIZE,
    }),
    getUserUsageAnalytics(userId, 30),
  ]);

  const transactions: WalletTransactionDto[] = txs.map((t) => ({
    id: t.id,
    type: t.type,
    amount: t.amount,
    balanceAfter: t.balanceAfter,
    feature: t.feature,
    note: t.note,
    createdAt: t.createdAt.toISOString(),
  }));

  // مصرف امروز/۷روز از سری روزانه‌ی تحلیل (بدون کوئری اضافه)
  const daily = analytics.daily;
  const spentToday = daily.length > 0 ? (daily[daily.length - 1]?.tokens ?? 0) : 0;
  const spent7d = daily.slice(-7).reduce((s, d) => s + d.tokens, 0);

  return {
    balance: wallet.balance,
    lifetimeGranted: wallet.lifetimeGranted,
    lifetimePurchased: wallet.lifetimePurchased,
    lifetimeSpent: wallet.lifetimeSpent,
    dailyBonusAvailable: bonusAvailable && settings.dailyBonus > 0,
    dailyBonusAmount: settings.dailyBonus,
    pricing: {
      pricePerMillion: settings.pricePerMillion,
      minChargeTokens: settings.minChargeTokens,
      maxChargeTokens: settings.maxChargeTokens,
      imageGenTokens: settings.imageGenTokens,
    },
    spentToday,
    spent7d,
    spent30d: analytics.totalTokens,
    analytics,
    transactions,
  };
}
