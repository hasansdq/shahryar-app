// ═════ ویرایشگر پروفایل حرفه‌ای شهریار — تب پروفایل کاربری ═════
// بنر (تصویر/تم) + عنوان شغلی + مهارت‌ها + سوابق + تحصیلات + علایق + لینک‌ها
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Briefcase, Building2, Camera, Check, Crown, Eye, FileText, GraduationCap, Heart, ImagePlus,
  Link2, Loader2, Plus, Save, Sparkles, Trash2, Users, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { get, put } from "@/lib/client/api";
import { uploadMedia } from "@/lib/client/media";
import { faNum } from "@/lib/client/persian";
import {
  BANNER_THEMES,
  BANNER_THEME_KEYS,
  SKILL_LEVEL_LABELS,
  type EducationItem,
  type ExperienceItem,
  type LinkItem,
  type SkillItem,
} from "@/lib/modules/social/types";

export interface SocialProfileForm {
  headline: string;
  bio: string;
  city: string;
  bannerUrl: string;
  bannerTheme: string;
  skills: SkillItem[];
  interests: string[];
  education: EducationItem[];
  experience: ExperienceItem[];
  links: LinkItem[];
  isDiscoverable: boolean;
}

interface MyProfileData {
  profile: SocialProfileForm & { viewCount: number; updatedAt: string } | null;
  agentStats: { items: number; totalChars: number };
  endorsementsReceived: number;
}

const DEGREES = ["دیپلم", "کاردانی", "کارشناسی", "کارشناسی ارشد", "دکتری", "سایر"];
const EMPTY: SocialProfileForm = {
  headline: "", bio: "", city: "رفسنجان", bannerUrl: "", bannerTheme: "aurora",
  skills: [], interests: [], education: [], experience: [], links: [], isDiscoverable: true,
};

/** سنجه‌ی قوت پروفایل (مثل LinkedIn) */
function profileStrength(f: SocialProfileForm): { score: number; label: string } {
  let score = 0;
  if (f.headline) score += 15;
  if (f.bio && f.bio.length > 60) score += 15;
  if (f.skills.length >= 3) score += 20;
  if (f.experience.length > 0) score += 20;
  if (f.education.length > 0) score += 10;
  if (f.interests.length >= 3) score += 10;
  if (f.links.length > 0) score += 10;
  const label = score >= 85 ? "فوق‌حرفه‌ای" : score >= 60 ? "حرفه‌ای" : score >= 35 ? "در حال رشد" : "پایه";
  return { score: Math.min(100, score), label };
}

export default function ProfileSocialEditor() {
  const [data, setData] = useState<MyProfileData | null>(null);
  const [form, setForm] = useState<SocialProfileForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // ورودی‌های موقت
  const [newSkill, setNewSkill] = useState("");
  const [newInterest, setNewInterest] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await get<MyProfileData>("/api/social/profile");
      if (!active) return;
      if (res.success && res.data) {
        setData(res.data);
        if (res.data.profile) {
          const p = res.data.profile;
          setForm({
            headline: p.headline || "",
            bio: p.bio || "",
            city: p.city || "رفسنجان",
            bannerUrl: p.bannerUrl || "",
            bannerTheme: p.bannerTheme || "aurora",
            skills: p.skills || [],
            interests: p.interests || [],
            education: p.education || [],
            experience: p.experience || [],
            links: p.links || [],
            isDiscoverable: p.isDiscoverable !== false,
          });
        }
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    const res = await put("/api/social/profile", {
      ...form,
      bannerUrl: form.bannerUrl || null,
    });
    setSaving(false);
    if (res.success) {
      toast({
        title: "پروفایل شهریار ذخیره شد 🎉",
        description: form.isDiscoverable ? "از این پس در دایرکتوری افراد دیده می‌شوید" : "پروفایل شما از دایرکتوری پنهان است",
      });
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const handleBannerSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingBanner(true);
    const result = await uploadMedia(file, "misc");
    if (result) {
      setForm((f) => ({ ...f, bannerUrl: result.url }));
      toast({ title: "بنر پروفایل آماده شد", description: "برای اعمال، ذخیره کن" });
    }
    setUploadingBanner(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    );
  }

  const strength = profileStrength(form);
  const theme = BANNER_THEMES[form.bannerTheme] || BANNER_THEMES.aurora;

  return (
    <div className="space-y-5">
      {/* ═══ پیش‌نمایش زنده‌ی هویت ═══ */}
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm">
        <div className="relative h-28" style={{ background: theme.gradient }}>
          {form.bannerUrl ? (
             
            <img src={form.bannerUrl} alt="بنر" className="absolute inset-0 size-full object-cover" />
          ) : null}
          <div aria-hidden className="pattern-dots absolute inset-0 opacity-25" />
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
            onChange={handleBannerSelect}
            className="hidden"
          />
          <button
            onClick={() => bannerInputRef.current?.click()}
            disabled={uploadingBanner}
            className="absolute end-3 top-3 inline-flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/15 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-md transition-all hover:bg-white/30"
          >
            {uploadingBanner ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
            {form.bannerUrl ? "تغییر تصویر بنر" : "بارگذاری بنر"}
          </button>
          {form.bannerUrl ? (
            <button
              onClick={() => setForm((f) => ({ ...f, bannerUrl: "" }))}
              className="absolute start-3 top-3 inline-flex items-center gap-1 rounded-xl border border-white/25 bg-white/15 px-2.5 py-1.5 text-[11px] font-bold text-white backdrop-blur-md hover:bg-red-500/40"
            >
              <X className="size-3.5" />
              حذف تصویر
            </button>
          ) : null}
        </div>

        {/* تم‌های بنر */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <span className="text-[11px] font-bold text-muted-foreground">تم بنر:</span>
          {BANNER_THEME_KEYS.map((k) => (
            <button
              key={k}
              onClick={() => setForm((f) => ({ ...f, bannerUrl: "", bannerTheme: k }))}
              title={BANNER_THEMES[k].label}
              className={`size-7 rounded-xl transition-all ${form.bannerTheme === k ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : "hover:scale-110"}`}
              style={{ background: BANNER_THEMES[k].gradient }}
            />
          ))}
          <span className="mr-1 text-[11px] text-muted-foreground">({theme.label})</span>
        </div>

        {/* سنجه‌ی قوت پروفایل */}
        <div className="border-t border-border/60 px-4 py-3.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-bold">
              <Crown className="size-3.5 text-amber-500" />
              قوت پروفایل: <span className="text-primary">{strength.label}</span>
            </span>
            <span className="tnum text-muted-foreground">{faNum(strength.score)}٪</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="shahryar-gradient h-full rounded-full transition-all duration-700"
              style={{ width: `${strength.score}%` }}
            />
          </div>
        </div>
      </div>

      {/* ═══ اطلاعات پایه ═══ */}
      <div className="space-y-4 rounded-3xl border border-border/60 bg-card p-5">
        <h3 className="flex items-center gap-2 font-black">
          <Users className="size-5 text-primary" />
          هویت حرفه‌ای
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>عنوان شغلی *</Label>
            <Input
              value={form.headline}
              onChange={(e) => setForm({ ...form, headline: e.target.value })}
              maxLength={80}
              placeholder="مثلاً: توسعه‌دهنده موبایل | طراح رابط کاربری"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label>شهر/محله فعالیت</Label>
            <Input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              maxLength={40}
              placeholder="رفسنجان"
              className="rounded-xl"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>درباره‌ی حرفه‌ای من</Label>
          <Textarea
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            maxLength={800}
            className="min-h-24 rounded-xl"
            placeholder="تجربه‌ها، تخصص‌ها و چیزی که شما را متمایز می‌کند… (برای معرفی بهتر توسط ایجنتتان هم استفاده می‌شود)"
          />
          <p className="text-left text-[10px] text-muted-foreground tnum">{faNum(form.bio.length)}/۸۰۰</p>
        </div>

        {/* مهارت‌ها */}
        <div className="space-y-2">
          <Label>مهارت‌ها (حداکثر ۲۰)</Label>
          <div className="flex gap-2">
            <Input
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newSkill.trim()) {
                  e.preventDefault();
                  addSkill();
                }
              }}
              maxLength={40}
              placeholder="مثلاً: React، حسابداری، تدریس…"
              className="rounded-xl"
            />
            <Button onClick={addSkill} variant="outline" className="shrink-0 rounded-xl" disabled={!newSkill.trim()}>
              <Plus className="size-4" />
            </Button>
          </div>
          {form.skills.length > 0 ? (
            <div className="space-y-2 pt-1">
              {form.skills.map((s, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 p-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{s.name}</span>
                  <Select
                    value={String(s.level)}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        skills: f.skills.map((x, j) => (j === i ? { ...x, level: Number(v) } : x)),
                      }))
                    }
                  >
                    <SelectTrigger className="h-8 w-28 rounded-lg text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4].map((l) => (
                        <SelectItem key={l} value={String(l)}>{SKILL_LEVEL_LABELS[l]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    onClick={() => setForm((f) => ({ ...f, skills: f.skills.filter((_, j) => j !== i) }))}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label="حذف مهارت"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* علایق حرفه‌ای */}
        <div className="space-y-2">
          <Label>علایق حرفه‌ای</Label>
          <div className="flex gap-2">
            <Input
              value={newInterest}
              onChange={(e) => setNewInterest(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newInterest.trim()) {
                  e.preventDefault();
                  addInterest();
                }
              }}
              maxLength={40}
              placeholder="مثلاً: استارتاپ، پسته، هوش مصنوعی…"
              className="rounded-xl"
            />
            <Button onClick={addInterest} variant="outline" className="shrink-0 rounded-xl" disabled={!newInterest.trim()}>
              <Plus className="size-4" />
            </Button>
          </div>
          {form.interests.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {form.interests.map((i, idx) => (
                <button
                  key={idx}
                  onClick={() => setForm((f) => ({ ...f, interests: f.interests.filter((_, j) => j !== idx) }))}
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted px-2.5 py-1 text-[11px] font-medium transition-colors hover:border-destructive/40 hover:text-destructive"
                >
                  {i}
                  <X className="size-3" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* دیده‌شدن در دایرکتوری */}
        <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/40 p-3.5">
          <div className="flex items-center gap-2.5">
            <Eye className="size-4 text-primary" />
            <div>
              <p className="text-sm font-bold">دیده‌شدن در دایرکتوری شهریار</p>
              <p className="text-[11px] text-muted-foreground">پروفایلم برای سایر کاربران نمایش داده شود</p>
            </div>
          </div>
          <Switch
            checked={form.isDiscoverable}
            onCheckedChange={(v) => setForm((f) => ({ ...f, isDiscoverable: v }))}
          />
        </div>
      </div>

      {/* ═══ سوابق شغلی ═══ */}
      <ListEditor
        icon={Briefcase}
        title="سوابق شغلی"
        items={form.experience}
        onChange={(items) => setForm((f) => ({ ...f, experience: items }))}
        blank={{ role: "", company: "", description: "", startYear: "", endYear: "", current: false }}
        fields={[
          { key: "role", label: "عنوان شغل", placeholder: "مثلاً: مدیر فروش", max: 80 },
          { key: "company", label: "شرکت/محل کار", placeholder: "مثلاً: پسته اعتماد", max: 80 },
        ]}
        yearFields
        textareaKey="description"
        currentCheckbox
      />

      {/* ═══ تحصیلات ═══ */}
      <ListEditor
        icon={GraduationCap}
        title="تحصیلات"
        items={form.education}
        onChange={(items) => setForm((f) => ({ ...f, education: items }))}
        blank={{ degree: "کارشناسی", field: "", school: "", startYear: "", endYear: "", note: "" }}
        fields={[
          { key: "field", label: "رشته", placeholder: "مثلاً: مهندسی نرم‌افزار", max: 60 },
          { key: "school", label: "دانشگاه/مؤسسه", placeholder: "مثلاً: دانشگاه ولیعصر رفسنجان", max: 80 },
        ]}
        degreeSelect
        textareaKey="note"
        notePlaceholder="توضیح اختیاری…"
      />

      {/* ═══ لینک‌ها ═══ */}
      <div className="space-y-3 rounded-3xl border border-border/60 bg-card p-5">
        <h3 className="flex items-center gap-2 font-black">
          <Link2 className="size-5 text-primary" />
          لینک‌ها (وب‌سایت، نمونه‌کار…)
        </h3>
        {form.links.map((l, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/40 p-3 sm:flex-row">
            <Input
              value={l.label}
              onChange={(e) => setForm((f) => ({ ...f, links: f.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) }))}
              maxLength={40}
              placeholder="برچسب (مثلاً نمونه‌کارها)"
              className="rounded-xl sm:w-44"
            />
            <Input
              value={l.url}
              onChange={(e) => setForm((f) => ({ ...f, links: f.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) }))}
              maxLength={300}
              placeholder="https://…"
              dir="ltr"
              className="flex-1 rounded-xl"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setForm((f) => ({ ...f, links: f.links.filter((_, j) => j !== i) }))}
              className="shrink-0 rounded-xl text-destructive hover:bg-destructive/10"
              aria-label="حذف لینک"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        {form.links.length < 6 ? (
          <Button
            variant="outline"
            onClick={() => setForm((f) => ({ ...f, links: [...f.links, { label: "", url: "" }] }))}
            className="w-full rounded-xl border-dashed"
          >
            <Plus className="size-4" />
            افزودن لینک
          </Button>
        ) : null}
      </div>

      {/* ذخیره */}
      <div className="sticky bottom-20 z-10 rounded-2xl border border-border/60 bg-card/90 p-3 shadow-lg backdrop-blur-md md:bottom-4">
        <Button onClick={save} disabled={saving} className="shahryar-gradient w-full rounded-xl border-0 font-black">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {saving ? "در حال ذخیره…" : "ذخیره‌ی پروفایل شهریار"}
        </Button>
      </div>
    </div>
  );

  function addSkill() {
    const name = newSkill.trim();
    if (!name) return;
    if (form.skills.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      toast({ title: "این مهارت قبلاً اضافه شده است" });
      return;
    }
    if (form.skills.length >= 20) {
      toast({ title: "حداکثر ۲۰ مهارت می‌توانید داشته باشید" });
      return;
    }
    setForm((f) => ({ ...f, skills: [...f.skills, { name, level: 3 }] }));
    setNewSkill("");
  }

  function addInterest() {
    const v = newInterest.trim();
    if (!v) return;
    if (form.interests.length >= 15) {
      toast({ title: "حداکثر ۱۵ علاقه" });
      return;
    }
    setForm((f) => ({ ...f, interests: [...f.interests, v] }));
    setNewInterest("");
  }
}

// ═══ ادیتور لیستی عمومی (سوابق شغلی / تحصیلات) ═══

interface ListEditorField {
  key: string;
  label: string;
  placeholder: string;
  max: number;
}

function ListEditor<T extends object>({
  icon: Icon,
  title,
  items,
  onChange,
  blank,
  fields,
  yearFields,
  currentCheckbox,
  degreeSelect,
  textareaKey,
  notePlaceholder,
}: {
  icon: typeof Briefcase;
  title: string;
  items: T[];
  onChange: (items: T[]) => void;
  blank: T;
  fields: ListEditorField[];
  yearFields?: boolean;
  currentCheckbox?: boolean;
  degreeSelect?: boolean;
  textareaKey?: string;
  notePlaceholder?: string;
}) {
  const get = (item: T, key: string) => String((item as Record<string, unknown>)[key] ?? "");
  const set = (i: number, key: string, value: unknown) =>
    onChange(items.map((x, j) => (j === i ? { ...x, [key]: value } : x)));

  return (
    <div className="space-y-3 rounded-3xl border border-border/60 bg-card p-5">
      <h3 className="flex items-center gap-2 font-black">
        <Icon className="size-5 text-primary" />
        {title}
      </h3>

      {items.map((item, i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-border/60 bg-muted/40 p-3.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
              <Building2 className="size-3" />
              مورد {faNum(i + 1)}
            </span>
            <button
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              aria-label="حذف"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>

          {degreeSelect ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">مقطع</Label>
                <Select value={get(item, "degree") || "کارشناسی"} onValueChange={(v) => set(i, "degree", v)}>
                  <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEGREES.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{fields[0].label}</Label>
                <Input
                  value={get(item, fields[0].key)}
                  onChange={(e) => set(i, fields[0].key, e.target.value)}
                  maxLength={fields[0].max}
                  placeholder={fields[0].placeholder}
                  className="h-9 rounded-lg"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">{fields[1].label}</Label>
                <Input
                  value={get(item, fields[1].key)}
                  onChange={(e) => set(i, fields[1].key, e.target.value)}
                  maxLength={fields[1].max}
                  placeholder={fields[1].placeholder}
                  className="h-9 rounded-lg"
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label className="text-xs">{f.label}</Label>
                  <Input
                    value={get(item, f.key)}
                    onChange={(e) => set(i, f.key, e.target.value)}
                    maxLength={f.max}
                    placeholder={f.placeholder}
                    className="h-9 rounded-lg"
                  />
                </div>
              ))}
            </div>
          )}

          {yearFields ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">سال شروع</Label>
                <Input
                  value={get(item, "startYear")}
                  onChange={(e) => set(i, "startYear", e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="۱۳۹۸"
                  className="h-9 rounded-lg tnum"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">سال پایان</Label>
                <Input
                  value={get(item, "current") ? "" : get(item, "endYear")}
                  onChange={(e) => set(i, "endYear", e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder={get(item, "current") ? "—" : "۱۴۰۱"}
                  disabled={Boolean(get(item, "current"))}
                  className="h-9 rounded-lg tnum"
                  dir="ltr"
                />
              </div>
            </div>
          ) : null}

          {currentCheckbox ? (
            <label className="flex w-fit cursor-pointer items-center gap-2 text-xs font-bold">
              <Check
                className={`size-4 rounded-md border p-0.5 ${get(item, "current") ? "border-primary bg-primary text-white" : "border-border"}`}
              />
              <input
                type="checkbox"
                checked={Boolean(get(item, "current"))}
                onChange={(e) => set(i, "current", e.target.checked)}
                className="sr-only"
              />
              همین الان مشغولش هستم
            </label>
          ) : null}

          {textareaKey ? (
            <div className="space-y-1.5">
              <Label className="text-xs">توضیحات</Label>
              <Textarea
                value={get(item, textareaKey)}
                onChange={(e) => set(i, textareaKey, e.target.value)}
                maxLength={600}
                placeholder={notePlaceholder || "شرح مختصر فعالیت…"}
                className="min-h-16 rounded-lg text-sm"
              />
            </div>
          ) : null}
        </div>
      ))}

      {items.length < 10 ? (
        <Button
          variant="outline"
          onClick={() => onChange([...items, { ...blank }])}
          className="w-full rounded-xl border-dashed"
        >
          <Plus className="size-4" />
          افزودن به {title}
        </Button>
      ) : null}
    </div>
  );
}
