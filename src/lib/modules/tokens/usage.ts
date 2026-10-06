// ═══════════════════════════════════════════════════════════════
// اقتصاد توکن — ثبت مصرف دقیق و تحلیل‌ها
//
// recordUsage: پس از هر فراخوانی AI صدا زده می‌شود؛ مصرف واقعی
// (ورودی + خروجی) را در TokenUsage با متادیتای کامل ثبت و به‌صورت
// اتمیک از کیف کسر می‌کند (کف: صفر — مثل صورتحساب API آخرین
// فراخوانی ممکن است موجودی را تا صفر کاهش دهد نه منفی).
//
// تحلیل‌ها: سری روزانه + تفکیک بخش/ویژگی برای کاربر و ادمین.
// ═══════════════════════════════════════════════════════════════
import { db } from "@/lib/db";
import { getTokenSettings } from "./settings";
import {
  FEATURE_LABELS,
  FEATURE_TO_SECTION,
  SECTION_LABELS,
  type TokenFeature,
  type TokenUsageDto,
  type UsageAnalyticsDto,
} from "./types";

export interface RecordUsageInput {
  userId: string;
  feature: TokenFeature;
  inputTokens: number;
  outputTokens: number;
  /** هزینه ثابت اضافه (مثل توکن به ازای هر تصویر تولیدی) */
  extraTokens?: number;
  estimated?: boolean;
  model?: string | null;
  title?: string | null;
  refId?: string | null;
  meta?: Record<string, unknown>;
}

export interface RecordUsageResult {
  recorded: boolean;
  totalTokens: number;
  charged: number;
  balance: number;
}

/** ثبت یک مصرف دقیق — همیشه رکورد usage؛ کسر فقط با اقتصاد فعال */
export async function recordUsage(input: RecordUsageInput): Promise<RecordUsageResult> {
  const inputT = Math.max(0, Math.round(input.inputTokens));
  const outputT = Math.max(0, Math.round(input.outputTokens));
  const extraT = Math.max(0, Math.round(input.extraTokens ?? 0));
  const totalTokens = inputT + outputT + extraT;
  if (totalTokens <= 0) return { recorded: false, totalTokens: 0, charged: 0, balance: 0 };

  const settings = await getTokenSettings();
  const section = FEATURE_TO_SECTION[input.feature] ?? "hoshyar";
  const metaStr = input.meta
    ? JSON.stringify(input.meta).slice(0, 4000)
    : null;

  // ─── اقتصاد خاموش: فقط ثبت آماری (بدون کسر) ───
  if (!settings.enabled) {
    await db.tokenUsage.create({
      data: {
        userId: input.userId,
        feature: input.feature,
        section,
        inputTokens: inputT,
        outputTokens: outputT,
        totalTokens,
        chargedTokens: 0,
        estimated: Boolean(input.estimated),
        model: input.model?.slice(0, 60) ?? null,
        title: input.title?.slice(0, 120) ?? null,
        refId: input.refId ?? null,
        meta: metaStr,
      },
    });
    const w = await db.tokenWallet.findUnique({ where: { userId: input.userId } });
    return { recorded: true, totalTokens, charged: 0, balance: w?.balance ?? 0 };
  }

  // ─── اقتصاد فعال: کسر اتمیک با کف صفر ───
  const wallet = await db.tokenWallet.findUnique({ where: { userId: input.userId } });
  const balanceBefore = wallet?.balance ?? 0;
  let charged = Math.min(totalTokens, Math.max(0, balanceBefore));

  if (charged > 0) {
    // کاهش شرطی اتمیک — اگر درخواست موازی زودتر موجودی را برداشت،
    // این فراخوانی بدون کسر ثبت می‌شود (جمع کسرها هرگز از موجودی بیشتر نمی‌شود)
    const res = await db.tokenWallet.updateMany({
      where: { userId: input.userId, balance: { gte: charged } },
      data: {
        balance: { decrement: charged },
        lifetimeSpent: { increment: charged },
      },
    });
    if (res.count !== 1) charged = 0;
  }

  const updated = await db.tokenWallet.findUnique({ where: { userId: input.userId } });
  const balanceAfter = updated?.balance ?? Math.max(0, balanceBefore - charged);

  // دفتر مالی — فقط وقتی کسر واقعی انجام شد
  if (charged > 0 && wallet) {
    await db.tokenTransaction.create({
      data: {
        walletId: wallet.id,
        userId: input.userId,
        type: "spend",
        amount: -charged,
        balanceAfter,
        feature: input.feature,
        refId: input.refId ?? null,
      },
    });
  }

  await db.tokenUsage.create({
    data: {
      userId: input.userId,
      feature: input.feature,
      section,
      inputTokens: inputT,
      outputTokens: outputT,
      totalTokens,
      chargedTokens: charged,
      estimated: Boolean(input.estimated),
      model: input.model?.slice(0, 60) ?? null,
      title: input.title?.slice(0, 120) ?? null,
      refId: input.refId ?? null,
      meta: metaStr,
    },
  });

  return { recorded: true, totalTokens, charged, balance: balanceAfter };
}

/**
 * ثبت مصرف «امن» — خطای مترینگ/داٹابیس هرگز پاسخ اصلی کاربر را
 * نمی‌شکند؛ فقط لاگ می‌شود (مصرف بعدی جبران‌پذیر است).
 */
export async function recordUsageSafe(input: RecordUsageInput): Promise<RecordUsageResult | null> {
  try {
    return await recordUsage(input);
  } catch (err) {
    console.error("[tokens/usage] خطای ثبت مصرف:", err);
    return null;
  }
}

// ─── تحلیل مصرف ───

// ایران UTC+3:30 ثابت (از ۱۴۰۱ ساعت تابستانی ندارد) — «امروزِ» کاربر یعنی روز تهران
const IRAN_OFFSET_MS = 210 * 60_000;

/** کلید روز تهران (YYYY-MM-DD) از یک لحظه UTC */
export function tehranDayKey(utc: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(utc);
}

/** نیمه‌شب تهرانِ N روز پیش (به UTC) — شروع بازه روزهای تهران */
export function tehranMidnightUtc(daysAgo: number): Date {
  const tehranNow = new Date(Date.now() + IRAN_OFFSET_MS);
  const midnightTehranLocal = Date.UTC(
    tehranNow.getUTCFullYear(), tehranNow.getUTCMonth(), tehranNow.getUTCDate()
  );
  return new Date(midnightTehranLocal - IRAN_OFFSET_MS - (daysAgo - 1) * 86_400_000);
}

function startOfDaysAgo(days: number): Date {
  return tehranMidnightUtc(days);
}

/** پرکردن روزهای خالی سری روزانه (نمودار پیوسته) — کلیدها روزِ تهران */
function fillDailySeries(
  rows: Array<{ day: string; tokens: number; count: number }>,
  rangeDays: number
): Array<{ date: string; tokens: number; count: number }> {
  const map = new Map(rows.map((r) => [r.day, r]));
  const out: Array<{ date: string; tokens: number; count: number }> = [];
  const start = tehranMidnightUtc(rangeDays); // نیمه‌شب تهران اولین روز بازه
  for (let i = 0; i < rangeDays; i++) {
    const instant = new Date(start.getTime() + i * 86_400_000);
    const key = tehranDayKey(instant);
    const row = map.get(key);
    out.push({ date: key, tokens: row?.tokens ?? 0, count: row?.count ?? 0 });
  }
  return out;
}

/** تحلیل مصرف یک کاربر در بازه (روز) */
export async function getUserUsageAnalytics(
  userId: string,
  rangeDays = 30
): Promise<UsageAnalyticsDto> {
  const from = startOfDaysAgo(rangeDays);
  const where = { userId, createdAt: { gte: from } };

  const [dailyRaw, bySectionRaw, byFeatureRaw, totals] = await Promise.all([
    // DateTime پرایسما در SQLite «میلی‌ثانیه صحیح» است → unixepoch + ۲۱۰ دقیقه = روز تهران
    // (ایران بدون ساعت تابستانی → آفست ثابت +۳:۳۰؛ مودیفایر '+H:MM' در این نسخه SQLite پشتیبانی نمی‌شود)
    db.$queryRaw<Array<{ day: string; tokens: number | bigint; count: number | bigint }>>`
      SELECT strftime('%Y-%m-%d', "createdAt" / 1000, 'unixepoch', '+210 minutes') as day,
             COALESCE(SUM("totalTokens"), 0) as tokens,
             COUNT(*) as count
      FROM token_usages
      WHERE "userId" = ${userId} AND "createdAt" >= ${from}
      GROUP BY day ORDER BY day ASC`,
    db.tokenUsage.groupBy({
      by: ["section"],
      where,
      _sum: { totalTokens: true },
      _count: { _all: true },
    }),
    db.tokenUsage.groupBy({
      by: ["feature"],
      where,
      _sum: { totalTokens: true },
      _count: { _all: true },
    }),
    db.tokenUsage.aggregate({
      where,
      _sum: { totalTokens: true },
      _count: { _all: true },
    }),
  ]);

  const daily = fillDailySeries(
    dailyRaw.map((r) => ({
      day: String(r.day),
      tokens: Number(r.tokens),
      count: Number(r.count),
    })),
    rangeDays
  );

  const totalTokens = totals._sum.totalTokens ?? 0;
  const activeDays = daily.filter((d) => d.count > 0).length;

  return {
    rangeDays,
    totalTokens,
    totalCount: totals._count._all ?? 0,
    avgDaily: activeDays > 0 ? Math.round(totalTokens / activeDays) : 0,
    daily,
    bySection: bySectionRaw
      .map((s) => ({
        section: s.section,
        count: s._count._all,
        tokens: s._sum.totalTokens ?? 0,
      }))
      .sort((a, b) => b.tokens - a.tokens),
    byFeature: byFeatureRaw
      .map((f) => ({
        feature: f.feature,
        count: f._count._all,
        tokens: f._sum.totalTokens ?? 0,
      }))
      .sort((a, b) => b.tokens - a.tokens),
  };
}

/** مجموع مصرف کاربر در N روز اخیر (برای کارت موجودی) */
export async function getUserSpentSince(userId: string, days: number): Promise<number> {
  const agg = await db.tokenUsage.aggregate({
    where: { userId, createdAt: { gte: startOfDaysAgo(days) } },
    _sum: { totalTokens: true },
  });
  return agg._sum.totalTokens ?? 0;
}

export interface UsageQuery {
  userId: string;
  rangeDays?: number;
  feature?: string;
  section?: string;
  page?: number;
  pageSize?: number;
}

/** رکوردهای مصرف با فیلتر و صفحه‌بندی (جدول ریز مصرف کاربر) */
export async function getUserUsageRecords(q: UsageQuery): Promise<{
  records: TokenUsageDto[];
  total: number;
  page: number;
  pageCount: number;
}> {
  const rangeDays = Math.min(90, Math.max(1, q.rangeDays ?? 30));
  const pageSize = Math.min(50, Math.max(5, q.pageSize ?? 15));
  const page = Math.max(1, q.page ?? 1);

  const where = {
    userId: q.userId,
    createdAt: { gte: startOfDaysAgo(rangeDays) },
    ...(q.feature ? { feature: q.feature } : {}),
    ...(q.section ? { section: q.section } : {}),
  };

  const [rows, total] = await Promise.all([
    db.tokenUsage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.tokenUsage.count({ where }),
  ]);

  const records: TokenUsageDto[] = rows.map((r) => ({
    id: r.id,
    feature: r.feature,
    section: r.section,
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens,
    totalTokens: r.totalTokens,
    chargedTokens: r.chargedTokens,
    estimated: r.estimated,
    model: r.model,
    title: r.title,
    meta: r.meta ? safeParse(r.meta) : null,
    createdAt: r.createdAt.toISOString(),
  }));

  return { records, total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

function safeParse(s: string): Record<string, unknown> | null {
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** برچسب فارسی بخش (برای UI) */
export function sectionLabel(section: string): string {
  return SECTION_LABELS[section] ?? section;
}

/** برچسب فارسی ویژگی (برای UI) */
export function featureLabel(feature: string): string {
  return FEATURE_LABELS[feature] ?? feature;
}
