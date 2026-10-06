// ═════ رجیستری آیکن‌ها — نقشه‌ی نام آیکن → کامپوننت lucide ═════
// کاربرد: دسته‌بندی‌های اهداف و قالب‌های مالی که مدیر از CMS انتخاب
// می‌کند فقط «نام» آیکن را ذخیره می‌کنند؛ کلاینت از این نقشه رندر می‌کند.
"use client";

import {
  Target, Heart, Briefcase, GraduationCap, Wallet, Users, Sparkles, Flame,
  Dumbbell, Book, Plane, Home, Star, Zap, Leaf, Coffee, Baby, PawPrint,
  Camera, Music, Palette, Trophy, Utensils, Car, Receipt, HeartPulse,
  Shirt, Gamepad2, BookOpen, ShoppingCart, Gift, Sprout, Nut, Store,
  TrendingUp, CircleEllipsis, Tag, Banknote, PiggyBank, Bot, User,
  Calendar, Clock, Activity,
  type LucideIcon,
} from "lucide-react";

export const ICON_REGISTRY: Record<string, LucideIcon> = {
  target: Target,
  heart: Heart,
  briefcase: Briefcase,
  "graduation-cap": GraduationCap,
  wallet: Wallet,
  users: Users,
  sparkles: Sparkles,
  flame: Flame,
  dumbbell: Dumbbell,
  book: Book,
  plane: Plane,
  home: Home,
  star: Star,
  zap: Zap,
  leaf: Leaf,
  coffee: Coffee,
  baby: Baby,
  paw: PawPrint,
  camera: Camera,
  music: Music,
  palette: Palette,
  trophy: Trophy,
  utensils: Utensils,
  car: Car,
  receipt: Receipt,
  "heart-pulse": HeartPulse,
  shirt: Shirt,
  "gamepad-2": Gamepad2,
  "book-open": BookOpen,
  "shopping-cart": ShoppingCart,
  gift: Gift,
  sprout: Sprout,
  nut: Nut,
  store: Store,
  "trending-up": TrendingUp,
  "circle-ellipsis": CircleEllipsis,
  tag: Tag,
  banknote: Banknote,
  "piggy-bank": PiggyBank,
  bot: Bot,
  user: User,
  calendar: Calendar,
  clock: Clock,
  activity: Activity,
};

/** آیکن از نام — همیشه چیزی برمی‌گرداند (fallback: Target) */
export function iconOf(name: string | null | undefined): LucideIcon {
  return (name && ICON_REGISTRY[name]) || Target;
}

/** نام‌های موجود برای انتخابگر ادمین */
export const ICON_NAMES = Object.keys(ICON_REGISTRY);
