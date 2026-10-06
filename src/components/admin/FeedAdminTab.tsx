// ═══ مدیریت فید شهریار — پست‌ها، گزارش‌ها و آمار جامع ═══
// تب جدید پنل مدیریت: مشاهده/حذف/بازیابی پست‌ها + بررسی گزارش‌های تخلف
"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle, Eye, EyeOff, FileText, Flag, Heart, Layers, Loader2, MessageSquare,
  Newspaper, Pin, RotateCcw, Search, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import AppDialog from "@/components/ui/app-dialog";
import { get, patch } from "@/lib/client/api";
import { faNum, faRelative } from "@/lib/client/persian";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AdminAttachment {
  kind: string;
  url: string;
  originalName: string;
  mime: string;
  size: number;
}

interface AdminPostRow {
  id: string;
  content: string;
  createdAt: string;
  deletedAt: string | null;
  editedAt: string | null;
  isPinned: boolean;
  likeCount: number;
  commentCount: number;
  attachments: AdminAttachment[];
  reports: Array<{ id: string; reason: string; note: string | null; createdAt: string; reporter: { fullName: string | null } }>;
  reportCount: number;
  author: {
    id: string; fullName: string | null; phone: string; avatarUrl: string | null;
    avatarColor: string; isVerified: boolean; status: string;
  };
}

interface AdminReportRow {
  id: string;
  reason: string;
  note: string | null;
  createdAt: string;
  reporter: { id: string; fullName: string | null };
  post: {
    id: string; content: string; deletedAt: string | null; createdAt: string;
    author: { id: string; fullName: string | null; phone: string; status: string };
  };
}

interface FeedAdminData {
  overview: {
    postsTotal: number; postsToday: number; postsWeek: number; likesTotal: number;
    commentsTotal: number; deletedTotal: number; pinnedTotal: number;
    openReports: number; activeAuthors7d: number; attachmentsTotal: number;
  };
  posts: AdminPostRow[];
  reports: AdminReportRow[];
  pagination: { page: number; total: number; totalPages: number };
}

const REPORT_LABELS: Record<string, string> = {
  spam: "هرزنامه",
  abusive: "توهین",
  inappropriate: "محتوای نامناسب",
  misinformation: "اطلاعات گمراه‌کننده",
  privacy: "نقض حریم خصوصی",
  other: "سایر",
};

const FILTERS = [
  { key: "all", label: "همه پست‌ها", icon: Newspaper },
  { key: "reported", label: "گزارش‌شده", icon: Flag },
  { key: "pinned", label: "سنجاق‌شده", icon: Pin },
  { key: "deleted", label: "حذف‌شده", icon: Trash2 },
] as const;

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${faNum((bytes / (1024 * 1024)).toFixed(1))}MB`;
  if (bytes >= 1024) return `${faNum(Math.round(bytes / 1024))}KB`;
  return `${faNum(bytes)}B`;
}

export default function FeedAdminTab() {
  const [data, setData] = useState<FeedAdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<"posts" | "reports">("posts");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminPostRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ filter, page: String(page) });
    if (query.trim()) params.set("q", query.trim());
    const res = await get<FeedAdminData>(`/api/admin/social-feed?${params.toString()}`);
    if (res.success && res.data) setData(res.data);
    setLoading(false);
  }, [filter, page, query]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const act = async (
    postId: string,
    body: Record<string, unknown>,
    done: string,
    reportId?: string
  ) => {
    setBusyId(reportId || postId);
    const res = await patch(`/api/admin/social-feed/${postId}`, body);
    setBusyId(null);
    if (res.success) {
      toast({ title: done });
      load();
    } else {
      toast({ title: "انجام نشد", description: res.error, variant: "destructive" });
    }
  };

  const o = data?.overview;
  const statCards = [
    { label: "کل پست‌ها", value: o?.postsTotal ?? 0, sub: `${faNum(o?.activeAuthors7d ?? 0)} نویسنده فعال ۷روز`, icon: Newspaper, color: "from-blue-500 to-indigo-600" },
    { label: "پست امروز", value: o?.postsToday ?? 0, sub: `${faNum(o?.postsWeek ?? 0)} این هفته`, icon: Layers, color: "from-cyan-500 to-sky-600" },
    { label: "پسندها", value: o?.likesTotal ?? 0, sub: `${faNum(o?.commentsTotal ?? 0)} دیدگاه`, icon: Heart, color: "from-rose-500 to-pink-600" },
    { label: "گزارش باز", value: o?.openReports ?? 0, sub: "نیازمند بررسی", icon: Flag, color: "from-amber-500 to-orange-600" },
    { label: "سنجاق‌شده", value: o?.pinnedTotal ?? 0, sub: `${faNum(o?.attachmentsTotal ?? 0)} پیوست`, icon: Pin, color: "from-violet-500 to-purple-600" },
    { label: "حذف‌شده", value: o?.deletedTotal ?? 0, sub: "قابل بازیابی", icon: Trash2, color: "from-slate-500 to-slate-600" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-white">فید شهریار</h2>
        <p className="text-slate-400 text-sm mt-1">مدیریت جامع پست‌های فید، پیوست‌ها و گزارش‌های تخلف</p>
      </div>

      {/* آمار کلی */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {statCards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3.5 hover:border-slate-700 transition-colors">
              <div className={cn("mb-2.5 grid size-9 place-items-center rounded-xl bg-gradient-to-br shadow-lg", c.color)}>
                <c.icon className="text-white" style={{ width: 18, height: 18 }} />
              </div>
              <p className="text-xl font-black text-white tnum">{faNum(c.value)}</p>
              <p className="text-[11px] font-bold text-slate-300 mt-0.5">{c.label}</p>
              <p className="text-[10px] text-slate-500 mt-1">{c.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ساب‌تب‌ها */}
      <div className="flex gap-1 rounded-2xl border border-slate-800 bg-slate-900/70 p-1">
        {([
          { id: "posts", label: "پست‌ها", icon: Newspaper },
          { id: "reports", label: `گزارش‌ها${o?.openReports ? ` (${faNum(o.openReports)})` : ""}`, icon: Flag },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-colors ${
              subTab === t.id ? "text-white shahryar-gradient" : "text-slate-400 hover:text-white"
            }`}
          >
            <t.icon className="size-4" />
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "posts" ? (
        <>
          {/* فیلترها + جستجو */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="جستجو در متن پست یا نام نویسنده…"
                className="h-10 rounded-xl border-slate-700 bg-slate-900/70 pe-4 ps-10 text-slate-100 placeholder:text-slate-500 focus-visible:border-blue-500"
              />
            </div>
            <div className="grid grid-cols-4 gap-1.5 md:flex">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => {
                    setFilter(f.key);
                    setPage(1);
                  }}
                  className={`flex h-10 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-all ${
                    filter === f.key
                      ? "border-transparent shahryar-gradient text-white shadow-lg"
                      : "border-slate-700 bg-slate-900/70 text-slate-400 hover:text-white"
                  }`}
                >
                  <f.icon className="size-3.5" />
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* لیست پست‌ها */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 rounded-2xl bg-slate-900/70" />
              ))}
            </div>
          ) : !data || data.posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-10 text-center text-sm text-slate-400">
              پستی با این فیلتر یافت نشد.
            </div>
          ) : (
            <div className="space-y-3">
              {data.posts.map((p) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"
                >
                  {/* نویسنده */}
                  <div className="flex items-center gap-3">
                    {p.author.avatarUrl ? (
                      <img src={p.author.avatarUrl} alt="" className="size-10 rounded-xl object-cover" />
                    ) : (
                      <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 text-sm font-bold text-white">
                        {(p.author.fullName || "ک").charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-white truncate">{p.author.fullName || "بی‌نام"}</p>
                        {p.author.isVerified ? <Badge className="h-4 bg-blue-600 text-[9px]">تأییدشده</Badge> : null}
                        {p.isPinned ? <Badge className="h-4 bg-amber-600 text-[9px] gap-0.5"><Pin style={{ width: 10, height: 10 }} />سنجاق</Badge> : null}
                        {p.deletedAt ? <Badge className="h-4 bg-rose-600 text-[9px]">حذف‌شده</Badge> : null}
                        {p.reportCount > 0 ? (
                          <Badge className="h-4 bg-orange-600 text-[9px] gap-0.5">
                            <AlertTriangle style={{ width: 10, height: 10 }} />
                            {faNum(p.reportCount)} گزارش
                          </Badge>
                        ) : null}
                        {p.editedAt ? <Badge className="h-4 bg-slate-600 text-[9px]">ویرایش‌شده</Badge> : null}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 tnum">
                        {p.author.phone} · {faRelative(p.createdAt)}
                      </p>
                    </div>
                    {/* آمار */}
                    <div className="flex shrink-0 items-center gap-3 text-[11px] text-slate-400">
                      <span className="inline-flex items-center gap-1 tnum"><Heart className="size-3.5 text-rose-400" />{faNum(p.likeCount)}</span>
                      <span className="inline-flex items-center gap-1 tnum"><MessageSquare className="size-3.5 text-sky-400" />{faNum(p.commentCount)}</span>
                      <span className="inline-flex items-center gap-1 tnum"><FileText className="size-3.5 text-violet-400" />{faNum(p.attachments.length)}</span>
                    </div>
                  </div>

                  {/* متن */}
                  <p className="mt-3 line-clamp-3 text-[13px] leading-6 text-slate-300 whitespace-pre-line">{p.content}</p>

                  {/* گزارش‌های باز */}
                  {p.reports.length > 0 ? (
                    <div className="mt-2.5 space-y-1.5">
                      {p.reports.slice(0, 2).map((r) => (
                        <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-orange-500/20 bg-orange-500/5 px-3 py-2">
                          <p className="text-[11px] text-orange-300 truncate">
                            🚩 {REPORT_LABELS[r.reason] || r.reason}
                            {r.reporter.fullName ? ` — ${r.reporter.fullName}` : ""}
                            {r.note ? `: «${r.note.slice(0, 60)}»` : ""}
                          </p>
                          <div className="flex shrink-0 gap-1.5">
                            <button
                              onClick={() => act(p.id, { reportId: r.id, reportAction: "dismiss" }, "گزارش رد شد", r.id)}
                              disabled={busyId === r.id}
                              className="rounded-lg border border-slate-700 px-2 py-1 text-[10px] font-bold text-slate-300 hover:text-white disabled:opacity-50"
                            >
                              رد
                            </button>
                            <button
                              onClick={() => act(p.id, { reportId: r.id, reportAction: "resolve" }, "گزارش بررسی‌شد", r.id)}
                              disabled={busyId === r.id}
                              className="rounded-lg border border-emerald-600/50 bg-emerald-600/10 px-2 py-1 text-[10px] font-bold text-emerald-400 hover:bg-emerald-600/20 disabled:opacity-50"
                            >
                              بررسی‌شد
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {/* اقدامات */}
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-800 pt-3">
                    <button
                      onClick={() => setDetail(p)}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-white"
                    >
                      <Eye className="size-3.5" />
                      مشاهده کامل
                    </button>
                    <div className="flex gap-2">
                      {p.isPinned ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busyId === p.id}
                          onClick={() => act(p.id, { action: "unpin" }, "سنجاش پست برداشته شد")}
                          className="h-8 rounded-lg border-amber-600/40 bg-amber-600/10 text-[11px] font-bold text-amber-400 hover:bg-amber-600/20"
                        >
                          <Pin className="size-3.5" />
                          برداشتن سنجاق
                        </Button>
                      ) : null}
                      {p.deletedAt ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busyId === p.id}
                          onClick={() => act(p.id, { action: "restore" }, "پست بازیابی شد")}
                          className="h-8 rounded-lg border-emerald-600/40 bg-emerald-600/10 text-[11px] font-bold text-emerald-400 hover:bg-emerald-600/20"
                        >
                          {busyId === p.id ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                          بازیابی
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busyId === p.id}
                          onClick={() => act(p.id, { action: "delete" }, "پست حذف شد")}
                          className="h-8 rounded-lg border-rose-600/40 bg-rose-600/10 text-[11px] font-bold text-rose-400 hover:bg-rose-600/20"
                        >
                          {busyId === p.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                          حذف پست
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* صفحه‌بندی */}
              {data.pagination.totalPages > 1 ? (
                <div className="flex items-center justify-center gap-3 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-xl border-slate-700 text-slate-300"
                  >
                    قبلی
                  </Button>
                  <span className="text-xs font-bold text-slate-400 tnum">
                    صفحه {faNum(data.pagination.page)} از {faNum(data.pagination.totalPages)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= data.pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded-xl border-slate-700 text-slate-300"
                  >
                    بعدی
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </>
      ) : (
        /* ═══ ساب‌تب گزارش‌ها ═══ */
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-24 rounded-2xl bg-slate-900/70" />
              ))}
            </div>
          ) : !data || data.reports.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-10 text-center">
              <Flag className="mx-auto mb-2 size-8 text-slate-600" />
              <p className="text-sm text-slate-400">گزارش بازیابی‌نشده‌ای وجود ندارد — عالی! 🎉</p>
            </div>
          ) : (
            data.reports.map((r) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-orange-600 text-[10px]">{REPORT_LABELS[r.reason] || r.reason}</Badge>
                  <p className="text-[11px] text-slate-400 tnum">
                    گزارش‌دهنده: {r.reporter.fullName || "بی‌نام"} · {faRelative(r.createdAt)}
                  </p>
                  {r.post.deletedAt ? <Badge className="bg-rose-600 text-[10px]">پست حذف‌شده</Badge> : null}
                </div>
                <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-[11px] font-bold text-slate-300">
                    نویسنده پست: {r.post.author.fullName || "بی‌نام"} ({r.post.author.phone})
                  </p>
                  <p className="mt-1.5 line-clamp-3 text-[12px] leading-6 text-slate-400 whitespace-pre-line">{r.post.content}</p>
                </div>
                {r.note ? (
                  <p className="mt-2 text-[11px] text-orange-300">یادداشت گزارش‌دهنده: «{r.note}»</p>
                ) : null}
                <div className="mt-3 flex items-center justify-end gap-2">
                  {!r.post.deletedAt ? (
                    <Button
                      size="sm"
                      disabled={busyId === r.id}
                      onClick={() => act(r.post.id, { action: "delete" }, "پست حذف و گزارش بسته شد", r.id)}
                      className="h-8 rounded-lg bg-rose-600 text-[11px] font-bold text-white hover:bg-rose-700"
                    >
                      {busyId === r.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                      حذف پست
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId === r.id}
                    onClick={() => act(r.post.id, { reportId: r.id, reportAction: "dismiss" }, "گزارش رد شد", r.id)}
                    className="h-8 rounded-lg border-slate-700 text-[11px] font-bold text-slate-300 hover:text-white"
                  >
                    <X className="size-3.5" />
                    رد گزارش
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId === r.id}
                    onClick={() => act(r.post.id, { reportId: r.id, reportAction: "resolve" }, "گزارش بررسی‌شد", r.id)}
                    className="h-8 rounded-lg border-emerald-600/40 bg-emerald-600/10 text-[11px] font-bold text-emerald-400 hover:bg-emerald-600/20"
                  >
                    <Eye className="size-3.5" />
                    بررسی‌شد (بدون حذف)
                  </Button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* ─── دیالوگ مشاهده کامل پست ─── */}
      <AppDialog
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="جزئیات پست"
        icon={Newspaper}
        variant="admin"
        size="lg"
        footer={
          detail ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 text-[11px] text-slate-400 tnum">
                <span className="inline-flex items-center gap-1"><Heart className="size-3.5 text-rose-400" />{faNum(detail.likeCount)} پسند</span>
                <span className="inline-flex items-center gap-1"><MessageSquare className="size-3.5 text-sky-400" />{faNum(detail.commentCount)} دیدگاه</span>
                <span className="inline-flex items-center gap-1"><FileText className="size-3.5 text-violet-400" />{faNum(detail.attachments.length)} پیوست</span>
              </div>
              {detail.deletedAt ? (
                <Button
                  size="sm"
                  disabled={busyId === detail.id}
                  onClick={() => {
                    void act(detail.id, { action: "restore" }, "پست بازیابی شد");
                    setDetail(null);
                  }}
                  className="h-8 rounded-lg bg-emerald-600 text-[11px] font-bold text-white hover:bg-emerald-700"
                >
                  <RotateCcw className="size-3.5" />
                  بازیابی پست
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={busyId === detail.id}
                  onClick={() => {
                    void act(detail.id, { action: "delete" }, "پست حذف شد");
                    setDetail(null);
                  }}
                  className="h-8 rounded-lg bg-rose-600 text-[11px] font-bold text-white hover:bg-rose-700"
                >
                  <Trash2 className="size-3.5" />
                  حذف پست
                </Button>
              )}
            </div>
          ) : null
        }
      >
        {detail ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {detail.author.avatarUrl ? (
                <img src={detail.author.avatarUrl} alt="" className="size-11 rounded-xl object-cover" />
              ) : (
                <div className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 font-bold text-white">
                  {(detail.author.fullName || "ک").charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white">{detail.author.fullName || "بی‌نام"}</p>
                <p className="text-[11px] text-slate-500 tnum">{detail.author.phone} · {faRelative(detail.createdAt)}</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
              <p className="whitespace-pre-line text-[13px] leading-7 text-slate-200">{detail.content}</p>
            </div>

            {detail.attachments.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-bold text-slate-400">پیوست‌ها:</p>
                <div className="space-y-2">
                  {detail.attachments.map((a, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-2.5">
                      {a.kind === "image" ? (
                        <img src={a.url} alt="" className="size-12 rounded-lg object-cover" />
                      ) : (
                        <div className="grid size-12 place-items-center rounded-lg bg-slate-800">
                          <FileText className="size-5 text-slate-400" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-slate-300" dir="auto">{a.originalName}</p>
                        <p className="text-[10px] text-slate-500 tnum">
                          {a.kind === "image" ? "تصویر" : a.kind === "video" ? "ویدیو" : a.kind === "audio" ? "صوت" : "فایل"} · {fmtSize(a.size)} · {a.mime}
                        </p>
                      </div>
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 hover:text-white"
                      >
                        باز کردن
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {detail.reports.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-bold text-orange-400">گزارش‌های این پست:</p>
                <div className="space-y-1.5">
                  {detail.reports.map((r) => (
                    <div key={r.id} className="rounded-xl border border-orange-500/20 bg-orange-500/5 px-3 py-2 text-[11px] text-orange-300">
                      🚩 {REPORT_LABELS[r.reason] || r.reason} — {r.reporter.fullName || "بی‌نام"}
                      {r.note ? `: «${r.note}»` : ""}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </AppDialog>
    </div>
  );
}
