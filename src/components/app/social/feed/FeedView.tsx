// ═══════════════════════════════════════════════════════════════
// نمای فید شهریار — تب فید داخل صفحه شهریار + تب پست‌های پروفایل
// composer + لیست پست‌ها + صفحه‌بندی بی‌نهایت + مرتب‌سازی
// معماری: wrapper نگه‌دارنده sort → FeedList با key — تغییر فیلتر/مرتب‌سازی
// remount تمیز می‌دهد (بدون setState همگام در effect)
// ═══════════════════════════════════════════════════════════════
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Flame, Loader2, Newspaper, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { get } from "@/lib/client/api";
import { faNum } from "@/lib/client/persian";
import type { FeedPageDTO, FeedPostDTO } from "@/lib/modules/social/feed-types";
import PostCard from "./PostCard";
import PostComposer from "./PostComposer";

const SORTS = [
  { key: "recent", label: "تازه‌ترین", icon: Newspaper },
  { key: "popular", label: "داغ‌ترین", icon: Flame },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

export interface FeedViewProps {
  onOpenProfile: (userId: string) => void;
  onOpenChat: (type: "dm" | "agent", userId: string) => void;
  headerNote?: string;
  /** فیلتر روی یک نویسنده — حالت پروفایل */
  authorId?: string;
  /** نمایش composer (فید اصلی یا پروفایل خودم) */
  showComposer?: boolean;
  /** پین‌شده‌ها جداگانه در بالای لیست — حالت پروفایل */
  pinnedFirst?: boolean;
  emptyTitle?: string;
  emptyDesc?: string;
}

export default function FeedView(props: FeedViewProps) {
  const [sort, setSort] = useState<SortKey>("recent");
  const [refreshKey, setRefreshKey] = useState(0);
  const isProfile = Boolean(props.authorId);

  return (
    <div className="space-y-4" dir="rtl">
      {props.showComposer ? (
        <PostComposer onPublished={() => setRefreshKey((k) => k + 1)} />
      ) : null}
      {props.headerNote ? (
        <div className="flex items-center gap-2.5 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs font-bold text-primary">
          <Newspaper className="size-4 shrink-0" />
          {props.headerNote}
        </div>
      ) : null}

      {/* مرتب‌سازی — فقط فید عمومی */}
      {!isProfile ? (
        <div className="flex gap-1.5">
          {SORTS.map((s) => {
            const active = sort === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                className={`flex h-9 items-center gap-1.5 rounded-xl border px-3.5 text-xs font-bold transition-all active:scale-95 ${
                  active
                    ? "border-transparent shahryar-gradient text-white shadow-md"
                    : "border-border/60 bg-card text-muted-foreground hover:bg-accent"
                }`}
              >
                <s.icon className="size-3.5" />
                {s.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <FeedList
        key={`${props.authorId ?? "all"}-${sort}-${refreshKey}`}
        sort={sort}
        onNewPost={(p) => {
          // پست تازه منتشرشده — با bump کلید، لیست از نو با پست جدید بالا می‌آید
          void p;
          setRefreshKey((k) => k + 1);
        }}
        {...props}
      />
    </div>
  );
}

/** لیست داخلی — state تازه روی هر تغییر کلید (authorId/sort/refresh) */
function FeedList({
  sort,
  authorId,
  pinnedFirst,
  onOpenProfile,
  onOpenChat,
  emptyTitle,
  emptyDesc,
  onNewPost,
}: FeedViewProps & {
  sort: SortKey;
  onNewPost: (post: FeedPostDTO) => void;
}) {
  const [posts, setPosts] = useState<FeedPostDTO[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const busyRef = useRef(false);

  // بارگذاری اولیه — فقط async داخل effect (بدون setState همگام)
  useEffect(() => {
    let alive = true;
    void (async () => {
      const params = new URLSearchParams({ sort, take: "8" });
      if (authorId) params.set("authorId", authorId);
      const res = await get<FeedPageDTO>(`/api/social/feed?${params.toString()}`);
      if (!alive) return;
      if (res.success && res.data) {
        setPosts(res.data.posts);
        setCursor(res.data.nextCursor);
      } else if (res.error) {
        toast({ title: "خطا", description: res.error, variant: "destructive" });
        setPosts([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [sort, authorId]);

  const loadMore = useCallback(async () => {
    if (!cursor || busyRef.current || posts === null) return;
    busyRef.current = true;
    setLoadingMore(true);
    const params = new URLSearchParams({ sort, take: "8", cursor });
    if (authorId) params.set("authorId", authorId);
    const res = await get<FeedPageDTO>(`/api/social/feed?${params.toString()}`);
    if (res.success && res.data) {
      setPosts((p) => {
        const seen = new Set((p || []).map((x) => x.id));
        return [...(p || []), ...res.data!.posts.filter((x) => !seen.has(x.id))];
      });
      setCursor(res.data.nextCursor);
    }
    setLoadingMore(false);
    busyRef.current = false;
  }, [cursor, posts, sort, authorId]);

  // infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) void loadMore();
      },
      { rootMargin: "600px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  const onDeleted = (id: string) => {
    setPosts((prev) => (prev || []).filter((p) => p.id !== id));
  };

  const onUpdated = (updated: FeedPostDTO) => {
    setPosts((prev) => (prev || []).map((p) => (p.id === updated.id ? updated : p)));
  };

  const renderCard = (p: FeedPostDTO) => (
    <motion.div
      key={p.id}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <PostCard
        post={p}
        onDeleted={onDeleted}
        onUpdated={onUpdated}
        onOpenProfile={onOpenProfile}
        onOpenChat={onOpenChat}
      />
    </motion.div>
  );

  // حالت پروفایل: پین‌شده‌ها جداگانه بالا
  const pinned = pinnedFirst && posts ? posts.filter((p) => p.isPinned) : [];
  const rest = pinnedFirst && posts ? posts.filter((p) => !p.isPinned) : null;

  void onNewPost; // انتشار پست از طریق refreshKey والد هندل می‌شود

  return (
    <>
      {posts === null ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-border/60 bg-card p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-11 rounded-2xl" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32 rounded-lg" />
                  <Skeleton className="h-3 w-44 rounded-lg" />
                </div>
              </div>
              <Skeleton className="mt-3 h-4 w-full rounded-lg" />
              <Skeleton className="mt-2 h-4 w-3/4 rounded-lg" />
              <Skeleton className="mt-3 h-40 w-full rounded-2xl" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border/60 bg-card p-10 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
            <Newspaper className="size-8 text-muted-foreground" />
          </div>
          <p className="font-black">{emptyTitle || "فید هنوز خاموش است"}</p>
          <p className="max-w-sm text-sm leading-6 text-muted-foreground">
            {emptyDesc ||
              "اولین پست فید شهریار را شما منتشر کنید! یک دستاورد، فرصت همکاری یا خبر خوب از رفسنجان بنویسید."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* پین‌شده‌ها — بالای پروفایل */}
          {pinned.length > 0 ? (
            <>
              {pinned.map((p) => renderCard(p))}
              {rest && rest.length > 0 ? (
                <p className="flex items-center gap-2 pt-1 text-[11px] font-bold text-muted-foreground">
                  <span className="h-px flex-1 bg-border/70" />
                  بقیه پست‌ها
                  <span className="h-px flex-1 bg-border/70" />
                </p>
              ) : null}
            </>
          ) : null}
          {(rest || posts).map((p) => renderCard(p))}

          <div ref={sentinelRef} className="h-2" />
          {loadingMore ? (
            <div className="flex items-center justify-center gap-2 py-3 text-xs font-bold text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              پست‌های بیشتر…
            </div>
          ) : cursor ? (
            <div className="flex justify-center py-2">
              <Button variant="outline" size="sm" className="rounded-xl text-xs font-bold" onClick={() => void loadMore()}>
                پست‌های قدیمی‌تر
              </Button>
            </div>
          ) : posts.length > 3 ? (
            <p className="pb-2 text-center text-[11px] text-muted-foreground">به انتهای فید رسیدید ✨</p>
          ) : null}
        </div>
      )}
    </>
  );
}
