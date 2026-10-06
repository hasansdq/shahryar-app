// ═══════════════════════════════════════════════════════════════
// فرم انتشار پست فید شهریار — متن + پیوست تصویر/ویدیو/صوت/فایل
// آپلود با پروگرس زنده، استخراج متادیتای رسانه (مدت/ابعاد)،
// پیش‌نمایش جذاب هر نوع پیوست، ویرایش پست موجود
// ═══════════════════════════════════════════════════════════════
"use client";

import { useEffect, useRef, useState } from "react";
import {
  AudioLines, FileText, Film, ImagePlus, Loader2, Paperclip, Send, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { post as apiPost, patch as apiPatch } from "@/lib/client/api";
import { faNum } from "@/lib/client/persian";
import { useAppStore } from "@/lib/client/store";
import { uploadMedia } from "@/lib/client/media";
import { ATTACHMENTS_MAX, POST_CONTENT_MAX, type FeedPostDTO } from "@/lib/modules/social/feed-types";
import { PersonAvatar } from "../social-ui";
import WaveformPlayer from "./WaveformPlayer";

/** پیوست در حال آماده‌سازی (قبل از انتشار) */
interface DraftAttachment {
  key: string;
  kind: "image" | "video" | "audio" | "file";
  localUrl: string; // blob برای پیش‌نمایش
  url: string | null; // URL سرور بعد از آپلود
  originalName: string;
  mime: string;
  size: number;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  uploading: boolean;
  error?: string;
}

function kindOf(mime: string): DraftAttachment["kind"] {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
}

/** خواندن متادیتای رسانه در کلاینت — مدت ویدیو/صوت + ابعاد */
function readMediaMeta(
  file: File
): Promise<{ durationMs: number | null; width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    const kind = kindOf(file.type);
    if (kind === "video" || kind === "audio") {
      const el = document.createElement(kind === "video" ? "video" : "audio");
      el.preload = "metadata";
      const url = URL.createObjectURL(file);
      const done = (d: number | null, w: number | null, h: number | null) => {
        URL.revokeObjectURL(url);
        resolve({ durationMs: d, width: w, height: h });
      };
      el.onloadedmetadata = () => {
        const d = Number.isFinite(el.duration) ? Math.round(el.duration * 1000) : null;
        if (kind === "video") {
          const v = el as HTMLVideoElement;
          done(d, v.videoWidth || null, v.videoHeight || null);
        } else {
          done(d, null, null);
        }
      };
      el.onerror = () => done(null, null, null);
      el.src = url;
      // سقف ۵ ثانیه — فایل‌های عجیب گیر نکنند
      setTimeout(() => done(null, null, null), 5000);
    } else if (kind === "image") {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const w = img.naturalWidth || null;
        const h = img.naturalHeight || null;
        URL.revokeObjectURL(url);
        resolve({ durationMs: null, width: w, height: h });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ durationMs: null, width: null, height: null });
      };
      img.src = url;
    } else {
      resolve({ durationMs: null, width: null, height: null });
    }
  });
}

const ACCEPT_MAP: Record<DraftAttachment["kind"], string> = {
  image: "image/png,image/jpeg,image/webp,image/gif,image/avif",
  video: "video/mp4,video/webm,video/quicktime,video/x-matroska,video/ogg",
  audio: "audio/mpeg,audio/mp3,audio/mp4,audio/wav,audio/x-wav,audio/webm,audio/ogg,audio/aac,audio/flac,audio/x-m4a,audio/m4a",
  file: ".pdf,.zip,.rar,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.ods",
};

const KIND_ICON = {
  image: ImagePlus,
  video: Film,
  audio: AudioLines,
  file: Paperclip,
} as const;

const KIND_LABEL = {
  image: "تصویر",
  video: "ویدیو",
  audio: "صوت",
  file: "فایل",
} as const;

export default function PostComposer({
  onPublished,
  editPost,
  onCancelEdit,
  compact = false,
}: {
  onPublished: (post: FeedPostDTO) => void;
  editPost?: FeedPostDTO | null;
  onCancelEdit?: () => void;
  compact?: boolean;
}) {
  const user = useAppStore((s) => s.user);
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [focused, setFocused] = useState(false);

  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // حالت ویرایش — پر کردن فرم از پست موجود
  useEffect(() => {
    if (editPost) {
      setContent(editPost.content);
      setAttachments(
        editPost.attachments.map((a) => ({
          key: a.id,
          kind: a.kind,
          localUrl: a.url,
          url: a.url,
          originalName: a.originalName,
          mime: a.mime,
          size: a.size,
          durationMs: a.durationMs,
          width: a.width,
          height: a.height,
          uploading: false,
        }))
      );
      taRef.current?.focus();
    } else {
      setContent("");
      setAttachments([]);
    }
  }, [editPost]);

  // خودرشد textarea
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 340)}px`;
  }, [content]);

  const remaining = POST_CONTENT_MAX - content.length;
  const busy = publishing || attachments.some((a) => a.uploading);
  const canPublish = content.trim().length > 0 && !busy;

  const pickFiles = async (kind: DraftAttachment["kind"], files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = ATTACHMENTS_MAX - attachments.length;
    if (room <= 0) {
      toast({ title: "سقف پیوست", description: `حداکثر ${faNum(ATTACHMENTS_MAX)} پیوست برای هر پست`, variant: "destructive" });
      return;
    }
    const list = Array.from(files).slice(0, room);
    if (Array.from(files).length > room) {
      toast({ title: "بعضی فایل‌ها اضافه نشد", description: `تنها ${faNum(room)} پیوست دیگر جا هست` });
    }

    for (const file of list) {
      const key = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const localUrl = URL.createObjectURL(file);
      const meta = await readMediaMeta(file);

      const draft: DraftAttachment = {
        key,
        kind: kindOf(file.type) || kind,
        localUrl,
        url: null,
        originalName: file.name,
        mime: file.type || "application/octet-stream",
        size: file.size,
        ...meta,
        uploading: true,
      };
      setAttachments((prev) => [...prev, draft]);

      // آپلود async — هر فایل مستقل
      (async () => {
        const uploaded = await uploadMedia(file, "post");
        setAttachments((prev) =>
          prev.map((a) =>
            a.key === key
              ? uploaded
                ? { ...a, url: uploaded.url, mime: uploaded.mime, size: uploaded.size, uploading: false }
                : { ...a, uploading: false, error: "بارگذاری ناموفق" }
              : a
          )
        );
      })();
    }
  };

  const removeAttachment = (key: string) => {
    setAttachments((prev) => {
      const item = prev.find((a) => a.key === key);
      if (item && item.localUrl.startsWith("blob:")) URL.revokeObjectURL(item.localUrl);
      return prev.filter((a) => a.key !== key);
    });
  };

  const publish = async () => {
    if (!canPublish) return;

    // پیوست‌های هنوز در حال آپلود
    if (attachments.some((a) => a.uploading)) {
      toast({ title: "کمی صبر کنید", description: "بارگذاری پیوست‌ها هنوز تمام نشده است" });
      return;
    }
    // پیوست‌های خطادار حذف شوند با هشدار
    const failed = attachments.filter((a) => !a.url);
    const payload = attachments.filter((a) => a.url);

    setPublishing(true);
    try {
      if (editPost) {
        // ویرایش — متن + مجموعه کامل پیوست‌ها (سرور جایگزینی کامل انجام می‌دهد)
        const res = await apiPatch<FeedPostDTO>(`/api/social/posts/${editPost.id}`, {
          content,
          attachments: payload.map((a) => ({
            kind: a.kind,
            url: a.url,
            originalName: a.originalName,
            mime: a.mime,
            size: a.size,
            durationMs: a.durationMs,
            width: a.width,
            height: a.height,
          })),
        });
        if (res.success && res.data) {
          onPublished(res.data);
          toast({ title: "پست به‌روزرسانی شد ✨" });
          setContent("");
          setAttachments([]);
          onCancelEdit?.();
        } else {
          toast({ title: "ویرایش نشد", description: res.error, variant: "destructive" });
        }
      } else {
        const res = await apiPost<FeedPostDTO>("/api/social/posts", {
          content,
          attachments: payload.map((a) => ({
            kind: a.kind,
            url: a.url,
            originalName: a.originalName,
            mime: a.mime,
            size: a.size,
            durationMs: a.durationMs,
            width: a.width,
            height: a.height,
          })),
        });
        if (res.success && res.data) {
          if (failed.length > 0) {
            toast({ title: "انتشار یافت", description: `${faNum(failed.length)} پیوست ناموفق، بدون آن‌ها منتشر شد` });
          } else {
            toast({ title: "پست شما منتشر شد 🎉", description: "همه شهریاری‌ها آن را می‌بینند" });
          }
          onPublished(res.data);
          setContent("");
          setAttachments([]);
          setFocused(false);
        } else {
          toast({ title: "انتشار نشد", description: res.error, variant: "destructive" });
        }
      }
    } finally {
      setPublishing(false);
    }
  };

  const showToolbar = focused || content.length > 0 || attachments.length > 0 || editPost;

  return (
    <div
      className={`rounded-2xl border border-border/60 bg-card shadow-sm transition-shadow ${
        showToolbar ? "shadow-md ring-1 ring-primary/10" : ""
      }`}
      dir="rtl"
    >
      <div className="flex gap-3 p-3.5 sm:p-4">
        <PersonAvatar
          name={user?.fullName || "ش"}
          avatarUrl={user?.avatarUrl}
          color={user?.avatarColor}
          size={compact ? 38 : 44}
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <textarea
            ref={taRef}
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, POST_CONTENT_MAX))}
            onFocus={() => setFocused(true)}
            placeholder={
              editPost
                ? "متن پست را ویرایش کنید…"
                : "چه خبر از رفسنجان؟ یک تجربه، فرصت شغلی یا دستاورد حرفه‌ای بنویسید…"
            }
            rows={showToolbar ? 3 : 1}
            className="w-full resize-none bg-transparent text-sm leading-7 outline-none placeholder:text-muted-foreground/70"
          />

          {/* پیش‌نمایش پیوست‌ها */}
          {attachments.length > 0 ? (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {attachments.map((a) => (
                <div key={a.key} className="group relative overflow-hidden rounded-xl border border-border/60 bg-muted/40">
                  {a.kind === "image" ? (
                     
                    <img src={a.localUrl} alt={a.originalName} className="h-24 w-full object-cover" />
                  ) : a.kind === "video" ? (
                    <div className="relative h-24 w-full bg-slate-900">
                      <video src={a.localUrl} className="size-full object-cover" preload="metadata" muted />
                      <span className="absolute inset-0 grid place-items-center">
                        <span className="grid size-9 place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm">
                          <Film className="size-4" />
                        </span>
                      </span>
                    </div>
                  ) : a.kind === "audio" ? (
                    <div className="flex h-24 items-center p-2">
                      <WaveformPlayer src={a.localUrl} title={a.originalName} compact />
                    </div>
                  ) : (
                    <div className="flex h-24 flex-col items-center justify-center gap-1.5 p-2 text-center">
                      <FileText className="size-7 text-primary" />
                      <p className="w-full truncate px-1 text-[10px] font-bold" dir="auto">{a.originalName}</p>
                    </div>
                  )}

                  {/* وضعیت آپلود */}
                  {a.uploading ? (
                    <span className="absolute inset-0 grid place-items-center bg-background/70 backdrop-blur-[2px]">
                      <Loader2 className="size-5 animate-spin text-primary" />
                    </span>
                  ) : a.error ? (
                    <span className="absolute inset-x-0 bottom-0 bg-destructive/90 px-2 py-1 text-[9px] font-bold text-white">
                      {a.error}
                    </span>
                  ) : null}

                  {/* حذف */}
                  <button
                    onClick={() => removeAttachment(a.key)}
                    aria-label={`حذف ${KIND_LABEL[a.kind]}`}
                    className="absolute end-1.5 top-1.5 grid size-6.5 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100 focus:opacity-100"
                    style={{ width: 26, height: 26 }}
                  >
                    <X className="size-3.5" />
                  </button>

                  {/* نام فایل برای تصویر/ویدیو/صوت */}
                  {a.kind !== "file" ? (
                    <p className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pb-1 pt-3 text-[9px] text-white" dir="auto">
                      {a.originalName}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {/* شمارنده + نوار ابزار */}
          {showToolbar ? (
            <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/50 pt-2.5">
              <div className="flex items-center gap-0.5">
                {(Object.keys(ACCEPT_MAP) as Array<DraftAttachment["kind"]>).map((kind) => {
                  const Icon = KIND_ICON[kind];
                  const disabled = attachments.length >= ATTACHMENTS_MAX;
                  return (
                    <div key={kind} className="relative">
                      <input
                        ref={(el) => {
                          inputRefs.current[kind] = el;
                        }}
                        type="file"
                        accept={ACCEPT_MAP[kind]}
                        multiple={kind === "image"}
                        className="absolute inset-0 size-full cursor-pointer opacity-0"
                        onChange={(e) => {
                          void pickFiles(kind, e.target.files);
                          e.target.value = "";
                        }}
                        disabled={disabled}
                        aria-label={`افزودن ${KIND_LABEL[kind]}`}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        disabled={disabled}
                        title={`افزودن ${KIND_LABEL[kind]}`}
                        className={`grid size-9 place-items-center rounded-xl transition-colors ${
                          disabled
                            ? "text-muted-foreground/40"
                            : "text-muted-foreground hover:bg-accent hover:text-primary"
                        }`}
                        onClick={() => inputRefs.current[kind]?.click()}
                      >
                        <Icon className="size-[18px]" />
                      </button>
                    </div>
                  );
                })}
                {attachments.length > 0 ? (
                  <span className="tnum ms-1 text-[10px] font-bold text-muted-foreground">
                    {faNum(attachments.length)}/{faNum(ATTACHMENTS_MAX)}
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-2.5">
                {content.length > POST_CONTENT_MAX * 0.7 ? (
                  <span className={`tnum text-[10px] font-bold ${remaining < 200 ? "text-destructive" : "text-muted-foreground"}`}>
                    {faNum(remaining)}
                  </span>
                ) : null}
                {editPost ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setContent("");
                      setAttachments([]);
                      onCancelEdit?.();
                    }}
                    className="h-9 rounded-xl px-3 text-xs font-bold text-muted-foreground"
                  >
                    <Trash2 className="size-3.5" />
                    انصراف
                  </Button>
                ) : null}
                <Button
                  onClick={publish}
                  disabled={!canPublish}
                  size="sm"
                  className="h-9 rounded-xl border-0 px-4 text-xs font-bold shahryar-gradient disabled:opacity-50"
                >
                  {publishing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                  {editPost ? "ذخیره ویرایش" : "انتشار پست"}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
