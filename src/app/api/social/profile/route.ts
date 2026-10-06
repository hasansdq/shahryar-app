// ═════ پروفایل اجتماعی من — GET / PUT /api/social/profile ═════
// GET: پروفایل کامل + آمار ایجنت + بازدیدکنندگان اخیر
// PUT: ایجاد/به‌روزرسانی پروفایل عمومی
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { sanitizeProfileInput, getAgentStats, type ProfileInput } from "@/lib/modules/social/service";

export async function GET(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("social");
    if (gate) return gate;

    const [profile, agentStats] = await Promise.all([
      db.socialProfile.findUnique({ where: { userId: auth.id } }),
      getAgentStats(auth.id),
    ]);

    // بازدیدکنندگان اخیر پروفایل من (۹ نفر آخر)
    const viewLogs = await db.profileViewLog.findMany({
      where: { profile: { userId: auth.id } },
      orderBy: { updatedAt: "desc" },
      take: 9,
      include: {
        viewer: { select: { id: true, fullName: true, avatarUrl: true, avatarColor: true } },
      },
    });

    // مجموع تأییدهای دریافتی
    const endorseAgg = await db.skillEndorsement.aggregate({
      where: { profile: { userId: auth.id } },
      _count: { _all: true },
    });

    return ok({
      profile: profile
        ? {
            headline: profile.headline,
            bio: profile.bio,
            city: profile.city,
            bannerUrl: profile.bannerUrl,
            bannerTheme: profile.bannerTheme,
            skills: JSON.parse(profile.skills || "[]"),
            interests: JSON.parse(profile.interests || "[]"),
            education: JSON.parse(profile.education || "[]"),
            experience: JSON.parse(profile.experience || "[]"),
            links: JSON.parse(profile.links || "[]"),
            isDiscoverable: profile.isDiscoverable,
            viewCount: profile.viewCount,
            updatedAt: profile.updatedAt.toISOString(),
            agent: {
              enabled: profile.agentEnabled,
              name: profile.agentName,
              greeting: profile.agentGreeting,
              style: profile.agentStyle,
              instructions: profile.agentInstructions,
              forbidden: profile.agentForbidden,
              useProfile: profile.agentUseProfile,
              suggestHandoff: profile.agentSuggestHandoff,
              questions: JSON.parse(profile.agentQuestions || "[]"),
            },
          }
        : null,
      agentStats: {
        items: agentStats.items,
        totalChars: agentStats.totalChars,
      },
      viewers: viewLogs
        .filter((v) => v.viewerId !== auth.id)
        .map((v) => ({
          userId: v.viewer.id,
          name: v.viewer.fullName || "کاربر شهریار",
          avatarUrl: v.viewer.avatarUrl,
          avatarColor: v.viewer.avatarColor,
          at: v.updatedAt.toISOString(),
        })),
      endorsementsReceived: endorseAgg._count._all,
    });
  } catch (err) {
    console.error("خطای GET پروفایل اجتماعی:", err);
    return fail("خطای داخلی سرور", 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("social");
    if (gate) return gate;

    const body = await parseJson<ProfileInput>(req);
    if (!body) return fail("درخواست نامعتبر است");

    const { data, errors } = sanitizeProfileInput(body);
    if (errors.length > 0) return fail(errors[0]);

    const profile = await db.socialProfile.upsert({
      where: { userId: auth.id },
      create: { userId: auth.id, ...data },
      update: data,
    });

    await logActivity({
      userId: auth.id,
      action: "social.profile.update",
      entity: "social-profile",
      entityId: profile.id,
      details: {
        skills: data.skills ? JSON.parse(data.skills).length : undefined,
        headline: data.headline,
        agentOnly: body?.agent !== undefined && body?.headline === undefined,
      },
    });

    return ok({ profileId: profile.id, updatedAt: profile.updatedAt.toISOString() });
  } catch (err) {
    console.error("خطای PUT پروفایل اجتماعی:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
