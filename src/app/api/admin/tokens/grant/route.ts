// ═════ اهدا/کسر توکن کاربر — POST /api/admin/tokens/grant ═════
// بدنه: { phone | userId, amount (±), note }
import { NextRequest } from "next/server";
import { ok, fail, getAdmin, assertWritableAdmin, parseJson } from "@/lib/core/api";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/core/logger";
import { applyGrant } from "@/lib/modules/tokens/service";

interface Body {
  phone?: string;
  userId?: string;
  amount?: number;
  note?: string;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);
    const writeGate = assertWritableAdmin(admin);
    if (writeGate) return writeGate;

    const body = await parseJson<Body>(req);
    if (!body) return fail("درخواست نامعتبر است");

    const amount = Math.round(Number(body.amount));
    if (!Number.isFinite(amount) || amount === 0) {
      return fail("مقدار توکن باید عددی غیرصفر باشد (مثبت = اهدا، منفی = کسر)");
    }
    if (Math.abs(amount) > 1_000_000) return fail("مقدار بیش از حد مجاز است");

    // یافتن کاربر با شماره موبایل یا شناسه
    let user: { id: string; fullName: string | null; phone: string } | null = null;
    if (body.userId) {
      user = await db.user.findUnique({ where: { id: body.userId } });
    } else if (body.phone) {
      const phone = body.phone.trim();
      user = await db.user.findUnique({ where: { phone } });
    } else {
      return fail("شماره موبایل یا شناسه کاربر الزامی است");
    }
    if (!user) return fail("کاربر یافت نشد", 404);

    // کسر بیشتر از موجودی مجاز نیست
    if (amount < 0) {
      const wallet = await db.tokenWallet.findUnique({ where: { userId: user.id } });
      const balance = wallet?.balance ?? 0;
      if (balance + amount < 0) {
        return fail(`موجودی کاربر (${balance.toLocaleString("fa-IR")} توکن) برای این کسر کافی نیست`);
      }
    }

    const res = await applyGrant({
      userId: user.id,
      amount,
      type: amount > 0 ? "admin_grant" : "admin_deduct",
      note: (body.note || "").trim().slice(0, 200) || null,
    });

    await logActivity({
      adminId: admin.id,
      actorType: "admin",
      action: amount > 0 ? "tokens.admin_grant" : "tokens.admin_deduct",
      entity: "token_wallet",
      entityId: user.id,
      details: { amount, note: body.note ?? null },
    });

    return ok({
      user: { id: user.id, fullName: user.fullName, phone: user.phone },
      amount,
      balance: res.balance,
    });
  } catch (err) {
    console.error("[admin/tokens/grant] خطا:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
