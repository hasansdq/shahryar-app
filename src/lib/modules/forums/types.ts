// ═══════════════════════════════════════════════════════════════
// انواع مشترک ماژول انجمن‌ها — قابل استفاده در سرور و کلاینت
// ═══════════════════════════════════════════════════════════════

/** نوع انجمن — عمومی (قابل مشاهده برای همه) یا خصوصی (فقط اعضا) */
export type ForumType = "PUBLIC" | "PRIVATE";

/** وضعیت چرخه حیات انجمن — مدیریت از پنل CMS */
export type ForumStatus = "ACTIVE" | "PAUSED" | "ARCHIVED";

/** نقش عضو در انجمن */
export type ForumMemberRole = "CHAIR" | "MEMBER";

/** وضعیت عضویت */
export type ForumMemberStatus = "ACTIVE" | "PENDING" | "REJECTED" | "BANNED";

/** رشته گفتگو — تالار گفتمان گروهی یا گفتگوی خصوصی با ایجنت */
export type ForumThread = "FORUM" | "AGENT";

/** وضعیت من نسبت به انجمن — برای UI لیست انجمن‌ها */
export type MyForumRelation =
  | "chair" // رئیس انجمن
  | "member" // عضو فعال
  | "pending" // درخواست در انتظار تایید
  | "rejected" // درخواست رد شده
  | "banned" // اخراج‌شده
  | "none"; // هیچ ارتباطی

/** کارت انجمن در لیست */
export interface ForumSummary {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverImage: string | null;
  type: ForumType;
  status: ForumStatus;
  memberCount: number;
  articleCount: number;
  eventCount: number;
  chair: {
    userId: string;
    name: string;
    avatarUrl: string | null;
    avatarColor: string;
  };
  myRelation: MyForumRelation;
  isMember: boolean;
  createdAt: string;
}

/** جزئیات انجمن — شامل وضعیت دسترسی من */
export interface ForumDetailData {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverImage: string | null;
  type: ForumType;
  status: ForumStatus;
  chair: {
    userId: string;
    name: string;
    avatarUrl: string | null;
    avatarColor: string;
  };
  agent: {
    enabled: boolean;
    name: string;
    greeting: string | null;
    knowledgeCount: number;
  };
  memberCount: number;
  myRelation: MyForumRelation;
  isMember: boolean;
  isChair: boolean;
  /** بخش‌هایی که من اجازه دیدنشان را دارم */
  canView: {
    chat: boolean;
    agent: boolean;
    members: boolean;
    articles: boolean;
    events: boolean;
    knowledge: boolean;
  };
  pendingCount: number; // فقط برای رئیس — درخواست‌های در انتظار
  createdAt: string;
}

/** پیام تالار گفتمان / گفتگوی ایجنت */
export interface ForumChatMessage {
  id: string;
  thread: ForumThread;
  isFromAgent: boolean;
  senderId: string | null;
  senderName: string | null;
  senderAvatarUrl: string | null;
  senderAvatarColor: string | null;
  content: string;
  createdAt: string;
}

/** عضو انجمن */
export interface ForumMemberDTO {
  id: string; // شناسه رکورد عضویت
  userId: string;
  name: string;
  phone: string | null; // فقط برای رئیس/مدیر
  avatarUrl: string | null;
  avatarColor: string;
  headline: string | null;
  role: ForumMemberRole;
  status: ForumMemberStatus;
  requestNote: string | null;
  joinedAt: string;
  reviewedAt: string | null;
  messageCount: number;
}

/** رویداد انجمن */
export interface ForumEventDTO {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
}

/** مقاله نشریه انجمن */
export interface ForumArticleDTO {
  id: string;
  title: string;
  summary: string | null;
  content: string | null; // در لیست خلاصه؛ در جزئیات کامل
  coverImage: string | null;
  status: "DRAFT" | "PUBLISHED";
  views: number;
  publishedAt: string | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
}

/** منبع دانش ایجنت انجمن */
export interface ForumKnowledgeDTO {
  id: string;
  title: string;
  content: string;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

/** داده داشبورد مدیریت رئیس انجمن */
export interface ForumManageData {
  pending: ForumMemberDTO[];
  members: ForumMemberDTO[];
  banned: ForumMemberDTO[];
  stats: {
    members: number;
    pending: number;
    messages: number;
    agentMessages: number;
    articles: number;
    publishedArticles: number;
    events: number;
    upcomingEvents: number;
    knowledge: number;
  };
}
