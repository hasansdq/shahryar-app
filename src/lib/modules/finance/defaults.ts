// ═════ مقادیر پیش‌فرض ماژول مالی — دسته‌بندی‌های سیستمی ═════
// این فایل عمداً هیچ وابستگی‌ای ندارد تا هم سرویس مالی و هم سرویس CMS
// بتوانند از آن استفاده کنند (بدون حلقه‌ی import).

/** دسته‌بندی‌های مالی پیش‌فرض (پشتوانه‌ی سید کاربران جدید) */
export const DEFAULT_CATEGORIES: Array<{
  name: string; type: "income" | "expense"; icon: string; color: string; sortOrder: number;
}> = [
  // هزینه‌ها
  { name: "خورد و خوراک", type: "expense", icon: "utensils", color: "#e67e22", sortOrder: 1 },
  { name: "حمل و نقل", type: "expense", icon: "car", color: "#2980b9", sortOrder: 2 },
  { name: "خانه و اجاره", type: "expense", icon: "home", color: "#8e44ad", sortOrder: 3 },
  { name: "قبض و خدمات", type: "expense", icon: "receipt", color: "#c0392b", sortOrder: 4 },
  { name: "سلامت و درمان", type: "expense", icon: "heart-pulse", color: "#e74c3c", sortOrder: 5 },
  { name: "پوشاک", type: "expense", icon: "shirt", color: "#d35400", sortOrder: 6 },
  { name: "تفریح و سرگرمی", type: "expense", icon: "gamepad-2", color: "#16a085", sortOrder: 7 },
  { name: "آموزش", type: "expense", icon: "book-open", color: "#27ae60", sortOrder: 8 },
  { name: "خرید روزانه", type: "expense", icon: "shopping-cart", color: "#f39c12", sortOrder: 9 },
  { name: "هدیه و مهمانی", type: "expense", icon: "gift", color: "#9b59b6", sortOrder: 10 },
  { name: "کشاورزی و باغ", type: "expense", icon: "sprout", color: "#2ecc71", sortOrder: 11 },
  { name: "سایر هزینه‌ها", type: "expense", icon: "circle-ellipsis", color: "#7f8c8d", sortOrder: 12 },
  // درآمدها
  { name: "حقوق و دستمزد", type: "income", icon: "briefcase", color: "#27ae60", sortOrder: 1 },
  { name: "فروش پسته", type: "income", icon: "nut", color: "#0e8a5a", sortOrder: 2 },
  { name: "کسب و کار", type: "income", icon: "store", color: "#16a085", sortOrder: 3 },
  { name: "سود و سرمایه", type: "income", icon: "trending-up", color: "#2980b9", sortOrder: 4 },
  { name: "هدیه و فامیل", type: "income", icon: "gift", color: "#9b59b6", sortOrder: 5 },
  { name: "سایر درآمدها", type: "income", icon: "circle-ellipsis", color: "#7f8c8d", sortOrder: 6 },
];
