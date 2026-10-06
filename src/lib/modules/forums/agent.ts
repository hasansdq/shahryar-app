// ═══════════════════════════════════════════════════════════════
// ایجنت انجمن — مغز هوشمند هر انجمن شهریار
//
// دو مسیر استفاده:
//  ۱. تالار گفتمان: اگر عضوی در پیامش @agent یا @ایجنت بنویسد،
//     پاسخ در همان گفتگوی گروهی برای همه اعضا ثبت می‌شود
//  ۲. گفتگوی خصوصی: تب ایجنت انجمن — مشاوره ۱:۱ هر عضو
//  ۳. گفتگوی معرفی (مهمان): غیراعضای انجمن‌های عمومی با ایجنت گفتگو می‌کنند
//     تا اهداف و فعالیت‌های انجمن را برایشان پرزنت کند — بدون ذخیره‌سازی و
//     بدون نشت تاریخچه/اطلاعات اعضا به مهمان
//
// منابع دانش ایجنت (به‌ترتیب اولویت):
//  • هویت انجمن (عنوان، توضیح، رئیس) از دیتابیس
//  • فهرست اعضا + خلاصه پروفایل حرفه‌ای هرکدام (نام، عنوان شغلی، مهارت‌ها)
//  • دانش بارگذاری‌شده توسط رئیس انجمن (ForumKnowledge)
//  • دستورالعمل اختصاصی رئیس (agentInstructions)
//
// بهینه‌سازی توکن (طبق سیاست محصول):
//  • سقف دانش: ۲۴هزار کاراکتر | سقف فهرست اعضا: ۸۰ نفر
//  • تاریخچه گفتگو: ۱۰ پیام اخیر | پاسخ: کوتاه و کاربردی
//  • thinking خاموش — پاسخ مستقیم و سریع
// ═══════════════════════════════════════════════════════════════
import { db } from "@/lib/db";
import { chatCompletion, type ChatMsg } from "@/lib/modules/ai/zai";
import { detectAgentMention } from "./service";

// ─── بودجه‌های توکن ───

const KNOWLEDGE_CHAR_BUDGET = 24_000; // سقف متن دانش انجمن در پرامپت
const MEMBER_ROSTER_LIMIT = 80; // حداکثر اعضای معرفی‌شده در پرامپت
const HISTORY_MESSAGES = 10; // پیام‌های اخیر برای درک زمینه گفتگو
const MAX_REPLY_TOKENS = 700; // پاسخ فشرده و کاربردی
const CONTENT_SLICE = 1_500; // برش هر پیام تاریخچه

// ─── پرامپت پایه ───

const FORUM_AGENT_BASE = `تو «ایجنت انجمن» هستی — دستیار هوشمند و رسمی یک انجمن در اپلیکیشن شهریار (شهر رفسنجان).

وظیفه‌ات: کمک به اعضای انجمن، معرفی حرفه‌ای انجمن و اعضایش، و پاسخ به سؤالات بر اساس دانش انجمن.

قوانین طلایی:
۱. فقط از «اطلاعات انجمن»، «فهرست اعضا» و «دانش انجمن» پایین پاسخ بده؛ چیزی از خودت نساز. حدس و جعل ممنوع.
۲. پاسخ‌ها را کوتاه، نقطه‌زنی و کاربردی بده — معمولاً حداکثر ۴-۶ خط یا چند بولت. مقدمه‌چینی و حاشیه نرو؛ مستقیم به اصل مطلب و راه‌حل برس.
۳. فرستنده‌ی پیام را با نام خودش خطاب کن (مثلاً «سلام {نام} جان») و گرم و محترمانه پاسخ بده.
۴. اعضای انجمن را می‌شناسی؛ اگر کسی سوالی درباره اعضا یا تخصص‌هایشان پرسید، بر اساس فهرست اعضا معرفی‌شان کن (نقاط قوت را برجسته کن، بدون اغراق).
۵. اگر اطلاعات دقیق در دانش انجمن نیست، صادقانه بگو و پیشنهاد بده از رئیس انجمن یا در تالار بپرسند.
۶. اطلاعات خصوصی اعضا (شماره موبایل، رمز، وضعیت مالی) هرگز فاش نکن؛ برای ارتباط، اعضا را به تالار گفتمان یا بخش اعضای انجمن هدایت کن.
۷. اگر انجمن رویداد پیش‌رو یا مقاله‌ای در نشریه دارد که به سؤال مربوط است، به آن اشاره کن.
۸. به فارسی روان پاسخ بده. از **بولد** و بولت (-) فقط زمانی استفاده کن که خوانایی را واقعاً بهتر کند.
۹. تو ایجنت انجمن هستی، نه یک عضو عادی؛ از زاویه «دستیار رسمی انجمن» صحبت کن.`;

// ─── پرامپت حالت مهمان — پرزنت انجمن برای غیرعضو ───

const GUEST_AGENT_BASE = `تو «ایجنت انجمن» هستی — دستیار هوشمند و رسمی یک انجمن در اپلیکیشن شهریار (شهر رفسنجان).

وضعیت گفتگو: کاربر مقابل «مهمان» است — هنوز عضو انجمن نشده و برای شناخت انجمن با تو صحبت می‌کند. ماموریت تو در این گفتگو، معرفی حرفه‌ای و جذاب انجمن به اوست.

قوانین طلایی (گفتگو با مهمان):
۱. فقط از «اطلاعات انجمن»، «دانش انجمن» و «فعالیت‌های عمومی» پایین پاسخ بده؛ چیزی از خودت نساز. حدس و جعل ممنوع.
۲. تمرکز اصلی: معرفی اهداف، فعالیت‌ها، رویدادها و نشریه انجمن — منظم، با جزئیات و انگیزه‌بخش.
۳. نام و مشخصات اعضا را فاش نکن؛ معرفی اعضا فقط برای اعضای انجمن است. گفتن تعداد اعضا و نام رئیس انجمن اشکالی ندارد.
۴. اگر کاربر علاقه‌مند شد، او را به دکمه «درخواست عضویت» در بالای صفحه انجمن دعوت کن و بگو پس از تایید رئیس انجمن، به تالار گفتمان و امکانات کامل دسترسی پیدا می‌کند.
۵. پاسخ‌ها را کوتاه، نقطه‌زنی و کاربردی بده — معمولاً حداکثر ۴-۶ خط یا چند بولت؛ گرم و محترمانه و با خطاب کردن کاربر با نام خودش.
۶. اطلاعات خصوصی هیچ‌کس (شماره موبایل، رمز، وضعیت مالی) هرگز فاش نشود.
۷. اگر اطلاعات دقیق در دانش انجمن نیست، صادقانه بگو و پیشنهاد بده پس از عضویت از رئیس انجمن یا تالار گفتمان بپرسد.
۸. به فارسی روان پاسخ بده. از **بولد** و بولت (-) فقط زمانی استفاده کن که خوانایی را واقعاً بهتر کند.
۹. تو سفیر و معرفی‌کننده رسمی انجمن هستی؛ انگیزه عضویت ایجاد کن — بدون اغراق و بدون فشار.`;

// ─── ساخت اجزای پرامپت ───

/** فهرست فشرده اعضا + خلاصه پروفایل — هر عضو یک خط
 *  رئیس همیشه اول و همیشه حاضر — take یک نفر بیشتر از سقف تا
 *  بتوانیم «و N عضو دیگر» را واقعی گزارش کنیم (قبلاً با take=80
 *  رئیسِ انجمن‌های بزرگ از فهرست ایجنت حذف می‌شد) */
async function buildMemberRoster(forumId: string): Promise<string> {
  const members = await db.forumMember.findMany({
    where: { forumId, status: "ACTIVE" },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }], // رئیس اول
    take: MEMBER_ROSTER_LIMIT + 1,
    include: {
      user: {
        select: {
          fullName: true,
          socialProfile: { select: { headline: true, skills: true, bio: true } },
        },
      },
    },
  });

  if (members.length === 0) return "";
  const shown = members.slice(0, MEMBER_ROSTER_LIMIT);
  const hiddenCount = members.length - shown.length;
  const lines: string[] = [];
  for (const m of shown) {
    const name = m.user.fullName || "کاربر شهریار";
    const isChair = m.role === "CHAIR";
    const headline = m.user.socialProfile?.headline?.trim();
    let skills: string[] = [];
    try {
      const parsed = m.user.socialProfile?.skills ? JSON.parse(m.user.socialProfile.skills) : [];
      if (Array.isArray(parsed)) {
        skills = parsed.map((s: { name?: string }) => s?.name).filter((n: string | undefined): n is string => !!n).slice(0, 4);
      }
    } catch { /* JSON خراب — نادیده بگیر */ }
    const parts: string[] = [];
    if (isChair) parts.push("رئیس انجمن");
    if (headline) parts.push(headline);
    if (skills.length) parts.push(`مهارت‌ها: ${skills.join("، ")}`);
    lines.push(`• ${name}${parts.length ? ` — ${parts.join(" | ")}` : ""}`);
  }
  if (hiddenCount > 0) {
    lines.push(`(و ${hiddenCount.toLocaleString("fa-IR")} عضو دیگر)`);
  }
  return lines.join("\n");
}

/** خلاصه فعالیت‌های عمومی انجمن — رویدادهای پیش‌رو + آخرین مقاله‌های نشریه (سوخت پرزنت) */
async function buildForumActivities(forumId: string): Promise<string> {
  const now = new Date();
  const [events, articles] = await Promise.all([
    db.forumEvent.findMany({
      where: { forumId, startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      take: 5,
      select: { title: true, startsAt: true, location: true },
    }),
    db.forumArticle.findMany({
      where: { forumId, status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: 5,
      select: { title: true, summary: true },
    }),
  ]);

  const parts: string[] = [];
  if (events.length > 0) {
    const dateFmt = new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", month: "long", day: "numeric" });
    parts.push(
      "رویدادهای پیش‌رو:\n" +
        events
          .map((e) => `• ${e.title} — ${dateFmt.format(e.startsAt)}${e.location ? ` (${e.location})` : ""}`)
          .join("\n")
    );
  }
  if (articles.length > 0) {
    parts.push(
      "آخرین مقاله‌های نشریه:\n" +
        articles.map((a) => `• ${a.title}${a.summary ? ` — ${a.summary.slice(0, 80)}` : ""}`).join("\n")
    );
  }
  return parts.join("\n");
}

/** متن دانش انجمن با بودجه‌بندی — جدیدترین منابع اول
 *  برای مهمان فقط خلاصه فشرده (سقف کمتر) — دانش کامل انجمن
 *  محتوای اعضاست و API آن را به غیراعضا نمی‌دهد؛ کانال AI هم نباید بدهد */
async function buildKnowledgeText(forumId: string, guest = false): Promise<string> {
  const budget = guest ? Math.min(KNOWLEDGE_CHAR_BUDGET, 6000) : KNOWLEDGE_CHAR_BUDGET;
  const items = await db.forumKnowledge.findMany({
    where: { forumId },
    orderBy: { updatedAt: "desc" },
    select: { title: true, content: true },
  });
  if (items.length === 0) return "";

  const parts: string[] = [];
  let used = 0;
  for (const item of items) {
    if (used >= budget) break;
    const remaining = budget - used;
    // مهمان فقط عنوان‌ها و چکیده‌ی کوتاه هر منبع را می‌بیند — متن کامل نه
    const body = guest
      ? item.content.slice(0, Math.min(200, Math.max(0, remaining - 60)))
      : item.content.slice(0, Math.max(0, remaining - 60));
    const header = `### ${item.title}`;
    parts.push(`${header}\n${body}`);
    used += header.length + body.length;
    if (item.content.length > body.length) {
      parts.push("…[برش خورده]");
      break;
    }
  }
  return parts.join("\n\n");
}

export interface ForumAgentPromptResult {
  systemPrompt: string;
  knowledgeItems: number;
  memberCount: number;
}

/** پرامپت کامل سیستم ایجنت انجمن — حالت عادی (عضو) یا مهمان (پرزنت برای غیرعضو) */
export async function buildForumAgentPrompt(
  forum: {
    id: string;
    title: string;
    description: string | null;
    type: string;
    chairId: string;
    agentName: string | null;
    agentInstructions: string | null;
  },
  opts: { guest?: boolean } = {}
): Promise<ForumAgentPromptResult> {
  const guest = opts.guest === true;
  const [roster, knowledgeText, chair, knowledgeCount, memberCount, activities] = await Promise.all([
    // مهمان هرگز فهرست اعضا را در پرامپت نمی‌بیند — معرفی اعضا مخصوص اعضای انجمن است
    guest ? Promise.resolve("") : buildMemberRoster(forum.id),
    // دانش کامل فقط برای اعضا — مهمان خلاصه فشرده می‌گیرد (هم‌تراز با گیت API دانش)
    buildKnowledgeText(forum.id, guest),
    db.user.findUnique({ where: { id: forum.chairId }, select: { fullName: true } }),
    db.forumKnowledge.count({ where: { forumId: forum.id } }),
    db.forumMember.count({ where: { forumId: forum.id, status: "ACTIVE" } }),
    buildForumActivities(forum.id),
  ]);

  const agentName = forum.agentName?.trim() || `ایجنت ${forum.title}`;
  const chairName = chair?.fullName || "رئیس انجمن";

  const parts: string[] = [];
  parts.push(guest ? GUEST_AGENT_BASE : FORUM_AGENT_BASE);
  parts.push(`نام نمایشی تو: «${agentName}» — ایجنت رسمی انجمن «${forum.title}».`);

  const identity: string[] = [];
  identity.push(`━━━ اطلاعات انجمن «${forum.title}» ━━━`);
  if (forum.description) identity.push(`درباره انجمن: ${forum.description}`);
  identity.push(`رئیس انجمن: ${chairName}`);
  identity.push(`تعداد اعضای فعال: ${memberCount}`);
  parts.push(identity.join("\n"));

  if (forum.agentInstructions?.trim()) {
    parts.push(`━━━ دستورالعمل اختصاصی رئیس انجمن (اولویت بالا — همیشه رعایت کن) ━━━\n${forum.agentInstructions.trim()}`);
  }

  if (roster) {
    parts.push(`━━━ فهرست اعضای انجمن (این‌ها را می‌شناسی و می‌توانی معرفی‌شان کنی) ━━━\n${roster}`);
  }

  if (activities) {
    parts.push(
      `━━━ فعالیت‌های عمومی انجمن (رویدادها و نشریه — برای معرفی به کاربران) ━━━\n${activities}`
    );
  }

  if (knowledgeText) {
    parts.push(
      guest
        ? `━━━ خلاصه دانش انجمن (چکیده منابع — دسترسی کامل پس از عضویت) ━━━\n${knowledgeText}`
        : `━━━ دانش انجمن (منابع بارگذاری‌شده توسط رئیس — منبع اصلی تو) ━━━\n${knowledgeText}`
    );
  } else {
    parts.push(
      guest
        ? "⚠️ هنوز منبع دانش اختصاصی برای انجمن بارگذاری نشده است؛ فقط بر اساس اطلاعات انجمن و فعالیت‌های عمومی پاسخ بده."
        : "⚠️ هنوز منبع دانش اختصاصی برای انجمن بارگذاری نشده است؛ فقط بر اساس اطلاعات انجمن و فهرست اعضا پاسخ بده."
    );
  }

  return { systemPrompt: parts.join("\n\n"), knowledgeItems: knowledgeCount, memberCount };
}

// ─── تولید و ثبت پاسخ ───

export interface AgentReplyResult {
  ok: boolean;
  messageId?: string;
  content?: string;
  error?: string;
}

/** پیام تاریخچه جلسه — سازگاری با نسخه‌های قبلی (اکنون تاریخچه از سرور خوانده می‌شود) */
export type GuestHistoryMsg = { role: "user" | "assistant"; content: string };

/**
 * تولید پاسخ ایجنت انجمن.
 *  • رشته‌ی AGENT: گفتگوی خصوصی ۱:۱ — تاریخچه از ترد اختصاصی کاربر
 *    (threadUserId) خوانده و پاسخ در همان ترد ثبت می‌شود. حالت «مهمان»
 *    (غیرعضوِ انجمن عمومی) فقط پرامپت معرفی‌محور دارد؛ گفتگو مانند عضو
 *    ذخیره می‌شود (منبع لید رئیس انجمن).
 *  • رشته‌ی FORUM: تالار گروهی — پاسخ پس از تولید با polling به همه می‌رسد.
 */
export async function generateForumAgentReply(opts: {
  forumId: string;
  thread: "FORUM" | "AGENT";
  triggeringUserId: string;
  triggeringUserName: string;
  /** ترد خصوصی رشته‌ی AGENT — همیشه برابر فراخوان است */
  threadUserId?: string;
  /** مهمان = غیرعضوِ انجمن عمومی → پرامپت معرفی‌محور (بدون فهرست اعضا) */
  guest?: boolean;
}): Promise<AgentReplyResult> {
  try {
    const forum = await db.forum.findUnique({
      where: { id: opts.forumId },
      select: { id: true, title: true, description: true, type: true, chairId: true, agentName: true, agentInstructions: true, agentEnabled: true },
    });
    if (!forum || !forum.agentEnabled) return { ok: false, error: "ایجنت انجمن فعال نیست" };

    const guest = opts.guest === true;
    const messages: ChatMsg[] = [];

    // ─── پرامپت: معرفی‌محور برای مهمان، کامل برای عضو ───
    const systemPrompt = (await buildForumAgentPrompt(forum, { guest })).systemPrompt;
    messages.push({ role: "system", content: systemPrompt });

    // تاریخچه از دیتابیس — در رشته‌ی AGENT فقط ترد اختصاصی فراخوان؛
    // گفتگوی خصوصی هرگز با تردهای دیگران مخلوط نمی‌شود
    const history = await db.forumMessage.findMany({
      where: {
        forumId: opts.forumId,
        thread: opts.thread,
        ...(opts.thread === "AGENT" ? { threadUserId: opts.threadUserId ?? opts.triggeringUserId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: HISTORY_MESSAGES,
      include: { sender: { select: { id: true, fullName: true } } },
    });
    // تاریخچه به ترتیب زمانی — هر پیام با نام فرستنده برچسب‌گذاری می‌شود
    for (const m of history.reverse()) {
      const label = m.isFromAgent
        ? "ایجنت انجمن"
        : m.sender?.fullName?.trim() || "عضو انجمن";
      messages.push({
        role: m.isFromAgent ? "assistant" : "user",
        content: `${label}: ${m.content.slice(0, CONTENT_SLICE)}`,
      });
    }
    // پیام فراخوان پیش از این در دیتابیس ثبت شده و آخرین پیامِ تاریخچه است —
    // ایجنت می‌داند پاسخ به چه کسی و چه پیامی می‌دهد.

    // پارامترهای بهینه: بدون تفکر عمیق (پاسخ سریع و ارزان)
    const res = await chatCompletion(messages, { thinking: false, temperature: 0.6, maxTokens: MAX_REPLY_TOKENS });
    let replyText = res?.choices?.[0]?.message?.content?.trim() || null;

    if (!replyText) {
      replyText = "ایجنت انجمن الان موقتاً در دسترس نیست؛ چند لحظه بعد دوباره بپرسید.";
    }

    // پاسخ در همان ترد ثبت می‌شود — تالار گروهی یا ترد خصوصی فراخوان
    const saved = await db.forumMessage.create({
      data: {
        forumId: opts.forumId,
        thread: opts.thread,
        threadUserId: opts.thread === "AGENT" ? (opts.threadUserId ?? opts.triggeringUserId) : null,
        senderId: null,
        isFromAgent: true,
        content: replyText,
      },
    });

    return { ok: true, messageId: saved.id, content: replyText };
  } catch (err) {
    console.error("خطای ایجنت انجمن:", err);
    return { ok: false, error: "خطای داخلی در تولید پاسخ ایجنت" };
  }
}

export { detectAgentMention };
