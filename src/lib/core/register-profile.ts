// ═════ اعتبارسنجی پروفایل ثبت‌نام (مشترک بین درخواست و تایید OTP) ═════
// فیلدها: نام، نام خانوادگی، جنسیت، تاریخ تولد شمسی (اختیاری)
// ═══════════════════════════════════════════════════════════════
import { jalaliToDate } from "@/lib/client/jalali";

export interface RegisterProfile {
  firstName: string;
  lastName: string;
  gender: "male" | "female";
  birthDate?: { jy: number; jm: number; jd: number } | null;
}

export interface ValidatedProfile {
  fullName: string;
  gender: "male" | "female";
  birthDate: Date | null;
  birthYear: number | null;
}

const FA_NAME = /^[\u0600-\u06FF\u200ca-zA-Z\u00C0-\u024F\s'.-]{2,40}$/u;

/** اعتبارسنجی سمت سرور — پیام فارسی دقیق برمی‌گرداند */
export function validateRegisterProfile(
  profile?: RegisterProfile | null
): { ok: true; value: ValidatedProfile } | { ok: false; error: string } {
  if (!profile) return { ok: false, error: "اطلاعات ثبت‌نام ارسال نشده است" };

  const firstName = (profile.firstName || "").trim().replace(/\s+/g, " ");
  const lastName = (profile.lastName || "").trim().replace(/\s+/g, " ");

  if (firstName.length < 2) return { ok: false, error: "نام باید حداقل ۲ حرف باشد" };
  if (lastName.length < 2) return { ok: false, error: "نام خانوادگی باید حداقل ۲ حرف باشد" };
  if (!FA_NAME.test(firstName) || !FA_NAME.test(lastName)) {
    return { ok: false, error: "نام و نام خانوادگی فقط شامل حروف باشد" };
  }

  if (profile.gender !== "male" && profile.gender !== "female") {
    return { ok: false, error: "جنسیت را انتخاب کنید" };
  }

  let birthDate: Date | null = null;
  let birthYear: number | null = null;
  const bd = profile.birthDate;
  if (bd && typeof bd.jy === "number" && typeof bd.jm === "number" && typeof bd.jd === "number") {
    const { jy, jm, jd } = bd;
    if (jy < 1290 || jy > 1405) return { ok: false, error: "سال تولد نامعتبر است" };
    if (jm < 1 || jm > 12) return { ok: false, error: "ماه تولد نامعتبر است" };
    if (jd < 1 || jd > 31) return { ok: false, error: "روز تولد نامعتبر است" };
    try {
      birthDate = jalaliToDate(jy, jm, jd);
      if (birthDate.getTime() > Date.now()) return { ok: false, error: "تاریخ تولد نمی‌تواند در آینده باشد" };
      birthYear = jy;
    } catch {
      return { ok: false, error: "تاریخ تولد نامعتبر است" };
    }
  }

  return {
    ok: true,
    value: {
      fullName: `${firstName} ${lastName}`.trim(),
      gender: profile.gender,
      birthDate,
      birthYear,
    },
  };
}
