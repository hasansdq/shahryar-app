// ═══════════════════════════════════════════════════════════════
// سرویس CMS شهریار — رجیستری ماژول‌ها + دسته‌بندی‌های قابل‌مدیریت
//
// وظایف:
//  • رجیستری ماژول‌های اپ (فعال/غیرفعال + کانفیگ JSON) — seed تنبل
//  • دسته‌بندی‌های اهداف (DB-driven با fallback به پیش‌فرض‌ها)
//  • قالب‌های دسته‌بندی مالی برای سید کاربران جدید
//  • کش کوتاه‌مدت برای خواندن سریع وضعیت ماژول‌ها در هر درخواست
// ═══════════════════════════════════════════════════════════════
import { db } from "@/lib/db";
import { DEFAULT_CATEGORIES } from "@/lib/modules/finance/defaults";

// ─── انواع ───

export interface ModuleConfigField {
  key: string;
  label: string;
  type: "boolean" | "number";
  default: boolean | number;
  min?: number;
  max?: number;
  hint?: string;
}

export interface ModuleDef {
  key: string;
  name: string;
  description: string;
  icon: string;
  group: "core" | "main";
  isCore: boolean;
  sortOrder: number;
  config: Record<string, boolean | number>;
  configSchema: ModuleConfigField[];
}

export interface ModuleState {
  key: string;
  name: string;
  description: string | null;
  icon: string;
  group: string;
  isCore: boolean;
  isEnabled: boolean;
  sortOrder: number;
  config: Record<string, boolean | number>;
  updatedAt: Date;
}

export interface GoalCategoryInfo {
  key: string;
  name: string;
  icon: string;
  color: string;
}

// ─── تعریف ماژول‌های اپ + اسکیمای کانفیگ ───
// هر فلگ کانفیگ باید هم سمت سرور (guardModule / روت مربوطه) اعمال شود
// و هم سمت کلاینت (مخفی‌سازی UI) — وگرنه از MODULES حذف/تغییرش نکن.

export const MODULE_DEFS: ModuleDef[] = [
  {
    key: "home",
    name: "خانه و داشبورد",
    description: "داشبورد اصلی اپ — خبرها، دسترسی سریع به ماژول‌ها و خلاصه وضعیت کاربر",
    icon: "home",
    group: "core",
    isCore: true,
    sortOrder: 1,
    config: {},
    configSchema: [],
  },
  {
    key: "chat",
    name: "هوشیار (دستیار هوشمند)",
    description: "چت هوشیار با حالت‌های گفتگو، تفکر عمیق، جستجوی وب، تولید تصویر، خواندن اسناد و ساخت فایل (Word/Excel/PDF)",
    icon: "bot",
    group: "main",
    isCore: false,
    sortOrder: 2,
    config: {
      enableDeepThink: true, enableWebSearch: true, enableImageGen: true,
      enableFileTools: true, enableDocReading: true, enableCodeInterpreter: true,
      maxFilesPerReply: 3, maxSheetRows: 5000,
    },
    configSchema: [
      { key: "enableDeepThink", label: "حالت تفکر عمیق", type: "boolean", default: true, hint: "تحلیل چندمرحله‌ای سؤالات پیچیده" },
      { key: "enableWebSearch", label: "حالت جستجوی وب", type: "boolean", default: true, hint: "پاسخ با جدیدترین اطلاعات وب" },
      { key: "enableImageGen", label: "حالت تولید تصویر", type: "boolean", default: true, hint: "ساخت تصویر از متن" },
      { key: "enableFileTools", label: "ابزار ساخت فایل", type: "boolean", default: true, hint: "ساخت و ویرایش Word، Excel، PDF، CSV و... در چت" },
      { key: "enableDocReading", label: "خواندن اسناد و فایل‌ها", type: "boolean", default: true, hint: "خواندن PDF، Word، Excel، متن، کد و تصویر پیوست‌شده" },
      { key: "enableCodeInterpreter", label: "مفسر کد (اکسل/CSV)", type: "boolean", default: true, hint: "نوشتن و اجرای کد روی داده‌های فایل‌های اکسل و CSV" },
      { key: "maxFilesPerReply", label: "حداکثر فایل در هر پاسخ", type: "number", default: 3, min: 1, max: 3, hint: "سقف تعداد فایل‌های ساخته‌شده در هر پیام" },
      { key: "maxSheetRows", label: "حداکثر ردیف هر شیت اکسل", type: "number", default: 5000, min: 100, max: 5000, hint: "سقف ردیف‌های هر شیت در فایل‌های Excel/CSV" },
    ],
  },
  {
    key: "goals",
    name: "اهداف من",
    description: "مدیریت اهداف و وظایف با کانبان، تحلیل گرافیکی و مربی‌گری هوشمند",
    icon: "target",
    group: "main",
    isCore: false,
    sortOrder: 3,
    config: { enableAIAssist: true, enableAnalytics: true, maxActiveGoals: 0 },
    configSchema: [
      { key: "enableAIAssist", label: "امکانات هوش مصنوعی اهداف", type: "boolean", default: true, hint: "پیش‌نویس هوشیار، تفکیک وظایف و مربی‌گری" },
      { key: "enableAnalytics", label: "تب تحلیل و آمار", type: "boolean", default: true, hint: "نمودارهای تحلیلی ماژول اهداف" },
      { key: "maxActiveGoals", label: "حداکثر اهداف فعال هر کاربر", type: "number", default: 0, min: 0, max: 100, hint: "۰ = بدون محدودیت" },
    ],
  },
  {
    key: "finance",
    name: "امور مالی",
    description: "مدیریت مالی شخصی: حساب‌ها، تراکنش‌ها، بودجه، قرض و مشاور هوشمند",
    icon: "wallet",
    group: "main",
    isCore: false,
    sortOrder: 4,
    config: { enableBudgets: true, enableDebts: true, enableRecurring: true, enableAdvisor: true, maxAccounts: 12 },
    configSchema: [
      { key: "enableBudgets", label: "بودجه‌های ماهانه", type: "boolean", default: true },
      { key: "enableDebts", label: "مدیریت قرض‌ها", type: "boolean", default: true },
      { key: "enableRecurring", label: "تراکنش‌های تکرارشونده", type: "boolean", default: true },
      { key: "enableAdvisor", label: "مشاور مالی هوشمند", type: "boolean", default: true },
      { key: "maxAccounts", label: "حداکثر حساب‌های هر کاربر", type: "number", default: 12, min: 0, max: 50, hint: "۰ = بدون محدودیت" },
    ],
  },
  {
    key: "businesses",
    name: "اصناف و کسب‌وکارها",
    description: "دایرکتوری اصناف رفسنجان با جستجو، امتیازدهی و علاقه‌مندی‌ها",
    icon: "store",
    group: "main",
    isCore: false,
    sortOrder: 5,
    config: { enableReviews: true },
    configSchema: [
      { key: "enableReviews", label: "ثبت نظر و امتیاز کاربران", type: "boolean", default: true },
    ],
  },
  {
    key: "social",
    name: "شهریار (شبکه اجتماعی)",
    description: "شبکه اجتماعی حرفه‌ای: پروفایل عمومی، دانش ایجنت شخصی، گفتگوی مستقیم و گفتگو با ایجنت کاربران",
    icon: "users",
    group: "main",
    isCore: false,
    sortOrder: 7,
    config: { enableDirectChat: true, enableAgentChat: true, maxKnowledgeItems: 12 },
    configSchema: [
      { key: "enableDirectChat", label: "پیام‌رسانی مستقیم کاربران", type: "boolean", default: true, hint: "گفتگوی متنی کاربر به کاربر" },
      { key: "enableAgentChat", label: "گفتگو با ایجنت کاربران", type: "boolean", default: true, hint: "ایجنت هوشمند هر کاربر بر اساس دانش اختصاصی‌اش" },
      { key: "maxKnowledgeItems", label: "حداکثر منابع دانش هر کاربر", type: "number", default: 12, min: 1, max: 40, hint: "سقف تعداد منابع دانش ایجنت" },
    ],
  },
  {
    key: "forums",
    name: "انجمن‌ها",
    description: "انجمن‌های شهری با تالار گفتمان، ایجنت انجمن، تقویم رویدادها، اعضا و نشریه — ایجاد فقط از پنل مدیریت",
    icon: "messages-square",
    group: "main",
    isCore: false,
    sortOrder: 8,
    config: { enableForumAgent: true, enableEvents: true, enableArticles: true },
    configSchema: [
      { key: "enableForumAgent", label: "ایجنت انجمن‌ها", type: "boolean", default: true, hint: "پاسخ‌گویی هوشمند در تالار و گفتگوی خصوصی" },
      { key: "enableEvents", label: "تقویم رویدادها", type: "boolean", default: true },
      { key: "enableArticles", label: "نشریه انجمن", type: "boolean", default: true },
    ],
  },
  {
    key: "profile",
    name: "پروفایل کاربر",
    description: "اطلاعات حساب، تصویر پروفایل و تنظیمات شخصی کاربر",
    icon: "user",
    group: "core",
    isCore: true,
    sortOrder: 6,
    config: {},
    configSchema: [],
  },
];

/** نقشه‌ی سریع تعریف ماژول‌ها */
const DEF_MAP = new Map(MODULE_DEFS.map((d) => [d.key, d]));

// ─── دسته‌بندی‌های اهداف — پیش‌فرض (سازگار با داده‌های موجود) ───

export const DEFAULT_GOAL_CATEGORIES: Array<GoalCategoryInfo & { sortOrder: number }> = [
  { key: "personal", name: "شخصی", icon: "target", color: "#0e8a5a", sortOrder: 1 },
  { key: "health", name: "سلامت", icon: "heart", color: "#e11d48", sortOrder: 2 },
  { key: "career", name: "شغلی", icon: "briefcase", color: "#7c3aed", sortOrder: 3 },
  { key: "education", name: "تحصیلی", icon: "graduation-cap", color: "#0891b2", sortOrder: 4 },
  { key: "financial", name: "مالی", icon: "wallet", color: "#d97706", sortOrder: 5 },
  { key: "family", name: "خانوادگی", icon: "users", color: "#db2777", sortOrder: 6 },
];

// ─── کش ───
// عمداً کش درون‌حافظه‌ای نداریم: در Next.js هر روت ماژول خودش را
// جداگانه باندل/لود می‌کند (به‌خصوص در dev) — یعنی کشِ روت A با روت B
// مشترک نیست و invalidateCmsCache فقط نمونه‌ی خودش را پاک می‌کرد →
// وضعیت کهنه تا ۱۰ ثانیه (خطای منطقی واقعی که در تست کشف شد).
// SQLite محلی میلی‌ثانیه‌ای است؛ هر درخواست وضعیت تازه از DB می‌خواند.

/** باطل‌کردن کش — برای سازگاری با کدهای موجود (عملیاتی انجام نمی‌دهد) */
export function invalidateCmsCache() {
  /* no-op: کش حذف شده — خواندن همیشه تازه */
}

// ─── Seed تنبل (idempotent) ───

/** ساخت ردیف‌های ماژول در صورت نبود — همیشه safe */
export async function ensureModules() {
  const existing = await db.moduleConfig.findMany({ select: { key: true } });
  const have = new Set(existing.map((e) => e.key));
  const missing = MODULE_DEFS.filter((d) => !have.has(d.key));
  if (missing.length === 0) return;
  for (const d of missing) {
    await db.moduleConfig.create({
      data: {
        key: d.key,
        name: d.name,
        description: d.description,
        icon: d.icon,
        group: d.group,
        isCore: d.isCore,
        config: JSON.stringify(d.config),
        sortOrder: d.sortOrder,
      },
    });
  }
}

/** ساخت دسته‌بندی‌های اهداف در صورت نبود */
export async function ensureGoalCategories() {
  const existing = await db.goalCategory.findMany({ select: { key: true } });
  const have = new Set(existing.map((e) => e.key));
  const missing = DEFAULT_GOAL_CATEGORIES.filter((c) => !have.has(c.key));
  if (missing.length === 0) return;
  await db.goalCategory.createMany({
    data: missing.map((c) => ({
      key: c.key, name: c.name, icon: c.icon, color: c.color, sortOrder: c.sortOrder,
    })),
  });
}

/** ساخت قالب‌های دسته‌بندی مالی در صورت نبود — idempotent به تفکیک نام+نوع */
export async function ensureFinanceTemplates() {
  const existing = await db.financeCategoryTemplate.findMany({ select: { name: true, type: true } });
  const have = new Set(existing.map((e) => `${e.name}|${e.type}`));
  const missing = DEFAULT_CATEGORIES.filter((c) => !have.has(`${c.name}|${c.type}`));
  if (missing.length === 0) return;
  await db.financeCategoryTemplate.createMany({
    data: missing.map((c) => ({ ...c })),
  });
}

// ─── خواندن وضعیت ماژول‌ها ───

/** ادغام کانفیگ ذخیره‌شده با پیش‌فرض‌های تعریف (کلیدهای جدید امن) */
function mergeConfig(def: ModuleDef, stored: string): Record<string, boolean | number> {
  let parsed: Record<string, unknown> = {};
  try {
    const raw = JSON.parse(stored);
    if (raw && typeof raw === "object") parsed = raw as Record<string, unknown>;
  } catch {
    // کانفیگ خراب → پیش‌فرض‌ها
  }
  const merged: Record<string, boolean | number> = { ...def.config };
  for (const f of def.configSchema) {
    const v = parsed[f.key];
    if (f.type === "boolean" && typeof v === "boolean") merged[f.key] = v;
    if (f.type === "number" && typeof v === "number" && Number.isFinite(v)) merged[f.key] = v;
  }
  return merged;
}

/** وضعیت تمام ماژول‌ها — همیشه تازه از دیتابیس (بدون کش) */
export async function getModuleStates(): Promise<Map<string, ModuleState>> {
  await ensureModules();
  const rows = await db.moduleConfig.findMany();
  const states = new Map<string, ModuleState>();
  for (const row of rows) {
    const def = DEF_MAP.get(row.key);
    states.set(row.key, {
      key: row.key,
      name: row.name || def?.name || row.key,
      description: row.description,
      icon: row.icon || def?.icon || "sparkles",
      group: row.group,
      isCore: row.isCore,
      isEnabled: row.isEnabled,
      sortOrder: row.sortOrder,
      config: def ? mergeConfig(def, row.config) : {},
      updatedAt: row.updatedAt,
    });
  }
  return states;
}

/** وضعیت یک ماژول (یا null اگر کلید نامعتبر) */
export async function getModuleState(key: string): Promise<ModuleState | null> {
  const states = await getModuleStates();
  return states.get(key) ?? null;
}

// ─── اعتبارسنجی و بروزرسانی کانفیگ ───

/**
 * پاک‌سازی و اعتبارسنجی کانفیگ ورودی ادمین.
 * خروجی: config نهایی + پیام‌های خطا (در صورت مقادیر نامعتبر).
 */
export function sanitizeModuleConfig(
  key: string,
  input: Record<string, unknown>
): { config: Record<string, boolean | number>; errors: string[] } {
  const def = DEF_MAP.get(key);
  const errors: string[] = [];
  const config: Record<string, boolean | number> = {};
  if (!def) return { config, errors: ["ماژول یافت نشد"] };

  for (const f of def.configSchema) {
    const v = input[f.key];
    if (f.type === "boolean") {
      if (typeof v === "boolean") config[f.key] = v;
      else if (v === undefined) continue; // تغییرنکرده
      else errors.push(`مقدار «${f.label}» نامعتبر است`);
    } else if (f.type === "number") {
      const n = typeof v === "string" ? Number(v) : v;
      if (typeof n === "number" && Number.isFinite(n)) {
        const clamped = Math.min(f.max ?? n, Math.max(f.min ?? n, n));
        if (n !== clamped) {
          errors.push(`«${f.label}» باید بین ${f.min ?? 0} تا ${f.max ?? "بدون سقف"} باشد`);
        }
        config[f.key] = clamped;
      } else if (v !== undefined) {
        errors.push(`مقدار «${f.label}» باید عدد باشد`);
      }
    }
  }
  return { config, errors };
}

/** کانفیگ کامل پیش‌فرض یک ماژول (برای reset) */
export function defaultModuleConfig(key: string): Record<string, boolean | number> {
  return { ...(DEF_MAP.get(key)?.config || {}) };
}

// ─── دسته‌بندی‌های اهداف ───

/** دسته‌بندی‌های فعال اهداف برای اپ (سازگار با داده‌های قدیمی) */
export async function listActiveGoalCategories(): Promise<Array<GoalCategoryInfo & { sortOrder: number }>> {
  await ensureGoalCategories();
  const rows = await db.goalCategory.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return rows.map((r) => ({ key: r.key, name: r.name, icon: r.icon, color: r.color, sortOrder: r.sortOrder }));
}

/** همه‌ی دسته‌بندی‌های اهداف (برای ادمین — شامل غیرفعال) + آمار استفاده */
export async function listGoalCategoriesForAdmin() {
  await ensureGoalCategories();
  const [rows, usage] = await Promise.all([
    db.goalCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.goal.groupBy({ by: ["category"], _count: { _all: true } }),
  ]);
  const usageMap = new Map(usage.map((u) => [u.category, u._count._all]));
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    icon: r.icon,
    color: r.color,
    sortOrder: r.sortOrder,
    isActive: r.isActive,
    usage: usageMap.get(r.key) || 0,
  }));
}

/** کلید یکتای امن از نام (برای دسته‌بندی جدید ادمین) */
export function slugifyCategoryKey(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[\s\u200c]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return base || `cat-${Date.now().toString(36)}`;
}

// ─── قالب‌های دسته‌بندی مالی ───

/** قالب‌های فعال مالی برای سید کاربران جدید */
export async function listActiveFinanceTemplates() {
  await ensureFinanceTemplates();
  return db.financeCategoryTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { name: true, type: true, icon: true, color: true, sortOrder: true },
  });
}

/** همه‌ی قالب‌های مالی (برای ادمین) + آمار استفاده‌ی واقعی کاربران */
export async function listFinanceTemplatesForAdmin() {
  await ensureFinanceTemplates();
  const [rows, usage] = await Promise.all([
    db.financeCategoryTemplate.findMany({ orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.financeCategory.groupBy({ by: ["name", "type"], where: { kind: "builtin" }, _count: { _all: true } }),
  ]);
  const usageMap = new Map(usage.map((u) => [`${u.name}|${u.type}`, u._count._all]));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    icon: r.icon,
    color: r.color,
    sortOrder: r.sortOrder,
    isActive: r.isActive,
    usage: usageMap.get(`${r.name}|${r.type}`) || 0,
  }));
}
