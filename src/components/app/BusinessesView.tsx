// ═════ اصناف رفسنجان — دایرکتوری هوشمند کسب‌وکارها ═════
"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Store, Search, Star, MapPin, Phone, BadgeCheck, Heart, Clock,
  Globe, Instagram, Send, Mail, MessageCircle, Sparkles, Filter,
  ImageIcon, ThumbsUp, Pencil, Trash2, ThumbsDown, Eye, Share2, Check, Info,
  Nut, ShoppingBasket, Utensils, Cross, Cake, Smartphone, Shirt, Car, Scissors,
  Layers, Pill, HeartPulse, Wrench, Coffee, GraduationCap, Dumbbell, Watch,
  Gem, Music, Tv, Camera, Flower2, Baby, PawPrint, Book, Bus, Hammer, Bike,
  UtensilsCrossed, Pizza, X, ChevronDown, LayoutGrid,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import AppDialog from "@/components/ui/app-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { get, post, del } from "@/lib/client/api";
import { faNum, faRating, faRelative, maskPhone } from "@/lib/client/persian";
import { PersonAvatar } from "./social/social-ui";
import { useAppStore, moduleConfig } from "@/lib/client/store";
import { toast } from "@/hooks/use-toast";

interface Category {
  id: string; name: string; slug: string; icon: string; color: string; count: number;
}
interface Business {
  id: string; slug: string; name: string; description: string | null;
  category: { name: string; slug: string; icon: string; color: string };
  ownerName: string | null; phone: string | null; phone2: string | null; email: string | null;
  address: string | null; district: string | null;
  services: string[]; workingHours: { display: string } | null;
  imageUrl: string | null; gallery: Array<{ url: string; name?: string }>;
  website: string | null; instagram: string | null; telegram: string | null;
  rating: number; reviewCount: number; viewCount: number;
  isVerified: boolean; isFeatured: boolean;
}
interface ReviewItem {
  id: string; rating: number; comment: string | null;
  createdAt: string; updatedAt: string;
  quality: number | null; priceFair: number | null; behavior: number | null; speed: number | null;
  pros: string[]; cons: string[]; wouldRecommend: boolean;
  helpfulCount: number;
  user: { id?: string; fullName: string | null; avatarColor: string };
}
interface ReviewStats {
  total: number;
  distribution: Record<string, number>;
  criteria: { quality: number | null; priceFair: number | null; behavior: number | null; speed: number | null };
}
interface BusinessDetail extends Business {
  reviews: ReviewItem[];
}

// ═══ نقشهٔ آیکون دسته‌بندی‌ها — نام lucide ذخیره‌شده در دیتابیس ← کامپوننت ═══
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Store, LayoutGrid, Nut, ShoppingBasket, Utensils, UtensilsCrossed, Cross, Pill, HeartPulse,
  Cake, Pizza, Coffee, Smartphone, Shirt, Car, Scissors, Layers, Wrench, Hammer,
  GraduationCap, Dumbbell, Watch, Gem, Music, Tv, Camera, Flower2, Baby, PawPrint,
  Book, Bus, Bike,
};
const catIcon = (name?: string): LucideIcon => (name && CATEGORY_ICONS[name]) || Store;

export default function BusinessesView() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedDistrict, setSelectedDistrict] = useState("all");
  const [sortBy, setSortBy] = useState("featured");
  const [selectedBiz, setSelectedBiz] = useState<BusinessDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null);
  const [myReview, setMyReview] = useState<ReviewItem | null>(null);
  const [votedHelpful, setVotedHelpful] = useState<string[]>([]);
  const { setView } = useAppStore();

  // بارگذاری دسته‌بندی‌ها
  useEffect(() => {
    get<{ categories: Category[] }>("/api/businesses/categories").then((res) => {
      if (res.success && res.data) setCategories(res.data.categories);
    });
  }, []);

  // جستجو با debounce
  const loadBusinesses = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (selectedCategory !== "all") params.set("category", selectedCategory);
    if (selectedDistrict !== "all") params.set("district", selectedDistrict);
    params.set("sort", sortBy);

    const res = await get<{
      businesses: Business[];
      districts: string[];
    }>(`/api/businesses?${params.toString()}`);
    if (res.success && res.data) {
      setBusinesses(res.data.businesses);
      setDistricts(res.data.districts);
    }
    setLoading(false);
  }, [query, selectedCategory, selectedDistrict, sortBy]);

  useEffect(() => {
    const t = setTimeout(loadBusinesses, 350);
    return () => clearTimeout(t);
  }, [loadBusinesses]);

  const openBusiness = async (biz: Business) => {
    setLoadingDetail(true);
    setSelectedBiz(biz as BusinessDetail);
    const res = await get<{ business: BusinessDetail; isFavorite: boolean; reviewStats: ReviewStats; myReview: ReviewItem | null; votedHelpful: string[] }>(`/api/businesses/${biz.slug}`);
    if (res.success && res.data) {
      setSelectedBiz(res.data.business);
      setIsFavorite(res.data.isFavorite);
      setReviewStats(res.data.reviewStats);
      setMyReview(res.data.myReview);
      setVotedHelpful(res.data.votedHelpful || []);
    }
    setLoadingDetail(false);
  };

  // بارگذاری مجدد جزئیات (بعد از ثبت نظر / رأی مفید / حذف)
  const reloadDetail = async () => {
    if (!selectedBiz) return;
    const res = await get<{ business: BusinessDetail; isFavorite: boolean; reviewStats: ReviewStats; myReview: ReviewItem | null; votedHelpful: string[] }>(`/api/businesses/${selectedBiz.slug}`);
    if (res.success && res.data) {
      setSelectedBiz(res.data.business);
      setIsFavorite(res.data.isFavorite);
      setReviewStats(res.data.reviewStats);
      setMyReview(res.data.myReview);
      setVotedHelpful(res.data.votedHelpful || []);
    }
  };

  const toggleFavorite = async () => {
    if (!selectedBiz) return;
    const res = await post<{ isFavorite: boolean; message: string }>(`/api/businesses/${selectedBiz.slug}`, { action: "favorite" });
    if (res.success) {
      setIsFavorite(res.data?.isFavorite ?? !isFavorite);
      toast({ title: res.data?.message || "به‌روزرسانی شد" });
    }
  };

  return (
    <div className="p-4 lg:p-0 max-w-6xl mx-auto space-y-5" dir="rtl">
      {/* ─── هدر: گرادیان برند + آمار زنده ─── */}
      <div className="shahryar-gradient rounded-3xl p-4 sm:p-6 text-white relative overflow-hidden">
        <div className="pattern-dots absolute inset-0 opacity-25" />
        <div aria-hidden className="absolute -left-10 -bottom-16 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden className="absolute -right-12 -top-14 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex size-10 sm:size-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/15 shadow-md backdrop-blur-sm">
              <Store className="size-5 sm:size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-2xl font-black leading-tight">اصناف رفسنجان</h2>
              <p className="text-[11px] sm:text-sm text-blue-50/80 mt-0.5 line-clamp-1 sm:line-clamp-none">
                هر کسب‌وکار شهر، فقط یک جستجو فاصله دارد
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* جستجو و فیلترها */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجو در نام، خدمات، محله... مثلاً «پسته» یا «داروخانه»"
            className="h-13 rounded-2xl pr-12 pl-4 text-right text-sm shadow-sm border-border/70 bg-card"
            style={{ height: 52 }}
          />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <CategoryChip
            active={selectedCategory === "all"}
            onClick={() => setSelectedCategory("all")}
            label="همه"
            iconComp={CATEGORY_ICONS.LayoutGrid ?? Store}
            count={categories.reduce((a, c) => a + c.count, 0)}
            color="#3b82f6"
          />
          {categories.map((c) => (
            <CategoryChip
              key={c.slug}
              active={selectedCategory === c.slug}
              onClick={() => setSelectedCategory(c.slug)}
              label={c.name}
              iconComp={catIcon(c.icon)}
              count={c.count}
              color={c.color}
            />
          ))}
        </div>

        {/* فیلترها: موبایل گرید ۲ستونی + هدف لمسی ۴۴px / دسکتاپ ردیفی فشرده */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
            <SelectTrigger className="w-full sm:w-36 rounded-xl data-[size=default]:h-11 sm:data-[size=default]:h-9 text-xs bg-card border-border/60">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
              <SelectValue placeholder="محله" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه محله‌ها</SelectItem>
              {districts.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-36 rounded-xl data-[size=default]:h-11 sm:data-[size=default]:h-9 text-xs bg-card border-border/60">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <SelectValue placeholder="مرتب‌سازی" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="featured">ویژه‌ترین</SelectItem>
              <SelectItem value="rating">بهترین امتیاز</SelectItem>
              <SelectItem value="popular">پربازدیدترین</SelectItem>
              <SelectItem value="new">جدیدترین</SelectItem>
            </SelectContent>
          </Select>
          <button
            onClick={() => setView("chat")}
            className="col-span-2 sm:col-span-1 flex h-11 sm:h-9 items-center justify-center gap-2 text-xs font-bold text-primary hover:bg-primary/10 active:scale-[0.98] px-4 rounded-xl transition-all border border-primary/30 bg-primary/5"
          >
            <Sparkles className="w-4 h-4" />
            از هوشیار بپرس
          </button>
        </div>
      </div>

      {/* ─── هدر نتایج: تعداد + فیلتر فعال قابل حذف ─── */}
      {!loading && businesses.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-muted-foreground">
            <span className="font-black text-foreground tnum">{faNum(businesses.length)}</span> صنف
            {selectedCategory !== "all" && (
              <>
                {" "}در <span className="font-bold text-foreground">{categories.find((c) => c.slug === selectedCategory)?.name}</span>
              </>
            )}
          </p>
          {selectedDistrict !== "all" && (
            <button
              onClick={() => setSelectedDistrict("all")}
              className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              {selectedDistrict}
              <X className="size-3" />
            </button>
          )}
        </div>
      )}

      {/* نتایج */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 sm:h-72 rounded-3xl" />)}
        </div>
      ) : businesses.length === 0 ? (
        <div className="text-center py-14 bg-card rounded-3xl border-2 border-dashed border-border/70">
          <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-primary/10 text-primary mb-4">
            <Search className="size-7" />
          </div>
          <h3 className="font-black text-lg">نتیجه‌ای پیدا نشد</h3>
          <p className="text-muted-foreground text-sm mt-2 max-w-xs mx-auto leading-relaxed">
            عبارت دیگری را جستجو کنید یا فیلترها را تغییر دهید
          </p>
          {(query || selectedCategory !== "all" || selectedDistrict !== "all") && (
            <button
              onClick={() => { setQuery(""); setSelectedCategory("all"); setSelectedDistrict("all"); }}
              className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 px-4 text-xs font-bold text-primary transition-colors hover:bg-primary/10 active:scale-95"
            >
              <X className="size-3.5" />
              حذف فیلترها
            </button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {businesses.map((b, i) => {
              const Icon = catIcon(b.category.icon);
              return (
                <motion.button
                  key={b.id}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ delay: Math.min(i * 0.04, 0.3) }}
                  onClick={() => openBusiness(b)}
                  className="text-right bg-card rounded-3xl border border-border/60 card-lift group relative overflow-hidden active:scale-[0.99] transition-transform"
                >
                  {b.imageUrl ? (
                    <>
                      {/* ─── کاور تصویری + نشان‌ها ─── */}
                      <div className="relative h-32 sm:h-40 overflow-hidden">
                        { }
                        <img src={b.imageUrl} alt={b.name} loading="lazy" className="size-full object-cover transition-transform duration-700 group-hover:scale-105" />
                        <span aria-hidden className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent" />
                        {b.isFeatured && (
                          <span className="absolute top-3 start-3 inline-flex items-center gap-1 rounded-full bg-amber-400/95 px-2.5 py-1 text-[10px] font-black text-amber-950 shadow-md backdrop-blur-sm">
                            <Sparkles className="size-3" />
                            ویژه
                          </span>
                        )}
                        {b.isVerified && (
                          <span className="absolute bottom-3 start-3 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-bold text-white backdrop-blur-md border border-white/25">
                            <BadgeCheck className="size-3" />
                            تأییدشده
                          </span>
                        )}
                      </div>
                      {/* ─── ردیف روی‌هم‌افتاده: کاشی آیکون + پیل امتیاز ───
                          ⚠️ relative z-10 الزامی: کاور position:relative دارد و عنصر
                          positioned بعدی، محتوای غیر-positioned را می‌پوشاند — بدون
                          z-10 نیمهٔ بالای کاشی آیکون (-mt-6) زیر تصویر می‌رفت */}
                      <div className="relative z-10 flex items-end justify-between gap-2 px-4">
                        <span
                          className="grid size-12 -mt-6 place-items-center rounded-2xl border-2 border-card bg-card shadow-lg shadow-black/20 ring-1 ring-black/5"
                          style={{ background: `${b.category.color}1f`, color: b.category.color }}
                        >
                          <Icon className="size-6" />
                        </span>
                        <RatingPill rating={b.rating} count={b.reviewCount} className="mb-1.5" />
                      </div>
                      <div className="px-4 pb-4">
                        <CardBody b={b} showVerified={false} />
                      </div>
                    </>
                  ) : (
                    <div className="p-4 sm:p-5">
                      {b.isFeatured && (
                        <div className="absolute top-4 left-4">
                          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-[10px] gap-1 border-0">
                            <Sparkles className="w-3 h-3" />
                            ویژه
                          </Badge>
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <span
                          className="grid size-12 sm:size-14 place-items-center rounded-2xl shadow-sm"
                          style={{ background: `${b.category.color}1f`, color: b.category.color }}
                        >
                          <Icon className="size-6 sm:size-7" />
                        </span>
                        <RatingPill rating={b.rating} count={b.reviewCount} />
                      </div>
                      <CardBody b={b} />
                    </div>
                  )}
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ═════ دیالوگ جزئیات صنف v2 — پروفایل حرفه‌ای کاملاً راست‌چین ═════ */}
      <BusinessDetailDialog
        open={!!selectedBiz}
        biz={selectedBiz}
        loading={loadingDetail}
        isFavorite={isFavorite}
        stats={reviewStats}
        myReview={myReview}
        votedHelpful={votedHelpful}
        onFavorite={toggleFavorite}
        onReload={reloadDetail}
        onClose={() => setSelectedBiz(null)}
      />
    </div>
  );
}

// ═════ دیالوگ جزئیات صنف v2 — هرو گرادیانی + نوار اقدام + بدنه بخش‌بندی‌شده ═════
function BusinessDetailDialog({ open, biz, loading, isFavorite, stats, myReview, votedHelpful, onFavorite, onReload, onClose }: {
  open: boolean;
  biz: BusinessDetail | null;
  loading: boolean;
  isFavorite: boolean;
  stats: ReviewStats | null;
  myReview: ReviewItem | null;
  votedHelpful: string[];
  onFavorite: () => void;
  onReload: () => Promise<void>;
  onClose: () => void;
}) {
  // نگه‌داشتن آخرین داده برای انیمیشن خروجِ تمیز (دیالوگ خالی نشود)
  // الگوی رسمی React برای «ذخیره اطلاعات از رندرهای قبلی» — به‌جای ref:
  // دست‌زدن به ref در رندر با React Compiler ناسازگار است؛ ستِیت گاردشده
  // همان نتیجه را بدون رندر اضافه می‌دهد (React خودش re-render را merge می‌کند)
  const [prevBiz, setPrevBiz] = useState<BusinessDetail | null>(null);
  const [lastBiz, setLastBiz] = useState<BusinessDetail | null>(null);
  if (biz !== prevBiz) {
    setPrevBiz(biz);
    if (biz) setLastBiz(biz);
  }
  const data = biz ?? lastBiz;

  const shareBusiness = async () => {
    if (!data) return;
    const lines = [data.name];
    if (data.category?.name) lines.push(`(${data.category.name})`);
    if (data.phone) lines.push(`📞 ${data.phone}`);
    if (data.address) lines.push(`📍 ${data.address}`);
    const text = lines.join("\n");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast({ title: "اطلاعات صنف کپی شد ✨", description: "می‌توانید مستقیم برای دوستانتان بفرستید" });
    } catch {
      toast({ title: "کپی اطلاعات انجام نشد", variant: "destructive" });
    }
  };

  if (!data) return null;

  const color = data.category?.color || "#3b82f6";
  const images = [...new Set(
    ([data.imageUrl, ...(data.gallery?.map((g) => g.url) || [])] as (string | null | undefined)[]).filter(Boolean)
  )].slice(0, 9) as string[];

  const contactCards: Array<{ icon: LucideIcon; label: string; value: string; href?: string; ltr?: boolean }> = [];
  if (data.phone) contactCards.push({ icon: Phone, label: "تماس مستقیم", value: data.phone, href: `tel:${data.phone.replace(/[\s-]/g, "")}`, ltr: true });
  if (data.phone2) contactCards.push({ icon: Phone, label: "خط دوم", value: data.phone2, href: `tel:${data.phone2.replace(/[\s-]/g, "")}`, ltr: true });
  if (data.email) contactCards.push({ icon: Mail, label: "ایمیل", value: data.email, href: `mailto:${data.email}`, ltr: true });
  if (data.workingHours?.display) contactCards.push({ icon: Clock, label: "ساعات کاری", value: data.workingHours.display });
  if (data.ownerName) contactCards.push({ icon: Store, label: "مدیریت", value: data.ownerName });
  // اگر تعداد کارت‌ها فرد باشد، آخری تمام‌عرض می‌شود تا چیدمان متقارن بماند
  const orphanIndex = contactCards.length % 2 === 1 ? contactCards.length - 1 : -1;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        dir="rtl"
        className="flex max-h-[92vh] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-2xl"
        closeButtonClassName="border-white/25 bg-white/15 text-white hover:border-white/40 hover:bg-white/30 hover:text-white backdrop-blur-md"
      >
        <DialogTitle className="sr-only">{data.name}</DialogTitle>
        <DialogDescription className="sr-only">مشخصات، تماس و نظرات کاربران درباره {data.name}</DialogDescription>

        {loading && biz ? (
          <DetailSkeleton />
        ) : (
          <>
            {/* ─── هِرو: گرادیان آینه‌ای RTL + هویت رنگی دسته ─── */}
            <div
              className="relative shrink-0 overflow-hidden text-white"
              style={{ background: "linear-gradient(225deg, oklch(0.33 0.12 266) 0%, oklch(0.44 0.18 258) 50%, oklch(0.58 0.16 243) 100%)" }}
            >
              <div aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(to bottom left, ${color}33, transparent 62%)` }} />
              <div aria-hidden className="pattern-dots absolute inset-0 opacity-25" />
              <div aria-hidden className="absolute -start-14 -top-14 size-44 rounded-full bg-white/10 blur-2xl" />
              <div aria-hidden className="absolute -end-10 -bottom-16 size-40 rounded-full" style={{ background: `${color}40`, filter: "blur(40px)" }} />

              <div className="relative flex items-start gap-3.5 p-4 pb-3.5 pt-5 sm:gap-4 sm:p-6 sm:pb-4 sm:pt-6">
                {/* کاشی آیکن دسته — بزرگ، شیشه‌ای */}
                <div className="flex size-14 shrink-0 animate-in zoom-in-50 fade-in-0 items-center justify-center rounded-2xl border border-white/25 bg-white/15 text-white shadow-lg backdrop-blur-md duration-500 sm:size-16">
                  <Store className="size-7 sm:size-8" />
                </div>

                <div className="min-w-0 flex-1 pe-13">
                  {/* نام + نشان تأیید */}
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-black leading-8 sm:text-2xl">{data.name}</h2>
                    {data.isVerified && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-400/25 px-2.5 py-1 text-[10px] font-bold text-emerald-50 backdrop-blur-sm">
                        <BadgeCheck className="size-3.5" />
                        تأییدشده
                      </span>
                    )}
                  </div>

                  {/* امتیاز — ستاره‌ها dir=ltr تا مثل همه‌ی اپ‌های فارسی از چپ پر شوند */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-white/85">
                    <span className="flex items-center gap-0.5" dir="ltr">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`size-3.5 ${i < Math.round(data.rating) ? "fill-amber-300 text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" : "text-white/30"}`}
                        />
                      ))}
                    </span>
                    <span className="text-sm font-black tnum">{faRating(data.rating)}</span>
                    <span className="text-[11px] tnum opacity-80">{faNum(data.reviewCount)} نظر</span>
                    <span className="flex items-center gap-1 text-[11px] tnum opacity-80">
                      <Eye className="size-3" />
                      {faNum(data.viewCount)} بازدید
                    </span>
                  </div>

                  {/* چیپ‌ها: دسته + محله + ویژه */}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-[10px] font-bold backdrop-blur-sm">
                      <span className="size-1.5 rounded-full" style={{ background: color }} />
                      {data.category.name}
                    </span>
                    {data.district && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-[10px] font-bold backdrop-blur-sm">
                        <MapPin className="size-3" />
                        {data.district}
                      </span>
                    )}
                    {data.isFeatured && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/30 bg-amber-400/25 px-3 py-1 text-[10px] font-bold text-amber-50 backdrop-blur-sm">
                        <Sparkles className="size-3" />
                        صنف ویژه
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ─── نوار اقدامات: تماس / ذخیره / اشتراک ─── */}
            <div className="z-10 flex shrink-0 items-center gap-2 border-b border-border/60 bg-card/80 px-4 py-3 backdrop-blur-md sm:px-5">
              {data.phone && (
                <a
                  href={`tel:${data.phone.replace(/[\s-]/g, "")}`}
                  className="shahryar-gradient flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all hover:brightness-110 active:scale-[0.98]"
                >
                  <Phone className="size-4.5" />
                  تماس مستقیم
                </a>
              )}
              <motion.button
                type="button"
                onClick={onFavorite}
                whileTap={{ scale: 0.95 }}
                className={`flex h-11 items-center gap-2 rounded-2xl border px-4 text-sm font-bold transition-colors ${
                  isFavorite
                    ? "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400"
                    : "border-border/60 bg-accent/40 text-foreground/75 hover:border-primary/30 hover:text-foreground"
                } ${data.phone ? "" : "flex-1 justify-center"}`}
              >
                <motion.span
                  key={String(isFavorite)}
                  initial={{ scale: 0.5, rotate: -12 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 15 }}
                  className="flex items-center"
                >
                  <Heart className={`size-4.5 ${isFavorite ? "fill-rose-500 text-rose-500" : ""}`} />
                </motion.span>
                {isFavorite ? "ذخیره شد" : "ذخیره"}
              </motion.button>
              <motion.button
                type="button"
                onClick={shareBusiness}
                whileTap={{ scale: 0.95 }}
                className="flex h-11 items-center gap-2 rounded-2xl border border-border/60 bg-accent/40 px-4 text-sm font-bold text-foreground/75 transition-colors hover:border-primary/30 hover:text-foreground"
              >
                <Share2 className="size-4.5" />
                اشتراک
              </motion.button>
            </div>

            {/* ─── بدنه اسکرول‌شونده: بخش‌بندی حرفه‌ای ─── */}
            <div className="min-h-0 flex-1 space-y-6 overscroll-contain overflow-y-auto p-5 sm:p-6">
              {/* گالری */}
              {images.length > 0 && (
                <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}>
                  <SectionTitle
                    icon={ImageIcon}
                    title="گالری تصاویر"
                    extra={<span className="rounded-lg bg-accent px-2 py-0.5 text-[10px] font-bold text-muted-foreground tnum">{faNum(images.length)} تصویر</span>}
                  />
                  <a
                    href={images[0]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative block h-44 overflow-hidden rounded-2xl border border-border/60 shadow-sm sm:h-52"
                  >
                    { }
                    <img src={images[0]} alt={`تصویر اصلی ${data.name}`} className="size-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    <span aria-hidden className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/35 to-transparent" />
                    <span className="absolute bottom-3 end-3 rounded-lg bg-black/45 px-2.5 py-1 text-[10px] font-bold text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                      مشاهده تصویر کامل
                    </span>
                  </a>
                  {images.length > 1 && (
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {images.slice(1, 9).map((url, i) => (
                        <motion.a
                          key={`${url}-${i}`}
                          initial={{ opacity: 0, scale: 0.88 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.22 + i * 0.05, duration: 0.35 }}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative block h-20 overflow-hidden rounded-xl border border-border/60 shadow-sm transition-shadow hover:shadow-md hover:ring-2 hover:ring-primary/50 sm:h-24"
                        >
                          { }
                          <img src={url} alt={`تصویر ${i + 2} ${data.name}`} className="size-full object-cover transition-transform duration-500 group-hover:scale-110" />
                        </motion.a>
                      ))}
                    </div>
                  )}
                </motion.section>
              )}

              {/* درباره */}
              {data.description && (
                <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, duration: 0.4, ease: "easeOut" }}>
                  <SectionTitle icon={Info} title="درباره این صنف" />
                  <p className="text-[13px] leading-7 text-foreground/85">{data.description}</p>
                </motion.section>
              )}

              {/* اطلاعات تماس */}
              {(contactCards.length > 0 || data.address) && (
                <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22, duration: 0.4, ease: "easeOut" }}>
                  <SectionTitle icon={Phone} title="اطلاعات تماس" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    {contactCards.map((c, i) => {
                      const inner = (
                        <>
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl shadow-sm" style={{ background: `${color}18`, color }}>
                            <c.icon className="size-4.5" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[11px] text-muted-foreground">{c.label}</p>
                            <p className="mt-0.5 truncate text-sm font-bold">
                              {c.ltr ? <span dir="ltr" className="tnum">{c.value}</span> : c.value}
                            </p>
                          </div>
                        </>
                      );
                      const cls =
                        "flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-accent/40 p-4 transition-all hover:border-primary/35 hover:bg-accent/70";
                      const wide = i === orphanIndex ? " sm:col-span-2" : "";
                      return c.href ? (
                        <a key={c.label} href={c.href} className={cls + wide}>
                          {inner}
                        </a>
                      ) : (
                        <div key={c.label} className={cls + wide}>
                          {inner}
                        </div>
                      );
                    })}
                    {data.address && (
                      <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-accent/40 p-4 sm:col-span-2">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl shadow-sm" style={{ background: `${color}18`, color }}>
                          <MapPin className="size-4.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            آدرس
                            {data.district && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">
                                <MapPin className="size-2.5" />
                                {data.district}
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 text-sm font-bold leading-6">{data.address}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.section>
              )}

              {/* خدمات */}
              {data.services?.length > 0 && (
                <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.4, ease: "easeOut" }}>
                  <SectionTitle
                    icon={Sparkles}
                    title="خدمات و محصولات"
                    extra={<span className="rounded-lg bg-accent px-2 py-0.5 text-[10px] font-bold text-muted-foreground tnum">{faNum(data.services.length)} مورد</span>}
                  />
                  <div className="flex flex-wrap gap-2">
                    {data.services.map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-medium text-foreground/80"
                      >
                        <Check className="size-3 text-primary" />
                        {s}
                      </span>
                    ))}
                  </div>
                </motion.section>
              )}

              {/* ارتباط آنلاین */}
              {(data.website || data.instagram || data.telegram) && (
                <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34, duration: 0.4, ease: "easeOut" }}>
                  <SectionTitle icon={Globe} title="ارتباط آنلاین" />
                  <div className="flex flex-wrap gap-2.5">
                    {data.website && (
                      <a
                        href={data.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-xl border border-sky-200/60 bg-sky-50 px-4 py-2.5 text-xs font-bold text-sky-700 transition-all hover:shadow-md dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-400"
                      >
                        <Globe className="size-4" />
                        وب‌سایت
                      </a>
                    )}
                    {data.instagram && (
                      <a
                        href={data.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-xl border border-rose-200/70 bg-gradient-to-l from-rose-50 to-purple-50 px-4 py-2.5 text-xs font-bold text-rose-600 transition-all hover:shadow-md dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-400 dark:bg-none"
                      >
                        <Instagram className="size-4" />
                        اینستاگرام
                      </a>
                    )}
                    {data.telegram && (
                      <a
                        href={data.telegram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-xl border border-sky-200/70 bg-sky-50 px-4 py-2.5 text-xs font-bold text-sky-600 transition-all hover:shadow-md dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-400"
                      >
                        <Send className="size-4" />
                        تلگرام
                      </a>
                    )}
                  </div>
                </motion.section>
              )}

              {/* نظرات */}
              <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.4, ease: "easeOut" }}>
                <ReviewSection biz={data} stats={stats} myReview={myReview} votedHelpful={votedHelpful} onReload={onReload} />
              </motion.section>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ═════ سرتیتر بخش‌ها: آیکن + عنوان + خط گرادیانی رو به چپ (RTL) ═════
function SectionTitle({ icon: Icon, title, extra }: { icon: LucideIcon; title: string; extra?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
        <Icon className="size-3.5" />
      </span>
      <h3 className="shrink-0 text-[13px] font-black tracking-tight">{title}</h3>
      <span aria-hidden className="h-px min-w-4 flex-1 bg-gradient-to-l from-border/80 to-transparent" />
      {extra}
    </div>
  );
}

// ═════ اسکلتون بارگذاری جزئیات ═════
function DetailSkeleton() {
  return (
    <div aria-busy>
      <div className="shahryar-gradient h-40 sm:h-44" />
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="size-12 rounded-2xl" />
          <div className="flex-1 space-y-2.5">
            <Skeleton className="h-5 w-2/3 rounded-lg" />
            <Skeleton className="h-3.5 w-1/3 rounded-lg" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-11 flex-1 rounded-2xl" />
          <Skeleton className="h-11 w-24 rounded-2xl" />
          <Skeleton className="h-11 w-24 rounded-2xl" />
        </div>
        <Skeleton className="h-44 rounded-2xl sm:h-52" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-[74px] rounded-2xl" />
          <Skeleton className="h-[74px] rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

// ═════ چیپ دسته‌بندی — آیکون واقعی + رنگ برند + شمارنده ═════
// کامپوننت آیکون از parent پاس داده می‌شود (lookup بیرون رندر) —
// کامپوننتِ متغیر ساخته‌شده در رندر با React Compiler ناسازگار است
function CategoryChip({ active, onClick, label, iconComp, count, color }: {
  active: boolean; onClick: () => void; label: string; iconComp: LucideIcon; count: number; color?: string;
}) {
  const Icon = iconComp;
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-10 shrink-0 items-center gap-2 rounded-2xl border px-3 text-xs font-bold whitespace-nowrap transition-all active:scale-95",
        active
          ? "shahryar-gradient text-white border-transparent shadow-md shadow-primary/25"
          : "bg-card border-border/60 text-foreground/70 hover:border-primary/40 hover:text-foreground"
      )}
    >
      <span
        className={cn("grid size-6 place-items-center rounded-lg", active && "bg-white/20 text-white")}
        style={!active ? { background: `${color || "#64748b"}1f`, color: color || undefined } : undefined}
      >
        <Icon className="size-3.5" />
      </span>
      {label}
      <span
        className={cn(
          "rounded-md px-1.5 py-0.5 text-[10px] tnum",
          active ? "bg-white/20 text-white/90" : "bg-accent text-muted-foreground"
        )}
      >
        {faNum(count)}
      </span>
    </button>
  );
}

// ═════ بدنهٔ مشترک کارت صنف: نام + توضیح + خدمات + متا ═════
function CardBody({ b, showVerified = true }: { b: Business; showVerified?: boolean }) {
  return (
    <>
      <div className="flex items-center gap-1.5">
        <h3 className="font-black group-hover:text-primary transition-colors line-clamp-1">{b.name}</h3>
        {showVerified && b.isVerified && (
          <BadgeCheck className="text-primary shrink-0" style={{ width: 18, height: 18 }} />
        )}
      </div>
      {b.description && (
        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{b.description}</p>
      )}
      {b.services?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {b.services.slice(0, 2).map((s) => (
            <span key={s} className="max-w-36 truncate rounded-lg bg-accent/70 px-2 py-1 text-[10px] font-medium text-muted-foreground">{s}</span>
          ))}
          {b.services.length > 2 && (
            <span className="rounded-lg bg-accent/70 px-2 py-1 text-[10px] font-bold text-muted-foreground tnum">
              +{faNum(b.services.length - 2)}
            </span>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 pt-3 border-t border-border/50 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full" style={{ background: b.category.color }} />
          {b.category.name}
        </span>
        {b.district && (
          <span className="flex items-center gap-1">
            <MapPin className="size-3.5" />
            {b.district}
          </span>
        )}
        {b.workingHours?.display && (
          <span className="flex items-center gap-1">
            <Clock className="size-3.5" />
            {b.workingHours.display}
          </span>
        )}
        {b.phone && (
          <span className="ms-auto flex items-center gap-1" dir="ltr">
            <Phone className="size-3.5" />
            <span className="tnum">{maskPhone(b.phone)}</span>
          </span>
        )}
      </div>
    </>
  );
}

// ═════ پیل امتیاز کهربایی — کارت‌ها ═════
function RatingPill({ rating, count, className }: { rating: number; count: number; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1", className)}>
      <Star className="size-3.5 fill-amber-500 text-amber-500" />
      <span className="text-xs font-black tnum text-amber-600 dark:text-amber-400">{faRating(rating)}</span>
      <span className="text-[10px] text-muted-foreground tnum">({faNum(count)})</span>
    </span>
  );
}

// ═════ بخش نظرات — نسخه ۲ (چندمعیاره، توزیع، رأی مفید) ═════
const PROS_OPTIONS = ["کیفیت بالا", "قیمت مناسب", "برخورد خوب", "سرعت عمل", "تنوع محصول", "دسترسی آسان", "محیط تمیز"];
const CONS_OPTIONS = ["قیمت بالا", "برخورد نامناسب", "کندی خدمات", "کیفیت پایین", "تنوع کم", "جای پارک ندارد"];
const RATING_LABELS = ["", "ضعیف", "قابل قبول", "خوب", "خیلی خوب", "عالی"];
const CRITERIA_META: Array<{ key: "quality" | "priceFair" | "behavior" | "speed"; label: string }> = [
  { key: "quality", label: "کیفیت" },
  { key: "priceFair", label: "قیمت مناسب" },
  { key: "behavior", label: "برخورد" },
  { key: "speed", label: "سرعت" },
];

interface ReviewSectionProps {
  biz: BusinessDetail;
  stats: ReviewStats | null;
  myReview: ReviewItem | null;
  votedHelpful: string[];
  onReload: () => Promise<void>;
}

function ReviewSection({ biz, stats, myReview, votedHelpful, onReload }: ReviewSectionProps) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [sort, setSort] = useState<"new" | "helpful" | "best">("new");
  const [busyId, setBusyId] = useState<string | null>(null);
  const { user } = useAppStore();

  const reviewsEnabled = moduleConfig("businesses", "enableReviews", true) === true;

  const sorted = useMemo(() => {
    const list = [...(biz.reviews || [])];
    if (sort === "helpful") list.sort((a, b) => b.helpfulCount - a.helpfulCount || b.rating - a.rating);
    else if (sort === "best") list.sort((a, b) => b.rating - a.rating || b.helpfulCount - a.helpfulCount);
    return list;
  }, [biz.reviews, sort]);

  const voteHelpful = async (reviewId: string) => {
    if (!user || busyId) return;
    setBusyId(reviewId);
    const res = await post<{ voted: boolean }>(`/api/businesses/${biz.slug}`, { action: "review-helpful", reviewId });
    setBusyId(null);
    if (res.success) {
      await onReload();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const deleteReview = async () => {
    if (!myReview || busyId) return;
    setBusyId("delete");
    const res = await del(`/api/businesses/${biz.slug}`);
    setBusyId(null);
    if (res.success) {
      toast({ title: "نظر شما حذف شد" });
      await onReload();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const dist = stats?.distribution || {};
  const total = stats?.total || 0;

  return (
    <div className="border-t border-border/60 pt-5">
      {/* ─── هدر بخش + دکمه ثبت نظر ─── */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <h4 className="font-bold text-sm flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          نظرات کاربران
          {total > 0 && <span className="text-[10px] text-muted-foreground tnum">({faNum(total)} نظر)</span>}
        </h4>
        {reviewsEnabled && user && (
          <Button
            onClick={() => setReviewOpen(true)}
            className="h-10 sm:h-8 shahryar-gradient text-white border-0 rounded-xl font-bold px-3.5"
          >
            <Pencil className="w-3.5 h-3.5" />
            {myReview ? "ویرایش نظر من" : "ثبت نظر"}
          </Button>
        )}
      </div>

      {!reviewsEnabled ? (
        <p className="text-xs text-muted-foreground bg-accent/40 rounded-xl p-3">
          ثبت نظر جدید موقتاً غیرفعال است
        </p>
      ) : !user ? (
        <p className="text-xs text-muted-foreground bg-accent/40 rounded-xl p-3">
          برای ثبت نظر وارد حساب خود شوید
        </p>
      ) : null}

      {/* ─── کارت خلاصه: میانگین + توزیع + معیارها ─── */}
      {total > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-l from-primary/5 to-transparent border border-border/50 rounded-2xl p-4 mb-4"
        >
          <div className="flex items-center gap-4">
            <div className="text-center shrink-0">
              <p className="text-xl md:text-3xl font-black tnum leading-none">{faRating(biz.rating)}</p>
              <div className="flex items-center gap-0.5 mt-1.5" dir="ltr">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`w-3 h-3 ${i < Math.round(biz.rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground tnum mt-1">{faNum(total)} نظر</p>
            </div>
            {/* توزیع امتیازها */}
            <div className="flex-1 space-y-1.5 min-w-0">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = dist[String(star)] || 0;
                const pct = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground tnum w-3">{faNum(star)}</span>
                    <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 shrink-0" />
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: star * 0.05 }}
                        className={`h-full rounded-full ${star >= 4 ? "bg-emerald-500" : star === 3 ? "bg-amber-400" : "bg-rose-400"}`}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground tnum w-7">{faNum(count)}</span>
                  </div>
                );
              })}
            </div>
          </div>
          {/* میانگین معیارها */}
          {stats?.criteria && CRITERIA_META.some((c) => stats.criteria[c.key] !== null) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-3 border-t border-border/40">
              {CRITERIA_META.map((c) => {
                const v = stats.criteria[c.key];
                return (
                  <div key={c.key} className="text-center">
                    <p className="text-[10px] text-muted-foreground mb-1">{c.label}</p>
                    {v !== null ? (
                      <>
                        <p className="text-sm font-black tnum leading-none">{faRating(v)}</p>
                        <div className="h-1 rounded-full bg-muted mt-1.5 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(v / 5) * 100}%` }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="h-full rounded-full shahryar-gradient"
                          />
                        </div>
                      </>
                    ) : (
                      <p className="text-[10px] text-muted-foreground/60">—</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* ─── مرتب‌سازی ─── */}
      {sorted.length > 1 && (
        <div className="flex gap-1.5 mb-3">
          {[
            { id: "new", label: "جدیدترین", icon: Clock },
            { id: "helpful", label: "مفیدترین", icon: ThumbsUp },
            { id: "best", label: "بهترین", icon: Star },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setSort(s.id as typeof sort)}
              className={cn(
                "flex items-center gap-1.5 text-[11px] px-3.5 py-2 sm:py-1.5 rounded-xl font-bold transition-all active:scale-95",
                sort === s.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
              )}
            >
              <s.icon className="size-3.5" />
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* ─── لیست نظرات ─── */}
      <div className="space-y-3">
        {sorted.length ? (
          <AnimatePresence initial={false}>
            {sorted.map((r) => {
              const isMine = user && r.user.id === user.id;
              const voted = votedHelpful.includes(r.id);
              const edited = r.updatedAt && r.updatedAt !== r.createdAt;
              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className={`rounded-2xl p-4 border transition-colors ${
                    isMine ? "border-primary/30 bg-primary/5" : "bg-accent/30 border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <PersonAvatar name={r.user.fullName || "ک"} color={r.user.avatarColor} size={32} radius="xl" className="shadow-none" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">
                          {r.user.fullName || "کاربر شهریار"}
                          {isMine && <span className="text-[9px] text-primary mr-1">(شما)</span>}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="flex items-center gap-0.5" dir="ltr">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className={`w-2.5 h-2.5 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                          ))}
                        </div>
                          <span className="text-[10px] text-muted-foreground">{faRelative(r.createdAt)}</span>
                          {edited && <span className="text-[9px] text-muted-foreground/70">(ویرایش‌شده)</span>}
                        </div>
                      </div>
                    </div>
                    {!r.wouldRecommend && (
                      <Badge variant="outline" className="text-[9px] text-rose-500 border-rose-500/30 shrink-0">
                        پیشنهاد نمی‌کند
                      </Badge>
                    )}
                  </div>

                  {/* تگ‌های مثبت و منفی */}
                  {(r.pros?.length > 0 || r.cons?.length > 0) && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {r.pros?.map((p) => (
                        <span key={p} className="text-[11px] px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                          + {p}
                        </span>
                      ))}
                      {r.cons?.map((c) => (
                        <span key={c} className="text-[11px] px-2 py-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium">
                          − {c}
                        </span>
                      ))}
                    </div>
                  )}

                  {r.comment && <p className="text-xs leading-relaxed mt-2.5 text-foreground/85">{r.comment}</p>}

                  {/* امتیازهای تفصیلی */}
                  {(r.quality || r.priceFair || r.behavior || r.speed) && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 pt-2.5 border-t border-border/40">
                      {CRITERIA_META.map((c) => {
                        const v = r[c.key];
                        return v ? (
                          <span key={c.key} className="text-[10px] text-muted-foreground">
                            {c.label}: <span className="text-foreground font-bold tnum">{faRating(v)}</span>
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}

                  {/* اقدامات: رأی مفید + ویرایش/حذف نظر خود */}
                  <div className="flex items-center justify-between mt-3">
                    {isMine ? (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setReviewOpen(true)}
                          className="text-[11px] flex items-center gap-1 px-2.5 py-2 sm:py-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors font-bold"
                        >
                          <Pencil className="w-3 h-3" />
                          ویرایش
                        </button>
                        <button
                          onClick={deleteReview}
                          disabled={busyId === "delete"}
                          className="text-[11px] flex items-center gap-1 px-2.5 py-2 sm:py-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors font-bold disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" />
                          حذف
                        </button>
                      </div>
                    ) : (
                      <span className="text-[9px] text-muted-foreground/60">تجربه واقعی کاربران شهریار</span>
                    )}
                    {user && !isMine && (
                      <button
                        onClick={() => voteHelpful(r.id)}
                        disabled={busyId === r.id}
                        className={`flex items-center gap-1.5 text-[11px] px-3 py-2.5 sm:py-1.5 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50 ${
                          voted
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground hover:bg-accent"
                        }`}
                        title={voted ? "رأی شما ثبت شده" : "این نظر برایم مفید بود"}
                      >
                        <ThumbsUp className={`w-3.5 h-3.5 transition-transform ${voted ? "fill-emerald-500 scale-110" : ""}`} />
                        مفید بود
                        {r.helpfulCount > 0 && <span className="tnum">{faNum(r.helpfulCount)}</span>}
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        ) : (
          <div className="text-center py-6">
            <MessageCircle className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">
              {reviewsEnabled ? "اولین نفری باشید که نظر می‌دهد" : "ثبت نظر غیرفعال است"}
            </p>
          </div>
        )}
      </div>

      {/* ─── دیالوگ ثبت/ویرایش نظر (چندمعیاره) ─── */}
      {reviewsEnabled && user && (
        <ReviewDialog
          key={`${myReview ? myReview.id : "new"}-${reviewOpen}`}
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          bizSlug={biz.slug}
          bizName={biz.name}
          editing={myReview}
          onSaved={onReload}
        />
      )}
    </div>
  );
}

// ═════ دیالوگ ثبت/ویرایش نظر — چندمعیاره با تگ و توصیه ═════
function ReviewDialog({ open, onClose, bizSlug, bizName, editing, onSaved }: {
  open: boolean;
  onClose: () => void;
  bizSlug: string;
  bizName: string;
  editing: ReviewItem | null;
  onSaved: () => Promise<void>;
}) {
  const [rating, setRating] = useState(editing?.rating ?? 5);
  const [quality, setQuality] = useState(editing?.quality || 0);
  const [priceFair, setPriceFair] = useState(editing?.priceFair || 0);
  const [behavior, setBehavior] = useState(editing?.behavior || 0);
  const [speed, setSpeed] = useState(editing?.speed || 0);
  const [pros, setPros] = useState<string[]>(editing?.pros || []);
  const [cons, setCons] = useState<string[]>(editing?.cons || []);
  const [wouldRecommend, setWouldRecommend] = useState(editing?.wouldRecommend !== false);
  const [comment, setComment] = useState(editing?.comment || "");
  const [submitting, setSubmitting] = useState(false);
  const [showCriteria, setShowCriteria] = useState(Boolean(editing?.quality || editing?.priceFair || editing?.behavior || editing?.speed));
  // فرم از state اولیه پر می‌شود؛ ریست کامل با key در والد (هر بار باز شدن
  // یا تغییر نظرِ در حال ویرایش → remount) — بدون useEffect-s setState

  const toggleTag = (list: string[], setList: (v: string[]) => void, tag: string) => {
    setList(list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]);
  };

  const submit = async () => {
    if (submitting) return;
    if (!comment.trim() && pros.length === 0 && cons.length === 0) {
      toast({ title: "متن نظر یا حداقل یک تگ لازم است", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const res = await post(`/api/businesses/${bizSlug}`, {
      action: "review",
      rating,
      comment: comment.trim(),
      quality: quality || null,
      priceFair: priceFair || null,
      behavior: behavior || null,
      speed: speed || null,
      pros: pros.length ? pros : null,
      cons: cons.length ? cons : null,
      wouldRecommend,
    });
    setSubmitting(false);
    if (res.success) {
      toast({
        title: editing ? "نظر شما به‌روزرسانی شد ✨" : "نظر شما ثبت شد ✨",
        description: "ممنون که به انتخاب بهتر همشهری‌ها کمک می‌کنی!",
      });
      onClose();
      await onSaved();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      icon={Star}
      size="lg"
      locked={submitting}
      title={editing ? `ویرایش نظرت درباره «${bizName}»` : `نظرت درباره «${bizName}»`}
      description="تجربه‌ات دقیق و صادقانه، انتخاب بقیه را بهتر می‌کند"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="ghost" onClick={onClose} className="h-11 rounded-xl sm:h-9">انصراف</Button>
          <Button onClick={submit} disabled={submitting} className="h-11 rounded-xl sm:h-9 sm:min-w-28 shahryar-gradient text-white border-0 font-bold">
            {submitting ? "در حال ثبت..." : editing ? "به‌روزرسانی نظر" : "ثبت نظر"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* امتیاز کلی با برچسب احساسی */}
        <div className="flex flex-col items-center gap-2 py-2">
          <StarInput value={rating} onChange={setRating} size="lg" />
          <span className="text-xs font-bold text-primary">{RATING_LABELS[rating]}</span>
        </div>

        {/* امتیازدهی تفصیلی (بازشو) */}
        <div className="rounded-2xl border border-border/60 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowCriteria(!showCriteria)}
            className="w-full flex items-center justify-between px-4 py-3.5 text-xs font-bold hover:bg-accent/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="size-3.5 text-primary" />
              امتیازدهی تفصیلی (اختیاری)
            </span>
            <ChevronDown className={`size-4 text-muted-foreground transition-transform ${showCriteria ? "rotate-180" : ""}`} />
          </button>
          {showCriteria && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="overflow-hidden">
              <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border/40">
                <StarRow label="کیفیت" value={quality} onChange={setQuality} />
                <StarRow label="قیمت مناسب" value={priceFair} onChange={setPriceFair} />
                <StarRow label="برخورد" value={behavior} onChange={setBehavior} />
                <StarRow label="سرعت خدمات" value={speed} onChange={setSpeed} />
              </div>
            </motion.div>
          )}
        </div>

        {/* تگ‌های مثبت */}
        <div className="space-y-2">
          <p className="text-xs font-bold flex items-center gap-1.5">
            <ThumbsUp className="w-3.5 h-3.5 text-emerald-500" />
            چه چیزی خوب بود؟
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PROS_OPTIONS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggleTag(pros, setPros, t)}
                className={`text-[11px] px-3 py-2 sm:py-1.5 rounded-xl font-medium transition-all active:scale-95 ${
                  pros.includes(t)
                    ? "bg-emerald-500 text-white shadow-md scale-105"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* تگ‌های منفی */}
        <div className="space-y-2">
          <p className="text-xs font-bold flex items-center gap-1.5">
            <ThumbsDown className="w-3.5 h-3.5 text-rose-500" />
            چه چیزی بهتر می‌شود؟
          </p>
          <div className="flex flex-wrap gap-1.5">
            {CONS_OPTIONS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggleTag(cons, setCons, t)}
                className={`text-[11px] px-3 py-2 sm:py-1.5 rounded-xl font-medium transition-all active:scale-95 ${
                  cons.includes(t)
                    ? "bg-rose-500 text-white shadow-md scale-105"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* توصیه به دیگران */}
        <label className="flex items-center justify-between rounded-2xl border border-border/60 px-4 py-3.5 cursor-pointer hover:bg-accent/40 transition-colors">
          <span className="flex items-center gap-2 text-xs font-bold">
            <Heart className="size-3.5 text-rose-500" />
            به دیگران هم این صنف را توصیه می‌کنی؟
          </span>
          <Switch checked={wouldRecommend} onCheckedChange={setWouldRecommend} />
        </label>

        {/* متن نظر */}
        <div className="space-y-2">
          <p className="text-xs font-bold">تجربه‌ات را بنویس</p>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="مثلاً: سفارشم سریع آماده شد و برخوردشان عالی بود..."
            className="rounded-xl min-h-28 text-sm leading-relaxed"
            maxLength={700}
          />
          <p className="text-[10px] text-muted-foreground text-left tnum">{faNum(comment.length)}/۷۰۰</p>
        </div>
      </div>
    </AppDialog>
  );
}

// ═════ ورودی ستاره (کلیک + هاور انیمیشنی) ═════
function StarInput({ value, onChange, size = "md" }: { value: number; onChange: (v: number) => void; size?: "md" | "lg" }) {
  const [hover, setHover] = useState(0);
  const dim = size === "lg" ? "size-11 sm:size-9" : "size-7";
  return (
    <div className="flex items-center gap-1" dir="ltr">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          className="p-1 transition-transform hover:scale-125 active:scale-90"
          aria-label={`${i} ستاره`}
        >
          <motion.span animate={{ scale: i <= (hover || value) ? 1.08 : 1 }} transition={{ duration: 0.15 }}>
            <Star
              className={`${dim} transition-colors duration-150 ${
                i <= (hover || value)
                  ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]"
                  : "text-muted-foreground/30"
              }`}
            />
          </motion.span>
        </button>
      ))}
    </div>
  );
}

// ═════ ردیف ستاره معیار (۰ = بدون امتیاز) ═════
function StarRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] text-muted-foreground font-medium shrink-0">{label}</span>
      <div className="flex items-center gap-0.5" dir="ltr">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(value === i ? 0 : i)}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            className="p-1 transition-transform hover:scale-125 active:scale-90"
            aria-label={`${label}: ${i}`}
          >
            <Star
              className={`size-6 sm:size-5 transition-colors duration-150 ${
                i <= (hover || value) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

