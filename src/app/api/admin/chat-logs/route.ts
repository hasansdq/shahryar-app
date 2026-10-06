// ═════ لاگ گفتگوهای هوشیار (ادمین) — GET /api/admin/chat-logs ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, getAdmin } from "@/lib/core/api";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);

    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode") || "";
    const sessionId = searchParams.get("sessionId") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(5, parseInt(searchParams.get("limit") || "20")));

    const where: Record<string, unknown> = {};
    if (mode) where.mode = mode;
    if (sessionId) where.id = sessionId;

    const [sessions, total] = await Promise.all([
      db.chatSession.findMany({
        where,
        include: {
          user: { select: { fullName: true, phone: true, avatarColor: true } },
          _count: { select: { messages: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.chatSession.count({ where }),
    ]);

    return ok({
      sessions: sessions.map((s) => ({
        id: s.id, title: s.title, mode: s.mode, messageCount: s.messageCount,
        updatedAt: s.updatedAt, createdAt: s.createdAt,
        user: s.user,
        messagesCount: s._count.messages,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
