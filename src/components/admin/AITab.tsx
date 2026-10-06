// ═════ مدیریت هوش مصنوعی — پرامپت، تنظیمات، قابلیت‌ها، API اختصاصی، حافظه ═════
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Brain, Save, Sparkles, MessageSquare, Plus, Trash2, RotateCcw,
  Gauge, Search, ImagePlus, MemoryStick, ShieldAlert, FileCog,
  FileSearch, Code2, Plug, Zap, Loader2, CheckCircle2, XCircle, Info, HeartPulse,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { get, put, patch, del, post } from "@/lib/client/api";
import { faNum, faRelative, maskPhone, LABELS } from "@/lib/client/persian";
import { toast } from "@/hooks/use-toast";

interface SystemPromptConfig {
  persona: string;
  tone: string;
  rules: string[];
}
interface AISettings {
  defaultMode: string;
  thinkingEnabled: boolean;
  webSearchEnabled: boolean;
  imageGenEnabled: boolean;
  memoryEnabled: boolean;
  memoryExtractionInterval: number;
  maxHistoryMessages: number;
  temperature: number;
  dailyMessageLimit: number;
}
interface CustomProvider {
  enabled: boolean;
  name: string;
  baseUrl: string;
  format: "openai" | "anthropic";
  model: string;
  maxTokens: number;
  hasApiKey: boolean;
  apiKeyPreview: string;
}
interface AIStats {
  totalSessions: number; totalMessages: number; totalMemories: number;
  todayMessages: number;
  modeStats: Array<{ mode: string; _count: number }>;
}
interface MemoryRow {
  id: string; key: string; value: string; category: string;
  importance: number; updatedAt: string;
  user: { fullName: string | null; phone: string };
}
/** کانفیگ ماژول چت — قابلیت‌های هوشیار */
interface ChatModuleConfig {
  enableDeepThink: boolean;
  enableWebSearch: boolean;
  enableImageGen: boolean;
  enableFileTools: boolean;
  enableDocReading: boolean;
  enableCodeInterpreter: boolean;
  maxFilesPerReply: number;
  maxSheetRows: number;
}

const MODE_LABELS: Record<string, string> = {
  chat: "گفتگوی عادی", deep: "تفکر عمیق", search: "جستجوی وب", image: "تولید تصویر",
};

// ─── پیش‌فرض‌های کلاینت — حتی اگر سرور null برگرداند اسکلتون ابدی رخ نمی‌دهد ───
const DEFAULT_SETTINGS: AISettings = {
  defaultMode: "chat",
  thinkingEnabled: true,
  webSearchEnabled: true,
  imageGenEnabled: true,
  memoryEnabled: true,
  memoryExtractionInterval: 6,
  maxHistoryMessages: 24,
  temperature: 0.8,
  dailyMessageLimit: 150,
};
const DEFAULT_PROVIDER: CustomProvider = {
  enabled: false, name: "", baseUrl: "", format: "openai",
  model: "", maxTokens: 4096, hasApiKey: false, apiKeyPreview: "",
};
const DEFAULT_CAPS: ChatModuleConfig = {
  enableDeepThink: true, enableWebSearch: true, enableImageGen: true,
  enableFileTools: true, enableDocReading: true, enableCodeInterpreter: true,
  maxFilesPerReply: 3, maxSheetRows: 5000,
};

export default function AITab() {
  const [prompt, setPrompt] = useState<SystemPromptConfig>({ persona: "هوشیار", tone: "", rules: [] });
  const [settings, setSettings] = useState<AISettings>({ ...DEFAULT_SETTINGS });
  const [provider, setProvider] = useState<CustomProvider>({ ...DEFAULT_PROVIDER });
  const [caps, setCaps] = useState<ChatModuleConfig>({ ...DEFAULT_CAPS });
  const [stats, setStats] = useState<AIStats | null>(null);
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [memQuery, setMemQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingProvider, setSavingProvider] = useState(false);
  const [savingCaps, setSavingCaps] = useState(false);
  const [testingProvider, setTestingProvider] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; latencyMs: number; reply?: string; error?: string } | null>(null);
  const [newRule, setNewRule] = useState("");
  const [preview, setPreview] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");

  // ─── سلامت سرویس‌های AI (تست پس از دیپلوی) ───
  interface AiServiceStatus {
    routing: Record<string, string>;
    customProvider: { enabled: boolean; name: string; model: string; format: string } | null;
    zaiConfigFile: { present: boolean; path: string | null };
    blockers: string[];
  }
  interface AiProbeResult { ok: boolean; latencyMs: number; sample?: string; error?: string }
  interface AiTestResponse {
    ok: boolean; testedAt: string; includeImage: boolean;
    zaiConfigFile: { present: boolean; path: string | null };
    results: Record<string, AiProbeResult>;
  }
  const [svcStatus, setSvcStatus] = useState<AiServiceStatus | null>(null);
  const [svcTesting, setSvcTesting] = useState(false);
  const [svcIncludeImage, setSvcIncludeImage] = useState(false);
  const [svcTest, setSvcTest] = useState<AiTestResponse | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [res, modRes] = await Promise.all([
      get<{
        systemPrompt: SystemPromptConfig;
        aiSettings: AISettings;
        customProvider: CustomProvider;
        stats: AIStats;
      }>("/api/admin/ai-settings"),
      get<{ modules: Array<{ key: string; config: Record<string, boolean | number> }> }>("/api/admin/modules"),
    ]);

    if (res.success && res.data) {
      if (res.data.systemPrompt) setPrompt(res.data.systemPrompt);
      // ⚠️ هرگز اجازه‌ی null نمی‌دهیم — پیش‌فرض کامل مرج می‌شود
      setSettings({ ...DEFAULT_SETTINGS, ...(res.data.aiSettings || {}) });
      setProvider({ ...DEFAULT_PROVIDER, ...(res.data.customProvider || {}) });
      setStats(res.data.stats);
    } else {
      // حتی در خطا — با پیش‌فرض‌ها لود شو (رفع باگ اسکلتون ابدی)
      setSettings((s) => ({ ...DEFAULT_SETTINGS, ...s }));
      setProvider((p) => ({ ...DEFAULT_PROVIDER, ...p }));
    }
    if (modRes.success && modRes.data) {
      const chatMod = modRes.data.modules.find((m) => m.key === "chat");
      if (chatMod?.config) {
        setCaps({
          enableDeepThink: chatMod.config.enableDeepThink !== false,
          enableWebSearch: chatMod.config.enableWebSearch !== false,
          enableImageGen: chatMod.config.enableImageGen !== false,
          enableFileTools: chatMod.config.enableFileTools !== false,
          enableDocReading: chatMod.config.enableDocReading !== false,
          enableCodeInterpreter: chatMod.config.enableCodeInterpreter !== false,
          maxFilesPerReply: Number(chatMod.config.maxFilesPerReply ?? 3),
          maxSheetRows: Number(chatMod.config.maxSheetRows ?? 5000),
        });
      }
    }
    setLoading(false);
  }, []);

  const loadMemories = useCallback(async () => {
    const params = new URLSearchParams({ limit: "15" });
    if (memQuery.trim()) params.set("q", memQuery.trim());
    const res = await get<{ memories: MemoryRow[] }>(`/api/admin/memories?${params}`);
    if (res.success && res.data) setMemories(res.data.memories);
  }, [memQuery]);

  useEffect(() => {
    const t = setTimeout(loadAll, 0);
    return () => clearTimeout(t);
  }, [loadAll]);

  useEffect(() => {
    const t = setTimeout(loadMemories, 350);
    return () => clearTimeout(t);
  }, [loadMemories]);

  // وضعیت پیکربندی سرویس‌های AI — سبک (بدون فراخوانی مدل)
  useEffect(() => {
    let active = true;
    (async () => {
      const res = await get<AiServiceStatus>("/api/admin/ai-status");
      if (active && res.success && res.data) setSvcStatus(res.data);
    })();
    return () => { active = false; };
  }, []);

  /** آزمون زنده‌ی سرویس‌های AI — چت فعال، چت ZAI، جستجوی وب، بینایی (+تصویر با انتخاب ادمین) */
  const runAiServiceTest = async () => {
    if (svcTesting) return;
    setSvcTesting(true);
    setSvcTest(null);
    const res = await post<AiTestResponse>("/api/admin/ai-status", {
      ...(svcIncludeImage ? { image: true } : {}),
    });
    setSvcTesting(false);
    if (res.success && res.data) {
      setSvcTest(res.data);
      const allOk = res.data.ok;
      toast({
        title: allOk ? "همه سرویس‌ها سالم‌اند" : "برخی سرویس‌ها مشکل دارند",
        description: allOk
          ? "قابلیت‌های AI شهریار روی این سرور پاسخ می‌دهند"
          : "جزئیات خطای هر سرویس را در کارت سلامت ببینید",
        variant: allOk ? undefined : "destructive",
      });
    } else {
      toast({ title: "تست ناموفق", description: res.error, variant: "destructive" });
    }
  };

  const savePrompt = async () => {
    if (savingPrompt) return;
    setSavingPrompt(true);
    const res = await put("/api/admin/ai-settings", {
      systemPrompt: { ...prompt, rules: prompt.rules.filter((r) => r.trim()) },
    });
    setSavingPrompt(false);
    if (res.success) toast({ title: "پرامپت سیستم ذخیره شد", description: "هوشیار از این لحظه با قوانین جدید پاسخ می‌دهد" });
    else toast({ title: "خطا", description: res.error, variant: "destructive" });
  };

  const saveSettings = async () => {
    if (savingSettings) return;
    setSavingSettings(true);
    const res = await put("/api/admin/ai-settings", { aiSettings: settings });
    setSavingSettings(false);
    if (res.success) toast({ title: "تنظیمات ذخیره شد" });
    else toast({ title: "خطا", description: res.error, variant: "destructive" });
  };

  /** ذخیره قابلیت‌ها — PATCH کانفیگ ماژول چت */
  const saveCaps = async (next: ChatModuleConfig) => {
    if (savingCaps) return;
    setSavingCaps(true);
    const res = await patch("/api/admin/modules/chat", { config: next });
    setSavingCaps(false);
    if (res.success) {
      setCaps(next);
      toast({ title: "قابلیت‌های هوشیار ذخیره شد", description: "تغییرات فوراً روی چت کاربران اعمال می‌شود" });
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  /** ذخیره provider اختصاصی */
  const saveProvider = async () => {
    if (savingProvider) return;
    setSavingProvider(true);
    setTestResult(null);
    const res = await put("/api/admin/ai-settings", {
      customProvider: {
        enabled: provider.enabled,
        name: provider.name,
        baseUrl: provider.baseUrl,
        format: provider.format,
        model: provider.model,
        maxTokens: provider.maxTokens,
        // فقط اگر ادمین کلید جدید تایپ کرده باشد ارسال می‌شود
        ...(apiKeyInput.trim() ? { apiKey: apiKeyInput.trim() } : {}),
      },
    });
    setSavingProvider(false);
    if (res.success) {
      setApiKeyInput("");
      toast({
        title: "تنظیمات API اختصاصی ذخیره شد",
        description: provider.enabled
          ? "گفتگوی متنی هوشیار از این پس از اندپوینت اختصاصی شما استفاده می‌کند"
          : "اندپوینت اختصاصی غیرفعال است — سرویس پیش‌فرض فعال است",
      });
      loadAll();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  /** تست اتصال اندپوینت اختصاصی — قبل یا بعد از ذخیره */
  const testProvider = async () => {
    if (testingProvider) return;
    setTestingProvider(true);
    setTestResult(null);
    const res = await post<{ ok: boolean; latencyMs: number; reply?: string; error?: string }>(
      "/api/admin/ai-settings/test",
      {
        baseUrl: provider.baseUrl,
        format: provider.format,
        model: provider.model,
        ...(apiKeyInput.trim() ? { apiKey: apiKeyInput.trim() } : {}),
      }
    );
    setTestingProvider(false);
    if (res.success && res.data) {
      setTestResult(res.data);
      toast({
        title: res.data.ok ? "اتصال برقرار است ✓" : "اتصال ناموفق",
        description: res.data.ok
          ? `پاسخ در ${faNum(Math.round(res.data.latencyMs / 100) / 10)} ثانیه دریافت شد`
          : (res.data.error || "خطای ناشناخته").slice(0, 120),
        variant: res.data.ok ? undefined : "destructive",
      });
    } else {
      setTestResult({ ok: false, latencyMs: 0, error: res.error });
      toast({ title: "تست ناموفق", description: res.error, variant: "destructive" });
    }
  };

  const addRule = () => {
    if (!newRule.trim()) return;
    setPrompt((p) => ({ ...p, rules: [...p.rules, newRule.trim()] }));
    setNewRule("");
  };

  const removeRule = (i: number) => {
    setPrompt((p) => ({ ...p, rules: p.rules.filter((_, idx) => idx !== i) }));
  };

  const deleteMemory = async (id: string) => {
    const res = await del(`/api/admin/memories?id=${id}`);
    if (res.success) setMemories((prev) => prev.filter((m) => m.id !== id));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="grid md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-white flex items-center gap-2.5">
          <Brain className="w-7 h-7 text-violet-400" />
          مدیریت هوش مصنوعی هوشیار
        </h2>
        <p className="text-slate-400 text-sm mt-1">مهندسی پرامپت، قابلیت‌ها، اتصال مدل، تنظیمات رفتاری و حافظه داینامیک</p>
      </div>

      {/* آمار */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "کل گفتگوها", value: stats?.totalSessions ?? 0, icon: MessageSquare, color: "from-violet-500 to-purple-600" },
          { label: "کل پیام‌ها", value: stats?.totalMessages ?? 0, icon: Sparkles, color: "from-blue-500 to-indigo-600" },
          { label: "پیام‌های امروز", value: stats?.todayMessages ?? 0, icon: Gauge, color: "from-amber-500 to-orange-600" },
          { label: "حافظه‌های ذخیره‌شده", value: stats?.totalMemories ?? 0, icon: MemoryStick, color: "from-rose-500 to-pink-600" },
        ].map((c) => (
          <Card key={c.label} className="rounded-2xl bg-slate-900/70 border-slate-800">
            <CardContent className="p-4">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center mb-3`}>
                <c.icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-2xl font-black text-white tnum">{faNum(c.value)}</p>
              <p className="text-xs text-slate-400 mt-1">{c.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ═══ سلامت سرویس‌های AI — راستی‌آزمایی پس از دیپلوی ═══ */}
      <Card className="rounded-2xl bg-slate-900/70 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <HeartPulse className="text-rose-400" style={{ width: 18, height: 18 }} />
            سلامت سرویس‌های AI
            {svcStatus && (
              <Badge
                variant="secondary"
                className={
                  svcStatus.zaiConfigFile.present
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                }
              >
                {svcStatus.zaiConfigFile.present ? "کانفیگ ZAI موجود" : "کانفیگ ZAI یافت نشد"}
              </Badge>
            )}
          </CardTitle>
          <p className="text-xs text-slate-500 leading-relaxed mt-1">
            بالا بودن سایت به‌تنهایی سلامت قابلیت‌های AI را ثابت نمی‌کند. چت متنی می‌تواند از اندپوینت اختصاصی شما
            بیاید، اما <span className="text-slate-400">جستجوی وب، تولید تصویر و بینایی</span> به سرویس پیش‌فرض (ZAI)
            وابسته‌اند — به‌خصوص بعد از استقرار روی سرور جدید این تست را اجرا کنید.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* مسیریابی قابلیت‌ها بر اساس پیکربندی فعلی */}
          {svcStatus && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {[
                { key: "chat", label: "چت متنی" },
                { key: "webSearch", label: "جستجوی وب" },
                { key: "vision", label: "بینایی" },
                { key: "imageGen", label: "تولید تصویر" },
              ].map((c) => (
                <div key={c.key} className="rounded-xl bg-slate-800/50 border border-slate-700/60 px-3 py-2">
                  <p className="text-[11px] text-slate-500">{c.label}</p>
                  <p className="text-xs text-slate-200 font-medium mt-0.5" dir="auto">{svcStatus.routing[c.key] || "—"}</p>
                </div>
              ))}
            </div>
          )}

          {/* مانع‌های پیکربندی */}
          {svcStatus?.blockers?.map((b, i) => (
            <div key={i} className="flex items-start gap-2 rounded-xl bg-amber-500/8 border border-amber-500/25 p-3">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-200/90 leading-relaxed">{b}</p>
            </div>
          ))}

          {/* کنترل تست */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              onClick={runAiServiceTest}
              disabled={svcTesting}
              className="rounded-xl bg-gradient-to-l from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white gap-2"
            >
              {svcTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {svcTesting ? "در حال آزمون… (تا ۲ دقیقه)" : "اجرای آزمون سرویس‌ها"}
            </Button>
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={svcIncludeImage}
                onChange={(e) => setSvcIncludeImage(e.target.checked)}
                className="accent-rose-500"
              />
              تست تولید تصویر هم انجام شود (هزینه‌بر است)
            </label>
          </div>

          {/* نتایج آزمون */}
          {svcTest && (
            <div className="space-y-2">
              {Object.entries(svcTest.results).map(([key, r]) => {
                const labels: Record<string, string> = {
                  chatActive: "چت متنی (مسیر فعال)",
                  zaiChat: "چت (سرویس پیش‌فرض ZAI)",
                  webSearch: "جستجوی وب",
                  vision: "بینایی (glm-4.6v)",
                  imageGen: "تولید تصویر",
                };
                return (
                  <div
                    key={key}
                    className={`flex items-start gap-2.5 rounded-xl border p-3 ${
                      r.ok ? "bg-emerald-500/8 border-emerald-500/25" : "bg-rose-500/8 border-rose-500/25"
                    }`}
                  >
                    {r.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-200">
                        {labels[key] || key}
                        <span className="text-slate-500 font-normal tnum"> · {faNum(r.latencyMs)} میلی‌ثانیه</span>
                      </p>
                      <p className={`text-[11px] mt-0.5 leading-relaxed ${r.ok ? "text-slate-400" : "text-rose-300/90"}`} dir="auto">
                        {r.ok ? (r.sample || "پاسخ دریافت شد") : (r.error || "خطای ناشناخته")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="prompt" dir="rtl">
        <TabsList className="grid grid-cols-5 w-full rounded-2xl h-12 bg-slate-900/70 border border-slate-800">
          <TabsTrigger value="prompt" className="rounded-xl gap-1.5 text-[13px] data-[state=active]:bg-slate-800 text-slate-300 data-[state=active]:text-white">
            <Brain className="w-4 h-4" />
            پرامپت
          </TabsTrigger>
          <TabsTrigger value="capabilities" className="rounded-xl gap-1.5 text-[13px] data-[state=active]:bg-slate-800 text-slate-300 data-[state=active]:text-white">
            <FileCog className="w-4 h-4" />
            قابلیت‌ها
          </TabsTrigger>
          <TabsTrigger value="provider" className="rounded-xl gap-1.5 text-[13px] data-[state=active]:bg-slate-800 text-slate-300 data-[state=active]:text-white">
            <Plug className="w-4 h-4" />
            اتصال مدل
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-xl gap-1.5 text-[13px] data-[state=active]:bg-slate-800 text-slate-300 data-[state=active]:text-white">
            <Gauge className="w-4 h-4" />
            رفتاری
          </TabsTrigger>
          <TabsTrigger value="memories" className="rounded-xl gap-1.5 text-[13px] data-[state=active]:bg-slate-800 text-slate-300 data-[state=active]:text-white">
            <MemoryStick className="w-4 h-4" />
            حافظه
          </TabsTrigger>
        </TabsList>

        {/* ═══ تب پرامپت ═══ */}
        <TabsContent value="prompt" className="mt-4 space-y-4">
          <Card className="rounded-2xl bg-slate-900/70 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Sparkles className="text-amber-400" style={{ width: 18, height: 18 }} />
                هویت و شخصیت هوشیار
              </CardTitle>
              <p className="text-xs text-slate-500 leading-relaxed mt-1">
                این پرامپت پایه، لایه اول از ۹ لایه سیستم پرامپت هوشیار است. لایه‌های دیگر (حافظه کاربر، اهداف، دانش شهری و اصناف) به‌صورت داینامیک اضافه می‌شوند.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">نام دستیار</Label>
                  <Input
                    value={prompt.persona}
                    onChange={(e) => setPrompt({ ...prompt, persona: e.target.value })}
                    className="rounded-xl bg-slate-800/70 border-slate-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">لحن گفتگو</Label>
                  <Input
                    value={prompt.tone}
                    onChange={(e) => setPrompt({ ...prompt, tone: e.target.value })}
                    className="rounded-xl bg-slate-800/70 border-slate-700 text-white"
                    placeholder="صمیمی، گرم و همراهانه مثل یک رفیق باهوش"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">قوانین طلایی رفتار</Label>
                <div className="space-y-2">
                  {prompt.rules.map((rule, i) => (
                    <div key={i} className="flex items-center gap-2.5 bg-slate-800/50 rounded-xl p-3 group">
                      <span className="w-6 h-6 rounded-lg shahryar-gradient flex items-center justify-center text-white text-xs font-bold shrink-0 tnum">
                        {faNum(i + 1)}
                      </span>
                      <p className="flex-1 text-sm text-slate-300 leading-relaxed">{rule}</p>
                      <button
                        onClick={() => removeRule(i)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newRule}
                    onChange={(e) => setNewRule(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addRule()}
                    placeholder="قانون جدید بنویسید و Enter بزنید..."
                    className="rounded-xl bg-slate-800/70 border-slate-700 text-white text-sm"
                  />
                  <Button onClick={addRule} disabled={!newRule.trim()}
                    className="shahryar-gradient text-white border-0 rounded-xl shrink-0">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* پیش‌نمایش پرامپت نهایی */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-slate-300">توضیح تکمیلی سیستم (اختیاری)</Label>
                  <button
                    onClick={() => setPreview(preview ? "" : "show")}
                    className="text-xs text-blue-400 hover:underline"
                  >
                    {preview ? "بستن پیش‌نمایش لایه‌ها" : "مشاهده ساختار ۹ لایه"}
                  </button>
                </div>
                <Textarea
                  value={prompt.tone}
                  onChange={(e) => setPrompt({ ...prompt, tone: e.target.value })}
                  className="rounded-xl bg-slate-800/70 border-slate-700 text-white min-h-16 text-sm"
                />
                {preview && (
                  <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 space-y-2 text-xs">
                    {[
                      "لایه ۱: هویت و شخصیت (قابل ویرایش در همین صفحه)",
                      "لایه ۲: قوانین طلایی رفتار (قابل ویرایش در همین صفحه)",
                      "لایه ۳: پروفایل کاربر (نام، شهر، جنسیت، سال تولد، علایق)",
                      "لایه ۴: حافظه داینامیک — ۲۴ حافظه مهم کاربر",
                      "لایه ۵: اهداف فعال و وظایف جاری کاربر",
                      "لایه ۶: داده‌های روز شهر (۵ رکورد آخر پایگاه دانش)",
                      "لایه ۷: اصناف مرتبط با موضوع پیام (تا ۸ کسب‌وکار)",
                      "لایه ۸: دستورالعمل حالت فعال (عادی/عمیق/جستجو/تصویر)",
                      "لایه ۹: قالب خروجی (مارک‌داون، ارقام فارسی، تقویم شمسی)",
                    ].map((l, i) => (
                      <p key={i} className="text-slate-400 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                        {l}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              <Button onClick={savePrompt} disabled={savingPrompt}
                className="shahryar-gradient text-white border-0 rounded-xl font-bold">
                <Save className="w-4 h-4" />
                {savingPrompt ? "در حال ذخیره..." : "ذخیره پرامپت سیستم"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ تب قابلیت‌ها — ابزارهای هوشیار ═══ */}
        <TabsContent value="capabilities" className="mt-4 space-y-4">
          <Card className="rounded-2xl bg-slate-900/70 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-white flex items-center gap-2">
                <FileCog className="text-emerald-400" style={{ width: 18, height: 18 }} />
                قابلیت‌های هوشیار
              </CardTitle>
              <p className="text-xs text-slate-500 leading-relaxed mt-1">
                فعال/غیرفعال‌سازی هر قابلیت فوراً روی چت همه کاربران اعمال می‌شود. قابلیت خاموش از پرامپت حذف شده و API آن هم مسدود می‌گردد.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { key: "enableDeepThink", label: "حالت تفکر عمیق", desc: "تحلیل چندمرحله‌ای سؤالات پیچیده", icon: Brain, color: "text-violet-400" },
                  { key: "enableWebSearch", label: "جستجوی وب", desc: "دسترسی هوشیار به وب و منابع روز", icon: Search, color: "text-cyan-400" },
                  { key: "enableImageGen", label: "تولید تصویر", desc: "ساخت تصویر از متن", icon: ImagePlus, color: "text-fuchsia-400" },
                  { key: "enableDocReading", label: "خواندن اسناد و فایل‌ها", desc: "PDF، Word، Excel، متن، انواع کد و تصویر پیوست‌شده", icon: FileSearch, color: "text-amber-400" },
                  { key: "enableFileTools", label: "ابزار ساخت فایل", desc: "ساخت Word، Excel، PDF، CSV، Markdown و HTML راست‌چین", icon: FileCog, color: "text-emerald-400" },
                  { key: "enableCodeInterpreter", label: "مفسر کد (اکسل/CSV)", desc: "نوشتن و اجرای کد روی داده‌های فایل‌های جدولی پیوست", icon: Code2, color: "text-orange-400" },
                ].map((f) => (
                  <label key={f.key} className="flex items-center gap-3 bg-slate-800/40 rounded-xl p-4 cursor-pointer">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                      <f.icon className={`w-5 h-5 ${f.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white">{f.label}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{f.desc}</p>
                    </div>
                    <Switch
                      checked={Boolean(caps[f.key as keyof ChatModuleConfig])}
                      onCheckedChange={(v) => saveCaps({ ...caps, [f.key]: v })}
                    />
                  </label>
                ))}
              </div>

              {/* سقف‌های ساخت فایل */}
              <div className="bg-slate-800/30 rounded-xl p-4 space-y-4 border border-slate-800">
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  سقف‌های ساخت فایل
                </p>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-slate-300 text-sm">حداکثر فایل در هر پاسخ</Label>
                      <span className="text-xs text-blue-400 font-bold tnum">{faNum(caps.maxFilesPerReply)} فایل</span>
                    </div>
                    <Slider
                      value={[caps.maxFilesPerReply]}
                      min={1}
                      max={3}
                      step={1}
                      onValueChange={([v]) => setCaps({ ...caps, maxFilesPerReply: v })}
                      onValueCommit={() => saveCaps(caps)}
                    />
                    <p className="text-[11px] text-slate-500">هوشیار در هر پیام حداکثر این تعداد فایل می‌سازد</p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-slate-300 text-sm">حداکثر ردیف هر شیت اکسل</Label>
                      <span className="text-xs text-blue-400 font-bold tnum">{faNum(caps.maxSheetRows)} ردیف</span>
                    </div>
                    <Slider
                      value={[caps.maxSheetRows]}
                      min={100}
                      max={5000}
                      step={100}
                      onValueChange={([v]) => setCaps({ ...caps, maxSheetRows: v })}
                      onValueCommit={() => saveCaps(caps)}
                    />
                    <p className="text-[11px] text-slate-500">سقف ردیف‌های هر شیت در فایل‌های Excel/CSV (۱۰۰ تا ۵۰۰۰)</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ تب اتصال مدل — API اختصاصی ═══ */}
        <TabsContent value="provider" className="mt-4 space-y-4">
          <Card className="rounded-2xl bg-slate-900/70 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Plug className="text-blue-400" style={{ width: 18, height: 18 }} />
                اندپوینت API اختصاصی
              </CardTitle>
              <p className="text-xs text-slate-500 leading-relaxed mt-1">
                با معرفی یک اندپوینت سازگار با قالب OpenAI یا Anthropic، گفتگوی متنی هوشیار از آن سرویس استفاده می‌کند.
                سرویس‌های فعلی (جستجوی وب، تولید تصویر، مدل بینایی GLM-4.6V) روی سرویس پیش‌فرض باقی می‌مانند و در خطای اندپوینت اختصاصی، سیستم خودکار به سرویس پیش‌فرض برمی‌گردد.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* سوییچ اصلی */}
              <div className="flex items-center gap-3 bg-slate-800/40 rounded-xl p-4">
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                  <Zap className={`w-5 h-5 ${provider.enabled ? "text-emerald-400" : "text-slate-500"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">استفاده از API اختصاصی</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {provider.enabled ? "فعال — گفتگوی متنی از اندپوینت شما سرویس می‌شود" : "غیرفعال — سرویس پیش‌فرض شهریار فعال است"}
                  </p>
                </div>
                <Switch
                  checked={provider.enabled}
                  onCheckedChange={(v) => setProvider({ ...provider, enabled: v })}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">نام سرویس (اختیاری)</Label>
                  <Input
                    value={provider.name}
                    onChange={(e) => setProvider({ ...provider, name: e.target.value })}
                    className="rounded-xl bg-slate-800/70 border-slate-700 text-white"
                    placeholder="مثلاً: گلدون AI"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">قالب API</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { id: "openai", label: "OpenAI", desc: "‏/v1/chat/completions" },
                      { id: "anthropic", label: "Anthropic", desc: "‏/v1/messages" },
                    ] as const).map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setProvider({ ...provider, format: f.id })}
                        className={`rounded-xl border p-3 text-right transition-all ${
                          provider.format === f.id
                            ? "border-blue-500/60 bg-blue-500/10"
                            : "border-slate-700 bg-slate-800/40 hover:border-slate-600"
                        }`}
                      >
                        <p className={`text-sm font-bold ${provider.format === f.id ? "text-blue-300" : "text-slate-300"}`}>{f.label}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5" dir="ltr">{f.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Base URL</Label>
                <Input
                  value={provider.baseUrl}
                  onChange={(e) => setProvider({ ...provider, baseUrl: e.target.value })}
                  className="rounded-xl bg-slate-800/70 border-slate-700 text-white font-mono text-sm"
                  dir="ltr"
                  placeholder="https://api.example.com/v1"
                />
                <p className="text-[11px] text-slate-500">
                  {provider.format === "openai"
                    ? "آدرس پایه بدون /chat/completions — سیستم خودکار اضافه می‌کند"
                    : "آدرس پایه بدون /v1/messages — سیستم خودکار اضافه می‌کند"}
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">نام مدل</Label>
                  <Input
                    value={provider.model}
                    onChange={(e) => setProvider({ ...provider, model: e.target.value })}
                    className="rounded-xl bg-slate-800/70 border-slate-700 text-white font-mono text-sm"
                    dir="ltr"
                    placeholder={provider.format === "openai" ? "gpt-4o-mini" : "claude-sonnet-4-20250514"}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">
                    کلید API
                    {provider.hasApiKey && (
                      <Badge variant="outline" className="ms-2 text-[9px] border-emerald-500/40 text-emerald-400 font-mono">
                        ذخیره‌شده: {provider.apiKeyPreview}
                      </Badge>
                    )}
                  </Label>
                  <Input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    className="rounded-xl bg-slate-800/70 border-slate-700 text-white font-mono text-sm"
                    dir="ltr"
                    placeholder={provider.hasApiKey ? "برای تغییر، کلید جدید وارد کنید" : "sk-..."}
                    autoComplete="off"
                  />
                  <p className="text-[11px] text-slate-500">کلید فقط روی سرور ذخیره می‌شود و هرگز کامل نمایش داده نمی‌شود</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-slate-300 text-sm">حداکثر توکن پاسخ</Label>
                  <span className="text-xs text-blue-400 font-bold tnum">{faNum(provider.maxTokens)}</span>
                </div>
                <Slider
                  value={[provider.maxTokens]}
                  min={1024}
                  max={16000}
                  step={512}
                  onValueChange={([v]) => setProvider({ ...provider, maxTokens: v })}
                />
              </div>

              {/* نتیجه تست */}
              {testResult && (
                <div className={`rounded-xl border p-3.5 flex items-start gap-3 ${
                  testResult.ok ? "border-emerald-500/30 bg-emerald-500/10" : "border-rose-500/30 bg-rose-500/10"
                }`}>
                  {testResult.ok ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0 text-sm">
                    <p className={testResult.ok ? "text-emerald-300 font-bold" : "text-rose-300 font-bold"}>
                      {testResult.ok ? "اتصال برقرار است" : "اتصال ناموفق"}
                      {testResult.ok && (
                        <span className="font-normal text-emerald-400/80 ms-2 tnum">
                          · {faNum(Math.round(testResult.latencyMs / 100) / 10)} ثانیه
                        </span>
                      )}
                    </p>
                    {testResult.reply && <p className="text-slate-400 text-xs mt-1 leading-relaxed">پاسخ مدل: {testResult.reply}</p>}
                    {testResult.error && <p className="text-rose-400/90 text-xs mt-1 leading-relaxed" dir="auto">{testResult.error}</p>}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={saveProvider}
                  disabled={savingProvider}
                  className="shahryar-gradient text-white border-0 rounded-xl font-bold"
                >
                  <Save className="w-4 h-4" />
                  {savingProvider ? "در حال ذخیره..." : "ذخیره تنظیمات API"}
                </Button>
                <Button
                  variant="outline"
                  onClick={testProvider}
                  disabled={testingProvider || !provider.baseUrl || !provider.model}
                  className="rounded-xl bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
                >
                  {testingProvider ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {testingProvider ? "در حال تست..." : "تست اتصال"}
                </Button>
              </div>

              {/* توضیح امنیتی */}
              <div className="flex items-start gap-2.5 bg-blue-500/5 border border-blue-500/20 rounded-xl p-3.5">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  <span className="text-blue-300 font-bold">نکته امنیتی:</span> کلید API فقط روی سرور ذخیره می‌شود، در پاسخ‌های API ماسک می‌گردد
                  و در هیچ لاگی ثبت نمی‌شود. اگر اندپوینت اختصاصی دچار خطا شود، سیستم برای تاب‌آوری خودکار به سرویس پیش‌فرض برمی‌گردد تا چت کاربران هرگز قطع نشود.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ تب تنظیمات رفتاری ═══ */}
        <TabsContent value="settings" className="mt-4 space-y-4">
          <Card className="rounded-2xl bg-slate-900/70 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-white">قابلیت‌ها و سقف‌ها</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { key: "thinkingEnabled", label: "حالت تفکر عمیق", desc: "تحلیل چندمرحله‌ای قبل از پاسخ", icon: Brain },
                  { key: "webSearchEnabled", label: "جستجوی وب", desc: "دسترسی هوشیار به وب", icon: Search },
                  { key: "imageGenEnabled", label: "تولید تصویر", desc: "ساخت تصویر از متن", icon: ImagePlus },
                  { key: "memoryEnabled", label: "حافظه داینامیک", desc: "یادگیری خودکار از گفتگو", icon: MemoryStick },
                ].map((f) => (
                  <label key={f.key} className="flex items-center gap-3 bg-slate-800/40 rounded-xl p-4 cursor-pointer">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                      <f.icon className="w-5 h-5 text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white">{f.label}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{f.desc}</p>
                    </div>
                    <Switch
                      checked={Boolean(settings[f.key as keyof AISettings])}
                      onCheckedChange={(v) => setSettings({ ...settings, [f.key]: v })}
                    />
                  </label>
                ))}
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300 text-sm">خلاقیت (Temperature)</Label>
                    <span className="text-xs text-blue-400 font-bold tnum">{settings.temperature.toFixed(1)}</span>
                  </div>
                  <Slider
                    value={[settings.temperature]}
                    min={0}
                    max={1}
                    step={0.1}
                    onValueChange={([v]) => setSettings({ ...settings, temperature: v })}
                  />
                  <p className="text-[11px] text-slate-500">مقادیر پایین: پاسخ دقیق و متمرکز · مقادیر بالا: پاسخ خلاقانه</p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300 text-sm">فاصله استخراج حافظه</Label>
                    <span className="text-xs text-blue-400 font-bold tnum">هر {faNum(settings.memoryExtractionInterval)} پیام</span>
                  </div>
                  <Slider
                    value={[settings.memoryExtractionInterval]}
                    min={2}
                    max={12}
                    step={1}
                    onValueChange={([v]) => setSettings({ ...settings, memoryExtractionInterval: v })}
                  />
                  <p className="text-[11px] text-slate-500">هر چند پیام یک‌بار از گفتگو حافظه استخراج شود</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300 text-sm">حداکثر پیام در تاریخچه</Label>
                  <Input
                    type="number"
                    value={settings.maxHistoryMessages}
                    onChange={(e) => setSettings({ ...settings, maxHistoryMessages: parseInt(e.target.value) || 24 })}
                    className="rounded-xl bg-slate-800/70 border-slate-700 text-white tnum"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300 text-sm">سقف پیام روزانه هر کاربر</Label>
                  <Input
                    type="number"
                    value={settings.dailyMessageLimit}
                    onChange={(e) => setSettings({ ...settings, dailyMessageLimit: parseInt(e.target.value) || 150 })}
                    className="rounded-xl bg-slate-800/70 border-slate-700 text-white tnum"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={saveSettings} disabled={savingSettings}
                  className="shahryar-gradient text-white border-0 rounded-xl font-bold">
                  <Save className="w-4 h-4" />
                  {savingSettings ? "در حال ذخیره..." : "ذخیره تنظیمات"}
                </Button>
                <Button variant="outline" onClick={loadAll}
                  className="rounded-xl bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700">
                  <RotateCcw className="w-4 h-4" />
                  بازگردانی
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* توزیع حالت‌ها */}
          {stats?.modeStats?.length ? (
            <Card className="rounded-2xl bg-slate-900/70 border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-white">محبوبیت حالت‌های گفتگو</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(() => {
                  const totalModes = stats.modeStats.reduce((a, m) => a + m._count, 0) || 1;
                  return stats.modeStats.map((m) => (
                    <div key={m.mode}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-slate-300">{MODE_LABELS[m.mode] || m.mode}</span>
                        <span className="text-slate-500 tnum">{faNum(m._count)} گفتگو</span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full shahryar-gradient rounded-full transition-all"
                          style={{ width: `${(m._count / totalModes) * 100}%` }}
                        />
                      </div>
                    </div>
                  ));
                })()}
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        {/* ═══ تب حافظه ═══ */}
        <TabsContent value="memories" className="mt-4 space-y-4">
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              value={memQuery}
              onChange={(e) => setMemQuery(e.target.value)}
              placeholder="جستجو در حافظه‌ها یا نام کاربر..."
              className="pr-12 h-11 rounded-xl bg-slate-900/70 border-slate-800 text-white placeholder:text-slate-500"
            />
          </div>

          {memories.length === 0 ? (
            <div className="text-center py-14 bg-slate-900/50 rounded-2xl border border-dashed border-slate-800">
              <MemoryStick className="w-12 h-12 mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400 text-sm">حافظه‌ای یافت نشد</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {memories.map((m) => (
                <div key={m.id} className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 group hover:border-slate-700 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-white">{m.key}</span>
                        <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-400">
                          {LABELS.memoryCategories[m.category] || m.category}
                        </Badge>
                        <Badge className="text-[9px] border-0 bg-violet-500/15 text-violet-400">
                          اهمیت {faNum(m.importance)}/۱۰
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-300 mt-2 leading-relaxed">{m.value}</p>
                      <p className="text-[11px] text-slate-500 mt-2">
                        {m.user.fullName || maskPhone(m.user.phone)} · {faRelative(m.updatedAt)}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteMemory(m.id)}
                      className="opacity-0 group-hover:opacity-100 p-2 rounded-lg text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/10 transition-all shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
