// ═══ تحلیل و مارکتینگ — GET /api/admin/analytics ═══
// رشد ۱۲ماهه، تعامل ماژول‌ها، دستگاه‌ها، علایق، ساعات فعال، برترین‌ها
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, getAdmin } from "@/lib/core/api";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);

    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const monthAgo = new Date(Date.now() - 30 * 86400000);
    const yearAgo = new Date(Date.now() - 365 * 86400000);

    const [
      users, sessionsAll, chatMsgs, goalsAll, reviewsAll, bizAll,
      socialMsgsRecent, logsRecent, usersRecent,
    ] = await Promise.all([
      db.user.findMany({ where: { createdAt: { gte: yearAgo } }, select: { createdAt: true, gender: true, interests: true, birthYear: true, city: true, loginCount: true, lastLoginAt: true, status: true } }),
      db.session.findMany({ where: { createdAt: { gte: monthAgo } }, select: { device: true, createdAt: true } }),
      db.chatMessage.findMany({ where: { createdAt: { gte: weekAgo }, role: "user" }, select: { createdAt: true } }),
      db.goal.findMany({ select: { createdAt: true, status: true } }),
      db.businessReview.findMany({ select: { rating: true, createdAt: true, wouldRecommend: true } }),
      db.business.findMany({ select: { viewCount: true, rating: true, isFeatured: true, name: true, category: { select: { name: true } } } }),
      db.socialMessage.findMany({ where: { createdAt: { gte: weekAgo } }, select: { createdAt: true } }),
      db.activityLog.findMany({ where: { createdAt: { gte: weekAgo } }, select: { action: true, createdAt: true } }),
      db.user.findMany({ orderBy: { createdAt: "desc" }, take: 200, select: { createdAt: true, lastLoginAt: true, loginCount: true } }),
    ]);

    // ─── رشد ۱۲ ماه اخیر ───
    const monthLabels = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
    const faMonths = new Intl.DateTimeFormat("fa-IR", { month: "long" });
    const growth12: Array<{ month: string; count: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      growth12.push({
        month: faMonths.format(mStart).replace(/^(.)ی$/, "$ی") || monthLabels[mStart.getMonth()],
        count: users.filter((u) => u.createdAt >= mStart && u.createdAt < mEnd).length,
      });
    }

    // ─── فعالیت ۱۴ روز اخیر (پیام‌ها + شبکه + ثبت‌نام) ───
    const activity14: Array<{ day: string; chat: number; social: number; signups: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const dStart = new Date(Date.now() - i * 86400000); dStart.setHours(0, 0, 0, 0);
      const dEnd = new Date(dStart.getTime() + 86400000);
      activity14.push({
        day: new Intl.DateTimeFormat("fa-IR", { weekday: "short" }).format(dStart),
        chat: chatMsgs.filter((m) => m.createdAt >= dStart && m.createdAt < dEnd).length,
        social: socialMsgsRecent.filter((m) => m.createdAt >= dStart && m.createdAt < dEnd).length,
        signups: users.filter((u) => u.createdAt >= dStart && u.createdAt < dEnd).length,
      });
    }

    // ─── تعامل ماژول‌ها (مجموع استفاده‌ها) ───
    const [goalCount, chatCount, financeCount, bizViewTotal, socialProfileCount] = await Promise.all([
      db.goal.count(),
      db.chatSession.count(),
      db.financeTransaction.count(),
      db.business.aggregate({ _sum: { viewCount: true } }),
      db.socialProfile.count(),
    ]);
    const moduleEngagement = [
      { key: "chat", label: "هوشیار (گفتگو)", value: chatCount },
      { key: "goals", label: "اهداف", value: goalCount },
      { key: "finance", label: "امور مالی", value: financeCount },
      { key: "businesses", label: "اصناف (بازدید)", value: bizViewTotal._sum.viewCount || 0 },
      { key: "social", label: "شهریار (پروفایل)", value: socialProfileCount },
    ];

    // ─── دستگاه‌ها (سشن‌های ماه اخیر) ───
    const deviceCounts: Record<string, number> = {};
    for (const s of sessionsAll) {
      const d = s.device || "نامشخص";
      const key = /android/i.test(d) ? "اندروید" : /iphone|ipad|ios/i.test(d) ? "iOS" : /windows/i.test(d) ? "ویندوز" : /mac/i.test(d) ? "مک" : /linux/i.test(d) ? "لینوکس" : "نامشخص";
      deviceCounts[key] = (deviceCounts[key] || 0) + 1;
    }
    const devices = Object.entries(deviceCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

    // ─── علایق کاربران ───
    const interestCounts: Record<string, number> = {};
    for (const u of users) {
      if (!u.interests) continue;
      try {
        const list = JSON.parse(u.interests) as string[];
        for (const tag of list.slice(0, 10)) interestCounts[tag] = (interestCounts[tag] || 0) + 1;
      } catch {}
    }
    const interests = Object.entries(interestCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 12);

    // ─── جنسیت و رده سنی ───
    const gender = { male: 0, female: 0, unknown: 0 };
    for (const u of users) {
      if (u.gender === "male") gender.male++;
      else if (u.gender === "female") gender.female++;
      else gender.unknown++;
    }
    const ageBuckets = { "زیر ۲۰": 0, "۲۰ تا ۲۹": 0, "۳۰ تا ۳۹": 0, "۴۰ تا ۴۹": 0, "۵۰ و بالاتر": 0, "نامشخص": 0 };
    for (const u of users) {
      if (!u.birthYear) ageBuckets["نامشخص"]++;
      else {
        const age = new Date().getFullYear() - u.birthYear;
        if (age < 20) ageBuckets["زیر ۲۰"]++;
        else if (age < 30) ageBuckets["۲۰ تا ۲۹"]++;
        else if (age < 40) ageBuckets["۳۰ تا ۳۹"]++;
        else if (age < 50) ageBuckets["۴۰ تا ۴۹"]++;
        else ageBuckets["۵۰ و بالاتر"]++;
      }
    }

    // ─── ساعات فعال (۲۴ ساعته — از لاگ‌ها و پیام‌ها) ───
    const hourCounts = new Array(24).fill(0);
    for (const l of logsRecent) hourCounts[l.createdAt.getHours()]++;
    for (const m of chatMsgs) hourCounts[m.createdAt.getHours()]++;
    for (const m of socialMsgsRecent) hourCounts[m.createdAt.getHours()]++;
    const busiestHours = hourCounts
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // ─── توزیع امتیاز نظرات + رضایت ───
    const ratingDist = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
    let recommendYes = 0, recommendNo = 0;
    for (const r of reviewsAll) {
      ratingDist[String(r.rating)] = (ratingDist[String(r.rating)] || 0) + 1;
      if (r.wouldRecommend) recommendYes++; else recommendNo++;
    }

    // ─── برترین‌ها ───
    const topBiz = [...bizAll].sort((a, b) => b.viewCount - a.viewCount).slice(0, 6)
      .map((b) => ({ name: b.name, category: b.category.name, views: b.viewCount, rating: b.rating }));

    // ─── کاربران قدرتی (فعال‌ترین) ───
    const [topGoalUsers, topChatUsers] = await Promise.all([
      db.goal.groupBy({ by: ["userId"], _count: true, orderBy: { _count: { userId: "desc" } }, take: 5 }),
      db.chatSession.groupBy({ by: ["userId"], _count: true, orderBy: { _count: { userId: "desc" } }, take: 5 }),
    ]);
    const powerIds = [...new Set([...topGoalUsers.map((g) => g.userId), ...topChatUsers.map((c) => c.userId)])];
    const powerUsersData = await db.user.findMany({
      where: { id: { in: powerIds } },
      select: { id: true, fullName: true, isVerified: true },
    });
    const powerUsers = powerUsersData.map((u) => ({
      ...u,
      goals: topGoalUsers.find((g) => g.userId === u.id)?._count ?? 0,
      chats: topChatUsers.find((c) => c.userId === u.id)?._count ?? 0,
    })).sort((a, b) => (b.goals + b.chats) - (a.goals + a.chats)).slice(0, 5);

    // ─── بینش‌های خودکار ───
    const insights: string[] = [];
    const avgRating = reviewsAll.length ? reviewsAll.reduce((a, r) => a + r.rating, 0) / reviewsAll.length : 0;
    if (avgRating >= 4.3) insights.push(`رضایت کاربران از اصناف بالاست (میانگین ${avgRating.toFixed(1)}) — فرصت خوب برای کمپین «معرفی صنف برتر».`);
    else if (reviewsAll.length > 5 && avgRating < 3.5) insights.push(`میانگین امتیاز اصناف پایین است (${avgRating.toFixed(1)}) — بررسی صنوف ضعیف توصیه می‌شود.`);
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
    if (peakHour >= 0) insights.push(`اوج فعالیت کاربران ساعت ${peakHour} است — ارسال اعلان‌ها در این بازه بیشترین دیده‌شدن را دارد.`);
    const weekSignups = users.filter((u) => u.createdAt >= weekAgo).length;
    if (weekSignups > 0) insights.push(`${weekSignups} کاربر جدید در ۷ روز اخیر — پیام خوش‌آمدگویی می‌تواند فعال‌سازی را افزایش دهد.`);
    const dormant = users.filter((u) => u.lastLoginAt && u.lastLoginAt < new Date(Date.now() - 14 * 86400000)).length;
    if (dormant > 0) insights.push(`${dormant} کاربر بیش از ۱۴ روز است وارد نشده‌اند — کمپین بازگشت با اعلان هدفمند پیشنهاد می‌شود.`);
    const androidShare = devices.length ? Math.round((devices.find((d) => d.name === "اندروید")?.count || 0) / sessionsAll.length * 100) : 0;
    if (sessionsAll.length > 3 && androidShare >= 60) insights.push(`حدود ${androidShare}٪ ورودی‌ها از اندروید است — اولویت بهینه‌سازی موبایل اندروید.`);

    return ok({
      growth12, activity14, moduleEngagement, devices, interests,
      gender, ageBuckets, busiestHours, ratingDist,
      recommend: { yes: recommendYes, no: recommendNo },
      topBiz, powerUsers, insights,
      totals: {
        usersTotal: users.length, sessionsMonth: sessionsAll.length,
        reviewsTotal: reviewsAll.length, goalsTotal: goalsAll.length,
      },
    });
  } catch (err) {
    console.error("خطای تحلیل:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
