// ═════ بازگشت از درگاه زرین‌پال — GET /api/tokens/verify ═════
// زنجیره: درگاه با Authority و Status برمی‌گردد → تأیید رسمی پرداخت →
// اعتبار اتمیک توکن (فقط یک‌بار، حتی با رفرش هم‌زمان) → ریدایرکت به اپ
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenSettings } from "@/lib/modules/tokens/settings";
import { zarinpalVerify } from "@/lib/modules/tokens/zarinpal";
import { applyGrant } from "@/lib/modules/tokens/service";
import { logActivity } from "@/lib/core/logger";

/** آدرس ریشه اپ از دید کاربر (پشت پروکسی) برای ریدایرکت نهایی */
function appRootUrl(req: NextRequest): string {
  const h = req.headers;
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  const host = h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host") || new URL(req.url).host;
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const root = appRootUrl(req);
  try {
    const url = new URL(req.url);
    const authority = url.searchParams.get("Authority") || url.searchParams.get("authority");
    const status = (url.searchParams.get("Status") || url.searchParams.get("status") || "").toUpperCase();

    if (!authority) {
      return NextResponse.redirect(`${root}/?tokens=failed&reason=noauth`, 302);
    }

    const order = await db.paymentOrder.findUnique({ where: { authority } });
    if (!order) {
      return NextResponse.redirect(`${root}/?tokens=failed&reason=notfound`, 302);
    }

    // کاربر در درگاه انصراف داده یا پرداخت ناموفق بوده
    if (status !== "OK") {
      if (order.status === "pending") {
        await db.paymentOrder.update({
          where: { id: order.id },
          data: { status: "canceled" },
        });
      }
      return NextResponse.redirect(`${root}/?tokens=canceled`, 302);
    }

    // قبلاً اعتبار گرفته — نمایش موفقیت بدون اعتبار مجدد
    if (order.status === "paid") {
      return NextResponse.redirect(`${root}/?tokens=paid&ref=${order.refId || ""}`, 302);
    }

    // ─── تأیید رسمی نزد زرین‌پال ───
    const settings = await getTokenSettings();
    const verify = await zarinpalVerify({
      config: {
        merchantId: settings.zarinpal.merchantId,
        sandbox: settings.zarinpal.sandbox,
      },
      amountRial: order.priceToman * 10,
      authority,
    });

    if (!verify.ok) {
      if (order.status === "pending") {
        await db.paymentOrder.update({
          where: { id: order.id },
          data: { status: "failed" },
        });
      }
      console.error("[tokens/verify] پرداخت ناموفق:", verify.error);
      return NextResponse.redirect(`${root}/?tokens=failed`, 302);
    }

    // ─── تصاحب اتمیک سفارش: فقط یک درخواست موفق به اعتبار می‌رسد ───
    const claim = await db.paymentOrder.updateMany({
      where: { id: order.id, status: "pending" },
      data: {
        status: "paid",
        refId: verify.refId ?? null,
        cardPan: verify.cardPan ?? null,
        paidAt: new Date(),
      },
    });
    if (claim.count !== 1) {
      // هم‌زمانی: درخواست دیگری زودتر اعتبار داد
      return NextResponse.redirect(`${root}/?tokens=paid&ref=${verify.refId ?? ""}`, 302);
    }

    // اعتبار توکن خریداری‌شده (شارژ دلخواه)
    await applyGrant({
      userId: order.userId,
      amount: order.tokens,
      type: "purchase",
      refId: order.id,
      note: `شارژ ${order.tokens.toLocaleString("fa-IR")} توکن`,
    });

    await logActivity({
      userId: order.userId,
      action: "tokens.purchase_paid",
      entity: "payment_order",
      entityId: order.id,
      details: {
        tokens: order.tokens,
        priceToman: order.priceToman,
        refId: verify.refId ?? null,
      },
    });

    return NextResponse.redirect(`${root}/?tokens=paid&ref=${verify.refId ?? ""}`, 302);
  } catch (err) {
    console.error("[tokens/verify] خطا:", err);
    return NextResponse.redirect(`${root}/?tokens=failed`, 302);
  }
}
