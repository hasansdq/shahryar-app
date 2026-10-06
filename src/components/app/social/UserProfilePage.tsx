// ═════ صفحه پروفایل عمومی — wrapper اتصال به استور ═══
// این صفحه وقتی active است که store.userProfileId تنظیم شده باشد؛
// گفتگو (DM/ایجنت) از داخل پروفایل → بازگشت به شهریار + باز شدن چت
"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { post } from "@/lib/client/api";
import { useAppStore } from "@/lib/client/store";
import UserProfileView from "./UserProfileView";

export default function UserProfilePage() {
  const userProfileId = useAppStore((s) => s.userProfileId);
  const [starting, setStarting] = useState(false);

  // ⚠️ هرگز setter استور را داخل رندر صدا نزنید:
  // AnimatePresence هنگام انیمیشن خروج این کامپوننت را زنده نگه می‌دارد،
  // در حالی که openChat هم‌زمان userProfileId را null کرده است؛ فراخوانی
  // closeUserProfile() در رندر → آپدیت استور → رندر مجدد → حلقه بی‌نهایت و فریز صفحه.
  if (!userProfileId) return null;

  const openChat = async (type: "dm" | "agent", userId: string) => {
    if (starting) return;
    setStarting(true);
    const res = await post<{ conversationId: string; type: string }>("/api/social/conversations", { type, userId });
    setStarting(false);
    if (res.success && res.data) {
      // الگوی موجود اپ: گفتگوی در انتظار در sessionStorage → SocialView هنگام mount بازش می‌کند
      try {
        sessionStorage.setItem("social:openChat", res.data.conversationId);
      } catch {
        /* private browsing */
      }
      // بازگشت به شهریار (حتی اگر از انجمن‌ها آمده بودیم — چت در شهریار باز می‌شود)
      useAppStore.setState({ view: "social", userProfileId: null, userProfileBackTo: "social" });
    } else {
      toast({ title: "شروع گفتگو نشد", description: res.error, variant: "destructive" });
    }
  };

  if (starting) {
    return (
      <div className="grid h-64 place-items-center" dir="rtl">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm font-bold">در حال آماده‌سازی گفتگو…</p>
        </div>
      </div>
    );
  }

  return <UserProfileView key={userProfileId} userId={userProfileId} onOpenChat={openChat} />;
}
