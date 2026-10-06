// ═════ تب امنیت حساب — موبایل قفل‌شده + رمز عبور دومرحله‌ای + وضعیت امنیتی ═════
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck, Lock, KeyRound, LogOut, Smartphone, Check, AlertTriangle,
  MonitorSmartphone, ShieldHalf, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import AppDialog from "@/components/ui/app-dialog";
import { api, post } from "@/lib/client/api";
import { faNum, faRelative } from "@/lib/client/persian";
import { toast } from "@/hooks/use-toast";

interface SecurityUser {
  phone: string;
  lastLoginAt: string | null;
  loginCount: number;
  hasPassword: boolean;
}

export default function SecurityTab({
  user,
  activeSessions,
  onChanged,
  onLogout,
  onOpenChangePassword,
}: {
  user: SecurityUser;
  activeSessions: number;
  onChanged: () => void;
  onLogout: () => void;
  onOpenChangePassword: () => void;
}) {
  const [enableOpen, setEnableOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const [enableForm, setEnableForm] = useState({ password: "", confirm: "" });
  const [disableForm, setDisableForm] = useState({ currentPassword: "" });

  /** فعال‌سازی رمز دومرحله‌ای */
  const enablePassword = async () => {
    if (enableForm.password.length < 8) {
      return toast({ title: "خطا", description: "رمز عبور باید حداقل ۸ کاراکتر باشد", variant: "destructive" });
    }
    if (enableForm.password !== enableForm.confirm) {
      return toast({ title: "خطا", description: "تکرار رمز عبور با رمز یکسان نیست", variant: "destructive" });
    }
    setBusy(true);
    const res = await api<{ message: string }>("/api/auth/two-factor", {
      method: "PUT",
      body: JSON.stringify({ password: enableForm.password, confirmPassword: enableForm.confirm }),
    });
    setBusy(false);
    if (res.success) {
      toast({ title: "رمز عبور فعال شد", description: "از این پس پس از کد پیامکی، رمز عبور هم پرسیده می‌شود" });
      setEnableOpen(false);
      setEnableForm({ password: "", confirm: "" });
      onChanged();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  /** غیرفعال‌سازی رمز دومرحله‌ای */
  const disablePassword = async () => {
    setBusy(true);
    const res = await api<{ message: string }>("/api/auth/two-factor", {
      method: "DELETE",
      body: JSON.stringify({ currentPassword: disableForm.currentPassword }),
    });
    setBusy(false);
    if (res.success) {
      toast({ title: "رمز عبور غیرفعال شد", description: "ورود فقط با کد پیامکی انجام می‌شود" });
      setDisableOpen(false);
      setDisableForm({ currentPassword: "" });
      onChanged();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      {/* ─── مروری بر امنیت ─── */}
      <Card className="rounded-3xl border-border/60">
        <CardContent className="p-4 sm:p-6">
          <h3 className="font-bold flex items-center gap-2 mb-4">
            <ShieldHalf className="w-5 h-5 text-primary" />
            مروری بر امنیت حساب
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-2xl p-4 text-center">
              <Smartphone className="w-5 h-5 mx-auto text-emerald-500 mb-2" />
              <p className="text-xs font-bold">ورود با کد پیامکی</p>
              <Badge className="mt-2 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15 text-[10px]">
                همیشه فعال
              </Badge>
            </div>
            <div className={`rounded-2xl p-4 text-center border ${user.hasPassword ? "bg-emerald-500/8 border-emerald-500/20" : "bg-amber-500/8 border-amber-500/20"}`}>
              <KeyRound className={`w-5 h-5 mx-auto mb-2 ${user.hasPassword ? "text-emerald-500" : "text-amber-500"}`} />
              <p className="text-xs font-bold">رمز عبور دومرحله‌ای</p>
              <Badge className={`mt-2 text-[10px] hover:bg-transparent ${user.hasPassword ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400"}`}>
                {user.hasPassword ? "فعال" : "غیرفعال"}
              </Badge>
            </div>
            <div className="bg-accent/50 rounded-2xl p-4 text-center border border-border/40">
              <MonitorSmartphone className="w-5 h-5 mx-auto text-primary mb-2" />
              <p className="text-xs font-bold">دستگاه‌های فعال</p>
              <p className="text-lg font-black mt-1.5 tnum">{faNum(activeSessions)}</p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed">
            آخرین ورود: {user.lastLoginAt ? faRelative(user.lastLoginAt) : "نامشخص"} · مجموع ورود: {faNum(user.loginCount || 0)} بار
          </p>
        </CardContent>
      </Card>

      {/* ─── شماره موبایل (قفل‌شده) ─── */}
      <Card className="rounded-3xl border-border/60">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm">شماره موبایل</p>
                <p className="text-sm text-muted-foreground tnum mt-0.5" dir="ltr">{user.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-accent/50 border border-border/50 rounded-xl px-3 py-2 shrink-0">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground font-medium">قفل</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3.5 leading-relaxed flex items-start gap-1.5">
            <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            شماره موبایل، شناسه یکتای حساب شماست و به دلایل امنیتی قابل تغییر نیست. ورود به حساب فقط با تایید پیامکی همین شماره انجام می‌شود.
          </p>
        </CardContent>
      </Card>

      {/* ─── رمز عبور دومرحله‌ای ─── */}
      <Card className="rounded-3xl border-border/60">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border ${user.hasPassword ? "bg-emerald-500/10 border-emerald-500/20" : "bg-amber-500/10 border-amber-500/20"}`}>
                <KeyRound className={`w-5 h-5 ${user.hasPassword ? "text-emerald-500" : "text-amber-500"}`} />
              </div>
              <div>
                <p className="font-bold text-sm">رمز عبور دومرحله‌ای</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {user.hasPassword ? "بعد از کد پیامکی، رمز عبور هم پرسیده می‌شود" : "لایه امنیتی دوم برای حساب شما"}
                </p>
              </div>
            </div>
            {!user.hasPassword && (
              <Button
                onClick={() => setEnableOpen(true)}
                className="rounded-xl shahryar-gradient text-white border-0 font-bold"
              >
                <ShieldCheck className="w-4 h-4" />
                فعال‌سازی رمز عبور
              </Button>
            )}
          </div>

          {user.hasPassword ? (
            <>
              <div className="flex items-start gap-2 rounded-xl bg-emerald-500/5 border border-emerald-500/15 px-3.5 py-3 text-xs text-emerald-600 dark:text-emerald-400 leading-relaxed">
                <Check className="w-4 h-4 shrink-0 mt-0.5" />
                حساب شما با تأیید دومرحله‌ای محافظت می‌شود؛ حتی با داشتن کد پیامکی، بدون رمز عبور امکان ورود وجود ندارد.
              </div>
              <div className="grid sm:grid-cols-2 gap-2.5">
                <Button variant="outline" onClick={onOpenChangePassword} className="rounded-xl gap-2 h-11">
                  <KeyRound className="w-4 h-4" />
                  تغییر رمز عبور
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setDisableOpen(true)}
                  className="rounded-xl gap-2 h-11 text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <AlertTriangle className="w-4 h-4" />
                  غیرفعال‌سازی
                </Button>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground leading-relaxed bg-accent/40 rounded-xl p-3.5">
              با فعال‌سازی رمز عبور، ورود به حساب شما دو مرحله‌ای می‌شود: ابتدا کد پیامکی و سپس رمز عبور. این لایه امنیتی در برابر سرقت شماره یا ریدایرکت پیامک‌ها از حساب شما محافظت می‌کند.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ─── خروج ─── */}
      <Card className="rounded-3xl border-border/60">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between bg-destructive/5 rounded-xl p-4 border border-destructive/20">
            <div>
              <p className="font-bold text-sm text-destructive">خروج از حساب</p>
              <p className="text-xs text-muted-foreground mt-1">پایان جلسه فعلی در این دستگاه</p>
            </div>
            <Button variant="outline" onClick={onLogout} className="rounded-xl text-destructive border-destructive/30 hover:bg-destructive/10 gap-2">
              <LogOut className="w-4 h-4" />
              خروج
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ═══ دیالوگ فعال‌سازی رمز ═══ */}
      <AppDialog
        open={enableOpen}
        onClose={() => setEnableOpen(false)}
        icon={KeyRound}
        size="sm"
        title="فعال‌سازی رمز عبور دومرحله‌ای"
        description="رمز عبور را انتخاب و تکرار کنید"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEnableOpen(false)} className="rounded-xl">انصراف</Button>
            <Button onClick={enablePassword} disabled={busy} className="shahryar-gradient text-white border-0 rounded-xl font-bold">
              <Check className="w-4 h-4" />
              {busy ? "در حال فعال‌سازی..." : "فعال‌سازی"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>رمز عبور</Label>
            <div className="relative">
              <Input
                type={showPass ? "text" : "password"}
                value={enableForm.password}
                onChange={(e) => setEnableForm({ ...enableForm, password: e.target.value })}
                className="rounded-xl pr-4 pl-11" dir="ltr"
                placeholder="حداقل ۸ کاراکتر شامل حرف و عدد"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPass ? "پنهان‌کردن رمز" : "نمایش رمز"}
              >
                {showPass ? <EyeOff className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} /> : <Eye className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>تکرار رمز عبور</Label>
            <Input
              type={showPass ? "text" : "password"}
              value={enableForm.confirm}
              onChange={(e) => setEnableForm({ ...enableForm, confirm: e.target.value })}
              className="rounded-xl" dir="ltr"
            />
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            پس از فعال‌سازی، در ورودهای بعدی بعد از کد پیامکی این رمز از شما پرسیده می‌شود.
          </p>
        </div>
      </AppDialog>

      {/* ═══ دیالوگ غیرفعال‌سازی رمز ═══ */}
      <AppDialog
        open={disableOpen}
        onClose={() => setDisableOpen(false)}
        icon={AlertTriangle}
        size="sm"
        title="غیرفعال‌سازی رمز عبور"
        description="برای تایید، رمز عبور فعلی را وارد کنید"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDisableOpen(false)} className="rounded-xl">انصراف</Button>
            <Button onClick={disablePassword} disabled={busy} variant="destructive" className="rounded-xl font-bold">
              {busy ? "در حال بررسی..." : "غیرفعال‌سازی"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>رمز عبور فعلی</Label>
            <Input
              type="password"
              value={disableForm.currentPassword}
              onChange={(e) => setDisableForm({ currentPassword: e.target.value })}
              className="rounded-xl" dir="ltr"
              autoFocus
            />
          </div>
          <p className="text-[11px] text-destructive leading-relaxed bg-destructive/5 rounded-lg p-2.5">
            با غیرفعال‌سازی، ورود به حساب فقط با کد پیامکی انجام می‌شود و لایه امنیتی دوم حذف می‌گردد.
          </p>
        </div>
      </AppDialog>
    </div>
  );
}
