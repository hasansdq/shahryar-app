// ═══════════════════════════════════════════════════════════════
// کارت پست فید شهریار — نمایش پست + پیوست‌های چندرسانه‌ای
// لایک انیمیشنی، دیدگاه‌های درون‌خطی، پین، ویرایش، گزارش، اشتراک
// ═══════════════════════════════════════════════════════════════
"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck, Bookmark, FileText, Flag, Heart, Link2, Loader2, MessageCircle,
  MoreHorizontal, Pencil, Pin, Send, Share2, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { del, get, post as apiPost, patch as apiPatch } from "@/lib/client/api";
import { faNum, faRelative } from "@/lib/client/persian";
import { useAppStore } from "@/lib/client/store";
import {
  REPORT_REASON_LABELS, REPORT_REASONS,
  type FeedCommentDTO, type FeedPostDTO, type ReportReason,
} from "@/lib/modules/social/feed-types";
import { AgentBadge, PersonAvatar } from "../social-ui";
import WaveformPlayer from "./WaveformPlayer";
import AppDialog from "@/components/ui/app-dialog";

/** سایز فایل خوانا */
function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${faNum((bytes / (1024 * 1024)).toFixed(1))} مگابایت`;
  if (bytes >= 1024) return `${faNum(Math.round(bytes / 1024))} کیلوبایت`;
  return `${faNum(bytes)} بایت`;
}

/** متن پست با لینک‌سازی امن (فقط http/https) */
function PostText({ content }: { content: string }) {
  const parts = content.split(/(https?:\/\/[^\s\u0600-\u06FF]+)/g);
  return (
    <p className="whitespace-pre-line break-words text-[13.5px] leading-7 text-foreground/95 sm:text-sm" dir="auto">
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a
            key={i}
            href={p}
            target="_blank"
            rel="noopener noreferrer nofollow"
            dir="ltr"
            className="font-bold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary"
          >
            {p.length > 48 ? `${p.slice(0, 45)}…` : p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </p>
  );
}

/** گالری پیوست‌ها — تصاویر گرید هوشمند + ویدیو + صوت + فایل */
function Attachments({ post }: { post: FeedPostDTO }) {
  if (post.attachments.length === 0) return null;
  const images = post.attachments.filter((a) => a.kind === "image");
  const others = post.attachments.filter((a) => a.kind !== "image");

  return (
    <div className="mt-3 space-y-2.5">
      {/* تصاویر — گرید واکنش‌گرا */}
      {images.length > 0 ? (
        <div
          className={`grid gap-1.5 overflow-hidden rounded-2xl border border-border/50 ${
            images.length === 1 ? "grid-cols-1" : images.length <= 4 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"
          }`}
        >
          {images.map((img, i) => {
            const many = images.length > 2;
            const hidden = many && i >= 5 && images.length > 5;
            if (hidden) return null;
            return (
              <a
                key={img.id}
                href={img.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`relative block overflow-hidden bg-muted ${
                  images.length === 1 ? "" : many ? "aspect-square" : "aspect-[4/3]"
                } ${images.length === 1 && img.width && img.height ? "" : ""}`}
                style={
                  images.length === 1 && img.width && img.height
                    ? { maxHeight: 480 }
                    : undefined
                }
              >
                { }
                <img
                  src={img.url}
                  alt={img.originalName}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-500 hover:scale-[1.03]"
                  style={images.length === 1 && img.width && img.height ? { maxHeight: 480, width: "100%", objectFit: "contain" } : undefined}
                />
                {many && i === 4 && images.length > 5 ? (
                  <span className="absolute inset-0 grid place-items-center bg-black/60 text-lg font-black text-white backdrop-blur-sm">
                    +{faNum(images.length - 5)}
                  </span>
                ) : null}
              </a>
            );
          })}
        </div>
      ) : null}

      {/* ویدیوها */}
      {post.attachments
        .filter((a) => a.kind === "video")
        .map((v) => (
          <div key={v.id} className="overflow-hidden rounded-2xl border border-border/50 bg-black">
            <video
              src={v.url}
              controls
              preload="metadata"
              playsInline
              className="max-h-[480px] w-full"
            />
          </div>
        ))}

      {/* صوت‌ها — موج جذاب */}
      {post.attachments
        .filter((a) => a.kind === "audio")
        .map((a) => (
          <WaveformPlayer key={a.id} src={a.url} title={a.originalName} />
        ))}

      {/* فایل‌ها — کارت دانلود */}
      {others
        .filter((a) => a.kind === "file")
        .map((f) => (
          <a
            key={f.id}
            href={f.url}
            target="_blank"
            rel="noopener noreferrer"
            download={f.originalName}
            className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/40 p-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <FileText className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold" dir="auto">{f.originalName}</span>
              <span className="mt-0.5 block text-[10px] text-muted-foreground">{fmtSize(f.size)} · برای دانلود بزنید</span>
            </span>
            <Bookmark className="size-4 shrink-0 text-muted-foreground" />
          </a>
        ))}
    </div>
  );
}

export default function PostCard({
  post: initialPost,
  onDeleted,
  onUpdated,
  onOpenProfile,
  onOpenChat,
  highlightPinned = true,
}: {
  post: FeedPostDTO;
  onDeleted: (postId: string) => void;
  onUpdated: (post: FeedPostDTO) => void;
  onOpenProfile: (userId: string) => void;
  onOpenChat: (type: "dm" | "agent", userId: string) => void;
  highlightPinned?: boolean;
}) {
  const [post, setPost] = useState(initialPost);
  const [lastInitial, setLastInitial] = useState(initialPost);
  const [likeBusy, setLikeBusy] = useState(false);
  const [burst, setBurst] = useState(0); // انیمیشن قلب
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>("spam");
  const [reportNote, setReportNote] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);

  // ─── دیدگاه‌ها ───
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<FeedCommentDTO[] | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement | null>(null);

  // sync با prop جدید — الگوی رسمی React (تنظیم state حین render، بدون effect)
  if (lastInitial !== initialPost) {
    setLastInitial(initialPost);
    setPost(initialPost);
  }

  const sync = (p: FeedPostDTO) => {
    setPost(p);
    onUpdated(p);
  };

  // ─── لایک ───
  const toggleLike = async () => {
    if (likeBusy) return;
    setLikeBusy(true);
    // optimistic
    const wasLiked = post.likedByMe;
    setPost((p) => ({
      ...p,
      likedByMe: !wasLiked,
      likeCount: p.likeCount + (wasLiked ? -1 : 1),
    }));
    if (!wasLiked) setBurst((b) => b + 1);
    const res = await apiPost<{ liked: boolean; likeCount: number }>(`/api/social/posts/${post.id}/like`);
    if (res.success && res.data) {
      setPost((p) => ({ ...p, likedByMe: res.data!.liked, likeCount: res.data!.likeCount }));
    } else {
      // rollback
      setPost((p) => ({ ...p, likedByMe: wasLiked, likeCount: p.likeCount + (wasLiked ? 1 : -1) }));
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
    setLikeBusy(false);
  };

  // ─── پین ───
  const togglePin = async () => {
    if (pinBusy) return;
    setPinBusy(true);
    setMenuOpen(false);
    const res = await apiPatch<FeedPostDTO>(`/api/social/posts/${post.id}`, { pinned: !post.isPinned });
    if (res.success && res.data) {
      sync(res.data);
      toast({
        title: res.data.isPinned ? "پست سنجاق شد 📌" : "سنجاق برداشته شد",
        description: res.data.isPinned ? "این پست همیشه بالای پروفایل شما دیده می‌شود" : undefined,
      });
    } else {
      toast({ title: "انجام نشد", description: res.error, variant: "destructive" });
    }
    setPinBusy(false);
  };

  // ─── ویرایش ───
  const saveEdit = async () => {
    if (editBusy) return;
    if (!editText.trim()) {
      toast({ title: "متن پست نمی‌تواند خالی باشد", variant: "destructive" });
      return;
    }
    setEditBusy(true);
    const res = await apiPatch<FeedPostDTO>(`/api/social/posts/${post.id}`, { content: editText });
    setEditBusy(false);
    if (res.success && res.data) {
      sync(res.data);
      setEditMode(false);
      toast({ title: "پست به‌روزرسانی شد" });
    } else {
      toast({ title: "ویرایش نشد", description: res.error, variant: "destructive" });
    }
  };

  // ─── حذف ───
  const doDelete = async () => {
    const res = await del<{ deleted: boolean }>(`/api/social/posts/${post.id}`);
    if (res.success) {
      onDeleted(post.id);
      toast({ title: "پست حذف شد" });
    } else {
      toast({ title: "حذف نشد", description: res.error, variant: "destructive" });
    }
    setConfirmDelete(false);
  };

  // ─── گزارش ───
  const doReport = async () => {
    if (reportBusy) return;
    setReportBusy(true);
    const res = await apiPost<{ reported: boolean }>(`/api/social/posts/${post.id}/report`, {
      reason: reportReason,
      note: reportNote || undefined,
    });
    setReportBusy(false);
    if (res.success) {
      setPost((p) => ({ ...p, reportedByMe: true }));
      setReportOpen(false);
      setReportNote("");
      toast({ title: "گزارش ثبت شد", description: "تیم مدیریت شهریار بررسی می‌کند — سپاس از همراهی شما" });
    } else {
      toast({ title: "ثبت نشد", description: res.error, variant: "destructive" });
    }
  };

  // ─── اشتراک‌گذاری ───
  const sharePost = async () => {
    setMenuOpen(false);
    const text = `${post.author.name} در فید شهریار:\n\n${post.content.slice(0, 180)}${post.content.length > 180 ? "…" : ""}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "پست فید شهریار", text });
      } else {
        await navigator.clipboard.writeText(text);
        toast({ title: "متن پست کپی شد", description: "می‌توانید برای دیگران بفرستید" });
      }
    } catch {
      /* لغو توسط کاربر */
    }
  };

  // ─── دیدگاه‌ها ───
  const loadComments = async () => {
    setCommentsLoading(true);
    const res = await get<{ comments: FeedCommentDTO[] }>(`/api/social/posts/${post.id}/comments`);
    if (res.success && res.data) setComments(res.data.comments);
    setCommentsLoading(false);
  };

  const toggleComments = () => {
    const open = !commentsOpen;
    setCommentsOpen(open);
    if (open && comments === null) void loadComments();
  };

  const submitComment = async () => {
    if (commentBusy) return;
    if (!commentText.trim()) return;
    setCommentBusy(true);
    const res = await apiPost<FeedCommentDTO>(`/api/social/posts/${post.id}/comments`, {
      content: commentText,
    });
    setCommentBusy(false);
    if (res.success && res.data) {
      setComments((c) => [...(c || []), res.data!]);
      setPost((p) => ({ ...p, commentCount: p.commentCount + 1 }));
      setCommentText("");
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
    } else {
      toast({ title: "ثبت نشد", description: res.error, variant: "destructive" });
    }
  };

  const deleteComment = async (commentId: string) => {
    const res = await del<{ deleted: boolean }>(`/api/social/posts/${post.id}/comments/${commentId}`);
    if (res.success) {
      setComments((c) => (c || []).filter((x) => x.id !== commentId));
      setPost((p) => ({ ...p, commentCount: Math.max(0, p.commentCount - 1) }));
    } else {
      toast({ title: "حذف نشد", description: res.error, variant: "destructive" });
    }
  };

  return (
    <article
      className={`relative rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md ${
        post.isPinned && highlightPinned ? "border-amber-300/70 dark:border-amber-500/30" : "border-border/60"
      }`}
      dir="rtl"
    >
      {/* نوار پین‌شده */}
      {post.isPinned && highlightPinned ? (
        <div className="flex items-center gap-1.5 rounded-t-2xl border-b border-amber-200/60 bg-gradient-to-l from-amber-50 to-transparent px-4 py-1.5 text-[10px] font-bold text-amber-700 dark:border-amber-500/20 dark:from-amber-900/20 dark:text-amber-300">
          <Pin className="size-3" />
          پست سنجاق‌شده — همیشه بالای پروفایل {post.isMine ? "شما" : "نویسنده"}
        </div>
      ) : null}

      <div className="p-3.5 sm:p-4">
        {/* ─── هدر: نویسنده ─── */}
        <div className="flex items-start gap-3">
          <button onClick={() => onOpenProfile(post.author.userId)} className="shrink-0 active:scale-95" aria-label={`پروفایل ${post.author.name}`}>
            <PersonAvatar name={post.author.name} avatarUrl={post.author.avatarUrl} color={post.author.avatarColor} size={44} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <button
                onClick={() => onOpenProfile(post.author.userId)}
                className="flex items-center gap-1 text-right text-sm font-black leading-6 hover:underline"
              >
                <span className="truncate" dir="auto">{post.author.name}</span>
                {post.author.isVerified ? <BadgeCheck className="size-4 shrink-0 fill-primary text-white" aria-label="تأییدشده" /> : null}
              </button>
              {post.author.hasAgent ? <AgentBadge compact /> : null}
            </div>
            {post.author.headline ? (
              <p className="truncate text-[11px] font-bold text-primary" dir="auto">{post.author.headline}</p>
            ) : null}
            <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span>{faRelative(post.createdAt)}</span>
              {post.editedAt ? <span>· ویرایش‌شده</span> : null}
            </p>
          </div>

          {/* منوی سه‌نقطه */}
          <div className="relative shrink-0">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="گزینه‌های پست"
              className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <MoreHorizontal className="size-4.5" style={{ width: 18, height: 18 }} />
            </button>
            <AnimatePresence>
              {menuOpen ? (
                <>
                  <button className="fixed inset-0 z-30 cursor-default" aria-hidden onClick={() => setMenuOpen(false)} tabIndex={-1} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: -6 }}
                    transition={{ duration: 0.14 }}
                    className="absolute end-0 top-9 z-40 w-48 overflow-hidden rounded-xl border border-border/70 bg-popover p-1 shadow-xl"
                  >
                    {post.isMine ? (
                      <>
                        <button
                          onClick={() => {
                            setEditMode(true);
                            setEditText(post.content);
                            setMenuOpen(false);
                          }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-right text-xs font-bold hover:bg-accent"
                        >
                          <Pencil className="size-4 text-primary" />
                          ویرایش پست
                        </button>
                        <button
                          onClick={togglePin}
                          disabled={pinBusy}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-right text-xs font-bold hover:bg-accent disabled:opacity-50"
                        >
                          <Pin className={`size-4 ${post.isPinned ? "text-amber-500" : "text-amber-600"}`} />
                          {post.isPinned ? "برداشتن سنجاق" : "سنجاق به پروفایل"}
                        </button>
                        <button
                          onClick={() => {
                            setConfirmDelete(true);
                            setMenuOpen(false);
                          }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-right text-xs font-bold text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-4" />
                          حذف پست
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            onOpenChat("dm", post.author.userId);
                            setMenuOpen(false);
                          }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-right text-xs font-bold hover:bg-accent"
                        >
                          <MessageCircle className="size-4 text-primary" />
                          پیام به {post.author.name.split(" ")[0]}
                        </button>
                        {post.author.hasAgent ? (
                          <button
                            onClick={() => {
                              onOpenChat("agent", post.author.userId);
                              setMenuOpen(false);
                            }}
                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-right text-xs font-bold hover:bg-accent"
                          >
                            <AgentBadge compact />
                            گفتگو با ایجنت
                          </button>
                        ) : null}
                        <div className="my-1 h-px bg-border/60" />
                        <button
                          onClick={() => {
                            setReportOpen(true);
                            setMenuOpen(false);
                          }}
                          disabled={post.reportedByMe}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-right text-xs font-bold text-amber-600 hover:bg-amber-500/10 disabled:opacity-50 dark:text-amber-400"
                        >
                          <Flag className="size-4" />
                          {post.reportedByMe ? "گزارش‌شده" : "گزارش تخلف"}
                        </button>
                      </>
                    )}
                    <div className="my-1 h-px bg-border/60" />
                    <button
                      onClick={sharePost}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-right text-xs font-bold hover:bg-accent"
                    >
                      <Share2 className="size-4 text-primary" />
                      اشتراک‌گذاری پست
                    </button>
                  </motion.div>
                </>
              ) : null}
            </AnimatePresence>
          </div>
        </div>

        {/* ─── متن ─── */}
        {editMode ? (
          <div className="mt-3 space-y-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={5}
              autoFocus
              className="w-full resize-none rounded-xl border border-border/70 bg-muted/40 p-3 text-sm leading-7 outline-none focus:border-primary/50"
            />
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs" onClick={() => setEditMode(false)}>
                <X className="size-3.5" />
                انصراف
              </Button>
              <Button size="sm" className="h-8 rounded-lg border-0 text-xs shahryar-gradient" onClick={saveEdit} disabled={editBusy}>
                {editBusy ? <Loader2 className="size-3.5 animate-spin" /> : null}
                ذخیره
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-2.5">
            <PostText content={post.content} />
          </div>
        )}

        {/* ─── پیوست‌ها ─── */}
        <Attachments post={post} />

        {/* ─── نوار اقدام ─── */}
        <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5">
          {/* لایک */}
          <button
            onClick={toggleLike}
            className={`relative flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-colors active:scale-95 ${
              post.likedByMe
                ? "text-rose-600 dark:text-rose-400"
                : "text-muted-foreground hover:bg-accent hover:text-rose-600"
            }`}
            aria-label={post.likedByMe ? "برداشتن پسندیدن" : "پسندیدن پست"}
            aria-pressed={post.likedByMe}
          >
            <span className="relative">
              <Heart className={`size-[18px] ${post.likedByMe ? "fill-rose-500 text-rose-500" : ""}`} />
              {burst > 0 ? (
                <motion.span
                  key={burst}
                  initial={{ scale: 0.4, opacity: 0.9 }}
                  animate={{ scale: 2, opacity: 0 }}
                  transition={{ duration: 0.55 }}
                  className="absolute inset-0 rounded-full bg-rose-500/40"
                  aria-hidden
                />
              ) : null}
            </span>
            <span className="tnum">{faNum(post.likeCount)}</span>
            <span className="hidden min-[420px]:inline">پسندیدن</span>
          </button>

          {/* دیدگاه */}
          <button
            onClick={toggleComments}
            className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-colors active:scale-95 ${
              commentsOpen ? "text-primary" : "text-muted-foreground hover:bg-accent hover:text-primary"
            }`}
            aria-label="دیدگاه‌ها"
            aria-expanded={commentsOpen}
          >
            <MessageCircle className="size-[18px]" />
            <span className="tnum">{faNum(post.commentCount)}</span>
            <span className="hidden min-[420px]:inline">دیدگاه</span>
          </button>

          {/* اشتراک سریع */}
          <button
            onClick={sharePost}
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-accent hover:text-primary active:scale-95"
            aria-label="اشتراک‌گذاری"
          >
            <Share2 className="size-[18px]" />
            <span className="hidden min-[420px]:inline">اشتراک</span>
          </button>

          {/* گزارش (غیرنویسنده) */}
          {!post.isMine ? (
            <button
              onClick={() => setReportOpen(true)}
              disabled={post.reportedByMe}
              className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-accent hover:text-amber-600 active:scale-95 disabled:opacity-40"
              aria-label="گزارش تخلف"
            >
              <Flag className="size-4" />
              <span className="hidden min-[480px]:inline">{post.reportedByMe ? "گزارش‌شده" : "گزارش"}</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60">
              <Link2 className="size-3.5" />
              پست شما
            </span>
          )}
        </div>

        {/* ─── بخش دیدگاه‌ها ─── */}
        <AnimatePresence initial={false}>
          {commentsOpen ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              <div className="mt-3 space-y-2.5 rounded-xl bg-muted/30 p-3">
                {/* فرم ارسال */}
                <div className="flex items-end gap-2">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value.replace(/\n/g, "").slice(0, 1000))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void submitComment();
                      }
                    }}
                    rows={1}
                    placeholder="دیدگاه شما…"
                    className="max-h-24 min-h-9 flex-1 resize-none rounded-xl border border-border/60 bg-background px-3 py-2 text-xs leading-6 outline-none placeholder:text-muted-foreground/70 focus:border-primary/50"
                    style={{ height: "auto" }}
                  />
                  <Button
                    size="icon"
                    onClick={submitComment}
                    disabled={commentBusy || !commentText.trim()}
                    className="size-9 shrink-0 rounded-xl border-0 shahryar-gradient"
                    aria-label="ارسال دیدگاه"
                  >
                    {commentBusy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  </Button>
                </div>

                {/* لیست */}
                {commentsLoading && comments === null ? (
                  <p className="py-2 text-center text-[11px] text-muted-foreground">در حال بارگذاری دیدگاه‌ها…</p>
                ) : comments && comments.length > 0 ? (
                  <div className="space-y-2">
                    {comments.map((c) => (
                      <div key={c.id} className="group flex items-start gap-2.5">
                        <button onClick={() => onOpenProfile(c.author.userId)} className="shrink-0" aria-label={`پروفایل ${c.author.name}`}>
                          <PersonAvatar name={c.author.name} avatarUrl={c.author.avatarUrl} color={c.author.avatarColor} size={30} />
                        </button>
                        <div className="min-w-0 flex-1 rounded-xl bg-background px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <button
                              onClick={() => onOpenProfile(c.author.userId)}
                              className="flex min-w-0 items-center gap-1 text-[11px] font-black hover:underline"
                            >
                              <span className="truncate" dir="auto">{c.author.name}</span>
                              {c.author.isVerified ? <BadgeCheck className="size-3 shrink-0 fill-primary text-white" /> : null}
                            </button>
                            <span className="shrink-0 text-[9px] text-muted-foreground">{faRelative(c.createdAt)}</span>
                          </div>
                          <p className="mt-0.5 whitespace-pre-line break-words text-xs leading-6 text-foreground/90" dir="auto">{c.content}</p>
                        </div>
                        {c.canDelete ? (
                          <button
                            onClick={() => deleteComment(c.id)}
                            className="mt-1 grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground/50 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                            aria-label="حذف دیدگاه"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        ) : null}
                      </div>
                    ))}
                    <div ref={commentsEndRef} />
                  </div>
                ) : (
                  <p className="py-1.5 text-center text-[11px] text-muted-foreground">
                    اولین دیدگاه را شما بنویسید 💬
                  </p>
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* ─── دیالوگ حذف ─── */}
      <AppDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="حذف پست"
        icon={Trash2}
        iconClassName="bg-gradient-to-br from-rose-500 to-red-600"
        description="پست شما برای همیشه از فید حذف می‌شود. پیوست‌های آن هم از دست می‌روند."
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" className="rounded-xl text-xs font-bold" onClick={() => setConfirmDelete(false)}>
              انصراف
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl text-xs font-bold"
              onClick={doDelete}
            >
              <Trash2 className="size-4" />
              حذف قطعی
            </Button>
          </div>
        }
      >
        <p className="text-xs leading-6 text-muted-foreground">
          اگر فقط می‌خواهید موقتاً پنهان کنید، به‌جای حذف می‌توانید سنجاق را بردارید و منتظر بمانید —
          حذف بازگشت‌پذیر نیست.
        </p>
      </AppDialog>

      {/* ─── دیالوگ گزارش ─── */}
      <AppDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="گزارش تخلف پست"
        icon={Flag}
        iconClassName="bg-gradient-to-br from-amber-500 to-orange-600"
        description="دلیل گزارش را انتخاب کنید تا تیم مدیریت شهریار بررسی کند."
        size="sm"
      >
        <div className="space-y-1.5">
          {REPORT_REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReportReason(r)}
              className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-right text-xs font-bold transition-colors ${
                reportReason === r
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/60 bg-card hover:bg-accent"
              }`}
            >
              <Flag className="size-4 shrink-0" />
              {REPORT_REASON_LABELS[r]}
            </button>
          ))}
          <textarea
            value={reportNote}
            onChange={(e) => setReportNote(e.target.value.slice(0, 500))}
            rows={2}
            placeholder="توضیح بیشتر (اختیاری)…"
            className="w-full resize-none rounded-xl border border-border/60 bg-muted/40 p-2.5 text-xs outline-none focus:border-primary/50"
          />
          <Button
            onClick={doReport}
            disabled={reportBusy}
            className="h-10 w-full rounded-xl bg-amber-600 text-xs font-bold text-white hover:bg-amber-700"
          >
            {reportBusy ? <Loader2 className="size-4 animate-spin" /> : <Flag className="size-4" />}
            ثبت گزارش
          </Button>
        </div>
      </AppDialog>
    </article>
  );
}
