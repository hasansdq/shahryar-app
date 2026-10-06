// ═════ مدیریت اصناف — CRUD کامل + آپلود تصویر و گالری ═════
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Store, Plus, Pencil, Trash2, Search, Star, BadgeCheck, Sparkles,
  ChevronLeft, ChevronRight, ImagePlus, X, Camera, Trash,
} from "lucide-react";
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
import { faNum, faRating } from "@/lib/client/persian";
import { uploadMedia } from "@/lib/client/media";
import { toast } from "@/hooks/use-toast";

interface Category {
  id: string; name: string; slug: string;
}
interface Business {
  id: string; name: string; description: string | null;
  categoryId: string; category: { name: string };
  ownerName: string | null; phone: string | null; phone2: string | null;
  email: string | null; address: string | null; district: string | null;
  services: string[]; workingHours: { display: string } | null;
  imageUrl: string | null; gallery: Array<{ url: string; name?: string }>;
  website: string | null; instagram: string | null;
  rating: number; reviewCount: number; viewCount: number;
  isVerified: boolean; isFeatured: boolean; isActive: boolean;
}

interface GalleryImage {
  url: string;
  name: string;
}

const EMPTY_FORM = {
  name: "", description: "", categoryId: "", ownerName: "", phone: "", phone2: "",
  email: "", address: "", district: "", servicesText: "", workingHours: "",
  website: "", instagram: "", imageUrl: "", isVerified: false, isFeatured: false, isActive: true,
};

export default function BusinessesTab() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Business | null>(null);
  const mainImageInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [uploadingMain, setUploadingMain] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  /** آپلود تصویر اصلی صنف */
  const handleMainImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingMain(true);
    const result = await uploadMedia(file, "business");
    if (result) setForm((f) => ({ ...f, imageUrl: result.url }));
    setUploadingMain(false);
  };

  /** آپلود چندتایی گالری تصاویر */
  const handleGallerySelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setUploadingGallery(true);
    for (const file of files.slice(0, 8)) {
      const result = await uploadMedia(file, "business");
      if (result) {
        setGallery((g) => [...g, { url: result.url, name: result.originalName }].slice(0, 12));
      }
    }
    setUploadingGallery(false);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "12" });
    if (query.trim()) params.set("q", query.trim());
    const res = await get<{
      businesses: Business[];
      pagination: { total: number; totalPages: number };
    }>(`/api/admin/businesses?${params}`);
    if (res.success && res.data) {
      setBusinesses(res.data.businesses);
      setTotalPages(res.data.pagination.totalPages);
      setTotal(res.data.pagination.total);
    }
    setLoading(false);
  }, [page, query]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    get<{ categories: Category[] }>("/api/admin/categories").then((res) => {
      if (res.success && res.data) setCategories(res.data.categories);
    });
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, categoryId: categories[0]?.id || "" });
    setGallery([]);
    setDialogOpen(true);
  };

  const openEdit = (b: Business) => {
    setEditingId(b.id);
    setForm({
      name: b.name,
      description: b.description || "",
      categoryId: b.categoryId,
      ownerName: b.ownerName || "",
      phone: b.phone || "",
      phone2: b.phone2 || "",
      email: b.email || "",
      address: b.address || "",
      district: b.district || "",
      servicesText: (b.services || []).join("\n"),
      workingHours: b.workingHours?.display || "",
      website: b.website || "",
      instagram: b.instagram || "",
      imageUrl: b.imageUrl || "",
      isVerified: b.isVerified,
      isFeatured: b.isFeatured,
      isActive: b.isActive,
    });
    setGallery(Array.isArray(b.gallery) ? b.gallery.map((g) => ({ url: g.url, name: g.name || "تصویر" })) : []);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.categoryId || saving) return;
    setSaving(true);
    const payload = {
      ...form,
      services: form.servicesText.split("\n").map((s) => s.trim()).filter(Boolean),
      gallery,
    };
    delete (payload as Partial<typeof payload>).servicesText;
    const res = editingId
      ? await patch(`/api/admin/businesses/${editingId}`, payload)
      : await post("/api/admin/businesses", payload);
    setSaving(false);
    if (res.success) {
      toast({ title: editingId ? "کسب‌وکار ویرایش شد" : "کسب‌وکار ثبت شد" });
      setDialogOpen(false);
      load();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const remove = async () => {
    if (!confirmDelete) return;
    const res = await del(`/api/admin/businesses/${confirmDelete.id}`);
    if (res.success) {
      toast({ title: "کسب‌وکار حذف شد" });
      setConfirmDelete(null);
      load();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-white">اصناف و کسب‌وکارها</h2>
          <p className="text-slate-400 text-sm mt-1">{faNum(total)} کسب‌وکار ثبت‌شده در سامانه</p>
        </div>
        <Button onClick={openCreate} className="shahryar-gradient text-white border-0 rounded-xl font-bold">
          <Plus className="w-4 h-4" />
          افزودن کسب‌وکار
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" style={{ width: 18, height: 18 }} />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          placeholder="جستجو در نام، مالک، تلفن..."
          className="pr-12 h-11 rounded-xl bg-slate-900/70 border-slate-800 text-white placeholder:text-slate-500"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : businesses.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-dashed border-slate-800">
          <Store className="w-12 h-12 mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400 text-sm">کسب‌وکاری یافت نشد</p>
        </div>
      ) : (
        <div className="space-y-3">
          {businesses.map((b) => (
            <div
              key={b.id}
              className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition-colors"
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-11 h-11 rounded-xl shahryar-gradient flex items-center justify-center shrink-0">
                  <Store className="w-5.5 h-5.5 text-white" style={{ width: 22, height: 22 }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-white font-bold text-sm">{b.name}</p>
                    {b.isVerified && <BadgeCheck className="w-4 h-4 text-blue-500" />}
                    {b.isFeatured && (
                      <Badge className="bg-amber-500/15 text-amber-400 border-0 text-[9px] gap-1">
                        <Sparkles className="w-3 h-3" /> ویژه
                      </Badge>
                    )}
                    {!b.isActive && (
                      <Badge className="bg-rose-500/15 text-rose-400 border-0 text-[9px]">غیرفعال</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-slate-400">
                    <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-400">{b.category.name}</Badge>
                    {b.district && <span>{b.district}</span>}
                    {b.phone && <span className="tnum" dir="ltr">{b.phone}</span>}
                    <span className="flex items-center gap-1 text-amber-400">
                      <Star className="w-3 h-3 fill-amber-400" />
                      {faRating(b.rating)} ({faNum(b.reviewCount)})
                    </span>
                    <span>{faNum(b.viewCount)} بازدید</span>
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(b)}
                    className="rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 h-9 w-9 p-0">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(b)}
                    className="rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 h-9 w-9 p-0">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* صفحه‌بندی */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}
            className="rounded-xl bg-slate-900 border-slate-800 text-slate-300">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="text-slate-400 text-sm tnum">
            صفحه {faNum(page)} از {faNum(totalPages)}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}
            className="rounded-xl bg-slate-900 border-slate-800 text-slate-300">
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* دیالوگ ثبت/ویرایش */}
      <AppDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        variant="admin"
        icon={Store}
        size="xl"
        locked={saving}
        title={editingId ? "ویرایش کسب‌وکار" : "افزودن کسب‌وکار جدید"}
        description="مشخصات صنف را برای دایرکتوری شهر ثبت کن"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="rounded-xl text-slate-400">انصراف</Button>
            <Button onClick={save} disabled={!form.name.trim() || !form.categoryId || saving}
              className="shahryar-gradient text-white border-0 rounded-xl font-bold min-w-28">
              {saving ? "در حال ذخیره..." : editingId ? "ذخیره تغییرات" : "ثبت کسب‌وکار"}
            </Button>
          </>
        }
      >
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-slate-300">نام کسب‌وکار *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="rounded-xl bg-slate-800/70 border-slate-700 text-white" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-slate-300">توضیحات</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="rounded-xl bg-slate-800/70 border-slate-700 text-white min-h-20" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">دسته‌بندی *</Label>
              <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                <SelectTrigger className="rounded-xl bg-slate-800/70 border-slate-700 text-white">
                  <SelectValue placeholder="انتخاب" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">نام مالک</Label>
              <Input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                className="rounded-xl bg-slate-800/70 border-slate-700 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">تلفن اصلی</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="rounded-xl bg-slate-800/70 border-slate-700 text-white" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">تلفن دوم</Label>
              <Input value={form.phone2} onChange={(e) => setForm({ ...form, phone2: e.target.value })}
                className="rounded-xl bg-slate-800/70 border-slate-700 text-white" dir="ltr" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-slate-300">آدرس</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="rounded-xl bg-slate-800/70 border-slate-700 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">محله</Label>
              <Input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })}
                className="rounded-xl bg-slate-800/70 border-slate-700 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">ساعات کاری</Label>
              <Input value={form.workingHours} onChange={(e) => setForm({ ...form, workingHours: e.target.value })}
                placeholder="مثلاً ۹ تا ۲۱" className="rounded-xl bg-slate-800/70 border-slate-700 text-white" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-slate-300">خدمات (هر خط یک مورد)</Label>
              <Textarea value={form.servicesText} onChange={(e) => setForm({ ...form, servicesText: e.target.value })}
                className="rounded-xl bg-slate-800/70 border-slate-700 text-white min-h-20" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">وب‌سایت</Label>
              <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })}
                className="rounded-xl bg-slate-800/70 border-slate-700 text-white" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">اینستاگرام</Label>
              <Input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                className="rounded-xl bg-slate-800/70 border-slate-700 text-white" dir="ltr" />
            </div>

            {/* ─── تصویر اصلی ─── */}
            <div className="space-y-2.5 sm:col-span-2">
              <Label className="text-slate-300">تصویر اصلی کسب‌وکار</Label>
              <input
                ref={mainImageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                onChange={handleMainImageSelect}
                className="hidden"
              />
              {form.imageUrl ? (
                <div className="relative inline-block group">
                  { }
                  <img
                    src={form.imageUrl}
                    alt="تصویر اصلی"
                    className="w-40 h-28 rounded-2xl object-cover border border-slate-700 shadow-lg group-hover:brightness-90 transition-all"
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
                  onClick={() => mainImageInputRef.current?.click()}
                  disabled={uploadingMain}
                  className="w-40 h-28 rounded-2xl border-2 border-dashed border-slate-700 hover:border-blue-500/60 hover:bg-blue-500/5 transition-all flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-blue-400"
                >
                  {uploadingMain ? (
                    <span className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                  ) : (
                    <ImagePlus className="w-7 h-7" />
                  )}
                  <span className="text-[11px]">{uploadingMain ? "در حال بارگذاری..." : "انتخاب تصویر اصلی"}</span>
                </button>
              )}
            </div>

            {/* ─── گالری تصاویر ─── */}
            <div className="space-y-2.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label className="text-slate-300">
                  گالری تصاویر {gallery.length > 0 && <span className="text-blue-400 tnum">({faNum(gallery.length)} تصویر)</span>}
                </Label>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={uploadingGallery || gallery.length >= 12}
                  className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
                >
                  {uploadingGallery ? (
                    <span className="w-3.5 h-3.5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                  {uploadingGallery ? "در حال بارگذاری..." : "افزودن تصویر"}
                </button>
              </div>
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                multiple
                onChange={handleGallerySelect}
                className="hidden"
              />
              {gallery.length === 0 ? (
                <p className="text-[11px] text-slate-500 border border-dashed border-slate-800 rounded-xl p-3 text-center">
                  هنوز تصویری در گالری نیست — تصاویر محیط، محصولات و ویترین کسب‌وکار را اضافه کنید (حداکثر ۱۲ تصویر)
                </p>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
                  {gallery.map((img, i) => (
                    <div key={img.url} className="relative group">
                      { }
                      <img
                        src={img.url}
                        alt={img.name}
                        className="w-full h-16 rounded-xl object-cover border border-slate-700 group-hover:brightness-90 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setGallery((g) => g.filter((_, idx) => idx !== i))}
                        className="absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 hover:scale-110 transition-all"
                        title="حذف از گالری"
                      >
                        <Trash className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="sm:col-span-2 flex flex-wrap gap-6 pt-2">
              <label className="flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer">
                <span>تأییدشده</span>
                <Switch checked={form.isVerified} onCheckedChange={(v) => setForm({ ...form, isVerified: v })} />
              </label>
              <label className="flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer">
                <span>ویژه</span>
                <Switch checked={form.isFeatured} onCheckedChange={(v) => setForm({ ...form, isFeatured: v })} />
              </label>
              <label className="flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer">
                <span>فعال</span>
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              </label>
            </div>
          </div>
      </AppDialog>

      {/* تأیید حذف */}
      <AppDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        variant="admin"
        icon={Trash2}
        size="sm"
        iconClassName="bg-gradient-to-br from-rose-500 to-red-600"
        title="حذف کسب‌وکار"
        description="این عمل قابل بازگشت نیست"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)} className="rounded-xl text-slate-400">انصراف</Button>
            <Button onClick={remove} className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl">حذف قطعی</Button>
          </>
        }
      >
          <p className="text-sm text-slate-400 leading-relaxed">
            آیا از حذف «{confirmDelete?.name}» مطمئن هستید؟ این عمل قابل بازگشت نیست و نظرات آن نیز حذف می‌شود.
          </p>
      </AppDialog>
    </div>
  );
}
