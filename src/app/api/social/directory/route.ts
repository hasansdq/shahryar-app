// ═════ دایرکتوری افراد شهریار — GET /api/social/directory ═════
// جستجو + مرتب‌سازی + پیشنهادها + آمار کلی
import { NextRequest } from "next/server";
import { ok, fail, getUser, guardModule } from "@/lib/core/api";
import { getDirectory } from "@/lib/modules/social/service";

export async function GET(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("social");
    if (gate) return gate;

    const { searchParams } = new URL(req.url);
    const result = await getDirectory(auth.id, {
      q: searchParams.get("q") || undefined,
      skill: searchParams.get("skill") || undefined,
      sort: searchParams.get("sort") || undefined,
    });

    return ok(result);
  } catch (err) {
    console.error("خطای دایرکتوری شهریار:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
