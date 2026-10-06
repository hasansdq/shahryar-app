// ═══════════════════════════════════════════════════════════════
// نشریه انجمن — مقالات ساختارمند با ویرایشگر حرفه‌ای
// ═══════════════════════════════════════════════════════════════
// سه نما:
//  ۱) فهرست مقالات — کارت‌های مدرن با تصویر شاخص، وضعیت و متادیتا
//  ۲) خواننده مقاله — هیرو تصویر شاخص + تایپوگرافی نشریه‌ای (ArticleContent)
//  ۳) ویرایشگر تمام‌صفحه (رئیس) — عنوان/خلاصه/تصویر شاخص + MDXEditor
//     حرفه‌ای با درج تصویر و تغییر اندازه داخل متن
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight, CalendarDays, Eye, ImagePlus, Loader2, Newspaper, Pencil, PenLine,
  Plus, Send, Trash2, X, FileEdit, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { del, get, patch, post } from "@/lib/client/api";
import { faDate, faNum } from "@/lib/client/persian";
import { uploadMedia } from "@/lib/client/media";
import type { ForumArticleDTO, ForumDetailData } from "@/lib/modules/forums/types";
import ArticleContent from "@/components/common/ArticleContent";
import ArticleEditor from "@/components/common/ArticleEditor";

interface EditorForm {
  title: string;
  summary: string;
  content: string;
  coverImage: string | null;
  publish: boolean;
}

const EMPTY_FORM: EditorForm = { title: "", summary: "", content: "", coverImage: null, publish: true };

export default function ForumArticles({ forum }: { forum: ForumDetailData }) {
  const [articles, setArticles] = useState<ForumArticleDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState<ForumArticleDTO | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ForumArticleDTO | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EditorForm>(EMPTY_FORM);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  // کلید یکتای ویرایشگر — با هر باز شدن ریست می‌شود تا markdown جدید لود شود
  const [editorKey, setEditorKey] = useState(0);

  const load = useCallback(async () => {
    const res = await get<{ articles: ForumArticleDTO[]; isChair: boolean }>(
      `/api/forums/${forum.id}/articles${forum.isChair ? "?all=1" : ""}`
    );
    if (res.success && res.data) setArticles(res.data.articles);
    setLoading(false);
  }, [forum.id, forum.isChair]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  // ─── خواندن مقاله کامل ───
  const openArticle = async (a: ForumArticleDTO) => {
    const res = await get<{ article: ForumArticleDTO }>(`/api/forums/${forum.id}/articles/${a.id}`);
    if (res.success && res.data) {
      setReading(res.data.article);
      // شمار بازدید فهرست هم بدون رفرش به‌روز شود
      setArticles((prev) => prev?.map((x) => (x.id === a.id ? res.data!.article : x)) || prev);
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  // ─── ویرایشگر ───
  const openEditor = (a?: ForumArticleDTO) => {
    setEditing(a || null);
    setForm(
      a
        ? {
            title: a.title,
            summary: a.summary || "",
            content: a.content || "",
            coverImage: a.coverImage,
            publish: a.status === "PUBLISHED",
          }
        : EMPTY_FORM
    );
    setEditorKey((k) => k + 1);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditing(null);
    setCoverUploading(false);
  };

  const pickCover = async (file: File | null | undefined) => {
    if (!file) return;
    setCoverUploading(true);
    const saved = await uploadMedia(file, "article");
    setCoverUploading(false);
    if (saved) setForm((f) => ({ ...f, coverImage: saved.url }));
  };

  const saveArticle = async () => {
    if (saving) return;
    if (!form.title.trim()) return toast({ title: "عنوان مقاله الزامی است", variant: "destructive" });
    if (!form.content.trim()) return toast({ title: "متن مقاله خالی است", variant: "destructive" });
    setSaving(true);
    const body = {
      title: form.title.trim(),
      summary: form.summary.trim(),
      content: form.content,
      coverImage: form.coverImage,
    };
    let res;
    if (editing) {
      res = await patch(`/api/forums/${forum.id}/articles/${editing.id}`, {
        ...body,
        ...(form.publish && editing.status === "DRAFT" ? { publish: true } : {}),
        ...(!form.publish && editing.status === "PUBLISHED" ? { unpublish: true } : {}),
      });
    } else {
      res = await post(`/api/forums/${forum.id}/articles`, { ...body, publish: form.publish });
    }
    setSaving(false);
    if (res.success) {
      toast({ title: editing ? "مقاله به‌روزرسانی شد ✨" : form.publish ? "مقاله منتشر شد 🎉" : "پیش‌نویس ذخیره شد" });
      closeEditor();
      load();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const deleteArticle = async (a: ForumArticleDTO) => {
    const res = await del(`/api/forums/${forum.id}/articles/${a.id}`);
    if (res.success) {
      toast({ title: "مقاله حذف شد" });
      if (reading?.id === a.id) setReading(null);
      load();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  // ═══════════ نمای ۲: خواننده مقاله — هیرو شاخص + متن ساختارمند ═══════════
  if (reading) {
    return (
      <article className="overflow-hidden rounded-3xl border border-border/60 bg-card" dir="rtl">
        {/* هیرو: تصویر شاخص یا گرادیان نشریه‌ای */}
        <div className="relative">
          {reading.coverImage ? (
            <>
              { }
              <img
                src={reading.coverImage}
                alt={reading.title}
                className="h-52 w-full object-cover sm:h-72"
              />
              <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-card via-card/35 to-transparent" />
            </>
          ) : (
            <div className="h-36 w-full bg-gradient-to-br from-teal-500/20 via-sky-500/15 to-primary/25 sm:h-44">
              <div aria-hidden className="pattern-dots size-full opacity-25" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
            <button
              onClick={() => setReading(null)}
              className="relative mb-3 flex h-9 items-center gap-1.5 rounded-xl border border-border/60 bg-card/90 px-3 text-xs font-bold shadow-sm backdrop-blur transition-colors hover:bg-accent active:scale-95"
            >
              <ArrowRight className="size-4" />
              بازگشت به نشریه
            </button>
            <h2 className="relative max-w-3xl text-lg font-black leading-8 text-foreground drop-shadow sm:text-2xl sm:leading-10">
              {reading.title}
            </h2>
          </div>
        </div>

        {/* متادیتا */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-border/60 px-4 py-3 text-[11px] text-muted-foreground sm:px-6">
          <span>
            نویسنده: <span className="font-bold text-foreground/80">{reading.authorName || "رئیس انجمن"}</span>
          </span>
          {reading.publishedAt ? (
            <span className="tnum inline-flex items-center gap-1">
              <CalendarDays className="size-3" />
              {faDate(reading.publishedAt)}
            </span>
          ) : null}
          <span className="tnum inline-flex items-center gap-1">
            <Eye className="size-3" />
            {faNum(reading.views)} بازدید
          </span>
          {reading.status === "DRAFT" ? (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400">
              پیش‌نویس — فقط شما می‌بینید
            </span>
          ) : null}
          {forum.isChair ? (
            <span className="ms-auto flex gap-1.5">
              <Button onClick={() => openEditor(reading)} variant="outline" size="sm" className="h-7 rounded-lg px-2.5 text-[11px] font-bold">
                <Pencil className="size-3" />
                ویرایش
              </Button>
              <Button
                onClick={() => deleteArticle(reading)}
                variant="outline"
                size="sm"
                className="h-7 rounded-lg border-rose-500/30 px-2.5 text-[11px] font-bold text-rose-500 hover:bg-rose-500/10 hover:text-rose-400"
              >
                <Trash2 className="size-3" />
                حذف
              </Button>
            </span>
          ) : null}
        </div>

        {/* بدنه مقاله — تایپوگرافی نشریه‌ای */}
        <div className="p-4 sm:p-7">
          <ArticleContent content={reading.content || ""} />
        </div>
      </article>
    );
  }

  // ═══════════ نمای ۱: فهرست مقالات ═══════════
  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Newspaper className="size-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-black">نشریه انجمن</h3>
            <p className="text-[11px] text-muted-foreground">{faNum(articles?.length || 0)} مقاله</p>
          </div>
        </div>
        {forum.isChair ? (
          <Button onClick={() => openEditor()} size="sm" className="shahryar-gradient rounded-xl border-0 font-bold">
            <Plus className="size-4" />
            مقاله جدید
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-52 rounded-3xl" />
          ))}
        </div>
      ) : !articles || articles.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border/60 bg-card p-10 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
            <Newspaper className="size-8 text-muted-foreground" />
          </div>
          <p className="font-black">نشریه خالی است</p>
          <p className="max-w-sm text-sm leading-6 text-muted-foreground">
            {forum.isChair
              ? "اولین مقاله نشریه را با ویرایشگر حرفه‌ای بنویسید — تصویر شاخص، تیترها، تصاویر داخل متن و جدول پشتیبانی می‌شود."
              : "مقالات نشریه این انجمن به‌زودی اینجا منتشر می‌شود."}
          </p>
          {forum.isChair ? (
            <Button onClick={() => openEditor()} className="shahryar-gradient rounded-xl border-0 font-bold">
              <PenLine className="size-4" />
              نوشتن مقاله
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {articles.map((a) => (
            <article
              key={a.id}
              className="group flex flex-col overflow-hidden rounded-3xl border border-border/60 bg-card transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
            >
              <button onClick={() => openArticle(a)} className="relative block h-36 w-full overflow-hidden bg-muted text-right sm:h-40">
                {a.coverImage ? (
                  <>
                    { }
                    <img
                      src={a.coverImage}
                      alt={a.title}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                  </>
                ) : (
                  <div className="flex size-full items-center justify-center bg-gradient-to-br from-teal-500/15 via-sky-500/10 to-primary/20">
                    <Newspaper className="size-9 text-primary/50" />
                  </div>
                )}
                {a.status === "DRAFT" ? (
                  <span className="absolute top-2.5 start-2.5 rounded-full bg-amber-400/95 px-2.5 py-1 text-[9px] font-black text-amber-950 shadow-md backdrop-blur-sm">
                    پیش‌نویس
                  </span>
                ) : null}
                <span className="absolute bottom-2.5 end-2.5 tnum inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
                  <Eye className="size-3" />
                  {faNum(a.views)}
                </span>
              </button>
              <button onClick={() => openArticle(a)} className="flex min-w-0 flex-1 flex-col p-4 text-right">
                <h4 className="line-clamp-2 text-[15px] font-black leading-6 transition-colors group-hover:text-primary">
                  {a.title}
                </h4>
                {a.summary ? (
                  <p className="mt-1.5 line-clamp-2 min-h-10 text-xs leading-5 text-muted-foreground">{a.summary}</p>
                ) : (
                  <div className="min-h-10" aria-hidden />
                )}
                <div className="mt-2.5 flex items-center gap-3 border-t border-border/50 pt-2.5 text-[10px] text-muted-foreground/80">
                  <span className="font-bold text-foreground/70">{a.authorName || "رئیس انجمن"}</span>
                  {a.publishedAt ? <span className="tnum">{faDate(a.publishedAt)}</span> : null}
                </div>
              </button>
              {forum.isChair ? (
                <div className="flex gap-1.5 border-t border-border/60 p-3 pt-2.5">
                  <Button
                    onClick={() => openEditor(a)}
                    variant="outline"
                    size="sm"
                    className="h-8 flex-1 rounded-lg text-xs font-bold"
                  >
                    <Pencil className="size-3.5" />
                    ویرایش
                  </Button>
                  <Button
                    onClick={() => deleteArticle(a)}
                    variant="outline"
                    size="sm"
                    className="h-8 flex-1 rounded-lg border-rose-500/30 text-xs font-bold text-rose-500 hover:bg-rose-500/10 hover:text-rose-400"
                  >
                    <Trash2 className="size-3.5" />
                    حذف
                  </Button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      {/* ═══════════ نمای ۳: ویرایشگر تمام‌صفحه (رئیس) ═══════════ */}
      {editorOpen ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-background/98 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          dir="rtl"
        >
          {/* نوار بالا */}
          <div className="flex shrink-0 items-center gap-2 border-b border-border/60 bg-card px-3 py-2.5 sm:px-5">
            <FileEdit className="size-4.5 shrink-0 text-primary" />
            <h4 className="truncate text-sm font-black">{editing ? "ویرایش مقاله" : "مقاله جدید نشریه"}</h4>
            <span
              className={`hidden shrink-0 rounded-full px-2.5 py-0.5 text-[9px] font-bold sm:inline ${
                form.publish
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              }`}
            >
              {form.publish ? "منتشر می‌شود" : "پیش‌نویس"}
            </span>
            <div className="ms-auto flex items-center gap-2">
              <label className="flex h-9 cursor-pointer select-none items-center gap-2 rounded-xl border border-border/60 px-3 text-xs font-bold text-muted-foreground transition-colors hover:bg-accent">
                <input
                  type="checkbox"
                  checked={form.publish}
                  onChange={(e) => setForm({ ...form, publish: e.target.checked })}
                  className="size-4 accent-primary"
                />
                انتشار فوری
              </label>
              <Button onClick={saveArticle} disabled={saving} size="sm" className="shahryar-gradient rounded-xl border-0 px-4 font-bold">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-3.5" />}
                {editing ? "ذخیره تغییرات" : form.publish ? "انتشار مقاله" : "ذخیره پیش‌نویس"}
              </Button>
              <Button onClick={closeEditor} variant="outline" size="icon" className="size-9 shrink-0 rounded-xl" aria-label="بستن ویرایشگر">
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {/* بدنه اسکرول‌شونده */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-4xl space-y-4 p-3 sm:p-6">
              {/* تصویر شاخص */}
              <div className="rounded-2xl border border-border/60 bg-card p-3">
                <Label className="mb-2 flex items-center gap-1.5 text-xs font-bold">
                  <Sparkles className="size-3.5 text-primary" />
                  تصویر شاخص مقاله
                </Label>
                {form.coverImage ? (
                  <div className="group relative overflow-hidden rounded-xl">
                    { }
                    <img src={form.coverImage} alt="تصویر شاخص" className="h-40 w-full object-cover sm:h-52" />
                    <div className="absolute inset-x-0 bottom-0 flex justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-2.5">
                      <button
                        onClick={() => coverInputRef.current?.click()}
                        className="flex h-8 items-center gap-1.5 rounded-lg bg-white/20 px-3 text-[11px] font-bold text-white backdrop-blur-md transition-colors hover:bg-white/30"
                      >
                        <ImagePlus className="size-3.5" />
                        تعویض تصویر
                      </button>
                      <button
                        onClick={() => setForm({ ...form, coverImage: null })}
                        className="flex h-8 items-center gap-1.5 rounded-lg bg-rose-500/80 px-3 text-[11px] font-bold text-white backdrop-blur-md transition-colors hover:bg-rose-500"
                      >
                        <Trash2 className="size-3.5" />
                        حذف
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => coverInputRef.current?.click()}
                    disabled={coverUploading}
                    className="flex h-28 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/70 bg-muted/30 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary disabled:opacity-60"
                  >
                    {coverUploading ? (
                      <Loader2 className="size-6 animate-spin text-primary" />
                    ) : (
                      <ImagePlus className="size-6" />
                    )}
                    <span className="text-xs font-bold">
                      {coverUploading ? "در حال بارگذاری…" : "افزودن تصویر شاخص (در کارت و ابتدای مقاله نمایش داده می‌شود)"}
                    </span>
                  </button>
                )}
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                  className="hidden"
                  onChange={(e) => {
                    void pickCover(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                  aria-label="بارگذاری تصویر شاخص"
                />
              </div>

              {/* عنوان و خلاصه */}
              <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">عنوان مقاله *</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value.slice(0, 140) })}
                    placeholder="مثلاً گزارش جلسه خرداد انجمن"
                    className="rounded-xl text-sm font-bold"
                    maxLength={140}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">خلاصه (اختیاری — در کارت نشریه نمایش داده می‌شود)</Label>
                  <Input
                    value={form.summary}
                    onChange={(e) => setForm({ ...form, summary: e.target.value.slice(0, 300) })}
                    placeholder="یک جمله جذاب درباره مقاله"
                    className="rounded-xl text-sm"
                    maxLength={300}
                  />
                </div>
              </div>

              {/* ویرایشگر متن حرفه‌ای */}
              <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
                <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
                  <Label className="text-xs font-bold">متن مقاله *</Label>
                  <span className="text-[10px] text-muted-foreground">
                    تیتر، فهرست، نقل‌قول، جدول و تصویر داخل متن — با کشیدن گوشه‌های تصویر اندازه‌اش را تنظیم کنید
                  </span>
                </div>
                <ArticleEditor
                  key={editorKey}
                  markdown={form.content}
                  onChange={(md) => setForm((f) => ({ ...f, content: md }))}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
