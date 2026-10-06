// ═════ تراکنش‌های تکرارشونده — GET/POST /api/finance/recurring ═════
// GET علاوه بر لیست، مواردِ سررسیدشده را به تراکنش واقعی تبدیل می‌کند
// (materialize — یک‌بار برای هر سررسید)
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { ensureDefaultCategories } from "@/lib/modules/finance/service";

const CADENCES = ["weekly", "monthly", "yearly"];

/** محاسبه‌ی سررسید بعدی بر اساس دوره */
function nextRun(date: Date, cadence: string): Date {
  const d = new Date(date);
  if (cadence === "weekly") d.setDate(d.getDate() + 7);
  else if (cadence === "yearly") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

/** تبدیل موارد سررسیدشده به تراکنش + advance سررسید */
export async function materializeDue(userId: string): Promise<number> {
  const due = await db.financeRecurring.findMany({
    where: { userId, isActive: true, nextRunDate: { lte: new Date() } },
  });
  let created = 0;
  for (const r of due) {
    // جلوگیری از بسار مجدد: تراکنش مشابه برای همین سررسید موجود است؟
    const exists = await db.financeTransaction.findFirst({
      where: {
        userId,
        source: "recurring",
        accountId: r.accountId,
        amount: r.amount,
        type: r.type,
        date: { gte: new Date(r.nextRunDate.getTime() - 864e5), lt: new Date(r.nextRunDate.getTime() + 864e5) },
      },
    });
    if (!exists) {
      await db.financeTransaction.create({
        data: {
          userId,
          accountId: r.accountId,
          categoryId: r.categoryId,
          type: r.type,
          amount: r.amount,
          date: r.nextRunDate,
          description: r.description || r.title,
          source: "recurring",
        },
      });
      created++;
    }
    await db.financeRecurring.update({
      where: { id: r.id },
      data: { nextRunDate: nextRun(r.nextRunDate, r.cadence) },
    });
  }
  return created;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("finance", "enableRecurring");
    if (gate) return gate;

    // اجرای موارد سررسیدشده (حداکثر ۳ چرخه برای جبران تأخیر)
    let created = 0;
    for (let i = 0; i < 3; i++) {
      const n = await materializeDue(auth.id);
      created += n;
      if (n === 0) break;
    }

    const recurrings = await db.financeRecurring.findMany({
      where: { userId: auth.id },
      include: {
        account: { select: { name: true, color: true } },
        category: { select: { name: true, color: true, icon: true } },
      },
      orderBy: [{ isActive: "desc" }, { nextRunDate: "asc" }],
    });

    return ok({ recurrings, materialized: created });
  } catch (err) {
    console.error("خطای تکرارشونده‌ها:", err);
    return fail("خطای داخلی سرور", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("finance", "enableRecurring");
    if (gate) return gate;
    await ensureDefaultCategories(auth.id);

    const body = await parseJson<{
      title: string; type?: string; amount: number; cadence?: string;
      accountId: string; categoryId?: string | null;
      nextRunDate?: string; description?: string;
    }>(req);

    if (!body?.title?.trim()) return fail("عنوان الزامی است");
    const type = body.type === "income" ? "income" : "expense";
    const amount = Math.round(Number(body.amount));
    if (!amount || amount <= 0) return fail("مبلغ باید مثبت باشد");
    if (amount > 2_000_000_000) return fail("مبلغ بیش از حد مجاز است");
    const cadence = CADENCES.includes(body.cadence || "") ? body.cadence : "monthly";

    const account = await db.financeAccount.findFirst({
      where: { id: body.accountId, userId: auth.id },
    });
    if (!account) return fail("حساب یافت نشد");

    let categoryId: string | null = null;
    if (body.categoryId) {
      const cat = await db.financeCategory.findFirst({
        where: { id: body.categoryId, userId: auth.id },
      });
      if (cat) categoryId = cat.id;
    }

    const activeCount = await db.financeRecurring.count({
      where: { userId: auth.id, isActive: true },
    });
    if (activeCount >= 30) return fail("حداکثر ۳۰ قلم تکرارشونده‌ی فعال مجاز است");

    let nextRunDate = new Date();
    if (body.nextRunDate) {
      const d = new Date(body.nextRunDate);
      if (!isNaN(d.getTime())) nextRunDate = d;
    }

    const recurring = await db.financeRecurring.create({
      data: {
        userId: auth.id,
        title: body.title.trim().slice(0, 100),
        type,
        amount,
        cadence,
        accountId: account.id,
        categoryId,
        nextRunDate,
        description: body.description?.slice(0, 300),
      },
      include: {
        account: { select: { name: true, color: true } },
        category: { select: { name: true, color: true, icon: true } },
      },
    });

    await logActivity({
      userId: auth.id,
      action: "finance.recurring.create",
      entity: "financeRecurring",
      entityId: recurring.id,
      details: { title: recurring.title, amount, cadence },
    });

    return ok({ recurring });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
