// ═════ بخش پنل پیامکی (ملی‌پیامک) — پیکربندی + تست اتصال + ارسال آزمایشی ═════
// اتصال با نام کاربری/رمز عبور طبق مستند رسمی rest.payamak-panel.com
// دو روش ارسال OTP (مطابق مستندات ملی‌پیامک):
//   الگو: کد الگو پر باشد → BaseServiceNumber (متن از پنل ملی‌پیامک)
//   دستی: کد الگو خالی → SendSMS (متن دلخواه + خط ارسال الزامی)
// ═══════════════════════════════════════════════════════════════
"use client";

import { useEffect, useState } from "react";
import {
  MessageSquareText, Save, PlugZap, Send, ShieldCheck, Info, CheckCircle2, XCircle,
  Loader2, KeyRound, Hash, ListPlus, Phone, ToggleLeft, PenLine, FileText, TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { get, put, post } from "@/lib/client/api";
import { faDateTime } from "@/lib/client/persian";
import { toast } from "@/hooks/use-toast";
import { renderOtpTemplate } from "@/lib/core/otp-template";

interface SmsSettingsState {
  username: string;
  hasPassword: boolean;
  fromNumber: string;
  patternCode: string;
  patternVars: string;
  otpTemplate: string;
  enabled: boolean;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  updatedAt: string | null;
}

/** حالت پیش‌فرض وقتی هنوز هیچ پیکربندی‌ای ذخیره نشده است */
const DEFAULT_SMS_SETTINGS: SmsSettingsState = {
  username: "",
  hasPassword: false,
  fromNumber: "",
  patternCode: "",
  patternVars: "",
  otpTemplate: "",
  enabled: false,
  lastTestAt: null,
  lastTestOk: null,
  updatedAt: null,
};

interface TestResult {
  ok: boolean;
  mode?: "pattern" | "simple";
  credit?: string;
  latencyMs?: number;
  error?: string;
  message?: string;
}

export default function SmsPanelSection() {
  const [settings, setSettings] = useState<SmsSettingsState | null>(null);
  const [encKeyOk, setEncKeyOk] = useState(true); // کلید رمزنگاری از env آماده است؟
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sending, setSending] = useState(false);

  const [password, setPassword] = useState(""); // خالی = بدون تغییر
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testSendTo, setTestSendTo] = useState("");
  const [sendResult, setSendResult] = useState<TestResult | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await get<{ encKeyOk?: boolean; settings: SmsSettingsState | null }>("/api/admin/sms");
        // settings=null یعنی «هنوز پیکربندی نشده» → فرم خالی باز می‌شود، نه اسکلتون ابدی
        if (active) {
          setSettings(res.data?.settings ?? DEFAULT_SMS_SETTINGS);
          setEncKeyOk(res.data?.encKeyOk !== false);
        }
      } catch {
        if (active) setSettings(DEFAULT_SMS_SETTINGS);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const save = async () => {
    if (!settings || saving) return;
    if (settings.enabled) {
      if (!settings.username.trim() || (!password && !settings.hasPassword)) {
        return toast({
          title: "پیکربندی ناقص",
          description: "برای فعال‌سازی: نام کاربری و رمز عبور پنل ملی‌پیامک الزامی است",
          variant: "destructive",
        });
      }
      // روش ارسال: یا کد الگو یا (در روش دستی) خط ارسال
      if (!settings.patternCode.trim() && !settings.fromNumber.trim()) {
        return toast({
          title: "روش ارسال نامشخص",
          description: "برای فعال‌سازی، یا «کد الگو (پترن)» را وارد کنید یا «خط ارسال» را برای روش دستی تکمیل کنید",
          variant: "destructive",
        });
      }
    }
    setSaving(true);
    const res = await put<{ settings: SmsSettingsState }>("/api/admin/sms", {
      username: settings.username,
      password: password || undefined,
      fromNumber: settings.fromNumber,
      patternCode: settings.patternCode,
      patternVars: settings.patternVars,
      otpTemplate: settings.otpTemplate,
      enabled: settings.enabled,
    });
    setSaving(false);
    if (res.success && res.data) {
      setSettings(res.data.settings);
      setPassword("");
      toast({ title: "تنظیمات پنل پیامک ذخیره شد" });
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  /** تست اتصال — اگر رمز تازه تایپ شده باشد با همان اعتبارنامه تست می‌شود */
  const testConnection = async () => {
    if (testing) return;
    setTesting(true);
    setTestResult(null);
    const body = password && settings?.username ? { username: settings.username, password } : {};
    const res = await post<TestResult>("/api/admin/sms/test", body);
    setTesting(false);
    if (res.success && res.data) {
      setTestResult(res.data);
    } else {
      setTestResult({ ok: false, error: res.error || "تست اتصال ناموفق بود" });
    }
  };

  const sendTest = async () => {
    if (sending || !testSendTo.trim()) return;
    setSending(true);
    setSendResult(null);
    const res = await post<TestResult>("/api/admin/sms/test-send", { to: testSendTo.trim() });
    setSending(false);
    if (res.success && res.data) {
      setSendResult(res.data);
    } else {
      setSendResult({ ok: false, error: res.error || "ارسال آزمایشی ناموفق بود" });
    }
  };

  if (loading || !settings) {
    return <Skeleton_ />;
  }

  // روش ارسال فعال — همان منطق resolveSendMode در بک‌اند
  const sendMode: "pattern" | "simple" | null = settings.patternCode.trim()
    ? "pattern"
    : settings.fromNumber.trim()
      ? "simple"
      : null;
  const configured = !!(settings.username.trim() && settings.hasPassword && sendMode);
  const active = settings.enabled && configured;
  // پیش‌نمایش زنده متن پیامک دستی با کد نمونه
  const manualPreview = renderOtpTemplate(settings.otpTemplate, "۱۲۳۴۵۶");

  return (
    <div className="space-y-4">
      {/* ═══ هشدار کلید رمزنگاری (فقط سروری که SMS_ENC_KEY ندارد) ═══ */}
      {!encKeyOk && (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-500/8 border border-amber-500/25 p-4">
          <TriangleAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 leading-relaxed space-y-1">
            <p className="font-bold text-amber-400">کلید رمزنگاری پیامک (SMS_ENC_KEY) روی سرور تعریف نشده است</p>
            <p>
              تا پیش از تعریف این کلید، ذخیره‌ی رمز عبور پنل پیامک ممکن نیست و ثبت‌نام با کد پیامکی
              کار نخواهد کرد. روی سرور:
            </p>
            <p className="font-mono text-amber-300/90" dir="ltr">openssl rand -hex 32</p>
            <p>
              خروجی را در فایل <span className="font-mono text-amber-300/90" dir="ltr">.env.docker</span> در
              جلوی <span className="font-mono text-amber-300/90" dir="ltr">SMS_ENC_KEY=</span> قرار دهید و
              کانتینر را ری‌استارت کنید. این کلید باید بین ری‌استارت‌ها ثابت بماند.
            </p>
          </div>
        </div>
      )}

      {/* ═══ راهنمای سریع ═══ */}
      <div className="flex items-start gap-3 rounded-2xl bg-blue-500/8 border border-blue-500/20 p-4">
        <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 leading-relaxed space-y-1">
          <p className="font-bold text-blue-400">اتصال به پنل ملی‌پیامک (rest.payamak-panel.com)</p>
          <p>
            اعتبارنامه‌ها همان نام کاربری و رمز عبور پنل ملی‌پیامک شماست. کد تایید با یکی از دو روش
            زیر ارسال می‌شود — <span className="text-blue-300 font-medium">کد الگو اختیاری است</span>:
          </p>
          <p>
            <span className="text-blue-300 font-medium">۱. ارسال با الگو (پترن):</span> اگر «کد الگو» را
            از بخش <span className="text-blue-300">ابزار ویژه ← وبسرویس خدماتی ← الگوها</span> وارد
            کنید، پیامک با همان الگوی ثبت‌شده در پنل ملی‌پیامک ارسال می‌شود.
          </p>
          <p>
            <span className="text-blue-300 font-medium">۲. ارسال دستی:</span> اگر کد الگو را
            <span className="text-blue-300 font-medium"> خالی</span> بگذارید، پیامک با متن دلخواه شما
            (بخش «متن پیامک دستی») از «خط ارسال» فرستاده می‌شود — در این روش خط ارسال الزامی است.
          </p>
        </div>
      </div>

      {/* ═══ وضعیت ═══ */}
      <div className={`flex items-center justify-between gap-3 rounded-2xl p-4 border ${active ? "bg-emerald-500/8 border-emerald-500/25" : "bg-amber-500/8 border-amber-500/25"}`}>
        <div className="flex items-center gap-3">
          {active ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <ToggleLeft className="w-5 h-5 text-amber-400 shrink-0" />
          )}
          <div>
            <p className={`text-sm font-bold ${active ? "text-emerald-400" : "text-amber-400"}`}>
              {active
                ? `ارسال پیامک OTP فعال است — روش: ${sendMode === "pattern" ? "الگو (پترن)" : "دستی (متن دلخواه)"}`
                : "ارسال پیامک OTP غیرفعال است"}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {active
                ? sendMode === "pattern"
                  ? "کدهای ورود و ثبت‌نام با الگوی ثبت‌شده در پنل ملی‌پیامک ارسال می‌شوند"
                  : "کدهای ورود و ثبت‌نام با متن دلخواه از خط ارسال فرستاده می‌شوند"
                : "تا پیش از فعال‌سازی، کد تایید در صفحه ورود به‌صورت تست نمایش داده می‌شود"}
            </p>
          </div>
        </div>
        {settings.lastTestAt && (
          <div className="text-[10px] text-slate-500 text-left shrink-0 leading-relaxed">
            <p>آخرین تست:</p>
            <p>{faDateTime(settings.lastTestAt)}</p>
            <p className={settings.lastTestOk ? "text-emerald-400" : "text-rose-400"}>
              {settings.lastTestOk ? "موفق" : "ناموفق"}
            </p>
          </div>
        )}
      </div>

      {/* ═══ پیکربندی ═══ */}
      <Card className="rounded-2xl bg-slate-900/70 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <MessageSquareText className="w-5 h-5 text-blue-400" />
            پیکربندی اتصال
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" />
                نام کاربری پنل ملی‌پیامک *
              </Label>
              <Input
                value={settings.username}
                onChange={(e) => setSettings({ ...settings, username: e.target.value })}
                className="rounded-xl bg-slate-800/70 border-slate-700 text-white"
                placeholder="نام کاربری پنل"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                رمز عبور پنل * {settings.hasPassword && <span className="text-emerald-400 text-[10px]">(ذخیره شده)</span>}
              </Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl bg-slate-800/70 border-slate-700 text-white"
                placeholder={settings.hasPassword ? "برای تغییر، رمز جدید وارد کنید" : "رمز عبور پنل"}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5" />
                کد الگوی OTP (پترن)
                <span className="text-[10px] font-normal text-slate-500">اختیاری</span>
              </Label>
              <Input
                value={settings.patternCode}
                onChange={(e) => setSettings({ ...settings, patternCode: e.target.value })}
                className="rounded-xl bg-slate-800/70 border-slate-700 text-white"
                placeholder="خالی = ارسال دستی"
                dir="ltr"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" />
                خط ارسال
                <span className={`text-[10px] font-normal ${settings.patternCode.trim() ? "text-slate-500" : "text-amber-400"}`}>
                  {settings.patternCode.trim() ? "فقط روش دستی" : "الزامی در روش دستی"}
                </span>
              </Label>
              <Input
                value={settings.fromNumber}
                onChange={(e) => setSettings({ ...settings, fromNumber: e.target.value })}
                className="rounded-xl bg-slate-800/70 border-slate-700 text-white"
                placeholder="مثلاً 50004046"
                dir="ltr"
                inputMode="numeric"
              />
            </div>
          </div>

          {/* ═══ نمایشگر روش ارسال فعال ═══ */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className={`rounded-xl border p-3.5 transition-colors ${sendMode === "pattern" ? "bg-blue-500/10 border-blue-500/30" : "bg-slate-800/40 border-slate-700/60 opacity-55"}`}>
              <p className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <Hash className="w-3.5 h-3.5 text-blue-400" />
                ارسال با الگو (پترن)
                {sendMode === "pattern" && (
                  <span className="text-[9px] bg-blue-500/25 text-blue-300 rounded-md px-1.5 py-0.5">فعال</span>
                )}
              </p>
              <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                کد الگو پر باشد؛ متن پیامک از الگوی ثبت‌شده در پنل ملی‌پیامک خوانده می‌شود
              </p>
            </div>
            <div className={`rounded-xl border p-3.5 transition-colors ${sendMode === "simple" ? "bg-amber-500/10 border-amber-500/30" : "bg-slate-800/40 border-slate-700/60 opacity-55"}`}>
              <p className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <PenLine className="w-3.5 h-3.5 text-amber-400" />
                ارسال دستی (متن دلخواه)
                {sendMode === "simple" && (
                  <span className="text-[9px] bg-amber-500/25 text-amber-300 rounded-md px-1.5 py-0.5">فعال</span>
                )}
              </p>
              <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                کد الگو خالی باشد؛ پیامک با متن دلخواه از خط ارسال فرستاده می‌شود
              </p>
            </div>
          </div>

          {/* ═══ فیلدهای وابسته به روش ارسال ═══ */}
          {sendMode === "pattern" ? (
            <div className="space-y-2">
              <Label className="text-slate-300 flex items-center gap-1.5">
                <ListPlus className="w-3.5 h-3.5" />
                متغیرهای اضافی الگو (اختیاری — هر خط یک مقدار ثابت)
              </Label>
              <Textarea
                value={settings.patternVars}
                onChange={(e) => setSettings({ ...settings, patternVars: e.target.value })}
                className="rounded-xl bg-slate-800/70 border-slate-700 text-white min-h-16 text-sm"
                placeholder={"مثال (اگر الگو دو متغیر دارد: کد + مدت اعتبار):\n3"}
                dir="ltr"
              />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                مثال: اگر متن الگوی شما «کد تایید: %code — اعتبار: %min دقیقه» باشد، اولین متغیر (کد) خودکار ارسال می‌شود و مقدار «3» را اینجا برای %min وارد کنید.
              </p>
            </div>
          ) : sendMode === "simple" ? (
            <div className="space-y-2">
              <Label className="text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                متن پیامک دستی (جای {`{code}`} یا {`{کد}`} کد تایید قرار می‌گیرد)
              </Label>
              <Textarea
                value={settings.otpTemplate}
                onChange={(e) => setSettings({ ...settings, otpTemplate: e.target.value })}
                className="rounded-xl bg-slate-800/70 border-slate-700 text-white min-h-28 text-sm leading-relaxed"
                placeholder={"کد تایید شما در شهریار {code} می باشد!\n\nرایان تکنولوژی\nلغو11"}
              />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="text-[11px] text-slate-500 leading-relaxed flex-1 min-w-48">
                  خالی = پیش‌فرض «کد تایید شما در شهریار {"{code}"} می باشد!» همراه با امضای رایان تکنولوژی و لغو۱۱.
                  هر پیامک فارسی تا ۷۰ کاراکتر یک پارت محاسبه می‌شود.
                </p>
                <p className="text-[11px] text-emerald-300/90 bg-emerald-500/8 border border-emerald-500/20 rounded-lg px-2.5 py-1.5" dir="rtl">
                  پیش‌نمایش: <span className="font-bold">{manualPreview}</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 rounded-xl bg-slate-800/40 border border-slate-700/60 p-3.5 text-[11px] text-slate-400 leading-relaxed">
              <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              برای تعیین روش ارسال، یا «کد الگو (پترن)» را وارد کنید یا برای روش دستی، «خط ارسال» را تکمیل کنید.
              تا آن زمان ذخیره ممکن است اما فعال‌سازی نه.
            </div>
          )}

          <label className="flex items-center justify-between bg-slate-800/40 rounded-xl p-4 cursor-pointer">
            <div>
              <p className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                فعال‌سازی ارسال پیامک OTP
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {sendMode
                  ? `پس از فعال‌سازی، کد تایید با روش ${sendMode === "pattern" ? "الگو" : "دستی"} ارسال می‌شود`
                  : "برای فعال‌سازی ابتدا یکی از دو روش ارسال را کامل کنید"}
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(v) => setSettings({ ...settings, enabled: v })}
            />
          </label>

          <div className="flex flex-wrap gap-2.5 pt-1">
            <Button
              onClick={save}
              disabled={saving}
              className="shahryar-gradient text-white border-0 rounded-xl font-bold"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "در حال ذخیره..." : "ذخیره تنظیمات"}
            </Button>
            <Button
              onClick={testConnection}
              disabled={testing || (!settings.username && !settings.hasPassword)}
              variant="outline"
              className="rounded-xl font-bold border-slate-700 text-slate-200 hover:bg-slate-800 gap-2"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />}
              {testing ? "در حال تست..." : "تست اتصال"}
            </Button>
          </div>

          {/* نتیجه تست اتصال */}
          {testResult && (
            <div className={`flex items-start gap-2.5 rounded-xl p-3.5 text-xs leading-relaxed border ${testResult.ok ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300" : "bg-rose-500/10 border-rose-500/25 text-rose-300"}`}>
              {testResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <div>
                <p className="font-bold">
                  {testResult.ok ? "اتصال موفق" : "اتصال ناموفق"}
                </p>
                <p className="mt-0.5 opacity-90">
                  {testResult.ok
                    ? `اعتبار باقیمانده: ${testResult.credit} — زمان پاسخ: ${testResult.latencyMs} میلی‌ثانیه`
                    : testResult.error}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ ارسال آزمایشی ═══ */}
      <Card className="rounded-2xl bg-slate-900/70 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Send className="w-5 h-5 text-amber-400" />
            ارسال آزمایشی پیامک OTP
          </CardTitle>
          <p className="text-xs text-slate-500 mt-1">
            {sendMode
              ? `پیامک آزمایشی با روش فعال (${sendMode === "pattern" ? "الگو/پترن" : "دستی + خط ارسال"}) و کد تصادفی به شماره دلخواه ارسال می‌شود`
              : "ابتدا روش ارسال را کامل کنید — سپس پیامک آزمایشی با همان روش ارسال می‌شود"}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <Input
              value={testSendTo}
              onChange={(e) => setTestSendTo(e.target.value)}
              className="rounded-xl bg-slate-800/70 border-slate-700 text-white flex-1"
              placeholder="شماره موبایل مقصد — ۰۹۱۲۳۴۵۶۷۸۹"
              dir="ltr"
              inputMode="tel"
            />
            <Button
              onClick={sendTest}
              disabled={sending || !testSendTo.trim() || !active}
              variant="outline"
              className="rounded-xl font-bold border-amber-500/40 text-amber-300 hover:bg-amber-500/10 gap-2"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? "در حال ارسال..." : "ارسال پیامک آزمایشی"}
            </Button>
          </div>
          {!active && (
            <p className="text-[11px] text-amber-400/80">
              {settings.enabled
                ? "برای ارسال آزمایشی، روش ارسال (کد الگو یا خط ارسال) را کامل کنید"
                : "برای ارسال آزمایشی، ابتدا پیکربندی را کامل و فعال کنید"}
            </p>
          )}
          {sendResult && (
            <div className={`flex items-start gap-2.5 rounded-xl p-3.5 text-xs leading-relaxed border ${sendResult.ok ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300" : "bg-rose-500/10 border-rose-500/25 text-rose-300"}`}>
              {sendResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <div>
                <p className="font-bold">{sendResult.ok ? "ارسال شد" : "ارسال ناموفق"}</p>
                <p className="mt-0.5 opacity-90">{sendResult.message || sendResult.error}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Skeleton_() {
  // اسکلتون هم‌شکل چیدمان نهایی — نه یک میله‌ی کوچک گمراه‌کننده
  return (
    <div className="space-y-4" aria-busy="true" aria-label="در حال بارگذاری تنظیمات پنل پیامک">
      <div className="h-24 rounded-2xl bg-slate-800/60 animate-pulse" />
      <div className="h-16 rounded-2xl bg-slate-800/60 animate-pulse" />
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-4">
        <div className="h-5 w-44 rounded-lg bg-slate-800/60 animate-pulse" />
        <div className="grid sm:grid-cols-2 gap-4 pt-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3.5 w-28 rounded bg-slate-800/60 animate-pulse" />
              <div className="h-10 rounded-xl bg-slate-800/60 animate-pulse" />
            </div>
          ))}
        </div>
        <div className="h-16 rounded-xl bg-slate-800/60 animate-pulse" />
        <div className="h-[68px] rounded-xl bg-slate-800/60 animate-pulse" />
      </div>
    </div>
  );
}
