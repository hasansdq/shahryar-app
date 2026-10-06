// ═════ پروفایل کاربر — اطلاعات، حافظه هوشیار، امنیت ═════
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  UserRound, Brain, ShieldCheck, Pencil, Trash2, LogOut, Check,
  MessageCircle, Target, Sparkles, Lock, Save, Camera, Crown, Bot, Magnet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import AppDialog from "@/components/ui/app-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { get, patch, post, del } from "@/lib/client/api";
import { faNum, faDate, faRelative, LABELS } from "@/lib/client/persian";
import { uploadMedia } from "@/lib/client/media";
import { useAppStore } from "@/lib/client/store";
import { toast } from "@/hooks/use-toast";
import { useRef } from "react";
import { PersonAvatar } from "./social/social-ui";
import ProfileSocialEditor from "./social/ProfileSocialEditor";
import KnowledgeManager from "./social/KnowledgeManager";
import AgentSettingsPanel from "./social/AgentSettingsPanel";
import AgentLeadsPanel from "./social/leads/AgentLeadsPanel";
import SecurityTab from "./SecurityTab";

interface ProfileData {
  user: {
    id: string; phone: string; fullName: string | null; email: string | null;
    city: string; gender: string | null; birthYear: number | null;
    interests: string[]; bio: string | null; avatarUrl: string | null;
    createdAt: string; lastLoginAt: string | null; loginCount: number;
    hasPassword: boolean;
  };
  stats: { goalsCount: number; memoriesCount: number; messagesCount: number; activeSessions: number };
}
interface Memory {
  id: string; key: string; value: string; category: string;
  importance: number; updatedAt: string;
}

const INTEREST_OPTIONS = [
  "پسته و کشاورزی", "ورزش", "آشپزی", "فناوری", "کتابخوانی",
  "سفر", "موسیقی", "معماری", "باغبانی", "کارآفرینی",
];

export default function ProfileView() {
  const { user, logout } = useAppStore();
  const [data, setData] = useState<ProfileData | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("memories");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [passOpen, setPassOpen] = useState(false);

  // فرم ویرایش
  const [form, setForm] = useState({
    fullName: "", email: "", city: "رفسنجان", gender: "", birthYear: "", bio: "",
  });
  const [interests, setInterests] = useState<string[]>([]);

  // فرم رمز
  const [passForm, setPassForm] = useState({ currentPassword: "", newPassword: "" });
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  /** آپلود تصویر پروفایل با موتور یکپارچه */
  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingAvatar(true);
    const result = await uploadMedia(file, "avatar");
    if (result) {
      const res = await patch("/api/auth/profile", { avatarUrl: result.url });
      if (res.success) {
        toast({ title: "تصویر پروفایل به‌روزرسانی شد", description: "عکس جدیدت فوق‌العاده‌ست!" });
        loadProfile();
        // به‌روزرسانی استور سراسری
        const current = useAppStore.getState().user;
        if (current) useAppStore.getState().setUser({ ...current, avatarUrl: result.url });
      } else {
        toast({ title: "خطا", description: res.error, variant: "destructive" });
      }
    }
    setUploadingAvatar(false);
  };

  const loadProfile = async () => {
    const res = await get<ProfileData>("/api/auth/me");
    if (res.success && res.data) {
      setData(res.data);
      setForm({
        fullName: res.data.user.fullName || "",
        email: res.data.user.email || "",
        city: res.data.user.city || "رفسنجان",
        gender: res.data.user.gender || "",
        birthYear: res.data.user.birthYear ? String(res.data.user.birthYear) : "",
        bio: res.data.user.bio || "",
      });
      setInterests(res.data.user.interests || []);
    }
    setLoading(false);
  };

  const loadMemories = async () => {
    const res = await get<{ memories: Memory[] }>("/api/ai/memories");
    if (res.success && res.data) setMemories(res.data.memories);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await get<ProfileData>("/api/auth/me");
      if (active && res.success && res.data) {
        setData(res.data);
        setForm({
          fullName: res.data.user.fullName || "",
          email: res.data.user.email || "",
          city: res.data.user.city || "رفسنجان",
          gender: res.data.user.gender || "",
          birthYear: res.data.user.birthYear ? String(res.data.user.birthYear) : "",
          bio: res.data.user.bio || "",
        });
        setInterests(res.data.user.interests || []);
      }
      if (active) setLoading(false);
    })();
    (async () => {
      const res = await get<{ memories: Memory[] }>("/api/ai/memories");
      if (active && res.success && res.data) setMemories(res.data.memories);
    })();
    return () => {
      active = false;
    };
  }, []);

  const saveProfile = async () => {
    if (saving) return;
    setSaving(true);
    const res = await patch("/api/auth/profile", {
      ...form,
      gender: form.gender || null,
      birthYear: form.birthYear || null,
      interests,
    });
    setSaving(false);
    if (res.success) {
      toast({ title: "پروفایل ذخیره شد" });
      setEditing(false);
      loadProfile();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const changePassword = async () => {
    const res = await post("/api/auth/change-password", passForm);
    if (res.success) {
      toast({ title: "رمز عبور تغییر کرد" });
      setPassOpen(false);
      setPassForm({ currentPassword: "", newPassword: "" });
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const deleteMemory = async (id: string) => {
    const res = await del(`/api/ai/memories?id=${id}`);
    if (res.success) {
      setMemories((prev) => prev.filter((m) => m.id !== id));
    }
  };

  const clearAllMemories = async () => {
    const res = await del("/api/ai/memories");
    if (res.success) {
      setMemories([]);
      toast({ title: "حافظه هوشیار پاک شد" });
    }
  };

  const handleLogout = async () => {
    await post("/api/auth/logout");
    logout();
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4 lg:p-0 max-w-3xl mx-auto">
        <Skeleton className="h-44 rounded-3xl" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    );
  }

  const u = data?.user;

  return (
    <div className="p-4 lg:p-0 max-w-3xl mx-auto space-y-5" dir="rtl">
      {/* ─── کارت پروفایل ─── */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="rounded-3xl border-border/60 overflow-hidden">
          <div className="shahryar-gradient h-24 relative">
            <div className="pattern-dots absolute inset-0 opacity-30" />
          </div>
          <CardContent className="p-4 sm:p-6 -mt-12">
            <div className="flex items-end justify-between mb-5">
              <div className="relative group">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                  onChange={handleAvatarSelect}
                  className="hidden"
                />
                {u?.avatarUrl ? (
                  <img
                    src={u.avatarUrl}
                    alt={u.fullName || "تصویر پروفایل"}
                    className="w-20 h-20 md:w-24 md:h-24 rounded-3xl object-cover shadow-xl border-4 border-card"
                  />
                ) : (
                  <PersonAvatar
                    name={u?.fullName || "ش"}
                    color={user?.avatarColor || "0"}
                    radius="3xl"
                    className="w-20 h-20 md:w-24 md:h-24 border-4 border-card text-3xl md:text-4xl"
                  />
                )}
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute -bottom-1.5 -left-1.5 w-9 h-9 rounded-2xl shahryar-gradient text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform border-2 border-card"
                  title="تغییر تصویر پروفایل"
                >
                  {uploadingAvatar ? (
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Camera className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                  )}
                </button>
              </div>
              <Button
                variant="outline"
                onClick={() => setEditing(!editing)}
                className="rounded-xl gap-2"
              >
                {editing ? <><X_ /> انصراف</> : <><Pencil className="w-4 h-4" /> ویرایش پروفایل</>}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div>
                <h2 className="text-lg md:text-xl font-black">{u?.fullName || "کاربر شهریار"}</h2>
                <p className="text-sm text-muted-foreground tnum mt-1" dir="ltr">{u?.phone}</p>
              </div>
              <Badge variant="secondary" className="gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                عضو از {faDate(u?.createdAt || new Date())}
              </Badge>
            </div>

            {/* آمار */}
            <div className="grid grid-cols-3 gap-3 mt-6">
              {[
                { label: "اهداف فعال", value: data?.stats.goalsCount ?? 0, icon: Target },
                { label: "پیام‌های هوشیار", value: data?.stats.messagesCount ?? 0, icon: MessageCircle },
                { label: "خاطرات هوشیار", value: data?.stats.memoriesCount ?? 0, icon: Brain },
              ].map((s) => (
                <div key={s.label} className="bg-accent/50 rounded-2xl p-4 text-center">
                  <s.icon className="w-5 h-5 mx-auto text-primary mb-2" />
                  <p className="text-xl md:text-2xl font-black tnum">{faNum(s.value)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {u?.bio && !editing && (
              <p className="text-sm text-foreground/80 leading-relaxed mt-5 bg-accent/30 rounded-xl p-3.5">
                {u.bio}
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── فرم ویرایش ─── */}
      {editing && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
          <Card className="rounded-3xl border-border/60">
            <CardContent className="p-4 sm:p-6 space-y-4">
              <h3 className="font-bold flex items-center gap-2">
                <UserRound className="w-5 h-5 text-primary" />
                اطلاعات شخصی
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>نام و نام خانوادگی</Label>
                  <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>ایمیل (اختیاری)</Label>
                  <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-xl" dir="ltr" placeholder="example@mail.com" />
                </div>
                <div className="space-y-2">
                  <Label>شهر</Label>
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>سال تولد (اختیاری)</Label>
                  <Input value={form.birthYear} onChange={(e) => setForm({ ...form, birthYear: e.target.value })} className="rounded-xl tnum" placeholder="۱۳۷۵" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>درباره من</Label>
                <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="rounded-xl min-h-20" placeholder="چند خط درباره خودت بنویس تا هوشیار بهتر بشناسدت..." />
              </div>
              <div className="space-y-2">
                <Label>علایق (برای شخصی‌سازی هوشیار)</Label>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_OPTIONS.map((i) => {
                    const active = interests.includes(i);
                    return (
                      <button
                        key={i}
                        onClick={() => setInterests(active ? interests.filter((x) => x !== i) : [...interests, i])}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                          active ? "shahryar-gradient text-white border-transparent shadow" : "bg-card border-border/60 hover:border-primary/40"
                        }`}
                      >
                        {i}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Button onClick={saveProfile} disabled={saving} className="shahryar-gradient text-white border-0 rounded-xl font-bold w-full sm:w-auto">
                <Save className="w-4 h-4" />
                {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ─── تب‌ها: موبایل/تبلت ردیف اسکرول‌شونده (بدون بریدگی) / دسکتاپ گرید ۶تایی ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList className="flex w-full gap-1 overflow-x-auto no-scrollbar rounded-2xl h-12 p-1 lg:grid lg:grid-cols-6 lg:gap-0">
          <TabsTrigger value="social" className="shrink-0 rounded-xl gap-1.5 text-[13px] px-4 whitespace-nowrap">
            <Crown className="w-4 h-4" />
            شهریار
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="shrink-0 rounded-xl gap-1.5 text-[13px] px-4 whitespace-nowrap">
            <Sparkles className="w-4 h-4" />
            دانش ایجنت
          </TabsTrigger>
          <TabsTrigger value="agent" className="shrink-0 rounded-xl gap-1.5 text-[13px] px-4 whitespace-nowrap">
            <Bot className="w-4 h-4" />
            ایجنت من
          </TabsTrigger>
          <TabsTrigger value="leads" className="shrink-0 rounded-xl gap-1.5 text-[13px] px-4 whitespace-nowrap">
            <Magnet className="w-4 h-4" />
            لیدها
          </TabsTrigger>
          <TabsTrigger value="memories" className="shrink-0 rounded-xl gap-1.5 text-[13px] px-4 whitespace-nowrap">
            <Brain className="w-4 h-4" />
            حافظه هوشیار
          </TabsTrigger>
          <TabsTrigger value="security" className="shrink-0 rounded-xl gap-1.5 text-[13px] px-4 whitespace-nowrap">
            <ShieldCheck className="w-4 h-4" />
            امنیت حساب
          </TabsTrigger>
        </TabsList>

        <TabsContent value="social" className="mt-4">
          <ProfileSocialEditor />
        </TabsContent>

        <TabsContent value="knowledge" className="mt-4">
          <KnowledgeManager />
        </TabsContent>

        <TabsContent value="agent" className="mt-4">
          <AgentSettingsPanel onOpenLeads={() => setActiveTab("leads")} />
        </TabsContent>

        <TabsContent value="leads" className="mt-4">
          <AgentLeadsPanel />
        </TabsContent>

        <TabsContent value="memories" className="mt-4">
          <Card className="rounded-3xl border-border/60">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold flex items-center gap-2">
                  <Brain className="w-5 h-5 text-violet-500" />
                  چیزهایی که هوشیار درباره‌ات یاد گرفته
                </h3>
                {memories.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearAllMemories} className="text-destructive hover:bg-destructive/10 rounded-xl">
                    <Trash2 className="w-4 h-4" />
                    پاک‌کردن همه
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
                هوشیار به‌صورت خودکار از گفتگوهایتان یاد می‌گیرد و این اطلاعات را برای شخصی‌سازی پاسخ‌ها استفاده می‌کند. هر زمان بخواهید می‌توانید حذفشان کنید.
              </p>
              <div className="space-y-2.5">
                {memories.length === 0 ? (
                  <div className="text-center py-10">
                    <Brain className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">هنوز چیزی یاد نگرفته! با هوشیار بیشتر گفتگو کن</p>
                  </div>
                ) : (
                  memories.map((m) => (
                    <motion.div
                      key={m.id}
                      layout
                      className="group flex items-start gap-3 bg-accent/40 rounded-xl p-3.5 hover:bg-accent/70 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black">{m.key}</span>
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                            {LABELS.memoryCategories[m.category]}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{faRelative(m.updatedAt)}</span>
                        </div>
                        <p className="text-sm text-foreground/80 mt-1.5 leading-relaxed">{m.value}</p>
                      </div>
                      <button
                        onClick={() => deleteMemory(m.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          {u && (
            <SecurityTab
              user={{
                phone: u.phone,
                lastLoginAt: u.lastLoginAt,
                loginCount: u.loginCount,
                hasPassword: !!u.hasPassword,
              }}
              activeSessions={data?.stats.activeSessions ?? 0}
              onChanged={loadProfile}
              onLogout={handleLogout}
              onOpenChangePassword={() => setPassOpen(true)}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* دیالوگ تغییر رمز */}
      <AppDialog
        open={passOpen}
        onClose={() => setPassOpen(false)}
        icon={Lock}
        size="sm"
        title="تغییر رمز عبور"
        description="امنیت حساب‌ت را هر چند وقت یک‌بار تازه کن"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPassOpen(false)} className="rounded-xl">انصراف</Button>
            <Button onClick={changePassword} className="shahryar-gradient text-white border-0 rounded-xl font-bold">
              <Check className="w-4 h-4" />
              تغییر رمز
            </Button>
          </>
        }
      >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>رمز عبور فعلی</Label>
              <Input
                type="password"
                value={passForm.currentPassword}
                onChange={(e) => setPassForm({ ...passForm, currentPassword: e.target.value })}
                className="rounded-xl" dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>رمز عبور جدید</Label>
              <Input
                type="password"
                value={passForm.newPassword}
                onChange={(e) => setPassForm({ ...passForm, newPassword: e.target.value })}
                className="rounded-xl" dir="ltr"
                placeholder="حداقل ۸ کاراکتر شامل حرف و عدد"
              />
            </div>
          </div>
      </AppDialog>
    </div>
  );
}

function X_() {
  return <Trash2 className="w-4 h-4" />;
}
