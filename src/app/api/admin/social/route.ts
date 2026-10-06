// ═══ مدیریت شبکه شهریار — GET /api/admin/social ═══
// نمای کلی + پروفایل‌ها + ایجنت‌ها با آمار جامع
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, getAdmin } from "@/lib/core/api";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const agentOnly = searchParams.get("agents") === "1";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = 12;

    // ─── آمار کلی شبکه ───
    const [
      profilesTotal, agentsEnabled, verifiedUsers,
      dmCount, agentConvCount, socialMsgs, endorsementsTotal, viewsTotal,
      knowledgeTotal, active7d,
    ] = await Promise.all([
      db.socialProfile.count(),
      db.socialProfile.count({ where: { agentEnabled: true } }),
      db.user.count({ where: { isVerified: true } }),
      db.socialConversation.count({ where: { type: "dm" } }),
      db.socialConversation.count({ where: { type: "agent" } }),
      db.socialMessage.count(),
      db.skillEndorsement.count(),
      db.profileViewLog.count(),
      db.knowledgeItem.count(),
      db.socialMessage.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } } }),
    ]);

    // ─── لیست پروفایل‌ها با جستجو ───
    const where = {
      user: q
        ? { OR: [{ fullName: { contains: q } }, { phone: { contains: q } }] }
        : undefined,
      ...(agentOnly ? { agentEnabled: true } : {}),
    };

    const [profiles, total] = await Promise.all([
      db.socialProfile.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, userId: true, headline: true, bio: true, city: true,
          bannerTheme: true, skills: true, interests: true,
          isDiscoverable: true, viewCount: true,
          agentEnabled: true, agentName: true, agentGreeting: true,
          agentStyle: true, agentInstructions: true, agentForbidden: true,
          agentQuestions: true, agentUseProfile: true, agentSuggestHandoff: true,
          createdAt: true, updatedAt: true,
          user: {
            select: {
              id: true, fullName: true, phone: true, avatarColor: true, avatarUrl: true,
              isVerified: true, status: true, createdAt: true, lastLoginAt: true, loginCount: true,
            },
          },
          _count: { select: { viewLogs: true, endorsements: true } },
        },
      }),
      db.socialProfile.count({ where }),
    ]);

    // آمار هر پروفایل: دانش، گفتگوهای ایجنت، پیام‌های ارسالی
    const profilesWithStats = await Promise.all(
      profiles.map(async (p) => {
        const [knowledge, agentConvs, msgsSent] = await Promise.all([
          db.knowledgeItem.count({ where: { userId: p.userId } }),
          db.socialConversation.count({ where: { ownerId: p.userId, type: "agent" } }),
          db.socialMessage.count({ where: { senderId: p.userId } }),
        ]);
        let skills: Array<{ name: string; level: number }> = [];
        let interests: string[] = [];
        let agentQuestions: string[] = [];
        try { skills = p.skills ? JSON.parse(p.skills) : []; } catch {}
        try { interests = p.interests ? JSON.parse(p.interests) : []; } catch {}
        try { agentQuestions = p.agentQuestions ? JSON.parse(p.agentQuestions) : []; } catch {}
        return {
          ...p,
          skills: skills.slice(0, 8),
          interests: interests.slice(0, 6),
          agentQuestions: agentQuestions.slice(0, 4),
          stats: {
            knowledge,
            agentConvs,
            msgsSent,
            endorsements: p._count.endorsements,
            views: p._count.viewLogs,
          },
        };
      })
    );

    // ─── برترین پروفایل‌ها (بازدید) ───
    const topProfiles = await db.socialProfile.findMany({
      orderBy: { viewCount: "desc" },
      take: 5,
      select: { id: true, headline: true, viewCount: true, user: { select: { fullName: true, isVerified: true } } },
    });

    return ok({
      overview: {
        profilesTotal, agentsEnabled, verifiedUsers,
        dmCount, agentConvCount, socialMsgs, endorsementsTotal, viewsTotal,
        knowledgeTotal, active7d,
      },
      profiles: profilesWithStats,
      topProfiles,
      pagination: { page, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err) {
    console.error("خطای مدیریت شبکه:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
