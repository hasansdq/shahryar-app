// ═══════════════════════════════════════════════════════════════
// سرویس مالی شهریار — منطق مشترک ماژول مدیریت مالی شخصی
// حساب‌ها، تراکنش‌ها، بودجه‌ها، تحلیل‌ها و امتیاز سلامت مالی
// ═══════════════════════════════════════════════════════════════
import { db } from "@/lib/db";
import { toJalali, jalaliToDate, JALALI_MONTHS } from "@/lib/client/jalali";
import { DEFAULT_CATEGORIES } from "./defaults";

export { DEFAULT_CATEGORIES };
export { JALALI_MONTHS };

// ─── انواع مشترک ───
export type TxType = "income" | "expense" | "transfer";
export type AccountType = "cash" | "bank" | "card" | "wallet";

/** کلید ماه جلالی: "1405-06" */
export function monthKeyOf(date: Date): string {
  const j = toJalali(date);
  return `${j.jy}-${String(j.jm).padStart(2, "0")}`;
}

/** ماه جلالی فعلی (به وقت ایران) */
export function currentMonthKey(): string {
  return monthKeyOf(new Date());
}

/** بازه‌ی [شروع، پایان) ماه جلالی از کلیدش */
export function monthRange(key: string): { start: Date; end: Date } {
  const [jy, jm] = key.split("-").map(Number);
  const start = jalaliToDate(jy, jm, 1);
  // ماه بعد
  const nY = jm === 12 ? jy + 1 : jy;
  const nM = jm === 12 ? 1 : jm + 1;
  const end = jalaliToDate(nY, nM, 1);
  return { start, end };
}

/** لیست n ماه اخیر (شامل فعلی) — قدیمی→جدید */
export function recentMonthKeys(n: number): string[] {
  const j = toJalali(new Date());
  const keys: string[] = [];
  let { jy, jm } = j;
  for (let i = 0; i < n; i++) {
    keys.unshift(`${jy}-${String(jm).padStart(2, "0")}`);
    jm -= 1;
    if (jm === 0) { jm = 12; jy -= 1; }
  }
  return keys;
}

/** برچسب فارسی ماه: «مرداد ۱۴۰۵» */
export function monthLabel(key: string): string {
  const [jy, jm] = key.split("-").map(Number);
  return `${JALALI_MONTHS[jm - 1]} ${jy}`;
}

// ─── دسته‌بندی‌های پیش‌فرض (سیدِ تنبل برای هر کاربر) ───
// فهرست کامل در ./defaults.ts — اینجا فقط re-export می‌شود.
// سید واقعی از «قالب‌های سیستمی» (FinanceCategoryTemplate) خوانده می‌شود
// که مدیر از پنل CMS قابل ویرایش است؛ جدول خالی → همان پیش‌فرض‌های ثابت.

/** قالب‌های فعال دسته‌بندی برای سید (با fallback به پیش‌فرض‌های ثابت) */
async function seedTemplateList() {
  const { listActiveFinanceTemplates } = await import("@/lib/modules/cms/service");
  const templates = await listActiveFinanceTemplates();
  return templates.length > 0
    ? templates.map((t) => ({ name: t.name, type: t.type as "income" | "expense", icon: t.icon, color: t.color, sortOrder: t.sortOrder }))
    : DEFAULT_CATEGORIES;
}

/** ایجاد دسته‌بندی‌های پیش‌فرض برای کاربر (یک‌بار — تنبل و idempotent) */
export async function ensureDefaultCategories(userId: string) {
  const count = await db.financeCategory.count({ where: { userId } });
  if (count > 0) return;
  const list = await seedTemplateList();
  await db.financeCategory.createMany({
    data: list.map((c) => ({ ...c, userId, kind: "builtin" })),
  });
}

// ─── محاسبه‌ی موجودی حساب ───
/** موجودی = اولیه + درآمد − هزینه + ورودی انتقال − خروجی انتقال */
export async function accountBalances(userId: string) {
  const accounts = await db.financeAccount.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  const map = new Map<string, number>();
  for (const a of accounts) map.set(a.id, a.initialBalance);

  const txs = await db.financeTransaction.findMany({
    where: { userId },
    select: { accountId: true, transferToId: true, type: true, amount: true },
  });
  for (const t of txs) {
    const m = t.amount;
    if (t.type === "income" && map.has(t.accountId)) map.set(t.accountId, (map.get(t.accountId)!) + m);
    if (t.type === "expense" && map.has(t.accountId)) map.set(t.accountId, (map.get(t.accountId)!) - m);
    if (t.type === "transfer") {
      if (map.has(t.accountId)) map.set(t.accountId, (map.get(t.accountId)!) - m);
      if (t.transferToId && map.has(t.transferToId)) map.set(t.transferToId, (map.get(t.transferToId)!) + m);
    }
  }
  return accounts.map((a) => ({
    ...a,
    balance: map.get(a.id) ?? a.initialBalance,
  }));
}

// ─── خلاصه‌ی ماه (برای داشبورد و تحلیل) ───
export interface MonthlyStats {
  monthKey: string;
  income: number;
  expense: number;
  net: number;
  txCount: number;
}

/** آمار درآمد/هزینه به تفکیک ماه — از روی تراکنش‌های بازه */
export function aggregateByMonth(
  txs: Array<{ date: Date; type: string; amount: number }>
): Map<string, MonthlyStats> {
  const map = new Map<string, MonthlyStats>();
  for (const t of txs) {
    if (t.type === "transfer") continue;
    const key = monthKeyOf(t.date);
    const s = map.get(key) || { monthKey: key, income: 0, expense: 0, net: 0, txCount: 0 };
    if (t.type === "income") s.income += t.amount;
    else s.expense += t.amount;
    s.net = s.income - s.expense;
    s.txCount += 1;
    map.set(key, s);
  }
  return map;
}

/** هزینه‌ی ماه به تفکیک دسته (برای بودجه و donut) */
export async function monthExpenseByCategory(userId: string, monthKey: string) {
  const { start, end } = monthRange(monthKey);
  const txs = await db.financeTransaction.findMany({
    where: {
      userId,
      type: "expense",
      date: { gte: start, lt: end },
    },
    select: { categoryId: true, amount: true, description: true },
    orderBy: { date: "desc" },
  });
  const byCat = new Map<string, { total: number; count: number }>();
  for (const t of txs) {
    const k = t.categoryId || "uncategorized";
    const e = byCat.get(k) || { total: 0, count: 0 };
    e.total += t.amount;
    e.count += 1;
    byCat.set(k, e);
  }
  return { byCategory: byCat, transactions: txs, total: txs.reduce((s, t) => s + t.amount, 0) };
}

// ─── امتیاز سلامت مالی (قانون‌محور — قابل توضیح) ───
export interface FinanceHealth {
  score: number; // 0-100
  savingsRate: number; // ٪ پس‌انداز = net/income
  budgetUsage: number; // ٪ مصرف بودجه
  monthsRunway: number; // ماه‌هایی که هزینه‌ها را با موجودی نقدی جاری پوشش می‌دهد
  debtRatio: number; // ٪ بدهی باز نسبت به درآمد سال
  components: Array<{ key: string; label: string; score: number; note: string }>;
}

export async function computeFinanceHealth(userId: string): Promise<FinanceHealth> {
  const monthKey = currentMonthKey();
  const [monthTx, balances, openDebts] = await Promise.all([
    db.financeTransaction.findMany({
      where: { userId, type: { in: ["income", "expense"] }, date: { gte: new Date(Date.now() - 180 * 864e5) } },
      select: { date: true, type: true, amount: true },
    }),
    accountBalances(userId),
    db.financeDebt.aggregate({
      where: { userId, status: "open", direction: "i_owe" },
      _sum: { remainingAmount: true },
    }),
  ]);

  const byMonth = aggregateByMonth(monthTx);

  // میانگین ۶ ماه اخیر (پایدارتر از ماه جاری)
  const keys = recentMonthKeys(6);
  const hist = keys.map((k) => byMonth.get(k)).filter(Boolean) as MonthlyStats[];
  const avgIncome = hist.length ? hist.reduce((s, m) => s + m.income, 0) / hist.length : 0;
  const avgExpense = hist.length ? hist.reduce((s, m) => s + m.expense, 0) / hist.length : 0;

  const totalCash = balances.reduce((s, a) => s + a.balance, 0);
  const savingsRate = avgIncome > 0 ? ((avgIncome - avgExpense) / avgIncome) * 100 : 0;
  const monthsRunway = avgExpense > 0 ? totalCash / avgExpense : totalCash > 0 ? 999 : 0;
  const debtOpen = openDebts._sum.remainingAmount || 0;
  const debtRatio = avgIncome > 0 ? (debtOpen / (avgIncome * 12)) * 100 : debtOpen > 0 ? 999 : 0;

  // بودجه‌ی ماه جاری
  const budgetRows = await db.financeBudget.findMany({ where: { userId, monthKey } });
  const { total: monthExpense } = await monthExpenseByCategory(userId, monthKey);
  const budgetTotal = budgetRows.reduce((s, b) => s + b.amount, 0);
  const budgetUsage = budgetTotal > 0 ? (monthExpense / budgetTotal) * 100 : 0;

  // اجزای امتیاز (هر کدام 0-100، میانگین → امتیاز کل)
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  const savingsScore = clamp(savingsRate * 2.5); // 40٪ پس‌انداز = امتیاز کامل
  const runwayScore = clamp(monthsRunway * 8); // ~۱۲ ماه ذخیره = کامل
  const debtScore = clamp(100 - debtRatio * 2); // بدهی > 50٪ درآمد سالانه = صفر
  const budgetScore = budgetTotal === 0 ? 12 : clamp(100 - Math.max(0, budgetUsage - 80) * 2.5);

  const components = [
    { key: "savings", label: "نرخ پس‌انداز", score: Math.round(savingsScore), note: `${savingsRate.toFixed(1)}٪ در ۶ ماه اخیر` },
    { key: "runway", label: "ذخیره‌ی اضطراری", score: Math.round(runwayScore), note: monthsRunway >= 999 ? "بدون هزینه‌ی ثبت‌شده" : `${monthsRunway.toFixed(1)} ماه پوشش هزینه` },
    { key: "debt", label: "وضعیت بدهی", score: Math.round(debtScore), note: debtRatio >= 999 ? "بدهی بدون درآمد ثبت‌شده" : `${debtRatio.toFixed(0)}٪ درآمد سالانه` },
    { key: "budget", label: "کنترل بودجه", score: Math.round(budgetScore), note: budgetTotal === 0 ? "بدون بودجه‌ی تعریف‌شده" : `${budgetUsage.toFixed(0)}٪ مصرف ماه جاری` },
  ];
  const score = Math.round(components.reduce((s, c) => s + c.score, 0) / components.length);

  return {
    score,
    savingsRate: Number(savingsRate.toFixed(1)),
    budgetUsage: Number(budgetUsage.toFixed(1)),
    monthsRunway: monthsRunway >= 999 ? 99 : Number(monthsRunway.toFixed(1)),
    debtRatio: debtRatio >= 999 ? 100 : Number(debtRatio.toFixed(1)),
    components,
  };
}

// ─── تحلیل کامل برای داشبورد و مشاور AI ───
export interface FinanceSnapshot {
  monthKey: string;
  monthLabel: string;
  totalCash: number;
  accounts: Array<{ name: string; type: string; balance: number }>;
  current: MonthlyStats;
  avg6: { income: number; expense: number };
  trend: Array<{ monthKey: string; label: string; income: number; expense: number; net: number }>;
  topCategories: Array<{ name: string; color: string; total: number; count: number }>;
  budgets: Array<{ name: string; amount: number; spent: number }>;
  goals: Array<{ title: string; target: number; current: number; progress: number; deadline: string | null }>;
  debts: {
    iOwe: number;
    owedToMe: number;
    openCount: number;
    nearestDue: string | null;
  };
  health: FinanceHealth;
  transactionCount: number;
}

/** عکس‌العمل کامل مالی کاربر — منبع تغذیه‌ی داشبورد و AI */
export async function buildFinanceSnapshot(userId: string): Promise<FinanceSnapshot> {
  const monthKey = currentMonthKey();
  const sixMonths = recentMonthKeys(6);
  const first = monthRange(sixMonths[0]).start;

  await ensureDefaultCategories(userId);

  const [accounts, txs, budgets, goals, debts, health, monthExp] = await Promise.all([
    accountBalances(userId),
    db.financeTransaction.findMany({
      where: { userId, date: { gte: first }, type: { in: ["income", "expense"] } },
      select: { date: true, type: true, amount: true },
    }),
    db.financeBudget.findMany({ where: { userId, monthKey }, include: { category: true } }),
    db.financeGoal.findMany({
      where: { userId, status: "active" },
      orderBy: { createdAt: "asc" },
    }),
    db.financeDebt.findMany({ where: { userId, status: "open" }, orderBy: { dueDate: "asc" } }),
    computeFinanceHealth(userId),
    monthExpenseByCategory(userId, monthKey),
  ]);

  const byMonth = aggregateByMonth(txs);
  const trend = sixMonths.map((k) => {
    const s = byMonth.get(k) || { income: 0, expense: 0, net: 0, txCount: 0 };
    return { monthKey: k, label: monthLabel(k), income: s.income, expense: s.expense, net: s.net };
  });

  // دسته‌های پرهزینه‌ی ماه
  const catIds = [...monthExp.byCategory.keys()].filter((k) => k !== "uncategorized");
  const cats = catIds.length
    ? await db.financeCategory.findMany({ where: { id: { in: catIds } } })
    : [];
  const catMap = new Map(cats.map((c) => [c.id, c]));
  const topCategories = [...monthExp.byCategory.entries()]
    .filter(([k]) => k !== "uncategorized")
    .map(([k, v]) => ({
      name: catMap.get(k)?.name || "بدون دسته",
      color: catMap.get(k)?.color || "#7f8c8d",
      total: v.total,
      count: v.count,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  // بودجه‌ها با مصرف واقعی
  const budgetSpend = monthExp.byCategory;
  const budgetList = budgets.map((b) => {
    const spent = budgetSpend.get(b.categoryId)?.total || 0;
    return { name: b.category.name, amount: b.amount, spent };
  });

  const jalaliDeadline = (d: Date | null) =>
    d ? new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Tehran" }).format(d) : null;

  return {
    monthKey,
    monthLabel: monthLabel(monthKey),
    totalCash: accounts.reduce((s, a) => s + a.balance, 0),
    accounts: accounts.filter((a) => a.isActive).map((a) => ({ name: a.name, type: a.type, balance: a.balance })),
    current: byMonth.get(monthKey) || { monthKey, income: 0, expense: 0, net: 0, txCount: 0 },
    avg6: {
      income: Math.round(trend.reduce((s, t) => s + t.income, 0) / 6),
      expense: Math.round(trend.reduce((s, t) => s + t.expense, 0) / 6),
    },
    trend,
    topCategories,
    budgets: budgetList,
    goals: goals.map((g) => ({
      title: g.title,
      target: g.targetAmount,
      current: g.currentAmount,
      progress: g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0,
      deadline: jalaliDeadline(g.deadline),
    })),
    debts: {
      iOwe: debts.filter((d) => d.direction === "i_owe").reduce((s, d) => s + d.remainingAmount, 0),
      owedToMe: debts.filter((d) => d.direction === "owed_to_me").reduce((s, d) => s + d.remainingAmount, 0),
      openCount: debts.length,
      nearestDue: debts.find((d) => d.dueDate)?.dueDate
        ? jalaliDeadline(debts.find((d) => d.dueDate)!.dueDate)
        : null,
    },
    health,
    transactionCount: txs.length,
  };
}
