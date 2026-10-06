// ═════ تأیید مهارت — POST /api/social/endorse ═════
// toggle: اگر قبلاً تأیید کرده‌ام حذف می‌شود، وگرنه ثبت
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { rateLimit, getClientIp } from "@/lib/core/rate-limit";
import { parseSkills } from "@/lib/modules/social/service";

export async function POST(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("social");
    if (gate) return gate;

    const rl = rateLimit(`social-endorse:${auth.id}:${getClientIp(req)}`, 40, 3600_000);
    if (!rl.allowed) return fail("درخواست‌های زیاد؛ کمی بعد دوباره تلاش کنید", 429);

    const body = await parseJson<{ userId?: string; skill?: string }>(req);
    const userId = (body?.userId || "").trim();
    const skill = (body?.skill || "").trim().slice(0, 40);

    if (!userId || userId.length > 40) return fail("شناسه کاربر نامعتبر است");
    if (!skill) return fail("مهارت را مشخص کنید");
    if (userId === auth.id) return fail("نمی‌توانید مهارت خودتان را تأیید کنید");

    const profile = await db.socialProfile.findUnique({ where: { userId } });
    if (!profile) return fail("این کاربر پروفایل شهریار ندارد", 404);

    // مهارت باید در پروفایل طرف موجود باشد
    const skills = parseSkills(profile.skills);
    if (!skills.some((s) => s.name.toLowerCase() === skill.toLowerCase())) {
      return fail("این مهارت در پروفایل کاربر موجود نیست");
    }
    // نام دقیق مهارت از پروفایل (برای یکدستی ذخیره)
    const exactSkill = skills.find((s) => s.name.toLowerCase() === skill.toLowerCase())!.name;

    const existing = await db.skillEndorsement.findUnique({
      where: { profileId_endorserId_skill: { profileId: profile.id, endorserId: auth.id, skill: exactSkill } },
    });

    if (existing) {
      await db.skillEndorsement.delete({ where: { id: existing.id } });
      return ok({ endorsed: false, skill: exactSkill });
    }

    await db.skillEndorsement.create({
      data: { profileId: profile.id, endorserId: auth.id, skill: exactSkill },
    });

    await logActivity({
      userId: auth.id,
      action: "social.endorse",
      entity: "social-profile",
      entityId: profile.id,
      details: { skill: exactSkill, forUser: userId },
    });

    return ok({ endorsed: true, skill: exactSkill });
  } catch (err) {
    console.error("خطای تأیید مهارت:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
