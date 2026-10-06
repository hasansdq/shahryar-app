// ═══ POST /api/social/posts/[id]/like — لایک/آنلایک اتمیک ─═══════
// الگوی بدون-تراکنشِ مقاوم به همزمانی (SQLite-friendly):
//
// چرا بدون $transaction: تراکنش interactive در SQLite نوشتن را تا پایان
// کل تراکنش قفل می‌کند؛ با چند لایکِ همزمان (مثل موج هجوم کاربران روی
// یک پست داغ) صفِ قفل طولانی می‌شود، تراکنش‌ها به timeout پنج‌ثانیه‌ای
// می‌رسند و کاربر ۵۰۰ می‌گیرد (اندازه‌گیری شد: ۶ لایک موازی → ۴×P1008).
//
// به‌جای آن دو عملیات «تک‌کوئریِ» کوتاه که هرکدام اتمیک‌اند:
//  • آنلایک: deleteMany یکتا (postId+userId) — count=1 یعنی برداشت شد
//  • لایک: create با قید یکتا — P2002 یعنی همین لحظه لایک شده
// دو درخواست موازی toggle در هر چینشی به نتیجه سازگار می‌رسند و هیچ
// کوئری‌ای بیشتر از چند میلی‌ثانیه قفل نگه نمی‌دارد.
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, getUser, guardModule } from "@/lib/core/api";

type Ctx = { params: Promise<{ id: string }> };
type LikeResult = { error: string; status: 404 } | { liked: boolean; likeCount: number };

/** خطای قابل تلاش‌مجدد — قفل موقت SQLite (زیر بار) یا تداخل تراکنش */
function isTransientDbError(err: unknown): boolean {
  const code = typeof err === "object" && err !== null ? (err as { code?: string }).code : undefined;
  if (code === "P1008" || code === "P2034") return true; // timeout / write conflict
  return typeof err === "object" && err !== null && "message" in err
    ? /socket timeout|database is locked|write conflict/i.test(String((err as { message?: string }).message))
    : false;
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt < retries - 1 && isTransientDbError(err)) {
        // پس‌خورد کوتاه + jitter — صف قفل تخلیه شود
        await new Promise((r) => setTimeout(r, 60 * (attempt + 1) + Math.random() * 60));
        continue;
      }
      throw err;
    }
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("social");
    if (gate) return gate;

    const { id } = await ctx.params;
    if (!id || id.length > 40) return fail("شناسه پست نامعتبر است");

    const result = await withRetry<LikeResult>(async (): Promise<LikeResult> => {
      const post = await db.socialPost.findUnique({ where: { id }, select: { id: true, deletedAt: true } });
      if (!post || post.deletedAt) return { error: "این پست یافت نشد", status: 404 } as const;

      // ─── گام ۱: آنلایک (اتمیک — یک کوئری، شمارنده فقط اگر واقعا حذف شد) ───
      const unlike = await db.socialPostLike.deleteMany({ where: { postId: id, userId: auth.id } });
      if (unlike.count > 0) {
        const updated = await db.socialPost.update({
          where: { id },
          data: { likeCount: { decrement: 1 } },
          select: { likeCount: true },
        });
        return { liked: false, likeCount: Math.max(0, updated.likeCount) } as const;
      }

      // ─── گام ۲: لایک (create با قید یکتا — رقابت همزمان → P2002) ───
      try {
        await db.socialPostLike.create({ data: { postId: id, userId: auth.id } });
      } catch (err) {
        if (typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002") {
          // همین لحظه توسط درخواست دیگری لایک شد — وضعیت موجود را برگردان
          const existing = await db.socialPost.findUnique({ where: { id }, select: { likeCount: true } });
          return { liked: true, likeCount: existing?.likeCount ?? 0 } as const;
        }
        throw err;
      }
      const updated = await db.socialPost.update({
        where: { id },
        data: { likeCount: { increment: 1 } },
        select: { likeCount: true },
      });
      return { liked: true, likeCount: updated.likeCount } as const;
    });

    if ("error" in result) return fail(result.error, result.status);
    return ok(result);
  } catch (err) {
    console.error("خطای لایک پست:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
