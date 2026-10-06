// ═════ پروفایل عمومی کاربر — GET /api/social/profiles/[userId] ═════
// نمای کامل پروفایل برای دیالوگ پروفایل + ثبت بازدید
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, getUser, guardModule } from "@/lib/core/api";
import {
  toPersonCard,
  getAgentStats,
  parseSkills,
  parseInterests,
  parseEducation,
  parseExperience,
  parseLinks,
  parseAgentQuestions,
} from "@/lib/modules/social/service";

export async function GET(req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("social");
    if (gate) return gate;

    const { userId } = await ctx.params;
    if (!userId || userId.length > 40) return fail("شناسه کاربر نامعتبر است");

    const profile = await db.socialProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, fullName: true, avatarUrl: true, avatarColor: true, status: true, city: true, createdAt: true, isVerified: true } },
        endorsements: { select: { skill: true } },
      },
    });

    // ─── کاربر بدون پروفایل اجتماعی؟ نمای حداقلی از رکورد کاربر ───
    // هر نامِ قابل‌کلیک در اپ (اعضای انجمن، پیام تالار، …) باید پروفایلی با
    // نامِ شخص باز کند — نه خطای ۴۰۴ بدون نام.
    if (!profile) {
      const u = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, fullName: true, avatarUrl: true, avatarColor: true, status: true, city: true, createdAt: true, isVerified: true, updatedAt: true },
      });
      if (!u || u.status !== "ACTIVE") return fail("این کاربر یافت نشد", 404);
      return ok({
        userId: u.id,
        name: u.fullName || "کاربر شهریار",
        avatarUrl: u.avatarUrl,
        avatarColor: u.avatarColor,
        isVerified: u.isVerified,
        headline: null,
        city: u.city,
        bannerTheme: "0",
        bannerUrl: null,
        skills: [],
        interests: [],
        endorsementCount: 0,
        hasAgent: false,
        knowledgeCount: 0,
        viewCount: 0,
        updatedAt: u.updatedAt.toISOString(),
        bio: null,
        education: [],
        experience: [],
        links: [],
        skillEndorsements: {},
        myEndorsements: [],
        isMe: auth.id === userId,
        joinedAt: u.createdAt.toISOString(),
        agentStats: { items: 0, totalChars: 0 },
        postStats: { total: 0, likes: 0 },
        agentInfo: { enabled: false, name: null, greeting: null, questions: [] },
        hasSocialProfile: false,
      });
    }
    if (profile.user.status !== "ACTIVE") return fail("این پروفایل یافت نشد", 404);

    const isMe = auth.id === userId;
    if (!profile.isDiscoverable && !isMe) return fail("این کاربر در دایرکتوری شهریار مخفی شده است", 403);

    const [agentStats, myEndorsements, postStats] = await Promise.all([
      getAgentStats(userId),
      isMe
        ? Promise.resolve([] as string[])
        : db.skillEndorsement.findMany({
            where: { profileId: profile.id, endorserId: auth.id },
            select: { skill: true },
          }),
      db.socialPost.aggregate({
        where: { authorId: userId, deletedAt: null },
        _count: { _all: true },
      }),
    ]);
    const likesReceived = await db.socialPostLike.count({
      where: { post: { authorId: userId, deletedAt: null } },
    });

    // ─── ثبت بازدید (غیر خودم؛ حداکثر یک‌بار در ۶ ساعت شمارش می‌شود) ───
    if (!isMe) {
      const existing = await db.profileViewLog.findUnique({
        where: { profileId_viewerId: { profileId: profile.id, viewerId: auth.id } },
      });
      const sixHours = 6 * 3600 * 1000;
      const shouldCount = !existing || Date.now() - existing.updatedAt.getTime() > sixHours;
      await db.profileViewLog.upsert({
        where: { profileId_viewerId: { profileId: profile.id, viewerId: auth.id } },
        create: { profileId: profile.id, viewerId: auth.id },
        update: { updatedAt: new Date() },
      });
      if (shouldCount) {
        await db.socialProfile.update({
          where: { id: profile.id },
          data: { viewCount: { increment: 1 } },
        });
      }
    }

    // توزیع تأییدها بر اساس مهارت
    const skillEndorsements: Record<string, number> = {};
    for (const e of profile.endorsements) {
      skillEndorsements[e.skill] = (skillEndorsements[e.skill] || 0) + 1;
    }
    const endorsementCount = profile.endorsements.length;

    const card = toPersonCard(
      profile,
      endorsementCount,
      agentStats.items > 0 && profile.agentEnabled !== false,
      agentStats.items
    );

    return ok({
      ...card,
      bio: profile.bio,
      education: parseEducation(profile.education),
      experience: parseExperience(profile.experience),
      links: parseLinks(profile.links),
      // هر دو فیلد skills/interests دوباره برای اطمینان از سازگاری
      skills: parseSkills(profile.skills),
      interests: parseInterests(profile.interests),
      skillEndorsements,
      myEndorsements: myEndorsements.map((m) => m.skill),
      isMe,
      joinedAt: profile.user.createdAt.toISOString(),
      agentStats: { items: agentStats.items, totalChars: agentStats.totalChars },
      postStats: { total: postStats._count._all, likes: likesReceived },
      agentInfo: {
        enabled: profile.agentEnabled !== false,
        name: profile.agentName,
        greeting: profile.agentGreeting,
        questions: parseAgentQuestions(profile.agentQuestions),
      },
      hasSocialProfile: true,
    });
  } catch (err) {
    console.error("خطای پروفایل عمومی:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
