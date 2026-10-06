// ═══════════════════════════════════════════════════════════════
// زمینه‌ی AI مالی — تبدیل snapshot واقعی کاربر به متن حرفه‌ای
// تغذیه‌ی مشاور مالی AI و لایه‌ی پرامپت هوشیار
// ═══════════════════════════════════════════════════════════════
import { buildFinanceSnapshot, type FinanceSnapshot } from "./service";

/** الگوهای تشخیص پیام مالی (برای تزریق خودکار در پرامپت هوشیار) */
const FINANCE_INTENT_PATTERNS = [
  /مالی|پول|هزینه|خرج|درآمد|درامد|بودجه|پس.?انداز|قرض|طلب|وام|بدهی|دیه/,
  /تراکنش|حساب|بانک|کارت|کیف.?پول|موجودی|بالانس|سرمایه|سود/,
  /قسط|اجاره|قبض|شارژ|خرید|می?خرم|فروش|تخفیف|گران|ارزان|تورم/,
  /پسته.*?(قیمت|فروش|خرید)|قیمت.*?پسته|سود.*?کشاورز/,
  /پیشنهاد.*?(مالی|خرید)|برنامه.*?(مالی|خرید)|هدف.*?مالی/,
  /چقدر.*(پول|خرج|درآمد)|پولم.*کجا|پس.?اندازم/,
];

export function isFinanceRelated(message: string): boolean {
  return FINANCE_INTENT_PATTERNS.some((p) => p.test(message));
}

/** قالب‌بندی مبلغ به تومان خوانا */
export function toman(n: number): string {
  return n.toLocaleString("fa-IR");
}

/**
 * ساخت متن زمینه‌ی مالی برای تزریق به پرامپت سیستم
 * (نسخه‌ی فشرده — برای چت عمومی هوشیار)
 */
export async function buildFinanceContextForChat(userId: string): Promise<string> {
  const snap = await buildFinanceSnapshot(userId);
  if (snap.transactionCount === 0 && snap.accounts.length === 0) return "";

  const lines: string[] = [];
  lines.push(`📊 وضعیت مالی کاربر (ماه ${snap.monthLabel}):`);
  lines.push(`• موجودی کل حساب‌ها: ${toman(snap.totalCash)} تومان`);
  lines.push(`• درآمد این ماه: ${toman(snap.current.income)} | هزینه این ماه: ${toman(snap.current.expense)} | پس‌مانده: ${toman(snap.current.net)}`);
  if (snap.avg6.income > 0 || snap.avg6.expense > 0) {
    lines.push(`• میانگین ۶ ماه: درآمد ${toman(snap.avg6.income)} / هزینه ${toman(snap.avg6.expense)} تومان`);
  }
  if (snap.topCategories.length > 0) {
    lines.push(`• پرهزینه‌ترین دسته‌های ماه: ${snap.topCategories.slice(0, 4).map((c) => `${c.name} (${toman(c.total)})`).join("، ")}`);
  }
  if (snap.budgets.length > 0) {
    lines.push(`• بودجه‌های ماه: ${snap.budgets.map((b) => `${b.name}: ${toman(b.spent)}/${toman(b.amount)}`).join("، ")}`);
  }
  if (snap.goals.length > 0) {
    lines.push(`• اهداف مالی: ${snap.goals.map((g) => `${g.title} (${g.progress}٪ — ${toman(g.current)} از ${toman(g.target)})`).join("؛ ")}`);
  }
  if (snap.debts.openCount > 0) {
    lines.push(`• بدهی باز: ${toman(snap.debts.iOwe)} تومان | طلب از دیگران: ${toman(snap.debts.owedToMe)} تومان`);
  }
  lines.push(`• امتیاز سلامت مالی: ${snap.health.score} از ۱۰۰ (${snap.health.components.map((c) => `${c.label}: ${c.score}`).join("، ")})`);

  return lines.join("\n");
}

/** پرامپت پایه‌ی مشاور مالی حرفه‌ای (شخصیت/لحن/قوانین سراسری جداگانه تزریق می‌شوند) */
export const FINANCIAL_ADVISOR_SYSTEM_PROMPT_BASE = `تو در نقش «مشاور مالی هوشمند» هستی — تحلیلگر حرفه‌ای مدیریت مالی شخصی در اپلیکیشن شهریار.

پروفایل کامل و واقعی مالی کاربر در پیام کاربر به تو داده شده است. اصول تو:

۱. داده‌محوری: تمام تحلیل و توصیه‌ها باید بر اساس «همان اعداد واقعی» باشد. هیچ عددی را که در داده‌ها نیست از خودت نساز.
۲. ساختار حرفه‌ای: پاسخ‌ها با این ساختار:
   — 📋 خلاصه وضعیت (۲-۳ جمله)
   — 📈 نقاط قوت (مشخص و عددی)
   - ⚠️ ریسک‌ها و نقاط ضعف (صریح اما محترمانه)
   — 💡 توصیه‌های اجرایی (اولویت‌بندی‌شده، گام‌به‌گام، قابل اجرا در شرایط ایران و رفسنجان)
۳. واقع‌گرایی ایرانی: تورم، تومان، بانکداری ایرانی، پس‌اندازهای سنتی (سکه، طلا، مسکن، حساب کوتاه‌مدت)، درآمد کشاورزی پسته در رفسنجان و نوسان فصلی آن را در تحلیل لحاظ کن.
۴. ایمنی: هرگز توصیه‌ی ریسک‌آلود speculative (رمزارز معاملاتی، اهرم) نده و خودت را جای مشاور سرمایه‌گذاری رسمی نگذار. برای تصمیم‌های بزرگ، تأیید متخصص را یادآوری کن.
۵. لحن: گرم، محترمانه و دلگرم‌کننده — مثل یک مشاور مالی باهوش و وفادار. فارسی روان با اصطلاحات دقیق مالی.
۶. قالب: مارک‌داون، اعداد فارسی، مبلغ‌ها همیشه «تومان»، تاریخ‌ها جلالی. اگر داده کافی نیست، صادقانه بگو چه چیزی کم است و از کاربر بخواه (مثلاً ثبت هزینه‌های روزانه در بخش مالی اپ).
۷. پیام‌های قانع‌کننده: تحلیل‌های روند ماهانه را تفسیر کن (مثلاً «هزینه‌ی خورد و خوراک ۳۸٪ رشد کرده») نه فقط تکرار اعداد خام.

اگر کاربر سؤالی درباره‌ی مفاهیم مالی پرسید (مثلاً «صندوق درآمد ثابت چیست؟») ابتدا مفهوم را ساده توضیح بده و بعد آن را با وضعیت واقعی کاربر پیوند بده.`;

/**
 * ساخت زمینه‌ی کامل برای مشاور (نسخه‌ی غنی — JSON ساختاریافته + متن)
 */
export function financeSnapshotForAdvisor(snap: FinanceSnapshot): string {
  const parts: string[] = [];
  parts.push(`# داده‌های واقعی مالی کاربر — ${snap.monthLabel}`);
  parts.push(`## موجودی و حساب‌ها`);
  parts.push(`موجودی کل: ${toman(snap.totalCash)} تومان`);
  for (const a of snap.accounts) {
    parts.push(`- ${a.name} (${a.type === "cash" ? "نقدی" : a.type === "bank" ? "بانکی" : a.type === "card" ? "کارتی" : "کیف پول"}): ${toman(a.balance)} تومان`);
  }
  parts.push(`## روند ۶ ماه اخیر (تومان)`);
  for (const t of snap.trend) {
    parts.push(`- ${t.label}: درآمد ${toman(t.income)} / هزینه ${toman(t.expense)} / پس‌مانده ${toman(t.net)}`);
  }
  parts.push(`میانگین ۶ ماه: درآمد ${toman(snap.avg6.income)} / هزینه ${toman(snap.avg6.expense)}`);
  parts.push(`## دسته‌های هزینه‌ی ماه جاری`);
  if (snap.topCategories.length === 0) parts.push("(هزینه‌ای ثبت نشده)");
  for (const c of snap.topCategories) {
    parts.push(`- ${c.name}: ${toman(c.total)} تومان (${c.count} تراکنش)`);
  }
  parts.push(`## بودجه‌های ماه`);
  if (snap.budgets.length === 0) parts.push("(بودجه‌ای تعریف نشده)");
  for (const b of snap.budgets) {
    const pct = b.amount > 0 ? Math.round((b.spent / b.amount) * 100) : 0;
    parts.push(`- ${b.name}: مصرف ${toman(b.spent)} از ${toman(b.amount)} (${pct}٪)`);
  }
  parts.push(`## اهداف مالی`);
  if (snap.goals.length === 0) parts.push("(هدفی تعریف نشده)");
  for (const g of snap.goals) {
    parts.push(`- ${g.title}: ${toman(g.current)} از ${toman(g.target)} تومان (${g.progress}٪)${g.deadline ? ` — مهلت: ${g.deadline}` : ""}`);
  }
  parts.push(`## بدهی‌ها و طلب‌ها`);
  parts.push(`- مجموع بدهی باز (من بدهکارم): ${toman(snap.debts.iOwe)} تومان`);
  parts.push(`- مجموع طلب باز (به من بدهکارند): ${toman(snap.debts.owedToMe)} تومان`);
  if (snap.debts.nearestDue) parts.push(`- نزدیک‌ترین سررسید: ${snap.debts.nearestDue}`);
  parts.push(`## امتیاز سلامت مالی: ${snap.health.score}/100`);
  for (const c of snap.health.components) {
    parts.push(`- ${c.label}: ${c.score}/100 (${c.note})`);
  }
  parts.push(`تعداد کل تراکنش‌های ثبت‌شده (۶ ماه): ${snap.transactionCount}`);
  return parts.join("\n");
}
