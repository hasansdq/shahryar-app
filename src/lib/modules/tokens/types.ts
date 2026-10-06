// ═══════════════════════════════════════════════════════════════
// اقتصاد توکن شهریار — انواع مشترک سرور/کلاینت
//
// مدل (v2 — مصرف دقیق API-مانند):
//  • موجودی کیف پول = توکن واقعی هوش مصنوعی (قابل استفاده در همه بخش‌ها)
//  • هر فراخوانی AI دقیقاً مثل صورتحساب API محاسبه می‌شود:
//    توکن ورودی (پرامپت) + توکن خروجی (پاسخ) → کسر از کیف
//  • تولید تصویر هوشیار: هزینه ثابت «توکن به ازای هر تصویر» (تنظیم ادمین)
//  • شارژ دلخواه: کاربر مقدار توکن را وارد می‌کند، قیمت از
//    «مبلغ هر ۱ میلیون توکن» محاسبه می‌شود
// ═══════════════════════════════════════════════════════════════

/** کلیدهای ویژگی‌های قابل مصرف — با نقاط تماس AI یکی است */
export type TokenFeature =
  | "chat"
  | "deep_think"
  | "web_search"
  | "image_gen"
  | "finance_advisor"
  | "goal_ai"
  | "forum_agent"
  | "social_agent"
  | "document_read"
  | "file_gen";

/** بخش‌های شهریار برای تفکیک مصرف */
export type TokenSection = "hoshyar" | "social" | "forums" | "goals" | "finance";

export const TOKEN_FEATURES: Array<{ key: TokenFeature; label: string; hint: string }> = [
  { key: "chat", label: "گفتگو با هوشیار", hint: "هر پیام معمولی چت" },
  { key: "deep_think", label: "تفکر عمیق", hint: "تحلیل چندمرحله‌ای سؤالات پیچیده" },
  { key: "web_search", label: "جستجوی وب", hint: "پاسخ با جدیدترین اطلاعات وب" },
  { key: "image_gen", label: "تولید تصویر", hint: "ساخت تصویر از متن" },
  { key: "finance_advisor", label: "مشاور مالی", hint: "تحلیل مالی اختصاصی" },
  { key: "goal_ai", label: "هوش اهداف", hint: "تفکیک هدف و مربی‌گری" },
  { key: "forum_agent", label: "ایجنت انجمن", hint: "گفتگو با ایجنت انجمن‌ها" },
  { key: "social_agent", label: "ایجنت شخصی", hint: "گفتگو با ایجنت‌های پروفایل" },
  { key: "document_read", label: "خواندن اسناد", hint: "تحلیل PDF/Word/Excel/تصویر پیوست" },
  { key: "file_gen", label: "ساخت فایل", hint: "تولید Word/Excel/PDF در چت" },
];

/** نگاشت ویژگی → بخش شهریار (منبع واحد حقیقت) */
export const FEATURE_TO_SECTION: Record<TokenFeature, TokenSection> = {
  chat: "hoshyar",
  deep_think: "hoshyar",
  web_search: "hoshyar",
  image_gen: "hoshyar",
  document_read: "hoshyar",
  file_gen: "hoshyar",
  social_agent: "social",
  forum_agent: "forums",
  goal_ai: "goals",
  finance_advisor: "finance",
};

export const SECTION_LABELS: Record<string, string> = {
  hoshyar: "هوشیار",
  social: "ایجنت‌های شخصی",
  forums: "ایجنت انجمن‌ها",
  goals: "اهداف",
  finance: "مشاور مالی",
};

export const FEATURE_LABELS: Record<string, string> = Object.fromEntries(
  TOKEN_FEATURES.map((f) => [f.key, f.label])
);

export const TX_TYPE_LABELS: Record<string, string> = {
  signup_bonus: "هدیه خوش‌آمد",
  daily_bonus: "پاداش روزانه",
  purchase: "شارژ توکن",
  spend: "مصرف هوش مصنوعی",
  refund: "بازگشت توکن",
  admin_grant: "اهدای مدیریتی",
  admin_deduct: "کسر مدیریتی",
  economy_upgrade: "هدیه ارتقای اقتصاد توکن",
};

export interface TokenEconomySettings {
  enabled: boolean;
  /** مبلغ (تومان) به ازای هر ۱,۰۰۰,۰۰۰ توکن */
  pricePerMillion: number;
  /** توکن کسرشده به ازای هر تصویر تولیدی در هوشیار */
  imageGenTokens: number;
  /** هدیه خوش‌آمد (توکن) */
  signupBonus: number;
  /** پاداش روزانه حضور (توکن) */
  dailyBonus: number;
  /** حداقل مقدار شارژ دلخواه (توکن) */
  minChargeTokens: number;
  /** حداکثر مقدار شارژ دلخواه (توکن) */
  maxChargeTokens: number;
  zarinpal: {
    merchantId: string;
    sandbox: boolean;
    description: string;
    callbackUrl: string; // خالی = استنتاج خودکار از درخواست
  };
}

export const DEFAULT_TOKEN_ECONOMY: TokenEconomySettings = {
  enabled: true,
  pricePerMillion: 90_000, // تومان به ازای هر ۱M توکن
  imageGenTokens: 2_000, // توکن به ازای هر تصویر هوشیار
  signupBonus: 100_000,
  dailyBonus: 10_000,
  minChargeTokens: 20_000,
  maxChargeTokens: 500_000_000,
  zarinpal: {
    merchantId: "",
    sandbox: true,
    description: "شارژ توکن هوش مصنوعی شهریار",
    callbackUrl: "",
  },
};

/** محاسبه قیمت شارژ دلخواه — تومان (گرد شده به بالا) */
export function chargePriceToman(tokens: number, pricePerMillion: number): number {
  if (!Number.isFinite(tokens) || tokens <= 0) return 0;
  return Math.ceil((tokens * pricePerMillion) / 1_000_000);
}

// ─── DTOهای API ───

export interface WalletTransactionDto {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  feature: string | null;
  note: string | null;
  createdAt: string;
}

/** یک رکورد مصرف دقیق (مشابه صورتحساب API) */
export interface TokenUsageDto {
  id: string;
  feature: string;
  section: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  chargedTokens: number;
  estimated: boolean;
  model: string | null;
  title: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export interface UsageAnalyticsDto {
  /** بازه تجمیع (روز) */
  rangeDays: number;
  /** مجموع مصرف در بازه */
  totalTokens: number;
  /** رکوردهای مصرف در بازه */
  totalCount: number;
  /** میانگین مصرف روزانه در بازه */
  avgDaily: number;
  /** سری روزانه مصرف (تاریخ شمسی در UI) */
  daily: Array<{ date: string; tokens: number; count: number }>;
  /** تفکیک مصرف به ازای بخش‌های شهریار */
  bySection: Array<{ section: string; count: number; tokens: number }>;
  /** تفکیک مصرف به ازای ویژگی‌ها */
  byFeature: Array<{ feature: string; count: number; tokens: number }>;
}

export interface WalletPricingDto {
  pricePerMillion: number;
  minChargeTokens: number;
  maxChargeTokens: number;
  imageGenTokens: number;
}

export interface WalletSummaryDto {
  balance: number;
  lifetimeGranted: number;
  lifetimePurchased: number;
  lifetimeSpent: number;
  dailyBonusAvailable: boolean;
  dailyBonusAmount: number;
  pricing: WalletPricingDto;
  /** مصرف امروز (توکن) */
  spentToday: number;
  /** مصرف ۷ روز اخیر */
  spent7d: number;
  /** مصرف ۳۰ روز اخیر */
  spent30d: number;
  /** تحلیل مصرف ۳۰ روزه */
  analytics: UsageAnalyticsDto;
  transactions: WalletTransactionDto[];
}

export interface PurchaseStartDto {
  orderId: string;
  redirectUrl: string;
}

export interface AdminTokenStats {
  walletsCount: number;
  circulatingBalance: number;
  lifetimeSpent: number;
  spentToday: number;
  spent7d: number;
  spent30d: number;
  purchasedTokens: number;
  revenueToman: number;
  paidOrders: number;
  pendingOrders: number;
  failedOrders: number;
  dailySeries: Array<{ date: string; spent: number; purchased: number; revenue: number }>;
  featureBreakdown: Array<{ feature: string; count: number; tokens: number }>;
  sectionBreakdown: Array<{ section: string; count: number; tokens: number }>;
  topConsumers: Array<{ userId: string; fullName: string | null; phone: string; spent: number; balance: number }>;
  recentOrders: Array<{
    id: string; user: string; packageTitle: string; tokens: number;
    priceToman: number; status: string; refId: string | null; createdAt: string;
  }>;
}
