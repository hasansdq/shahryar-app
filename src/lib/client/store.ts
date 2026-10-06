// ═════ استور مرکزی شهریار — Zustand ═════
"use client";

import { create } from "zustand";

export interface CurrentUser {
  id: string;
  phone: string;
  fullName: string | null;
  avatarColor: string;
  avatarUrl?: string | null;
  role: string;
}

export type AppView = "home" | "chat" | "goals" | "businesses" | "finance" | "social" | "forums" | "tokens" | "profile" | "userProfile";

// ─── وضعیت CMS (ماژول‌ها + دسته‌بندی اهداف) ───

export interface ModulePublicState {
  key: string;
  name: string;
  icon: string;
  isEnabled: boolean;
  isCore: boolean;
  config: Record<string, boolean | number>;
}

export interface GoalCategoryClient {
  key: string;
  name: string;
  icon: string;
  color: string;
}

interface AppState {
  user: CurrentUser | null;
  view: AppView;
  loading: boolean;
  /** وضعیت ماژول‌ها از CMS — خالی تا قبل از بارگذاری (fail-open) */
  modules: Record<string, ModulePublicState>;
  /** دسته‌بندی‌های اهداف از CMS — خالی = fallback دسته‌های ثابت */
  goalCategories: GoalCategoryClient[];
  /** صفحه پروفایل عمومی کاربر دیگر — userId هدف + نما برای بازگشت */
  userProfileId: string | null;
  userProfileBackTo: AppView;
  setUser: (user: CurrentUser | null) => void;
  setView: (view: AppView) => void;
  setLoading: (loading: boolean) => void;
  setModules: (modules: ModulePublicState[]) => void;
  setGoalCategories: (categories: GoalCategoryClient[]) => void;
  openUserProfile: (userId: string, backTo?: AppView) => void;
  closeUserProfile: () => void;
  logout: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  view: "home",
  loading: true,
  modules: {},
  goalCategories: [],
  userProfileId: null,
  userProfileBackTo: "social",
  setUser: (user) => set({ user, loading: false }),
  setView: (view) => set({ view }),
  setLoading: (loading) => set({ loading }),
  setModules: (list) =>
    set({ modules: Object.fromEntries(list.map((m) => [m.key, m])) }),
  setGoalCategories: (categories) => set({ goalCategories: categories }),
  openUserProfile: (userId, backTo) =>
    set((s) => ({ userProfileId: userId, userProfileBackTo: backTo ?? s.view, view: "userProfile" })),
  closeUserProfile: () =>
    set((s) => ({ view: s.userProfileBackTo, userProfileId: null })),
  logout: () => set({ user: null, view: "home" }),
}));

// ─── هلپرهای همگام CMS — خارج از React قابل استفاده ───

/**
 * ماژول فعال است؟ تا قبل از بارگذاری وضعیت، fail-open است
 * (ناوبری کامل نمایش داده می‌شود؛ سرور به‌هرحال گیت را اعمال می‌کند).
 */
export function moduleEnabled(key: string): boolean {
  const m = useAppStore.getState().modules[key];
  if (!m) return true; // هنوز لود نشده / تعریف نشده
  return m.isEnabled;
}

/** مقدار کانفیگ ماژول با fallback (کانفیگ غیب‌نشده = پیش‌فرض) */
export function moduleConfig(key: string, configKey: string, fallback: boolean | number): boolean | number {
  const m = useAppStore.getState().modules[key];
  const v = m?.config?.[configKey];
  return v === undefined ? fallback : v;
}
