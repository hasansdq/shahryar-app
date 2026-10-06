// ═════ پیام‌های یک جلسه + حذف — GET/DELETE /api/ai/sessions/[id] ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, getUser, guardModule } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("chat");
    if (gate) return gate;

    const { id } = await params;
    const session = await db.chatSession.findFirst({
      where: { id, userId: auth.id },
    });
    if (!session) return fail("گفتگو یافت نشد", 404);

    const messages = await db.chatMessage.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, role: true, content: true, thinking: true, searchUsed: true,
        imageData: true, createdAt: true, generatedFiles: true,
        attachmentUrl: true, attachmentName: true, attachmentMime: true,
      },
    });

    return ok({ session, messages });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("chat");
    if (gate) return gate;

    const { id } = await params;
    const session = await db.chatSession.findFirst({ where: { id, userId: auth.id } });
    if (!session) return fail("گفتگو یافت نشد", 404);

    await db.chatSession.delete({ where: { id } });
    await logActivity({ userId: auth.id, action: "ai.session_delete", entity: "chatSession", entityId: id });

    return ok({ message: "گفتگو حذف شد" });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
