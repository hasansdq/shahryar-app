// ═════ تنظیمات سیستم — عمومی و امنیت مدیر ═════
"use client";

import { useEffect, useState } from "react";
import { Settings, Save, KeyRound, UserCog, Globe, ShieldCheck, RefreshCw, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { get, put, post } from "@/lib/client/api";
import { toast } from "@/hooks/use-toast";
import SmsPanelSection from "./SmsPanelSection";

interface AppSettings {
  appName: string; city: string; province: string; supportPhone: string;
  allowRegistration: boolean; maintenanceMode: boolean; version: string;
}
interface SecuritySettings {
  maxLoginAttempts: number; lockoutMinutes: number; sessionDays: number; minPasswordLength: number;
}

export default function SettingsTab() {
  const [app, setApp] = useState<AppSettings | null>(null);
  const [security, setSecurity] = useState<SecuritySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingApp, setSavingApp] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);

  // فرم اعتبارنامه مدیر
  const [creds, setCreds] = useState({ currentPassword: "", newPassword: "", newUsername: "", newName: "" });

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await get<{ settings: { app?: { app_settings?: AppSettings }; security?: { security_settings?: SecuritySettings } } }>(
        "/api/admin/settings"
      );
      if (active && res.success && res.data) {
        if (res.data.settings.app?.app_settings) setApp(res.data.settings.app.app_settings);
        if (res.data.settings.security?.security_settings) setSecurity(res.data.settings.security.security_settings);
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const saveApp = async () => {
    if (!app || savingApp) return;
    setSavingApp(true);
    const res = await put("/api/admin/settings", { app });
    setSavingApp(false);
    if (res.success) toast({ title: "تنظیمات برنامه ذخیره شد" });
    else toast({ title: "خطا", description: res.error, variant: "destructive" });
  };

  const saveCreds = async () => {
    if (savingCreds || !creds.currentPassword || !creds.newPassword) return;
    setSavingCreds(true);
    const res = await post("/api/admin/auth/change-password", {
      currentPassword: creds.currentPassword,
      newPassword: creds.newPassword,
      newUsername: creds.newUsername || undefined,
      newName: creds.newName || undefined,
    });
    setSavingCreds(false);
    if (res.success) {
      toast({
        title: "اعتبارنامه تغییر کرد",
        description: "برای ادامه باید دوباره وارد شوید",
      });
      setTimeout(() => window.location.reload(), 1500);
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  if (loading || !app || !security) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56 rounded-xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-white">تنظیمات سامانه</h2>
        <p className="text-slate-400 text-sm mt-1">پیکربندی برنامه و امنیت</p>
      </div>

      <Tabs defaultValue="app" dir="rtl">
        <TabsList className="grid grid-cols-3 w-full rounded-2xl h-12 bg-slate-900/70 border border-slate-800">
          <TabsTrigger value="app" className="rounded-xl gap-2 text-sm data-[state=active]:bg-slate-800 text-slate-300 data-[state=active]:text-white">
            <Globe className="w-4 h-4" />
            عمومی
          </TabsTrigger>
          <TabsTrigger value="security" className="rounded-xl gap-2 text-sm data-[state=active]:bg-slate-800 text-slate-300 data-[state=active]:text-white">
            <KeyRound className="w-4 h-4" />
            امنیت و مدیر
          </TabsTrigger>
          <TabsTrigger value="sms" className="rounded-xl gap-1.5 text-[13px] data-[state=active]:bg-slate-800 text-slate-300 data-[state=active]:text-white">
            <MessageSquareText className="w-4 h-4" />
            پنل پیامکی
          </TabsTrigger>
        </TabsList>

        {/* ═══ عمومی ═══ */}
        <TabsContent value="app" className="mt-4">
          <Card className="rounded-2xl bg-slate-900/70 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-400" />
                پیکربندی برنامه
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">نام برنامه</Label>
                  <Input value={app.appName} onChange={(e) => setApp({ ...app, appName: e.target.value })}
                    className="rounded-xl bg-slate-800/70 border-slate-700 text-white" />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">شهر</Label>
                  <Input value={app.city} onChange={(e) => setApp({ ...app, city: e.target.value })}
                    className="rounded-xl bg-slate-800/70 border-slate-700 text-white" />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">استان</Label>
                  <Input value={app.province} onChange={(e) => setApp({ ...app, province: e.target.value })}
                    className="rounded-xl bg-slate-800/70 border-slate-700 text-white" />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">تلفن پشتیبانی</Label>
                  <Input value={app.supportPhone} onChange={(e) => setApp({ ...app, supportPhone: e.target.value })}
                    className="rounded-xl bg-slate-800/70 border-slate-700 text-white" dir="ltr" />
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center justify-between bg-slate-800/40 rounded-xl p-4 cursor-pointer">
                  <div>
                    <p className="text-sm font-bold text-white">ثبت‌نام کاربران جدید</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">امکان ساخت حساب جدید برای شهروندان</p>
                  </div>
                  <Switch checked={app.allowRegistration} onCheckedChange={(v) => setApp({ ...app, allowRegistration: v })} />
                </label>
                <label className="flex items-center justify-between bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 cursor-pointer">
                  <div>
                    <p className="text-sm font-bold text-amber-400">حالت تعمیر و نگهداری</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">غیرفعال‌سازی موقت دسترسی کاربران عادی</p>
                  </div>
                  <Switch checked={app.maintenanceMode} onCheckedChange={(v) => setApp({ ...app, maintenanceMode: v })} />
                </label>
              </div>

              <Button onClick={saveApp} disabled={savingApp}
                className="shahryar-gradient text-white border-0 rounded-xl font-bold">
                <Save className="w-4 h-4" />
                {savingApp ? "در حال ذخیره..." : "ذخیره تنظیمات"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ امنیت ═══ */}
        <TabsContent value="security" className="mt-4 space-y-4">
          {/* تغییر اعتبارنامه */}
          <Card className="rounded-2xl bg-slate-900/70 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-white flex items-center gap-2">
                <UserCog className="w-5 h-5 text-amber-400" />
                تغییر اعتبارنامه مدیر
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                پس از تغییر، همه سشن‌های فعال باطل می‌شوند و باید دوباره وارد شوید
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">رمز عبور فعلی *</Label>
                  <Input
                    type="password"
                    value={creds.currentPassword}
                    onChange={(e) => setCreds({ ...creds, currentPassword: e.target.value })}
                    className="rounded-xl bg-slate-800/70 border-slate-700 text-white"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">رمز عبور جدید *</Label>
                  <Input
                    type="password"
                    value={creds.newPassword}
                    onChange={(e) => setCreds({ ...creds, newPassword: e.target.value })}
                    className="rounded-xl bg-slate-800/70 border-slate-700 text-white"
                    placeholder="حداقل ۸ کاراکتر شامل حرف و عدد"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">نام کاربری جدید (اختیاری)</Label>
                  <Input
                    value={creds.newUsername}
                    onChange={(e) => setCreds({ ...creds, newUsername: e.target.value })}
                    className="rounded-xl bg-slate-800/70 border-slate-700 text-white"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">نام نمایشی (اختیاری)</Label>
                  <Input
                    value={creds.newName}
                    onChange={(e) => setCreds({ ...creds, newName: e.target.value })}
                    className="rounded-xl bg-slate-800/70 border-slate-700 text-white"
                  />
                </div>
              </div>
              <Button
                onClick={saveCreds}
                disabled={savingCreds || !creds.currentPassword || !creds.newPassword}
                className="shahryar-gradient text-white border-0 rounded-xl font-bold"
              >
                <KeyRound className="w-4 h-4" />
                {savingCreds ? "در حال اعمال..." : "تغییر اعتبارنامه"}
              </Button>
            </CardContent>
          </Card>

          {/* سیاست‌های امنیتی (نمایش) */}
          <Card className="rounded-2xl bg-slate-900/70 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
                سیاست‌های امنیتی فعال
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { label: "حداکثر تلاش ورود مدیر", value: `${security.maxLoginAttempts} تلاش در ۱۵ دقیقه` },
                  { label: "طول عمر سشن مدیر", value: "۱۲ ساعت" },
                  { label: "طول عمر سشن کاربر", value: `${security.sessionDays} روز` },
                  { label: "حداقل طول رمز عبور", value: `${security.minPasswordLength} کاراکتر` },
                  { label: "الگوریتم هش رمز", value: "scrypt (N=16384)" },
                  { label: "امضای توکن", value: "JWT HS256" },
                ].map((p) => (
                  <div key={p.label} className="flex items-center justify-between bg-slate-800/40 rounded-xl px-4 py-3">
                    <span className="text-xs text-slate-400">{p.label}</span>
                    <span className="text-xs text-blue-400 font-bold">{p.value}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-4">
                <RefreshCw className="w-3.5 h-3.5" />
                سیاست‌های امنیتی به‌صورت هسته‌ای پیاده‌سازی شده‌اند و از بخش تنظیمات برنامه قابل تغییر نیستند
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {/* ═══ پنل پیامکی ═══ */}
        <TabsContent value="sms" className="mt-4">
          <SmsPanelSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
