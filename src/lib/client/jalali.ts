// ═════ موتور تقویم جلالی شهریار ═════
// تبدیل دقیق میلادی ↔ جلالی (الگوریتم استاندارد jalaali)
// تاریخ و ساعت رسمی ایران — Asia/Tehran

export interface JalaliDate {
  jy: number;
  jm: number;
  jd: number;
}

export interface GregorianDate {
  gy: number;
  gm: number;
  gd: number;
}

const div = (a: number, b: number): number => ~~(a / b);
const mod = (a: number, b: number): number => a - ~~(a / b) * b;

/** محاسبه سال کبیسه و روز اول فروردین */
function jalCal(jy: number): { leap: number; gy: number; march: number } {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210,
    1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178,
  ];
  let bl = breaks.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];
  let jm = 0;
  let jump = 0;
  let leap = 0;
  let n = 0;
  let i = 1;
  for (; i < bl; i += 1) {
    jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

function g2d(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn: number): GregorianDate {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

/** جلالی → تعداد روز ژولینی */
function j2d(jy: number, jm: number, jd: number): number {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

/** تعداد روز ژولینی → جلالی */
function d2j(jdn: number): JalaliDate {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let jd = 0;
  let jm = 0;
  let k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div(k, 31);
      jd = mod(k, 31) + 1;
      return { jy, jm, jd };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  jm = 7 + div(k, 30);
  jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}

export function isLeapJalaliYear(jy: number): boolean {
  return jalCal(jy).leap === 0;
}

export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapJalaliYear(jy) ? 30 : 29;
}

/** میلادی → جلالی */
export function toJalali(date: Date): JalaliDate {
  const jdn = g2d(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return d2j(jdn);
}

/** جلالی → میلادی (Date محلی) */
export function jalaliToDate(jy: number, jm: number, jd: number): Date {
  const jdn = j2d(jy, jm, jd);
  const g = d2g(jdn);
  return new Date(g.gy, g.gm - 1, g.gd, 12, 0, 0);
}

/** رشته ISO میلادی (YYYY-MM-DD) → جلالی */
export function isoToJalali(iso: string): JalaliDate | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], 12);
  if (isNaN(d.getTime())) return null;
  return toJalali(d);
}

/** جلالی → رشته ISO میلادی (YYYY-MM-DD) */
export function jalaliToISO(jy: number, jm: number, jd: number): string {
  const d = jalaliToDate(jy, jm, jd);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** تاریخ امروز به وقت رسمی ایران (جلالی) */
export function jalaliToday(): JalaliDate {
  return toJalali(new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tehran" })));
}

export const JALALI_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];

export const JALALI_MONTHS_SHORT = [
  "فرو", "ارد", "خرد", "تیر", "مرد", "شهر",
  "مهر", "آبا", "آذر", "دی", "بهم", "اسف",
];

/** سرستون‌های هفته — هفته از شنبه شروع می‌شود */
export const WEEKDAY_HEADERS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

/** ایندکس روز هفته (۰=شنبه ... ۶=جمعه) */
export function jalaliWeekday(jy: number, jm: number, jd: number): number {
  const d = jalaliToDate(jy, jm, jd);
  // getDay: 0=Sunday...6=Saturday → شنبه=0
  return (d.getDay() + 1) % 7;
}

/** قالب‌بندی خوانا: ۲۶ مرداد ۱۴۰۵ */
export function formatJalali(j: JalaliDate): string {
  const fa = (n: number | string) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
  return `${fa(j.jd)} ${JALALI_MONTHS[j.jm - 1]} ${fa(j.jy)}`;
}

/** قالب کوتاه با اسلش: ۱۴۰۵/۰۵/۲۶ */
export function formatJalaliShort(j: JalaliDate): string {
  const fa = (n: number | string) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
  const p = (n: number) => fa(String(n).padStart(2, "0"));
  return `${fa(j.jy)}/${p(j.jm)}/${p(j.jd)}`;
}
