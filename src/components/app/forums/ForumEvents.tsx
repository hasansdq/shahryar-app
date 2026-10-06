// ═══ تقویم رویدادهای انجمن ═══
// پیش‌رو / گذشته — رئیس انجمن رویداد می‌سازد، ویرایش و حذف می‌کند
"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Clock, Loader2, MapPin, Pencil, Plus, Trash2, CalendarPlus, CalendarCheck2, CalendarX2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { del, get, post, patch } from "@/lib/client/api";
import { faDateTime, faNum } from "@/lib/client/persian";
import type { ForumDetailData, ForumEventDTO } from "@/lib/modules/forums/types";

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ForumEvents({ forum, onChanged }: { forum: ForumDetailData; onChanged: () => void }) {
  const [data, setData] = useState<{ upcoming: ForumEventDTO[]; past: ForumEventDTO[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ForumEventDTO | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", location: "", startsAt: "", endsAt: "" });

  const load = useCallback(async () => {
    const res = await get<{ upcoming: ForumEventDTO[]; past: ForumEventDTO[] }>(`/api/forums/${forum.id}/events`);
    if (res.success && res.data) setData(res.data);
    setLoading(false);
  }, [forum.id]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const openEditor = (event?: ForumEventDTO) => {
    setEditing(event || null);
    setForm({
      title: event?.title || "",
      description: event?.description || "",
      location: event?.location || "",
      startsAt: event ? toLocalInput(event.startsAt) : "",
      endsAt: event?.endsAt ? toLocalInput(event.endsAt) : "",
    });
    setEditorOpen(true);
  };

  const saveEvent = async () => {
    if (saving) return;
    if (!form.title.trim()) return toast({ title: "عنوان رویداد الزامی است", variant: "destructive" });
    if (!form.startsAt) return toast({ title: "زمان شروع الزامی است", variant: "destructive" });
    setSaving(true);
    const body = {
      title: form.title.trim(),
      description: form.description.trim(),
      location: form.location.trim(),
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
    };
    const res = editing
      ? await patch(`/api/forums/${forum.id}/events/${editing.id}`, body)
      : await post(`/api/forums/${forum.id}/events`, body);
    setSaving(false);
    if (res.success) {
      toast({ title: editing ? "رویداد به‌روزرسانی شد" : "رویداد ایجاد شد" });
      setEditorOpen(false);
      load();
      onChanged();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const deleteEvent = async (event: ForumEventDTO) => {
    const res = await del(`/api/forums/${forum.id}/events/${event.id}`);
    if (res.success) {
      toast({ title: "رویداد حذف شد" });
      load();
      onChanged();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    );
  }

  const upcoming = data?.upcoming || [];
  const past = data?.past || [];

  return (
    <div className="space-y-4" dir="rtl">
      {/* هدر + دکمه رئیس */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarDays className="size-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-black">تقویم رویدادها</h3>
            <p className="text-[11px] text-muted-foreground">{faNum(upcoming.length)} رویداد پیش‌رو</p>
          </div>
        </div>
        {forum.isChair ? (
          <Button onClick={() => openEditor()} size="sm" className="rounded-xl font-bold">
            <Plus className="size-4" />
            رویداد جدید
          </Button>
        ) : null}
      </div>

      {upcoming.length === 0 && past.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border/60 bg-card p-10 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
            <CalendarDays className="size-8 text-muted-foreground" />
          </div>
          <p className="font-black">هنوز رویدادی ثبت نشده</p>
          <p className="max-w-sm text-sm leading-6 text-muted-foreground">
            {forum.isChair
              ? "اولین رویداد انجمن را بسازید — جلسه، کارگاه یا همایش؛ برای همه اعضا نمایش داده می‌شود."
              : "رویدادهای این انجمن به‌زودی اینجا نمایش داده می‌شوند."}
          </p>
          {forum.isChair ? (
            <Button onClick={() => openEditor()} className="shahryar-gradient rounded-xl border-0 font-bold">
              <CalendarPlus className="size-4" />
              ساخت رویداد
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* رویدادهای پیش‌رو */}
      {upcoming.length > 0 ? (
        <section className="space-y-2.5">
          {upcoming.map((e) => (
            <EventCard key={e.id} event={e} isChair={forum.isChair} onEdit={() => openEditor(e)} onDelete={() => deleteEvent(e)} upcoming />
          ))}
        </section>
      ) : null}

      {/* رویدادهای گذشته */}
      {past.length > 0 ? (
        <section className="space-y-2.5">
          <p className="text-[11px] font-bold text-muted-foreground">رویدادهای برگزارشده</p>
          {past.slice(0, 6).map((e) => (
            <EventCard key={e.id} event={e} isChair={forum.isChair} onEdit={() => openEditor(e)} onDelete={() => deleteEvent(e)} />
          ))}
        </section>
      ) : null}

      {/* ═══ فرم رویداد (رئیس) ═══ */}
      {editorOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true">
          <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border/60 bg-card p-5 shadow-2xl sm:rounded-3xl" dir="rtl">
            <h4 className="mb-4 flex items-center gap-2 text-sm font-black">
              <CalendarPlus className="size-4.5 text-primary" />
              {editing ? "ویرایش رویداد" : "رویداد جدید انجمن"}
            </h4>
            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs">عنوان رویداد *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="مثلاً جلسه ماهانه انجمن"
                  className="rounded-xl"
                  maxLength={120}
                />
              </div>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">شروع *</Label>
                  <Input
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                    className="rounded-xl"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">پایان (اختیاری)</Label>
                  <Input
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                    className="rounded-xl"
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">مکان (اختیاری)</Label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="مثلاً سالن اجتماعات شهرداری"
                  className="rounded-xl"
                  maxLength={160}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">توضیحات (اختیاری)</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="درباره رویداد، برنامه و نکات مهم…"
                  className="min-h-20 rounded-xl text-sm"
                  maxLength={600}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button onClick={saveEvent} disabled={saving} className="flex-1 rounded-xl font-bold">
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <CalendarCheck2 className="size-4" />}
                  {editing ? "ذخیره تغییرات" : "ایجاد رویداد"}
                </Button>
                <Button onClick={() => setEditorOpen(false)} variant="outline" className="rounded-xl">
                  انصراف
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EventCard({
  event,
  isChair,
  onEdit,
  onDelete,
  upcoming,
}: {
  event: ForumEventDTO;
  isChair: boolean;
  onEdit: () => void;
  onDelete: () => void;
  upcoming?: boolean;
}) {
  return (
    <article
      className={`group rounded-2xl border p-4 transition-all ${
        upcoming
          ? "border-primary/25 bg-gradient-to-l from-primary/8 to-transparent hover:border-primary/40"
          : "border-border/60 bg-card opacity-75 hover:opacity-100"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-black leading-6">{event.title}</h4>
            {upcoming ? (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                پیش‌رو
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 tnum">
              <Clock className="size-3.5" />
              {faDateTime(event.startsAt)}
              {event.endsAt ? ` تا ${faDateTime(event.endsAt)}` : ""}
            </span>
            {event.location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                {event.location}
              </span>
            ) : null}
          </div>
          {event.description ? (
            <p className="mt-2 line-clamp-2 text-xs leading-6 text-muted-foreground">{event.description}</p>
          ) : null}
        </div>
        {isChair ? (
          <div className="flex shrink-0 gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
            <button
              onClick={onEdit}
              className="grid size-9 place-items-center rounded-xl border border-border/60 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95"
              aria-label="ویرایش رویداد"
            >
              <Pencil className="size-4" />
            </button>
            <button
              onClick={onDelete}
              className="grid size-9 place-items-center rounded-xl border border-rose-500/30 text-rose-500 transition-colors hover:bg-rose-500/10 active:scale-95"
              aria-label="حذف رویداد"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
