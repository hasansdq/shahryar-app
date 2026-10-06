// ═══ دیالوگ جزئیات لید — پروفایل کاربر + ترنسکریپت کامل + مدیریت ═══
// مشترک بین لیدهای ایجنت شخصی (scope=user) و لیدهای ایجنت انجمن (scope=forum):
// هدر کاربر با دکمه پروفایل، انتخابگر وضعیت گردش کار، یادداشت خصوصی،
// ترنسکریپت کامل گفتگو و حذف لید.
"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Magnet, Save, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import AppDialog from "@/components/ui/app-dialog";
import { toast } from "@/hooks/use-toast";
import { del, get, patch } from "@/lib/client/api";
import { useAppStore } from "@/lib/client/store";
import type { LeadMessageDTO, LeadStatus, LeadUserDTO } from "@/lib/modules/leads/service";
import {
  ForumRoleBadge,
  LeadMetaRow,
  LeadStatusBadge,
  LeadStatusPicker,
  LeadTranscript,
  LeadUserBlock,
} from "./lead-ui";

export interface LeadDetailData {
  lead: {
    id: string;
    user: LeadUserDTO;
    status: LeadStatus;
    note: string | null;
    messageCount: number;
    firstMessageAt: string;
    lastMessageAt: string;
    wasReset: boolean;
  };
  messages: LeadMessageDTO[];
}

const MAX_NOTE = 1000;

export default function LeadDetailDialog({
  open,
  onClose,
  scope,
  userId,
  forumId,
  onUpdated,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  /** user = لید ایجنت شخصی · forum = لید ایجنت انجمن */
  scope: "user" | "forum";
  userId: string | null;
  forumId?: string;
  /** پس از تغییر وضعیت/یادداشت — فهرست والد به‌روز شود */
  onUpdated?: () => void;
  onDeleted?: () => void;
}) {
  const { openUserProfile } = useAppStore();
  const [data, setData] = useState<LeadDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<LeadStatus>("NEW");
  const [note, setNote] = useState("");
  const [loadedNote, setLoadedNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const basePath = scope === "forum" && forumId ? `/api/forums/${forumId}/leads/${userId}` : `/api/social/leads/${userId}`;

  const load = useCallback(async () => {
    if (!userId || (scope === "forum" && !forumId)) return;
    setLoading(true);
    const res = await get<LeadDetailData>(basePath);
    if (res.success && res.data) {
      setData(res.data);
      setStatus(res.data.lead.status);
      setNote(res.data.lead.note || "");
      setLoadedNote(res.data.lead.note || "");
    } else {
      toast({ title: "خطا", description: res.error || "لید یافت نشد", variant: "destructive" });
    }
    setLoading(false);
  }, [basePath, userId, scope, forumId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- بارگذاری جزئیات لید با باز شدن دیالوگ (الگوی متعارف پروژه)
    if (open) load();
  }, [open, load]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    const res = await patch<{ status: LeadStatus; note: string | null }>(basePath, {
      status,
      note: note.trim() || null,
    });
    setSaving(false);
    if (res.success) {
      setLoadedNote(note.trim());
      setData((d) => (d ? { ...d, lead: { ...d.lead, status, note: note.trim() || null } } : d));
      toast({ title: "لید به‌روزرسانی شد", description: "وضعیت و یادداشت ذخیره شد" });
      onUpdated?.();
    } else {
      toast({ title: "ذخیره نشد", description: res.error, variant: "destructive" });
    }
  };

  const removeLead = async () => {
    if (deleting) return;
    setDeleting(true);
    const res = await del(basePath);
    setDeleting(false);
    if (res.success) {
      toast({ title: "لید حذف شد", description: "از فهرست لیدهای شما حذف شد" });
      onDeleted?.();
      onClose();
    } else {
      toast({ title: "حذف نشد", description: res.error, variant: "destructive" });
    }
  };

  const lead = data?.lead;
  const dirty = status !== lead?.status || note.trim() !== loadedNote;

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="جزئیات لید"
      description="پروفایل، گفتگوی کامل و وضعیت پیگیری"
      icon={Magnet}
      iconClassName="bg-gradient-to-br from-violet-500 to-purple-600"
      size="xl"
      locked={saving || deleting}
      headerExtra={lead ? <LeadStatusBadge status={lead.status} /> : undefined}
      footer={
        lead ? (
          <div className="flex w-full items-center gap-2">
            <Button
              variant="outline"
              onClick={removeLead}
              disabled={deleting}
              className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              size="sm"
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              حذف لید
            </Button>
            <div className="flex-1" />
            <Button variant="outline" onClick={onClose} disabled={saving} className="rounded-xl font-bold" size="sm">
              بستن
            </Button>
            <Button
              onClick={save}
              disabled={!dirty || saving}
              className="rounded-xl border-0 shahryar-gradient font-bold text-white"
              size="sm"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              ذخیره تغییرات
            </Button>
          </div>
        ) : undefined
      }
    >
      {loading || !lead ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">در حال بارگذاری جزئیات لید…</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* ─── کاربر لید ─── */}
          <div className="rounded-3xl border border-border/60 bg-gradient-to-l from-violet-500/5 to-transparent p-4 dark:from-violet-900/10">
            <LeadUserBlock
              user={lead.user}
              onOpenProfile={() => {
                onClose();
                openUserProfile(lead.user.userId);
              }}
              extra={
                scope === "forum" && lead.user.memberRole ? (
                  <ForumRoleBadge role={lead.user.memberRole} />
                ) : undefined
              }
            />
          </div>

          {/* ─── وضعیت پیگیری ─── */}
          <section className="space-y-2.5">
            <h4 className="text-xs font-black">وضعیت پیگیری</h4>
            <LeadStatusPicker value={status} onChange={setStatus} disabled={saving} />
          </section>

          {/* ─── آمار تماس ─── */}
          <LeadMetaRow
            messageCount={lead.messageCount}
            firstMessageAt={lead.firstMessageAt}
            lastMessageAt={lead.lastMessageAt}
          />

          {/* ─── یادداشت خصوصی ─── */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black">یادداشت خصوصی</h4>
              <span className="text-[10px] text-muted-foreground tnum">
                {note.length}/{MAX_NOTE}
              </span>
            </div>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE))}
              maxLength={MAX_NOTE}
              placeholder="مثال: علاقه‌مند به پروژه‌ی موبایل؛ شنبه تماس بگیرم — نمونه‌کار پسته را بفرستم…"
              className="min-h-24 rounded-2xl text-sm leading-6"
              dir="rtl"
            />
            <p className="text-[10px] leading-4 text-muted-foreground">
              این یادداشت فقط برای خودتان است؛ کاربر آن را نمی‌بیند.
            </p>
          </section>

          {/* ─── ترنسکریپت گفتگو ─── */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black">گفتگوی کامل با ایجنت</h4>
              {lead.wasReset ? (
                <span className="rounded-full border border-amber-300/60 bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/30 dark:text-amber-300">
                  بازنشانی‌شده توسط کاربر
                </span>
              ) : null}
            </div>
            <div className="max-h-80 overflow-y-auto overscroll-contain nice-scroll rounded-2xl">
              <LeadTranscript
                messages={data.messages}
                agentTheme={scope === "forum" ? "teal" : "violet"}
                wasReset={lead.wasReset}
                userLabel={lead.user.name}
              />
            </div>
          </section>

          {/* ─── اقدام بعدی ─── */}
          <div className="flex items-center gap-2.5 rounded-2xl border border-primary/20 bg-primary/5 p-3.5 text-[11px] leading-5 text-muted-foreground">
            <UserPlus className="size-4.5 shrink-0 text-primary" />
            <p>
              برای ارتباط مستقیم، پروفایل کاربر را باز کنید و از دکمه‌ی «گفتگو» پیام‌رسانی را شروع کنید؛
              ترنسکریپت ایجنت بهترین نقطه‌ی شروع مکالمه است.
            </p>
          </div>
        </div>
      )}
    </AppDialog>
  );
}
