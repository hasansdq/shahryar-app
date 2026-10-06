// ═════ کاوشگر تراکنش‌های توکن — GET /api/admin/tokens/transactions ═════
// فیلترها: userId | type | feature | page
import { NextRequest } from "next/server";
import { ok, fail, getAdmin } from "@/lib/core/api";
import { db } from "@/lib/db";

const PAGE_SIZE = 30;

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);

    const url = new URL(req.url);
    const userId = url.searchParams.get("userId")?.trim() || undefined;
    const type = url.searchParams.get("type")?.trim() || undefined;
    const feature = url.searchParams.get("feature")?.trim() || undefined;
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);

    const where = {
      ...(userId ? { userId } : {}),
      ...(type ? { type } : {}),
      ...(feature ? { feature } : {}),
    };

    const [total, txs] = await Promise.all([
      db.tokenTransaction.count({ where }),
      db.tokenTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          wallet: { select: { user: { select: { fullName: true, phone: true } } } },
        },
      }),
    ]);

    return ok({
      total,
      page,
      pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      transactions: txs.map((t) => ({
        id: t.id,
        user: t.wallet.user.fullName || t.wallet.user.phone,
        phone: t.wallet.user.phone,
        type: t.type,
        amount: t.amount,
        balanceAfter: t.balanceAfter,
        feature: t.feature,
        note: t.note,
        createdAt: t.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[admin/tokens/transactions] خطا:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
