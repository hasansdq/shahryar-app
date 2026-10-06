// ═════ پایگاه دانش شهری — مدیریت محتوای شهر + تصویر ═════
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Newspaper, Plus, Pencil, Trash2, Pin, PinOff, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import AppDialog from "@/components/ui/app-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { get, post, patch, del } from "@/lib/client/api";
import { faNum, faDate, LABELS } from "@/lib/client/persian";
import { uploadMedia } from "@/lib/client/media";
import { toast } from "@/hooks/use-toast";

interface CityItem {
  id: string; category: string; title: string; content: string;
  summary: string | null; source: string | null; imageUrl: string | null;
  isPinned: boolean; isPublished: boolean; publishedAt: string;
}

const EMPTY = { category: "news", title: "", content: "", summary: "", source: "", imageUrl: "", isPinned: false, isPublished: true };

export default function CityDataTab() {
  const [items, setItems] = useState<CityItem[]>([]);
  const [stats, setStats] = useState<Array<{ category: string; _count: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CityItem | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  /** آپلود تصویر رکورد شهری با موتور یکپارچه */
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingImage(true);
    const result = await uploadMedia(file, "city");
    if (result) setForm((f) => ({ ...f, imageUrl: result.url }));
    setUploadingImage(false);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const res = await get<{ items: CityItem[]; stats: Array<{ category: string; _count: number }> }>(
      `/api/admin/city-data${filter !== "all" ? `?category=${filter}` : ""}`
    );
    if (res.success && res.data) {
      setItems(res.data.items);
      setStats(res.data.stats);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setDialogOpen(true);
  };

  const openEdit = (item: CityItem) => {
    setEditing(item);
    setForm({
      category: item.category,
      title: item.title,
      content: item.content,
      summary: item.summary || "",
      source: item.source || "",
      imageUrl: item.imageUrl || "",
      isPinned: item.isPinned,
      isPublished: item.isPublished,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.content.trim() || saving) return;
    setSaving(true);
    const res = editing
      ? await patch(`/api/admin/city-data/${editing.id}`, form)
      : await post("/api/admin/city-data", form);
    setSaving(false);
    if (res.success) {
      toast({ title: editing ? "رکورد ویرایش شد" : "رکورد ثبت شد" });
      setDialogOpen(false);
      load();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const togglePin = async (item: CityItem) => {
    const res = await patch(`/api/admin/city-data/${item.id}`, { isPinned: !item.isPinned });
    if (res.success) load();
  };

  const remove = async (item: CityItem) => {
    const res = await del(`/api/admin/city-data/${item.id}`);
    if (res.success) {
      toast({ title: "رکورد حذف شد" });
      load();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-white">پایگاه دانش شهری</h2>
          <p className="text-slate-400 text-sm mt-1">
            {faNum(items.length)} رکورد · {stats.map((s) => `${faNum(s._count)} ${LABELS.cityCategories[s.category] || s.category}`).join(" · ")}
          </p>
        </div>
        <Button onClick={openCreate} className="shahryar-gradient text-white border-0 rounded-xl font-bold">
          <Plus className="w-4 h-4" />
          رکورد جدید
        </Button>
      </div>

      {/* فیلتر */}
      <div className="flex gap-1.5 flex-wrap">
        {["all", ...Object.keys(LABELS.cityCategories)].map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filter === c
                ? "shahryar-gradient text-white shadow"
                : "bg-slate-900/70 border border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {c === "all" ? "همه" : LABELS.cityCategories[c]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-dashed border-slate-800">
          <Newspaper className="w-12 h-12 mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400 text-sm">رکوردی یافت نشد</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={`text-[9px] border-0 ${
                      item.category === "news" ? "bg-blue-500/15 text-blue-400"
                      : item.category === "event" ? "bg-violet-500/15 text-violet-400"
                      : item.category === "announcement" ? "bg-amber-500/15 text-amber-400"
                      : item.category === "service" ? "bg-sky-500/15 text-sky-400"
                      : "bg-pink-500/15 text-pink-400"
                    }`}>
                      {LABELS.cityCategories[item.category]}
                    </Badge>
                    {item.isPinned && (
                      <Badge className="text-[9px] border-0 bg-amber-500/15 text-amber-400 gap-1">
                        <Pin className="w-2.5 h-2.5" /> سنجاق‌شده
                      </Badge>
                    )}
                    {!item.isPublished && (
                      <Badge className="text-[9px] border-0 bg-rose-500/15 text-rose-400">پیش‌نویس</Badge>
                    )}
                    <span className="text-[10px] text-slate-500">{faDate(item.publishedAt)}</span>
                  </div>
                  <p className="text-white font-bold text-sm mt-2">{item.title}</p>
                  <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">{item.summary || item.content}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => togglePin(item)}
                    className={`p-2 rounded-lg transition-colors ${
                      item.isPinned ? "text-amber-400 hover:bg-amber-500/10" : "text-slate-400 hover:text-amber-400 hover:bg-slate-800"
                    }`}
                    title={item.isPinned ? "برداشتن سنجاق" : "سنجاق‌کردن"}
                  >
                    {item.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => openEdit(item)}
                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => remove(item)}
                    className="p-2 rounded-lg text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* دیالوگ ثبت/ویرایش */}
      <AppDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        variant="admin"
        icon={Newspaper}
        size="lg"
        locked={saving}
        title={editing ? "ویرایش رکورد" : "رکورد جدید پایگاه دانش"}
        description="خبر، رویداد یا اطلاعیه‌ی شهری"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="rounded-xl text-slate-400">انصراف</Button>
            <Button onClick={save} disabled={!form.title.trim() || !form.content.trim() || saving}
              className="shahryar-gradient text-white border-0 rounded-xl font-bold min-w-28">
              {saving ? "در حال ذخیره..." : "ذخیره"}
            </Button>
          </>
        }
      >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-slate-300">دسته</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="rounded-xl bg-slate-800/70 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {Object.entries(LABELS.cityCategories).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">منبع (اختیاری)</Label>
                <Input
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  className="rounded-xl bg-slate-800/70 border-slate-700 text-white"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">عنوان *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="rounded-xl bg-slate-800/70 border-slate-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">خلاصه (برای نمایش در داشبورد و هوشیار)</Label>
              <Input
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                className="rounded-xl bg-slate-800/70 border-slate-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">محتوای کامل *</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                className="rounded-xl bg-slate-800/70 border-slate-700 text-white min-h-36"
              />
            </div>

            {/* تصویر رکورد */}
            <div className="space-y-2.5">
              <Label className="text-slate-300">تصویر (اختیاری)</Label>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                onChange={handleImageSelect}
                className="hidden"
              />
              {form.imageUrl ? (
                <div className="relative inline-block group">
                  { }
                  <img
                    src={form.imageUrl}
                    alt="تصویر رکورد"
                    className="w-44 h-28 rounded-2xl object-cover border border-slate-700 shadow-lg group-hover:brightness-90 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, imageUrl: "" })}
                    className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                    title="حذف تصویر"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="w-44 h-28 rounded-2xl border-2 border-dashed border-slate-700 hover:border-blue-500/60 hover:bg-blue-500/5 transition-all flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-blue-400"
                >
                  {uploadingImage ? (
                    <span className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                  ) : (
                    <ImagePlus className="w-7 h-7" />
                  )}
                  <span className="text-[11px]">{uploadingImage ? "در حال بارگذاری..." : "انتخاب تصویر"}</span>
                </button>
              )}
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer">
                <span>سنجاق در بالای داشبورد</span>
                <Switch checked={form.isPinned} onCheckedChange={(v) => setForm({ ...form, isPinned: v })} />
              </label>
              <label className="flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer">
                <span>انتشار</span>
                <Switch checked={form.isPublished} onCheckedChange={(v) => setForm({ ...form, isPublished: v })} />
              </label>
            </div>
          </div>
      </AppDialog>
    </div>
  );
}
