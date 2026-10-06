// ═════ گفتگوهای اجتماعی — GET / POST /api/social/conversations ═════
// GET: فهرست گفتگوهای من (DM + گفتگو با ایجنت‌ها + گفتگو با ایجنتِ خودم)
// POST: شروع/یافتن گفتگو { type: "dm" | "agent", userId }
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import type { ConversationSummary } from "@/lib/modules/social/types";

const USER_SELECT = {
  id: true,
  fullName: true,
  avatarUrl: true,
  avatarColor: true,
  isVerified: true,
  socialProfile: { select: { headline: true } },
} as const;

export async function GET(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("social");
    if (gate) return gate;

    const convs = await db.socialConversation.findMany({
      where: { OR: [{ userAId: auth.id }, { userBId: auth.id }, { ownerId: auth.id }] },
      orderBy: { updatedAt: "desc" },
      take: 60,
      include: {
        userA: { select: USER_SELECT },
        userB: { select: USER_SELECT },
        owner: { select: USER_SELECT },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { content: true, senderType: true } },
      },
    });

    const summaries: ConversationSummary[] = convs.map((c) => {
      // گفتگو با ایجنتِ خودم = آزمایش ایجنت (نقش: چت‌کننده، نه مالکِ ناظر)
      const isSelfAgent = c.type === "agent" && c.userAId === auth.id && c.ownerId === auth.id;
      const isOwnerSide = c.type === "agent" && c.ownerId === auth.id && !isSelfAgent;
      let other;
      if (c.type === "dm") {
        other = c.userAId === auth.id ? c.userB : c.userA;
      } else {
        // agent: طرف مقابل = صاحب ایجنت (اگر من چت‌کننده‌ام) یا چت‌کننده (اگر مالکم)
        other = isOwnerSide ? c.userA : c.owner;
      }
      const last = c.messages[0];
      return {
        id: c.id,
        type: c.type as "dm" | "agent",
        otherUserId: other?.id || "",
        otherUserName: other?.fullName || "کاربر شهریار",
        otherUserAvatar: other?.avatarUrl ?? null,
        otherUserAvatarColor: other?.avatarColor || "0",
        otherHeadline: other?.socialProfile?.headline ?? null,
        myRole: isOwnerSide ? "agent-owner" : "participant",
        lastMessage: last
          ? `${last.senderType === "agent" ? "🤖 " : ""}${(last.content || "").replace(/\s+/g, " ").slice(0, 70)}`
          : "—",
        lastMessageAt: c.updatedAt.toISOString(),
        messageCount: c.messageCount,
      };
    });

    return ok({ conversations: summaries });
  } catch (err) {
    console.error("خطای فهرست گفتگوها:", err);
    return fail("خطای داخلی سرور", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("social");
    if (gate) return gate;

    const body = await parseJson<{ type?: string; userId?: string }>(req);
    const type = body?.type === "agent" ? "agent" : body?.type === "dm" ? "dm" : null;
    const userId = (body?.userId || "").trim();

    if (!type) return fail("نوع گفتگو نامعتبر است");
    if (!userId || userId.length > 40) return fail("شناسه کاربر نامعتبر است");

    // فلگ‌های CMS
    const dmGate = type === "dm" ? await guardModule("social", "enableDirectChat") : null;
    if (dmGate) return dmGate;
    const agentGate = type === "agent" ? await guardModule("social", "enableAgentChat") : null;
    if (agentGate) return agentGate;

    // DM با خودم ممنوع؛ گفتگو با ایجنتِ خودم مجاز (آزمایش ایجنت)
    if (type === "dm" && userId === auth.id) return fail("نمی‌توانید با خودتان گفتگو کنید");

    const target = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, fullName: true },
    });
    if (!target || target.status !== "ACTIVE") return fail("این کاربر در دسترس نیست", 404);

    // برای گفتگو با ایجنت، پروفایل اجتماعی باید موجود و ایجنت فعال باشد
    if (type === "agent") {
      const profile = await db.socialProfile.findUnique({
        where: { userId },
        select: { agentEnabled: true },
      });
      if (!profile) return fail("این کاربر هنوز پروفایل شهریار نساخته است", 404);
      if (profile.agentEnabled === false) {
        return fail("ایجنت این کاربر در حال حاضر غیرفعال است؛ از گفتگوی مستقیم استفاده کنید", 403);
      }
    }

    const key =
      type === "dm"
        ? `dm:${[auth.id, userId].sort().join(":")}`
        : `agent:${auth.id}:${userId}`;

    const conv = await db.socialConversation.upsert({
      where: { key },
      create:
        type === "dm"
          ? { key, type, userAId: auth.id, userBId: userId }
          : { key, type, userAId: auth.id, ownerId: userId },
      update: {},
    });

    await logActivity({
      userId: auth.id,
      action: type === "dm" ? "social.dm.start" : "social.agent.start",
      entity: "social-conversation",
      entityId: conv.id,
      details: { with: userId },
    });

    return ok({ conversationId: conv.id, type, isNew: conv.messageCount === 0 });
  } catch (err) {
    console.error("خطای شروع گفتگو:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
