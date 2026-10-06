// ═════ شهریار — صفحه اصلی اپلیکیشن ═════
"use client";

import { useEffect } from "react";
import { useAppStore, type CurrentUser } from "@/lib/client/store";
import { get } from "@/lib/client/api";
import AuthScreen from "@/components/app/AuthScreen";
import AppShell from "@/components/app/AppShell";

export default function Home() {
  const { user, loading, setUser, setLoading } = useAppStore();

  // بررسی وضعیت ورود کاربر
  useEffect(() => {
    let mounted = true;
    get<{ user: CurrentUser }>("/api/auth/me").then((res) => {
      if (!mounted) return;
      if (res.success && res.data?.user) {
        setUser(res.data.user);
      } else {
        setUser(null);
      }
    });
    return () => {
      mounted = false;
    };
  }, [setUser]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <div className="flex flex-col items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-3xl shahryar-gradient flex items-center justify-center shadow-xl animate-float">
              <svg viewBox="0 0 64 64" className="w-11 h-11">
                <path d="M16 42 L14 24 L23 31 L32 18 L41 31 L50 24 L48 42 Z" fill="white" opacity="0.95" />
                <rect x="16" y="44" width="32" height="4.5" rx="2.25" fill="white" opacity="0.95" />
              </svg>
            </div>
            <span className="absolute inset-0 rounded-3xl bg-primary/20 animate-pulse-ring" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black shahryar-gradient-text">شهریار</h1>
            <p className="text-muted-foreground text-sm mt-2">دستیار هوشمند شهر رفسنجان</p>
          </div>
          <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin" style={{ borderWidth: 3 }} />
        </div>
      </div>
    );
  }

  return user ? <AppShell /> : <AuthScreen />;
}
