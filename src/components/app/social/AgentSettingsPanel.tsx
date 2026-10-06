// ═════ پنل مدیریت و شخصی‌سازی ایجنت — تب «ایجنت من» در پروفایل ═════
// کنترل کامل ایجنت شخصی: روشن/خاموش، هویت (نام + خوش‌آمدگویی)، سبک صحبت،
// دستورالعمل‌ها، موضوعات ممنوعه، سؤال‌های پیشنهادی + پیش‌نمایش زنده چت
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot, BookOpen, Sparkles, Loader2, Save, Send, Plus, Trash2, Power,
  MessageCircle, PenLine, Megaphone, Microscope, Palette, ShieldAlert,
  FileText, HelpCircle, RotateCcw, Magnet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { get, post, put } from "@/lib/client/api";
import { faNum } from "@/lib/client/persian";
import { useAppStore } from "@/lib/client/store";
import {
  AGENT_STYLE_OPTIONS,
  AGENT_SETTINGS_DEFAULTS,
  type AgentSettings,
  type AgentStyleKey,
} from "@/lib/modules/social/types";

const STYLE_ICONS: Record<AgentStyleKey, typeof Bot> = {
  professional: PenLine,
  friendly: MessageCircle,
  marketing: Megaphone,
  technical: Microscope,
  creative: Palette,
};

const MAX_NAME = 40;
const MAX_GREETING = 300;
const MAX_INSTRUCTIONS = 1500;
const MAX_FORBIDDEN = 600;
const MAX_QUESTIONS = 4;

interface ProfileResponse {
  profile: {
    agent: {
      enabled: boolean;
      name: string | null;
      greeting: string | null;
      style: string;
      instructions: string | null;
      forbidden: string | null;
      useProfile: boolean;
      suggestHandoff: boolean;
      questions: string[];
    };
  } | null;
  agentStats: { items: number; totalChars: number };
}

export default function AgentSettingsPanel({ onOpenLeads }: { onOpenLeads?: () => void }) {
  const { user, setView } = useAppStore();
  const [settings, setSettings] = useState<AgentSettings>(AGENT_SETTINGS_DEFAULTS);
  const [stats, setStats] = useState<{ items: number; totalChars: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const loadedRef = useRef<AgentSettings | null>(null);

  const firstName = (user?.fullName || "ش").split(" ")[0];
  const defaultName = `ایجنتِ ${firstName}`;

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await get<ProfileResponse>("/api/social/profile");
      if (!active) return;
      if (res.success && res.data) {
        const a = res.data.profile?.agent;
        const s: AgentSettings = {
          enabled: a?.enabled !== false,
          name: a?.name || "",
          greeting: a?.greeting || "",
          style: (a?.style as AgentStyleKey) || "professional",
          instructions: a?.instructions || "",
          forbidden: a?.forbidden || "",
          useProfile: a?.useProfile !== false,
          suggestHandoff: a?.suggestHandoff !== false,
          questions: Array.isArray(a?.questions) ? a.questions.slice(0, MAX_QUESTIONS) : [],
        };
        setSettings(s);
        loadedRef.current = s;
        setStats(res.data.agentStats);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const update = <K extends keyof AgentSettings>(key: K, value: AgentSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      setDirty(JSON.stringify(next) !== JSON.stringify(loadedRef.current));
      return next;
    });
  };

  const setQuestion = (i: number, value: string) => {
    setSettings((prev) => {
      const questions = [...prev.questions];
      questions[i] = value.slice(0, 80);
      const next = { ...prev, questions };
      setDirty(JSON.stringify(next) !== JSON.stringify(loadedRef.current));
      return next;
    });
  };

  const addQuestion = () => {
    if (settings.questions.length >= MAX_QUESTIONS) return;
    update("questions", [...settings.questions, ""]);
  };

  const removeQuestion = (i: number) => {
    update(
      "questions",
      settings.questions.filter((_, idx) => idx !== i)
    );
  };

  const resetToDefaults = () => {
    const cleared: AgentSettings = {
      ...AGENT_SETTINGS_DEFAULTS,
      enabled: settings.enabled, // وضعیت روشن/خاموش دست‌نخورده می‌ماند
    };
    setSettings(cleared);
    setDirty(true);
    toast({ title: "بازگشت به پیش‌فرض‌ها", description: "برای اعمال، ذخیره کنید" });
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    const res = await put("/api/social/profile", {
      agent: {
        enabled: settings.enabled,
        name: settings.name.trim() || null,
        greeting: settings.greeting.trim() || null,
        style: settings.style,
        instructions: settings.instructions.trim() || null,
        forbidden: settings.forbidden.trim() || null,
        useProfile: settings.useProfile,
        suggestHandoff: settings.suggestHandoff,
        questions: settings.questions.map((q) => q.trim()).filter(Boolean),
      },
    });
    setSaving(false);
    if (res.success) {
      const saved = { ...settings, questions: settings.questions.map((q) => q.trim()).filter(Boolean) };
      loadedRef.current = saved;
      setSettings(saved);
      setDirty(false);
      toast({ title: "تنظیمات ایجنت ذخیره شد 🎓", description: "از همین لحظه روی پاسخ‌هایش اعمال می‌شود" });
    } else {
      toast({ title: "خطا در ذخیره", description: res.error, variant: "destructive" });
    }
  };

  /** آزمایش ایجنت — ساخت گفتگوی self-agent و پرش به شهریار */
  const testAgent = async () => {
    if (!user?.id) return;
    const res = await post<{ conversationId: string }>("/api/social/conversations", {
      type: "agent",
      userId: user.id,
    });
    if (res.success && res.data) {
      sessionStorage.setItem("social:openChat", res.data.conversationId);
      setView("social");
    } else {
      toast({ title: "شروع گفتگو با ایجنت خودت ممکن نشد", description: res.error, variant: "destructive" });
    }
  };

  const agentDisplayName = settings.name.trim() || defaultName;
  const completion = useMemo(() => {
    // سنجه کامل‌بودن شخصی‌سازی (برای نمایش انگیزشی)
    const checks = [
      stats && stats.items > 0, // دانش دارد؟
      Boolean(settings.name.trim()), // نام اختصاصی
      Boolean(settings.greeting.trim()), // خوش‌آمدگویی
      Boolean(settings.instructions.trim()), // دستورالعمل
      settings.questions.filter((q) => q.trim()).length >= 2, // حداقل ۲ سؤال پیشنهادی
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [settings, stats]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-2">
      {/* ═══ کارت وضعیت ایجنت ═══ */}
      <div
        className={`relative overflow-hidden rounded-3xl border p-5 transition-colors ${
          settings.enabled
            ? "border-violet-200/60 bg-gradient-to-l from-violet-50/80 to-transparent dark:border-violet-800/40 dark:from-violet-900/20"
            : "border-border/60 bg-muted/30"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <div
              className={`flex size-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg transition-all ${
                settings.enabled
                  ? "bg-gradient-to-br from-violet-500 to-purple-600 shadow-violet-500/25"
                  : "bg-muted-foreground/40"
              }`}
            >
              <Bot className="size-7" />
            </div>
            <div className="min-w-0">
              <h3 className="flex flex-wrap items-center gap-2 font-black" dir="auto">
                {agentDisplayName}
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    settings.enabled
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {settings.enabled ? "فعال و در خدمت" : "موقتاً خاموش"}
                </span>
              </h3>
              <p className="mt-1.5 text-xs leading-6 text-muted-foreground">
                {settings.enabled
                  ? `نماینده‌ی دیجیتال شما در شبکه‌ی شهریار — به سؤالات کاربران درباره‌ی مهارت‌ها و خدمات‌تان پاسخ می‌دهد.`
                  : `کاربران نمی‌توانند با ایجنت شما گفتگو کنند تا دوباره روشنش کنید؛ پروفایل شما دست‌نخورده می‌ماند.`}
              </p>
              {stats ? (
                <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-muted-foreground tnum">
                  <span className="inline-flex items-center gap-1">
                    <FileText className="size-3.5" />
                    {faNum(stats.items)} منبع دانش
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <BookOpen className="size-3.5" />
                    {faNum(stats.totalChars.toLocaleString("en-US"))} کاراکتر
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Sparkles className="size-3.5" />
                    شخصی‌سازی {faNum(String(completion))}٪
                  </span>
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Label className="text-[11px] font-bold text-muted-foreground">
              {settings.enabled ? "روشن" : "خاموش"}
            </Label>
            <Switch checked={settings.enabled} onCheckedChange={(v) => update("enabled", v)} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={testAgent}
            disabled={!settings.enabled}
            className="rounded-xl bg-gradient-to-l from-violet-600 to-purple-600 border-0 font-bold text-white hover:from-violet-700 hover:to-purple-700"
          >
            <Send className="size-4" />
            آزمایش ایجنت
          </Button>
          {onOpenLeads ? (
            <Button variant="outline" onClick={onOpenLeads} className="rounded-xl font-bold">
              <Magnet className="size-4" />
              لیدهای ایجنت
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => setView("profile")} className="rounded-xl font-bold">
            <BookOpen className="size-4" />
            دانش ایجنت (تب جداگانه)
          </Button>
        </div>
      </div>

      {/* ═══ هویت ایجنت ═══ */}
      <SettingsSection
        icon={Bot}
        title="هویت ایجنت"
        description="نام و نخستین جمله‌ای که کاربران هنگام گفتگو می‌بینند"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>نام نمایشی ایجنت</Label>
            <Input
              value={settings.name}
              onChange={(e) => update("name", e.target.value.slice(0, MAX_NAME))}
              maxLength={MAX_NAME}
              placeholder={defaultName}
              className="rounded-xl"
              dir="auto"
            />
            <p className="text-[10px] leading-4 text-muted-foreground">
              خالی بماند: «{defaultName}»
            </p>
          </div>
          <div className="space-y-2">
            <Label>پیام خوش‌آمدگویی</Label>
            <Textarea
              value={settings.greeting}
              onChange={(e) => update("greeting", e.target.value.slice(0, MAX_GREETING))}
              maxLength={MAX_GREETING}
              placeholder={`سلام! من نماینده‌ی دیجیتالِ ${firstName} هستم؛ هر چیزی درباره‌ی تخصص‌ها و خدماتش می‌خواهی بپرس…`}
              className="min-h-24 rounded-xl"
              dir="auto"
            />
            <p className="text-left text-[10px] text-muted-foreground tnum">
              {faNum(String(settings.greeting.length))} / {faNum(String(MAX_GREETING))}
            </p>
          </div>
        </div>
      </SettingsSection>

      {/* ═══ سبک صحبت ═══ */}
      <SettingsSection
        icon={STYLE_ICONS[settings.style]}
        title="سبک صحبت ایجنت"
        description="شخصیت گفتاری که ایجنت با آن پاسخ می‌دهد"
      >
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {AGENT_STYLE_OPTIONS.map((opt) => {
            const Icon = STYLE_ICONS[opt.key];
            const active = settings.style === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => update("style", opt.key)}
                className={`flex items-start gap-3 rounded-2xl border p-3.5 text-right transition-all ${
                  active
                    ? "border-violet-400 bg-violet-50/70 shadow-sm dark:border-violet-600/60 dark:bg-violet-900/25"
                    : "border-border/60 bg-card hover:border-violet-300/60 hover:bg-violet-50/30 dark:hover:bg-violet-900/10"
                }`}
              >
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                    active
                      ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black">{opt.label}</p>
                  <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">{opt.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </SettingsSection>

      {/* ═══ رفتار و حدود ═══ */}
      <SettingsSection
        icon={ShieldAlert}
        title="رفتار و حدود ایجنت"
        description="دستورالعمل‌های دقیق، سوییچ‌های رفتاری و موضوعات ممنوعه"
      >
        <div className="space-y-4">
          {/* سوییچ‌ها */}
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-3.5">
              <div className="min-w-0">
                <p className="text-sm font-bold">استفاده از پروفایل عمومی</p>
                <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                  مهارت‌ها، سوابق و تحصیلات پروفایل در پاسخ‌ها به‌کار رود
                </p>
              </div>
              <Switch checked={settings.useProfile} onCheckedChange={(v) => update("useProfile", v)} />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-3.5">
              <div className="min-w-0">
                <p className="text-sm font-bold">دعوت به گفتگوی مستقیم</p>
                <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                  در فرصت‌های مناسب، کاربر را به چت مستقیم با شما هدایت کند
                </p>
              </div>
              <Switch checked={settings.suggestHandoff} onCheckedChange={(v) => update("suggestHandoff", v)} />
            </div>
          </div>

          {/* دستورالعمل اختصاصی */}
          <div className="space-y-2">
            <Label>دستورالعمل اختصاصی (چه چیزهایی را تأکید کند؟)</Label>
            <Textarea
              value={settings.instructions}
              onChange={(e) => update("instructions", e.target.value.slice(0, MAX_INSTRUCTIONS))}
              maxLength={MAX_INSTRUCTIONS}
              placeholder={"مثال:\n- قیمت‌ها را همیشه دقیق و بدون تخمیم بگو\n- اول از همه سابقه‌ی ۱۰ ساله‌ام در پسته را مطرح کن\n- اگر کسی نمونه‌کار خواست، به گفتگوی مستقیم هدایتش کن"}
              className="min-h-32 rounded-xl"
              dir="auto"
            />
            <p className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>ایجنت این‌ها را مثل قانون اجرا می‌کند</span>
              <span className="tnum">{faNum(String(settings.instructions.length))} / {faNum(String(MAX_INSTRUCTIONS))}</span>
            </p>
          </div>

          {/* موضوعات ممنوعه */}
          <div className="space-y-2">
            <Label>موضوعات ممنوعه (هرگز درباره‌شان صحبت نکند)</Label>
            <Textarea
              value={settings.forbidden}
              onChange={(e) => update("forbidden", e.target.value.slice(0, MAX_FORBIDDEN))}
              maxLength={MAX_FORBIDDEN}
              placeholder="مثال: قیمت‌های رقبا، مشتری‌های خاص، سیاست، مذاکرات در جریان…"
              className="min-h-20 rounded-xl"
              dir="auto"
            />
            <p className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>با ویرگول یا خط جدید جدا کنید</span>
              <span className="tnum">{faNum(String(settings.forbidden.length))} / {faNum(String(MAX_FORBIDDEN))}</span>
            </p>
          </div>
        </div>
      </SettingsSection>

      {/* ═══ سؤال‌های پیشنهادی ═══ */}
      <SettingsSection
        icon={HelpCircle}
        title="سؤال‌های پیشنهادی شروع"
        description="دکمه‌هایی که کاربر در شروع گفتگو می‌بیند (حداکثر ۴)"
      >
        <div className="space-y-2.5">
          {settings.questions.map((q, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="tnum flex size-8 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-xs font-black text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                {faNum(String(i + 1))}
              </span>
              <Input
                value={q}
                onChange={(e) => setQuestion(i, e.target.value)}
                maxLength={80}
                placeholder={["خودت و صاحبت را معرفی کن", "چه مهارت‌ها و سوابقی دارد؟", "برای پروژه‌ی من مناسب است؟", "بهترین راه همکاری با او چیست؟"][i] || "سؤال پیشنهادی…"}
                className="flex-1 rounded-xl"
                dir="auto"
              />
              <button
                type="button"
                onClick={() => removeQuestion(i)}
                aria-label="حذف سؤال"
                className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          {settings.questions.length < MAX_QUESTIONS ? (
            <Button variant="outline" onClick={addQuestion} className="w-full rounded-xl border-dashed font-bold">
              <Plus className="size-4" />
              افزودن سؤال پیشنهادی
            </Button>
          ) : null}
        </div>
      </SettingsSection>

      {/* ═══ پیش‌نمایش زنده ═══ */}
      <SettingsSection
        icon={Sparkles}
        title="پیش‌نمایش زنده"
        description="این را کاربران هنگام گفتگو با ایجنت شما می‌بینند"
      >
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-background">
          <div className="flex items-center gap-3 border-b border-border/60 bg-card px-4 py-2.5">
            <div className="relative shrink-0">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md">
                <Bot className="size-5" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black" dir="auto">{agentDisplayName}</p>
              <p className="truncate text-[10px] text-muted-foreground">
                {stats && stats.items > 0 ? `${faNum(stats.items)} منبع دانش اختصاصی` : "بر اساس پروفایل"} · نماینده‌ی دیجیتال {firstName}
              </p>
            </div>
          </div>
          <div className="space-y-3 bg-background p-4">
            <div className="flex items-end gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md">
                <Bot className="size-4" />
              </div>
              <div className="max-w-[80%] rounded-2xl rounded-bl-sm border border-violet-200/70 bg-violet-50/80 px-3.5 py-2.5 dark:border-violet-800/50 dark:bg-violet-900/25">
                <p className="text-[13px] leading-6" dir="auto">
                  {settings.greeting.trim() ||
                    `سلام! من نماینده‌ی دیجیتالِ ${firstName} هستم؛ هر چه درباره‌ی مهارت‌ها و سوابقش می‌خواهی بپرس.`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 ps-11">
              {(settings.questions.filter((q) => q.trim()).length > 0
                ? settings.questions.filter((q) => q.trim())
                : ["خودت و صاحبت را معرفی کن", "چه مهارت‌ها و سوابقی دارد؟"]
              ).map((q) => (
                <span
                  key={q}
                  className="rounded-full border border-violet-300/60 bg-card px-3 py-1.5 text-[11px] font-bold text-violet-700 dark:border-violet-700/50 dark:text-violet-300"
                  dir="auto"
                >
                  {q}
                </span>
              ))}
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* ═══ نوار ذخیره ═══ */}
      <div className="sticky bottom-20 z-10 flex items-center gap-2 rounded-2xl border border-border/60 bg-card/90 p-3 shadow-lg backdrop-blur-md md:bottom-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold">
            {dirty ? "تغییرات ذخیره نشده دارید" : "همه‌چیز ذخیره شده"}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {dirty
              ? "تا ذخیره نکنید، ایجنت با تنظیمات قبلی پاسخ می‌دهد"
              : "تنظیمات از همین لحظه روی پاسخ‌های ایجنت اعمال می‌شود"}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={resetToDefaults} className="rounded-xl text-muted-foreground">
          <RotateCcw className="size-4" />
          پیش‌فرض
        </Button>
        <Button
          onClick={save}
          disabled={!dirty || saving}
          className="shahryar-gradient rounded-xl border-0 font-black"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          ذخیره‌ی تنظیمات
        </Button>
      </div>
    </div>
  );
}

/** قالب بخش تنظیمات — تیتر + آیکن + توضیح */
function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Bot;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300">
          <Icon className="size-4.5" style={{ width: 18, height: 18 }} />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-black">{title}</h3>
          <p className="text-[11px] text-muted-foreground">{description}</p>
        </div>
        <div aria-hidden className="h-px flex-1 bg-gradient-to-l from-border to-transparent" />
      </div>
      {children}
    </section>
  );
}
