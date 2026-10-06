// ═════ آمار اقتصاد توکن — GET /api/admin/tokens/overview ═════
// کارت‌های آماری + سری روزانه ۱۴روز + تفکیک ویژگی/بخش (از TokenUsage
// دقیق) + مصرف‌کنندگان برتر + سفارش‌های اخیر
import { NextRequest } from "next/server";
import { ok, fail, getAdmin } from "@/lib/core/api";
import { db } from "@/lib/db";
import { tehranDayKey, tehranMidnightUtc } from "@/lib/modules/tokens/usage";
import type { AdminTokenStats } from "@/lib/modules/tokens/types";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);

    const now = new Date();
    const todayStart = tehranMidnightUtc(1); // نیمه‌شب تهران امروز
    const d7 = new Date(now.getTime() - 7 * 86400_000);
    const d30 = new Date(now.getTime() - 30 * 86400_000);
    const d14Start = tehranMidnightUtc(14); // ۱۴ روز تهران پیوسته

    const [
      walletsAgg,
      spentToday, spent7, spent30,
      ordersAgg, paidAgg,
      usageDaily, paidOrders14,
      featureAgg, sectionAgg, topSpendAgg, recentOrders,
    ] = await Promise.all([
      db.tokenWallet.aggregate({ _count: { _all: true }, _sum: { balance: true, lifetimeSpent: true } }),
      db.tokenUsage.aggregate({ where: { createdAt: { gte: todayStart } }, _sum: { totalTokens: true } }),
      db.tokenUsage.aggregate({ where: { createdAt: { gte: d7 } }, _sum: { totalTokens: true } }),
      db.tokenUsage.aggregate({ where: { createdAt: { gte: d30 } }, _sum: { totalTokens: true } }),
      db.paymentOrder.groupBy({ by: ["status"], _count: { _all: true } }),
      db.paymentOrder.aggregate({ where: { status: "paid" }, _sum: { priceToman: true, tokens: true } }),
      db.tokenUsage.findMany({
        where: { createdAt: { gte: d14Start } },
        select: { totalTokens: true, createdAt: true },
      }),
      db.paymentOrder.findMany({
        where: { status: "paid", paidAt: { gte: d14Start } },
        select: { priceToman: true, paidAt: true, createdAt: true },
      }),
      db.tokenUsage.groupBy({
        by: ["feature"],
        where: { createdAt: { gte: d30 } },
        _count: { _all: true },
        _sum: { totalTokens: true },
      }),
      db.tokenUsage.groupBy({
        by: ["section"],
        where: { createdAt: { gte: d30 } },
        _count: { _all: true },
        _sum: { totalTokens: true },
      }),
      db.tokenUsage.groupBy({
        by: ["userId"],
        _sum: { totalTokens: true },
        orderBy: { _sum: { totalTokens: "desc" } },
        take: 8,
      }),
      db.paymentOrder.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { user: { select: { fullName: true, phone: true } } },
      }),
    ]);

    // خرید (اعتبار خریداری‌شده) از دفتر تراکنش برای سری روزانه
    const [purchaseDaily] = await Promise.all([
      db.tokenTransaction.findMany({
        where: { createdAt: { gte: d14Start }, type: "purchase" },
        select: { amount: true, createdAt: true },
      }),
    ]);

    // سری روزانه ۱۴روز — روزهای تهران
    const series = new Map<string, { spent: number; purchased: number; revenue: number }>();
    for (let i = 13; i >= 0; i--) {
      const instant = new Date(d14Start.getTime() + i * 86_400_000);
      series.set(tehranDayKey(instant), { spent: 0, purchased: 0, revenue: 0 });
    }
    for (const u of usageDaily) {
      const row = series.get(tehranDayKey(u.createdAt));
      if (row) row.spent += u.totalTokens;
    }
    for (const t of purchaseDaily) {
      const row = series.get(tehranDayKey(t.createdAt));
      if (row) row.purchased += t.amount || 0;
    }
    for (const o of paidOrders14) {
      const row = series.get(tehranDayKey(o.paidAt || o.createdAt));
      if (row) row.revenue += o.priceToman;
    }

    const statusCount = (s: string) => ordersAgg.find((g) => g.status === s)?._count._all ?? 0;

    // پروفایل مصرف‌کنندگان برتر
    const topIds = topSpendAgg.map((g) => g.userId);
    const topUsers = topIds.length
      ? await db.user.findMany({
          where: { id: { in: topIds } },
          select: { id: true, fullName: true, phone: true, tokenWallet: { select: { balance: true } } },
        })
      : [];
    const userById = new Map(topUsers.map((u) => [u.id, u]));

    const stats: AdminTokenStats = {
      walletsCount: walletsAgg._count._all,
      circulatingBalance: walletsAgg._sum.balance ?? 0,
      lifetimeSpent: walletsAgg._sum.lifetimeSpent ?? 0,
      spentToday: spentToday._sum.totalTokens ?? 0,
      spent7d: spent7._sum.totalTokens ?? 0,
      spent30d: spent30._sum.totalTokens ?? 0,
      purchasedTokens: paidAgg._sum.tokens ?? 0,
      revenueToman: paidAgg._sum.priceToman ?? 0,
      paidOrders: statusCount("paid"),
      pendingOrders: statusCount("pending"),
      failedOrders: statusCount("failed") + statusCount("canceled"),
      dailySeries: [...series.entries()].map(([date, v]) => ({ date, ...v })),
      featureBreakdown: featureAgg
        .map((f) => ({
          feature: f.feature,
          count: f._count._all,
          tokens: f._sum.totalTokens ?? 0,
        }))
        .sort((a, b) => b.tokens - a.tokens),
      sectionBreakdown: sectionAgg
        .map((s) => ({
          section: s.section,
          count: s._count._all,
          tokens: s._sum.totalTokens ?? 0,
        }))
        .sort((a, b) => b.tokens - a.tokens),
      topConsumers: topSpendAgg.map((g) => {
        const u = userById.get(g.userId);
        return {
          userId: g.userId,
          fullName: u?.fullName ?? null,
          phone: u?.phone ?? "—",
          spent: g._sum.totalTokens ?? 0,
          balance: u?.tokenWallet?.balance ?? 0,
        };
      }),
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        user: o.user.fullName || o.user.phone,
        packageTitle: o.packageTitle,
        tokens: o.tokens,
        priceToman: o.priceToman,
        status: o.status,
        refId: o.refId,
        createdAt: o.createdAt.toISOString(),
      })),
    };

    return ok(stats);
  } catch (err) {
    console.error("[admin/tokens/overview] خطا:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
