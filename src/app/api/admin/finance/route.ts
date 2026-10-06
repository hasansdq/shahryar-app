// ═════ تحلیل ماژول امور مالی — GET /api/admin/finance ═════
// فقط داده‌های غیرحساس: شمارنده‌ها، توزیع‌ها و متادیتا —
// ⚠️ هیچ مبلغ، توضیح یا یادداشت شخصی کاربران نمایش داده نمی‌شود.
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, getAdmin } from "@/lib/core/api";
import { recentMonthKeys, monthRange, monthKeyOf, monthLabel } from "@/lib/modules/finance/service";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);

    // ─── بازه‌ی ۶ ماه جلالی ───
    const months = recentMonthKeys(6);
    const firstMonthStart = monthRange(months[0]).start;

    const [
      usersTotal,
      accounts,
      transactions,
      budgets,
      financeGoals,
      debtsActive,
      recurringsActive,
      advisorCalls,
      txsSince,
      topCatGroups,
      accountTypeGroups,
      lastTxGroups,
      accountUserRows,
      budgetUserRows,
      finGoalUserRows,
      debtUserRows,
      recUserRows,
      recentTxRows,
    ] = await Promise.all([
      db.user.count(),
      db.financeAccount.count(),
      db.financeTransaction.count(),
      db.financeBudget.count(),
      db.financeGoal.count(),
      db.financeDebt.count({ where: { status: "active" } }),
      db.financeRecurring.count({ where: { isActive: true } }),
      db.activityLog.count({ where: { action: "finance.ai.advisor" } }),

      // تراکنش‌های ۶ ماه اخیر — فقط نوع و تاریخ (بدون مبلغ)
      db.financeTransaction.findMany({
        where: { date: { gte: firstMonthStart } },
        select: { date: true, type: true },
      }),

      // محبوب‌ترین دسته‌ها (به تفکیک تعداد استفاده)
      db.financeTransaction.groupBy({
        by: ["categoryId"],
        _count: { _all: true },
        where: { categoryId: { not: null } },
      }),

      // توزیع نوع حساب‌ها
      db.financeAccount.groupBy({ by: ["type"], _count: { _all: true } }),

      // آخرین تراکنش هر کاربر
      db.financeTransaction.groupBy({ by: ["userId"], _max: { date: true } }),

      // کاربران دارای هر نوع رکورد مالی
      db.financeAccount.findMany({ distinct: ["userId"], select: { userId: true } }),
      db.financeBudget.findMany({ distinct: ["userId"], select: { userId: true } }),
      db.financeGoal.findMany({ distinct: ["userId"], select: { userId: true } }),
      db.financeDebt.findMany({ distinct: ["userId"], select: { userId: true } }),
      db.financeRecurring.findMany({ distinct: ["userId"], select: { userId: true } }),

      // ۳۰ تراکنش اخیر — متادیتای غیرحساس
      db.financeTransaction.findMany({
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 30,
        select: {
          id: true, date: true, type: true,
          category: { select: { name: true, type: true } },
          account: { select: { type: true } },
          user: { select: { fullName: true } },
        },
      }),
    ]);

    // ─── ماه جلالی فعلی ───
    const currentKey = monthKeyOf(new Date());
    const currentRange = monthRange(currentKey);
    const txThisMonth = txsSince.filter(
      (t) => t.date >= currentRange.start && t.date < currentRange.end
    ).length;

    // ─── روند ماهانه (شمارنده به تفکیک نوع) ───
    const monthly = months.map((key) => {
      const { start, end } = monthRange(key);
      const inRange = txsSince.filter((t) => t.date >= start && t.date < end);
      return {
        monthKey: key,
        label: monthLabel(key),
        income: inRange.filter((t) => t.type === "income").length,
        expense: inRange.filter((t) => t.type === "expense").length,
        transfer: inRange.filter((t) => t.type === "transfer").length,
      };
    });

    // ─── نام دسته‌های پرکاربرد ───
    const topGroups = topCatGroups
      .sort((a, b) => b._count._all - a._count._all)
      .slice(0, 12);
    const catIds = topGroups.map((g) => g.categoryId).filter(Boolean) as string[];
    const catRows = catIds.length
      ? await db.financeCategory.findMany({
          where: { id: { in: catIds } },
          select: { id: true, name: true, type: true },
        })
      : [];
    const catMap = new Map(catRows.map((c) => [c.id, c]));
    const topCategories = topGroups
      .map((g) => {
        const cat = catMap.get(g.categoryId as string);
        return cat ? { name: cat.name, type: cat.type, count: g._count._all } : null;
      })
      .filter((c): c is { name: string; type: string; count: number } => c !== null)
      .slice(0, 10);

    // ─── به تفکیک کاربر (شمارنده‌ها — بدون مبالغ) ───
    const userIds = new Set<string>([
      ...accountUserRows.map((r) => r.userId),
      ...budgetUserRows.map((r) => r.userId),
      ...finGoalUserRows.map((r) => r.userId),
      ...debtUserRows.map((r) => r.userId),
      ...recUserRows.map((r) => r.userId),
    ]);

    interface UserRow {
      id: string; fullName: string | null; phone: string; status: string; createdAt: Date;
    }
    interface CountRow {
      userId: string; _count: { _all: number };
    }

    let userRows: UserRow[] = [];
    let accountCounts: CountRow[] = [];
    let budgetCounts: CountRow[] = [];
    let goalCounts: CountRow[] = [];
    let debtCounts: CountRow[] = [];
    let recCounts: CountRow[] = [];
    let txCounts: CountRow[] = [];

    if (userIds.size > 0) {
      const ids = Array.from(userIds);
      const [u, ac, bu, go, de, re, tx] = await Promise.all([
        db.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, fullName: true, phone: true, status: true, createdAt: true },
        }),
        db.financeAccount.groupBy({ by: ["userId"], _count: { _all: true }, where: { userId: { in: ids } } }),
        db.financeBudget.groupBy({ by: ["userId"], _count: { _all: true }, where: { userId: { in: ids } } }),
        db.financeGoal.groupBy({ by: ["userId"], _count: { _all: true }, where: { userId: { in: ids } } }),
        db.financeDebt.groupBy({ by: ["userId"], _count: { _all: true }, where: { userId: { in: ids } } }),
        db.financeRecurring.groupBy({ by: ["userId"], _count: { _all: true }, where: { userId: { in: ids } } }),
        db.financeTransaction.groupBy({ by: ["userId"], _count: { _all: true }, where: { userId: { in: ids } } }),
      ]);
      userRows = u;
      accountCounts = ac;
      budgetCounts = bu;
      goalCounts = go;
      debtCounts = de;
      recCounts = re;
      txCounts = tx;
    }

    const toMap = (rows: CountRow[]) => new Map(rows.map((r) => [r.userId, r._count._all]));
    const accMap = toMap(accountCounts);
    const buMap = toMap(budgetCounts);
    const goMap = toMap(goalCounts);
    const deMap = toMap(debtCounts);
    const reMap = toMap(recCounts);
    const txMap = toMap(txCounts);
    const lastTxMap = new Map(lastTxGroups.map((g) => [g.userId, g._max.date]));

    const perUser = userRows
      .map((u) => ({
        user: { id: u.id, fullName: u.fullName, phone: u.phone, status: u.status },
        accounts: accMap.get(u.id) || 0,
        transactions: txMap.get(u.id) || 0,
        budgets: buMap.get(u.id) || 0,
        financeGoals: goMap.get(u.id) || 0,
        debts: deMap.get(u.id) || 0,
        recurrings: reMap.get(u.id) || 0,
        lastTxAt: lastTxMap.get(u.id) || null,
      }))
      .sort((a, b) => b.transactions - a.transactions);

    const usersWithFinance = perUser.length;

    return ok({
      kpis: {
        usersTotal,
        usersWithFinance,
        adoption: usersTotal > 0 ? Math.round((usersWithFinance / usersTotal) * 100) : 0,
        accounts,
        transactions,
        txThisMonth,
        budgets,
        financeGoals,
        debtsActive,
        recurringsActive,
        advisorCalls,
      },
      monthly,
      topCategories,
      accountTypes: accountTypeGroups
        .map((g) => ({ type: g.type, count: g._count._all }))
        .sort((a, b) => b.count - a.count),
      perUser,
      recentTransactions: recentTxRows.map((t) => ({
        id: t.id,
        date: t.date,
        type: t.type,
        categoryName: t.category?.name || "بدون دسته",
        accountType: t.account?.type || "—",
        userName: t.user?.fullName || "کاربر حذف‌شده",
      })),
      privacyNote: "برای حفظ حریم خصوصی کاربران، مبالغ و یادداشت‌های تراکنش‌ها نمایش داده نمی‌شود",
    });
  } catch (err) {
    console.error("خطای تحلیل مالی:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
