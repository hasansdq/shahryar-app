// ═════ بودجه‌های ماهانه — GET/POST /api/finance/budgets ═════
// POST منطق upsert دارد: اگر (دسته + ماه) بود، به‌روزرسانی می‌شود
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { currentMonthKey, monthRange, monthExpenseByCategory, ensureDefaultCategories } from "@/lib/modules/finance/service";

export async function GET(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("finance", "enableBudgets");
    if (gate) return gate;
    await ensureDefaultCategories(auth.id);

    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") || currentMonthKey();

    const [budgets, spend, categories] = await Promise.all([
      db.financeBudget.findMany({
        where: { userId: auth.id, monthKey: month },
        include: { category: { select: { name: true, color: true, icon: true, type: true } } },
        orderBy: { createdAt: "asc" },
      }),
      monthExpenseByCategory(auth.id, month),
      db.financeCategory.findMany({
        where: { userId: auth.id, type: "expense" },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

    const result = budgets.map((b) => {
      const spent = spend.byCategory.get(b.categoryId)?.total || 0;
      const pct = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0;
      return { ...b, spent, pct, remaining: b.amount - spent };
    });

    return ok({
      budgets: result,
      month,
      categories,
      totalBudget: budgets.reduce((s, b) => s + b.amount, 0),
      totalSpent: result.reduce((s, b) => s + b.spent, 0),
    });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("finance", "enableBudgets");
    if (gate) return gate;

    const body = await parseJson<{ categoryId: string; amount: number; month?: string }>(req);
    if (!body?.categoryId) return fail("دسته الزامی است");
    const amount = Math.round(Number(body.amount));
    if (!amount || amount <= 0) return fail("مبلغ بودجه باید مثبت باشد");
    if (amount > 2_000_000_000) return fail("مبلغ بیش از حد مجاز است");

    const month = body.month && /^\d{4}-\d{2}$/.test(body.month) ? body.month : currentMonthKey();
    // اعتبار ماه: نباید بیش از ۲ ماه آینده/گذشته باشد
    const { start } = monthRange(month);
    if (Math.abs(Date.now() - start.getTime()) > 120 * 864e5) {
      return fail("بودجه فقط برای ماه جاری یا ماه‌های نزدیک قابل تعریف است");
    }

    const category = await db.financeCategory.findFirst({
      where: { id: body.categoryId, userId: auth.id, type: "expense" },
    });
    if (!category) return fail("دسته‌ی هزینه یافت نشد");

    const budget = await db.financeBudget.upsert({
      where: { userId_categoryId_monthKey: { userId: auth.id, categoryId: category.id, monthKey: month } },
      create: { userId: auth.id, categoryId: category.id, monthKey: month, amount },
      update: { amount },
      include: { category: { select: { name: true, color: true, icon: true, type: true } } },
    });

    return ok({ budget });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
