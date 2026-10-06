// ═════ پنل مدیریت شهریار — /shah-ad — ورود فوق‌امنیتی با طراحی سینمایی ═════
"use client";

import { useEffect, useState } from "react";
import { Crown, ShieldCheck, UserRound, Lock, Eye, EyeOff, LogIn, Fingerprint, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { get, post } from "@/lib/client/api";
import { motion, AnimatePresence } from "framer-motion";
import AdminShell from "@/components/admin/AdminShell";

interface AdminInfo {
  id: string;
  username: string;
  name: string;
  role: string;
}

export default function AdminPage() {
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await get<{ admin: AdminInfo }>("/api/admin/auth/me");
      if (active) {
        if (res.success && res.data?.admin) setAdmin(res.data.admin);
        setChecking(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !username.trim() || !password) return;
    setSubmitting(true);
    setError("");
    const res = await post<{ admin: AdminInfo }>("/api/admin/auth/login", {
      username: username.trim(),
      password,
    });
    if (res.success && res.data?.admin) {
      setAdmin(res.data.admin);
    } else {
      setSubmitting(false);
      setError(res.error || "ورود ناموفق بود");
      setShake((s) => s + 1);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex flex-col items-center justify-center gap-5" dir="rtl">
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="w-16 h-16 rounded-2xl shahryar-gradient flex items-center justify-center shadow-blue-glow-lg"
        >
          <Crown className="w-9 h-9 text-white" />
        </motion.div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-2 h-2 rounded-full bg-blue-400"
              animate={{ opacity: [0.25, 1, 0.25], y: [0, -5, 0] }}
              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (admin) {
    return <AdminShell admin={admin} onLogout={() => setAdmin(null)} />;
  }

  // ─── صفحه لاگین فوق امنیتی ───
  return (
    <div className="min-h-screen bg-[#0a0f1e] relative overflow-hidden flex items-center justify-center p-4" dir="rtl">
      {/* ── پس‌زمینه سینمایی: شبکه + شفق آبی ── */}
      <div className="bg-grid-blue absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_45%,black,transparent)]" />
      <motion.div
        className="absolute -top-40 right-[10%] w-[34rem] h-[34rem] rounded-full bg-[oklch(0.5_0.19_258_/_0.22)] blur-3xl"
        animate={{ scale: [1, 1.18, 1], x: [0, -45, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-48 left-[8%] w-[30rem] h-[30rem] rounded-full bg-[oklch(0.6_0.15_235_/_0.16)] blur-3xl"
        animate={{ scale: [1.1, 0.95, 1.1], x: [0, 40, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      <motion.div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-[oklch(0.55_0.18_268_/_0.12)] blur-3xl"
        animate={{ opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* خط نوری عمودی تزئینی */}
      <div className="absolute inset-y-0 left-1/2 w-px bg-gradient-to-b from-transparent via-blue-500/30 to-transparent pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        {/* برند */}
        <div className="text-center mb-9">
          <motion.div
            initial={{ scale: 0, rotate: -14 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", damping: 11, delay: 0.15 }}
            className="relative w-[5.5rem] h-[5.5rem] mx-auto"
          >
            <span className="absolute inset-0 rounded-3xl bg-blue-500/25 blur-xl animate-glow-pulse" />
            <div className="relative w-full h-full rounded-3xl shahryar-gradient flex items-center justify-center shadow-blue-glow-lg">
              <Crown className="w-11 h-11 text-white" />
            </div>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-3xl font-black text-white mt-5"
          >
            پنل مدیریت شهریار
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-slate-400 text-sm mt-2"
          >
            سامانه مدیریت جامع شهر هوشمند رفسنجان
          </motion.p>
        </div>

        {/* کارت ورود با حاشیه گرادیانی */}
        <motion.div
          key={shake}
          animate={shake ? { x: [0, -9, 9, -6, 6, -3, 0] } : {}}
          transition={{ duration: 0.45 }}
          className="relative rounded-[1.65rem] p-[1.5px] bg-gradient-to-br from-blue-500/60 via-sky-400/25 to-indigo-500/50 shadow-blue-glow-lg"
        >
          <div className="absolute -inset-[2px] rounded-[1.7rem] bg-gradient-to-br from-blue-500/35 to-indigo-500/35 blur-3xl opacity-55 animate-glow-pulse pointer-events-none" />
          <form
            onSubmit={handleLogin}
            className="relative glass-dark rounded-[1.6rem] p-8"
          >
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex items-center gap-2 text-blue-300 text-xs mb-7 bg-blue-500/10 border border-blue-400/15 rounded-xl p-3"
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>ورود امن با محافظت Brute-Force و رمزنگاری scrypt</span>
            </motion.div>

            <div className="space-y-5">
              <motion.div
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.55 }}
                className="space-y-2"
              >
                <Label htmlFor="username" className="text-slate-300">نام کاربری</Label>
                <div className="relative">
                  <UserRound className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none" />
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pr-12 h-12 rounded-xl bg-slate-900/60 border-slate-700/80 text-white placeholder:text-slate-600 focus:border-blue-500/70 focus:shadow-[0_0_0_4px_oklch(0.5_0.19_258/0.12)] transition-all"
                    placeholder="نام کاربری مدیر"
                    autoComplete="username"
                    dir="ltr"
                  />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.65 }}
                className="space-y-2"
              >
                <Label htmlFor="admin-password" className="text-slate-300">رمز عبور</Label>
                <div className="relative">
                  <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none" />
                  <Input
                    id="admin-password"
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-12 pl-11 h-12 rounded-xl bg-slate-900/60 border-slate-700/80 text-white placeholder:text-slate-600 focus:border-blue-500/70 focus:shadow-[0_0_0_4px_oklch(0.5_0.19_258/0.12)] transition-all"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </motion.div>

              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-rose-400 text-sm bg-rose-500/10 border border-rose-500/25 rounded-xl p-3 flex items-center gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0 animate-upload-pulse" />
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.75 }}
                whileTap={{ scale: 0.985 }}
              >
                <Button
                  type="submit"
                  disabled={submitting || !username.trim() || !password}
                  className="w-full h-12 rounded-xl shahryar-gradient btn-shine text-white font-bold text-base border-0 hover:brightness-110 transition-all shadow-blue-glow"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      در حال بررسی...
                    </span>
                  ) : (
                    <>
                      <LogIn className="w-5 h-5" />
                      ورود به پنل مدیریت
                    </>
                  )}
                </Button>
              </motion.div>
            </div>
          </form>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="flex items-center justify-center gap-2 text-slate-600 text-xs mt-7"
        >
          <Fingerprint className="w-3.5 h-3.5" />
          <span>دسترسی به این بخش فقط برای مدیران مجاز · تمام فعالیت‌ها ثبت می‌شود</span>
        </motion.div>
      </motion.div>
    </div>
  );
}
