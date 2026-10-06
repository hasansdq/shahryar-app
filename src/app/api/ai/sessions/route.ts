// ═════ لیست جلسات گفتگو — GET /api/ai/sessions ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, getUser, guardModule } from "@/lib/core/api";

export async function GET(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("chat");
    if (gate) return gate;

    const sessions = await db.chatSession.findMany({
      where: { userId: auth.id },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true, title: true, mode: true, messageCount: true, updatedAt: true,
      },
    });

    return ok({ sessions });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
