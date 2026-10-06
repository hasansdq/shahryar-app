// ═════ تراکنش‌های مالی — GET/POST /api/finance/transactions ═════
// GET: فیلتر ماه جلالی، نوع، دسته، حساب + جستجو + صفحه‌بندی
// POST: ثبت درآمد/هزینه/انتقال
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { monthRange, currentMonthKey, recentMonthKeys } from "@/lib/modules/finance/service";

const TX_TYPES = ["income", "expense", "transfer"];
const MAX_AMOUNT = 2_000_000_000;

export async function GET(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("finance");
    if (gate) return gate;

    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") || currentMonthKey(); // "1405-06" | "all"
    const type = searchParams.get("type");
    const categoryId = searchParams.get("categoryId");
    const accountId = searchParams.get("accountId");
    const search = searchParams.get("q");
    const limit = Math.min(Number(searchParams.get("limit")) || 60, 200);
    const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

    const where: Record<string, unknown> = { userId: auth.id };
    if (month !== "all") {
      const { start, end } = monthRange(month);
      where.date = { gte: start, lt: end };
    }
    if (type && TX_TYPES.includes(type)) where.type = type;
    if (categoryId) where.categoryId = categoryId;
    if (accountId) where.accountId = accountId;
    if (search?.trim()) {
      where.OR = [
        { description: { contains: search.trim() } },
      ];
    }

    const [transactions, total] = await Promise.all([
      db.financeTransaction.findMany({
        where,
        include: {
          account: { select: { name: true, color: true } },
          category: { select: { name: true, color: true, icon: true } },
          transferTo: { select: { name: true } },
        },
        orderBy: { date: "desc" },
        take: limit,
        skip: offset,
      }),
      db.financeTransaction.count({ where }),
    ]);

    // آمار ماه/بازه‌ی همین فیلتر
    const income = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

    // کلیدهای ماه‌های اخیر برای ناوبری
    const months = recentMonthKeys(18);

    return ok({ transactions, total, income, expense, months, currentMonth: month });
  } catch (err) {
    console.error("خطای لیست تراکنش‌ها:", err);
    return fail("خطای داخلی سرور", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("finance");
    if (gate) return gate;

    const body = await parseJson<{
      type: string; amount: number; accountId: string;
      categoryId?: string | null; date?: string; description?: string;
      transferToId?: string | null;
    }>(req);

    if (!body) return fail("داده نامعتبر");
    if (!TX_TYPES.includes(body.type)) return fail("نوع تراکنش نامعتبر است");
    const amount = Math.round(Number(body.amount));
    if (!amount || amount <= 0) return fail("مبلغ باید مثبت باشد");
    if (amount > MAX_AMOUNT) return fail("مبلغ بیش از حد مجاز است (حداکثر ۲ میلیارد تومان)");

    // مالکیت حساب
    const account = await db.financeAccount.findFirst({
      where: { id: body.accountId, userId: auth.id },
    });
    if (!account) return fail("حساب یافت نشد");

    let transferToId: string | null = null;
    if (body.type === "transfer") {
      if (!body.transferToId) return fail("حساب مقصد انتقال الزامی است");
      if (body.transferToId === body.accountId) return fail("حساب مبدأ و مقصد یکسان است");
      const target = await db.financeAccount.findFirst({
        where: { id: body.transferToId, userId: auth.id },
      });
      if (!target) return fail("حساب مقصد یافت نشد");
      transferToId = target.id;
    }

    if (body.categoryId) {
      const cat = await db.financeCategory.findFirst({
        where: { id: body.categoryId, userId: auth.id },
      });
      if (!cat) return fail("دسته یافت نشد");
      if (cat.type !== body.type && body.type !== "transfer") {
        return fail(`دسته‌ی انتخابی برای ${body.type === "income" ? "درآمد" : "هزینه"} مناسب نیست`);
      }
    }

    let date = new Date();
    if (body.date) {
      const d = new Date(body.date);
      if (!isNaN(d.getTime())) date = d;
    }

    const transaction = await db.financeTransaction.create({
      data: {
        userId: auth.id,
        accountId: account.id,
        categoryId: body.type === "transfer" ? null : body.categoryId || null,
        type: body.type,
        amount,
        date,
        description: body.description?.trim().slice(0, 300),
        transferToId,
      },
      include: {
        account: { select: { name: true, color: true } },
        category: { select: { name: true, color: true, icon: true } },
        transferTo: { select: { name: true } },
      },
    });

    await logActivity({
      userId: auth.id,
      action: "finance.transaction.create",
      entity: "financeTransaction",
      entityId: transaction.id,
      details: { type: transaction.type, amount, account: account.name },
    });

    return ok({ transaction });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
