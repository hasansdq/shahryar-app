// ═════ مدیریت دسته‌بندی‌ها ═════
"use client";

import { useEffect, useState, useCallback } from "react";
import { FolderTree, Plus, Pencil, Trash2, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import AppDialog from "@/components/ui/app-dialog";
import { get, post, patch, del } from "@/lib/client/api";
import { faNum } from "@/lib/client/persian";
import { toast } from "@/hooks/use-toast";

interface Category {
  id: string; name: string; slug: string; icon: string; color: string;
  description: string | null; sortOrder: number; isActive: boolean;
  businessesCount: number;
}

export default function CategoriesTab() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: "", color: "#0e8a5a", description: "", sortOrder: 0, isActive: true });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await get<{ categories: Category[] }>("/api/admin/categories");
    if (res.success && res.data) setCategories(res.data.categories);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", color: "#0e8a5a", description: "", sortOrder: categories.length + 1, isActive: true });
    setDialogOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditing(c);
    setForm({ name: c.name, color: c.color, description: c.description || "", sortOrder: c.sortOrder, isActive: c.isActive });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    const res = editing
      ? await patch(`/api/admin/categories/${editing.id}`, form)
      : await post("/api/admin/categories", form);
    setSaving(false);
    if (res.success) {
      toast({ title: editing ? "دسته‌بندی ویرایش شد" : "دسته‌بندی ثبت شد" });
      setDialogOpen(false);
      load();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const remove = async (c: Category) => {
    const res = await del(`/api/admin/categories/${c.id}`);
    if (res.success) {
      toast({ title: "دسته‌بندی حذف شد" });
      load();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">دسته‌بندی اصناف</h2>
          <p className="text-slate-400 text-sm mt-1">{faNum(categories.length)} دسته‌بندی فعال</p>
        </div>
        <Button onClick={openCreate} className="shahryar-gradient text-white border-0 rounded-xl font-bold">
          <Plus className="w-4 h-4" />
          دسته‌بندی جدید
        </Button>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((c) => (
            <div
              key={c.id}
              className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: `${c.color}25`, color: c.color }}
                >
                  <FolderTree className="w-5.5 h-5.5" style={{ width: 22, height: 22 }} />
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(c)}
                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => remove(c)}
                    className="p-2 rounded-lg text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <h3 className="text-white font-bold mt-3">{c.name}</h3>
              {c.description && (
                <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">{c.description}</p>
              )}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800">
                <span className="text-xs text-slate-500">{faNum(c.businessesCount)} کسب‌وکار</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-lg ${
                  c.isActive ? "bg-blue-500/15 text-blue-400" : "bg-rose-500/15 text-rose-400"
                }`}>
                  {c.isActive ? "فعال" : "غیرفعال"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <AppDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        variant="admin"
        icon={Tags}
        size="md"
        locked={saving}
        title={editing ? "ویرایش دسته‌بندی" : "دسته‌بندی جدید"}
        description="دسته‌بندی‌های دایرکتوری اصناف شهر"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="rounded-xl text-slate-400">انصراف</Button>
            <Button onClick={save} disabled={!form.name.trim() || saving}
              className="shahryar-gradient text-white border-0 rounded-xl font-bold min-w-28">
              {saving ? "در حال ذخیره..." : "ذخیره"}
            </Button>
          </>
        }
      >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">نام *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="rounded-xl bg-slate-800/70 border-slate-700 text-white"
                placeholder="مثلاً رستوران و فست‌فود"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">توضیحات</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="rounded-xl bg-slate-800/70 border-slate-700 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-slate-300">رنگ</Label>
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-full h-10 rounded-xl bg-slate-800/70 border border-slate-700 cursor-pointer p-1"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">ترتیب</Label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                  className="rounded-xl bg-slate-800/70 border-slate-700 text-white"
                />
              </div>
            </div>
            <label className="flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer">
              <span>فعال</span>
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
            </label>
          </div>
      </AppDialog>
    </div>
  );
}
