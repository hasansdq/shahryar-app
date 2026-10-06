// ═════ حساب‌های مالی — GET/POST /api/finance/accounts ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { accountBalances, ensureDefaultCategories } from "@/lib/modules/finance/service";
import { getModuleState } from "@/lib/modules/cms/service";

const ACCOUNT_TYPES = ["cash", "bank", "card", "wallet"];

export async function GET(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("finance");
    if (gate) return gate;

    const accounts = await accountBalances(auth.id);
    const total = accounts.filter((a) => a.isActive).reduce((s, a) => s + a.balance, 0);
    return ok({
      accounts,
      total,
      types: ACCOUNT_TYPES,
    });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("finance");
    if (gate) return gate;
    await ensureDefaultCategories(auth.id);

    const body = await parseJson<{
      name: string; type?: string; initialBalance?: number;
      color?: string; note?: string;
    }>(req);
    if (!body?.name?.trim()) return fail("نام حساب الزامی است");

    const type = ACCOUNT_TYPES.includes(body.type || "") ? body.type : "cash";
    const initialBalance = Number(body.initialBalance) || 0;
    if (Math.abs(initialBalance) > 2_000_000_000) return fail("مبلغ بیش از حد مجاز است");

    // سقف حساب‌ها از کانفیگ CMS (۰ = بدون محدودیت؛ پیش‌فرض ۱۲)
    const finState = await getModuleState("finance");
    const maxAccounts = Number(finState?.config.maxAccounts ?? 12);
    if (maxAccounts > 0) {
      const count = await db.financeAccount.count({ where: { userId: auth.id, isActive: true } });
      if (count >= maxAccounts) {
        return fail(`حداکثر ${maxAccounts} حساب می‌توانید داشته باشید`, 400);
      }
    }

    const account = await db.financeAccount.create({
      data: {
        userId: auth.id,
        name: body.name.trim().slice(0, 60),
        type,
        initialBalance: Math.round(initialBalance),
        color: body.color || "#0e8a5a",
        note: body.note?.slice(0, 200),
      },
    });

    await logActivity({
      userId: auth.id,
      action: "finance.account.create",
      entity: "financeAccount",
      entityId: account.id,
      details: { name: account.name, type },
    });

    return ok({ account: { ...account, balance: account.initialBalance } });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
