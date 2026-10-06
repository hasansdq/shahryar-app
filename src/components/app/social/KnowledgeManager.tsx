// ═════ مدیر دانش ایجنت — تب پروفایل کاربری ═════
// منابع دانش ایجنت شخصی: متن خام یا فایل متنی (استخراج سمت کلاینت)
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bot, ChevronDown, FileText, FilePlus2, Loader2, Pencil, Plus, Sparkles, Trash2, Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { get, post, patch, del } from "@/lib/client/api";
import { faNum, faRelative } from "@/lib/client/persian";
import AppDialog from "@/components/ui/app-dialog";
import { Bot as BotIcon } from "lucide-react";

interface KnowledgeItemData {
  id: string;
  title: string;
  sourceType: "text" | "file";
  fileName: string | null;
  charCount: number;
  content: string;
  createdAt: string;
  updatedAt: string;
}

const MAX_CONTENT = 60000;
const TEXT_FILE_ACCEPT = ".txt,.md,.markdown,.csv,.tsv,.json,.xml,.html,.htm,.log,.yml,.yaml,.text";

export default function KnowledgeManager() {
  const [items, setItems] = useState<KnowledgeItemData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<KnowledgeItemData | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<KnowledgeItemData | null>(null);

  const load = async () => {
    const res = await get<{ items: KnowledgeItemData[] }>("/api/social/knowledge");
    if (res.success && res.data) setItems(res.data.items);
    setLoading(false);
  };

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, []);

  const removeItem = async () => {
    if (!confirmDelete) return;
    const res = await del(`/api/social/knowledge/${confirmDelete.id}`);
    if (res.success) {
      setItems((prev) => (prev ? prev.filter((i) => i.id !== confirmDelete.id) : prev));
      toast({ title: "منبع دانش حذف شد" });
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
    setConfirmDelete(null);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
    );
  }

  const list = items || [];
  const totalChars = list.reduce((s, i) => s + i.charCount, 0);

  return (
    <div className="space-y-4">
      {/* ═══ وضعیت ایجنت ═══ */}
      <div className="overflow-hidden rounded-3xl border border-violet-200/60 bg-gradient-to-l from-violet-50/80 to-transparent p-5 dark:border-violet-800/40 dark:from-violet-900/20">
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg">
            <BotIcon className="size-7" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="flex flex-wrap items-center gap-2 font-black">
              ایجنت هوشمند شما
              {list.length > 0 ? (
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                  فعال و دانش‌پرور
                </span>
              ) : (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  در انتظار دانش
                </span>
              )}
            </h3>
            <p className="mt-1.5 text-xs leading-6 text-muted-foreground">
              ایجنت شما نماینده‌ی دیجیتال‌تان در شبکه‌ی شهریار است؛ هر چه اینجا آموزشش دهید،
              بهتر شما را به کاربران معرفی می‌کند — رزومه، خدمات، دستاوردها، مقالات، قیمت‌ها و هر چیزی که دوست دارید مردم بدانند.
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-muted-foreground tnum">
              <span className="inline-flex items-center gap-1"><FileText className="size-3.5" />{faNum(list.length)} منبع</span>
              <span className="inline-flex items-center gap-1"><Type className="size-3.5" />{faNum(totalChars.toLocaleString("en-US"))} کاراکتر دانش</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ دکمه افزودن ═══ */}
      <Button
        onClick={() => setAddOpen(true)}
        className="w-full rounded-2xl bg-gradient-to-l from-violet-600 to-purple-600 border-0 font-black text-white hover:from-violet-700 hover:to-purple-700"
      >
        <Plus className="size-4" />
        آموزش دانش جدید به ایجنت
      </Button>

      {/* ═══ فهرست منابع ═══ */}
      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border/60 bg-card p-8 text-center">
          <Sparkles className="size-8 text-muted-foreground" />
          <p className="font-black">هنوز چیزی به ایجنتتان یاد نداده‌اید</p>
          <p className="max-w-sm text-xs leading-6 text-muted-foreground">
            با متن خام شروع کنید: توضیح خدمات‌تان را بنویسید یا رزومه را paste کنید.
            فایل‌های متنی (txt، md، csv، json…) هم پشتیبانی می‌شوند.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {list.map((item) => (
            <KnowledgeRow
              key={item.id}
              item={item}
              onEdit={() => setEditing(item)}
              onDelete={() => setConfirmDelete(item)}
            />
          ))}
        </div>
      )}

      {/* دیالوگ افزودن */}
      <AddKnowledgeDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={() => {
          setAddOpen(false);
          load();
        }}
      />

      {/* دیالوگ ویرایش */}
      {editing ? (
        <EditKnowledgeDialog
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      ) : null}

      {/* تأیید حذف */}
      <AppDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="حذف منبع دانش"
        description={confirmDelete ? `«${confirmDelete.title}» برای همیشه حذف می‌شود.` : ""}
        icon={Trash2}
        size="xs"
      >
        <div className="flex gap-2">
          <Button variant="destructive" onClick={removeItem} className="flex-1 rounded-xl font-bold">حذف کن</Button>
          <Button variant="outline" onClick={() => setConfirmDelete(null)} className="flex-1 rounded-xl">انصراف</Button>
        </div>
      </AppDialog>
    </div>
  );
}

/** ردیف منبع دانش با باز/بسته شدن — دکمه‌های ویرایش/حذف جدا از دکمه‌ی بازکردن */
function KnowledgeRow({
  item,
  onEdit,
  onDelete,
}: {
  item: KnowledgeItemData;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card transition-colors">
      <div className="flex items-center gap-2 p-3.5">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-right transition-colors"
        >
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${item.sourceType === "file" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" : "bg-primary/10 text-primary"}`}>
            {item.sourceType === "file" ? <FileText className="size-5" /> : <Type className="size-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black">{item.title}</p>
            <p className="tnum mt-0.5 truncate text-[11px] text-muted-foreground">
              {item.fileName ? `${item.fileName} · ` : ""}
              {faNum(item.charCount.toLocaleString("en-US"))} کاراکتر · {faRelative(item.updatedAt)}
            </p>
          </div>
          <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        <button
          onClick={onEdit}
          aria-label="ویرایش منبع"
          className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          onClick={onDelete}
          aria-label="حذف منبع"
          className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {open ? (
        <div className="border-t border-border/60 bg-muted/30 p-3.5">
          <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl bg-card p-3 text-[11px] leading-5 text-foreground/80" dir="auto">
            {item.content}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

/** دیالوگ افزودن دانش — متن یا فایل متنی */
function AddKnowledgeDialog({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const [mode, setMode] = useState<"text" | "file">("text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (saving) return;
    if (!title.trim()) {
      toast({ title: "عنوان منبع را بنویسید", variant: "destructive" });
      return;
    }
    if (!content.trim()) {
      toast({ title: mode === "file" ? "یک فایل متنی انتخاب کنید" : "متن دانش خالی است", variant: "destructive" });
      return;
    }
    setSaving(true);
    const res = await post("/api/social/knowledge", {
      title: title.trim(),
      content,
      sourceType: mode,
      fileName: mode === "file" ? fileName : undefined,
    });
    setSaving(false);
    if (res.success) {
      toast({ title: "به ایجنتتان آموزش داده شد 🎓", description: "از این پاسخ‌هایش دقیق‌تر می‌شود" });
      setTitle("");
      setContent("");
      setFileName(null);
      setMode("text");
      onAdded();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const handleFile = (file: File) => {
    setReading(true);
    setFileName(file.name);
    if (!title.trim()) {
      setTitle(file.name.replace(/\.[^.]+$/, "").slice(0, 80));
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      if (!text.trim()) {
        toast({ title: "فایل متنی خالی است", variant: "destructive" });
        setContent("");
      } else if (text.length > MAX_CONTENT) {
        setContent(text.slice(0, MAX_CONTENT));
        toast({ title: "متن بلند بود", description: `${faNum(MAX_CONTENT.toLocaleString("en-US"))} کاراکتر اول نگه داشته شد` });
      } else {
        setContent(text);
      }
      setReading(false);
    };
    reader.onerror = () => {
      setReading(false);
      toast({ title: "خواندن فایل ناموفق بود", variant: "destructive" });
    };
    reader.readAsText(file, "utf-8");
  };

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="آموزش دانش به ایجنت"
      description="هر چیزی که ایجنت باید درباره‌ی شما بداند — رزومه، خدمات، تخصص‌ها…"
      icon={Bot}
      size="lg"
    >
      <div className="space-y-4">
        {/* انتخاب روش */}
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/60 p-1.5">
          <button
            onClick={() => setMode("text")}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all ${
              mode === "text" ? "bg-card shadow text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Type className="size-4" />
            متن خام
          </button>
          <button
            onClick={() => setMode("file")}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all ${
              mode === "file" ? "bg-card shadow text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FilePlus2 className="size-4" />
            فایل متنی
          </button>
        </div>

        <div className="space-y-2">
          <Label>عنوان منبع *</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="مثلاً: رزومه‌ی من، خدمات و تعرفه‌ها، بیوگرافی حرفه‌ای…"
            className="rounded-xl"
          />
        </div>

        {mode === "text" ? (
          <div className="space-y-2">
            <Label>متن دانش *</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={MAX_CONTENT}
              className="min-h-40 rounded-xl"
              placeholder="اینجا بنویسید یا paste کنید…&#10;مثلاً: من ۵ سال تجربه‌ی طراحی لوگو دارم؛ با ابزارهای Illustrator و Figma کار می‌کنم و تا حالا برای ۳۰ برند در رفسنجان هویت بصری ساخته‌ام…"
            />
            <p className="text-left text-[10px] text-muted-foreground tnum">
              {faNum(content.length.toLocaleString("en-US"))} / {faNum(MAX_CONTENT.toLocaleString("en-US"))}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept={TEXT_FILE_ACCEPT}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) handleFile(f);
              }}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border/70 bg-muted/30 p-8 text-center transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              {reading ? (
                <Loader2 className="size-8 animate-spin text-primary" />
              ) : (
                <FilePlus2 className="size-8 text-muted-foreground" />
              )}
              <p className="text-sm font-bold">{fileName || "انتخاب فایل متنی"}</p>
              <p className="text-[11px] text-muted-foreground">
                txt، md، csv، json، html، log و… — متن فایل خوانده و ذخیره می‌شود
              </p>
            </button>
            {content ? (
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">
                  پیش‌نمایش ({faNum(content.length.toLocaleString("en-US"))} کاراکتر):
                </p>
                <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap text-[11px] leading-5 text-foreground/80" dir="auto">
                  {content.slice(0, 1500)}
                  {content.length > 1500 ? "\n…" : ""}
                </pre>
              </div>
            ) : null}
          </div>
        )}

        <Button
          onClick={submit}
          disabled={saving || reading || !title.trim() || !content.trim()}
          className="w-full rounded-xl bg-gradient-to-l from-violet-600 to-purple-600 border-0 font-black text-white hover:from-violet-700 hover:to-purple-700"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {saving ? "در حال آموزش…" : "آموزش به ایجنت"}
        </Button>
      </div>
    </AppDialog>
  );
}

/** دیالوگ ویرایش منبع */
function EditKnowledgeDialog({ item, onClose, onSaved }: { item: KnowledgeItemData; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    const res = await patch(`/api/social/knowledge/${item.id}`, { title, content });
    setSaving(false);
    if (res.success) {
      toast({ title: "منبع دانش به‌روزرسانی شد" });
      onSaved();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  return (
    <AppDialog
      open
      onClose={onClose}
      title="ویرایش منبع دانش"
      description={item.fileName || undefined}
      icon={Pencil}
      size="lg"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>عنوان</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className="rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label>محتوا</Label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={MAX_CONTENT}
            className="min-h-40 rounded-xl"
          />
          <p className="text-left text-[10px] text-muted-foreground tnum">
            {faNum(content.length.toLocaleString("en-US"))} / {faNum(MAX_CONTENT.toLocaleString("en-US"))}
          </p>
        </div>
        <Button onClick={submit} disabled={saving || !title.trim() || !content.trim()} className="shahryar-gradient w-full rounded-xl border-0 font-black">
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          ذخیره‌ی تغییرات
        </Button>
      </div>
    </AppDialog>
  );
}
