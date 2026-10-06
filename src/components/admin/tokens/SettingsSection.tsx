// ═════ اقتصاد توکن — قیمت‌گذاری مصرف (هر ۱M توکن / تصویر) و درگاه زرین‌پال ═════
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Coins, Image as ImageIcon, Gift, Landmark, ShieldCheck, FlaskConical, Globe, Loader2, Calculator,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { get, put, post } from "@/lib/client/api";
import { faNum } from "@/lib/client/persian";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface SettingsForm {
  enabled: boolean;
  pricePerMillion: number;
  imageGenTokens: number;
  signupBonus: number;
  dailyBonus: number;
  minChargeTokens: number;
  maxChargeTokens: number;
  zarinpal: {
    merchantId: string;
    merchantIdSet: boolean;
    sandbox: boolean;
    description: string;
    callbackUrl: string;
  };
}

const MERCHANT_PLACEHOLDER = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx";
const fa = (n: number) => n.toLocaleString("fa-IR");

/** فیلد عددی با برچسب، راهنما و نمایش کمکی */
function NumberField({
  label, hint, value, onChange, icon, dir = "ltr", suffix,
}: {
  label: string; hint?: string; value: number;
  onChange: (n: number) => void; icon?: React.ReactNode; dir?: "ltr" | "rtl"; suffix?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        {icon} {label}
      </Label>
      <div className="relative">
        <Input
          dir={dir} inputMode="numeric"
          value={String(value)}
          onChange={(e) => onChange(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
          className={suffix ? "pe-14" : undefined}
        />
        {suffix && (
          <span className="absolute end-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-muted-foreground">{suffix}</span>
        )}
      </div>
      {hint && <p className="text-[11px] text-muted-foreground leading-relaxed">{hint}</p>}
    </div>
  );
}

export default function SettingsSection({ onChanged }: { onChanged?: () => void }) {
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [merchantInput, setMerchantInput] = useState("");
  const [gatewayMsg, setGatewayMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await get<{ settings: SettingsForm }>("/api/admin/tokens/settings");
    if (res.success && res.data) {
      setForm(res.data.settings);
      setMerchantInput("");
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const save = async (extra?: Record<string, unknown>) => {
    if (!form) return;
    setSaving(true);
    const body = {
      enabled: form.enabled,
      pricePerMillion: form.pricePerMillion,
      imageGenTokens: form.imageGenTokens,
      signupBonus: form.signupBonus,
      dailyBonus: form.dailyBonus,
      minChargeTokens: form.minChargeTokens,
      maxChargeTokens: form.maxChargeTokens,
      zarinpal: {
        ...(extra?.zarinpal ?? {}),
        merchantId: merchantInput.trim() ? merchantInput.trim() : undefined,
        sandbox: form.zarinpal.sandbox,
        description: form.zarinpal.description,
        callbackUrl: form.zarinpal.callbackUrl,
      },
      ...extra,
    };
    const res = await put<{ settings: SettingsForm }>("/api/admin/tokens/settings", body);
    setSaving(false);
    if (res.success && res.data) {
      setForm(res.data.settings);
      setMerchantInput("");
      toast({ title: "تنظیمات ذخیره شد" });
      onChanged?.();
    } else {
      toast({ title: "خطا", description: res.error || "ذخیره نشد", variant: "destructive" });
    }
  };

  const testGateway = async () => {
    setTesting(true);
    setGatewayMsg(null);
    const res = await post<{ ok: boolean; message: string }>("/api/admin/tokens/gateway-test");
    setTesting(false);
    if (res.success && res.data) {
      setGatewayMsg({ ok: res.data.ok, text: res.data.message });
    } else {
      setGatewayMsg({ ok: false, text: res.error || "تست انجام نشد" });
    }
  };

  if (!form) {
    return <div className="space-y-4"><Skeleton className="h-40 rounded-3xl" /><Skeleton className="h-64 rounded-3xl" /></div>;
  }

  const pricePer1k = Math.ceil((form.pricePerMillion * 1000) / 1_000_000);
  const pricePer100k = Math.ceil((form.pricePerMillion * 100_000) / 1_000_000);
  const pricePer1M = form.pricePerMillion;

  return (
    <div className="space-y-5">
      {/* ─── کلید اصلی اقتصاد ─── */}
      <div className={cn(
        "rounded-3xl border p-5 flex flex-wrap items-center gap-4",
        form.enabled ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5"
      )}>
        <span className={cn(
          "grid size-12 place-items-center rounded-2xl",
          form.enabled ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
        )}>
          <Coins className="size-6" />
        </span>
        <div className="flex-1 min-w-56">
          <p className="font-black">اقتصاد توکن {form.enabled ? "فعال" : "غیرفعال"}</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {form.enabled
              ? "موجودی کیف هر کاربر، اعتبار مصرف هوش مصنوعی اوست — هر فراخوانی دقیقاً مثل API (توکن ورودی + خروجی) محاسبه و کسر می‌شود؛ موجودی صفر یعنی مسدودی تا شارژ."
              : "خاموش بودن یعنی همه‌ی سرویس‌های هوش مصنوعی فقط با سهمیه رایگان روزانه کار می‌کنند (رفتار قدیمی سیستم) و کسری انجام نمی‌شود."}
          </p>
        </div>
        <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
      </div>

      {/* ─── قیمت‌گذاری مصرف ─── */}
      <div className="rounded-3xl border border-border/60 bg-card p-5">
        <h3 className="font-black text-sm mb-1 flex items-center gap-2">
          <Calculator className="size-4.5 text-amber-600 dark:text-amber-400" /> قیمت‌گذاری مصرف دقیق
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          مصرف هر فراخوانی هوش مصنوعی (توکن ورودی + خروجی) از کیف کاربر کسر می‌شود؛ قیمت شارژ دلخواه از نرخ زیر محاسبه می‌گردد.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <NumberField
              label="مبلغ هر ۱٬۰۰۰٬۰۰۰ توکن"
              hint="نرخ پایه قیمت‌گذاری — کاربر هر مقدار توکنی که بخواهد شارژ می‌کند و قیمت از همین نرخ محاسبه می‌شود"
              value={form.pricePerMillion}
              onChange={(n) => setForm({ ...form, pricePerMillion: n })}
              icon={<Coins className="size-3.5 text-amber-600 dark:text-amber-400" />}
              suffix="تومان"
            />
          </div>
          <div className="space-y-1.5">
            <NumberField
              label="مصرف توکن هر تصویر تولیدی هوشیار"
              hint="تولید تصویر صورتتحساب توکنی ندارد — به‌ازای هر تصویر موفق این مقدار ثابت از کیف کسر می‌شود"
              value={form.imageGenTokens}
              onChange={(n) => setForm({ ...form, imageGenTokens: n })}
              icon={<ImageIcon className="size-3.5 text-amber-600 dark:text-amber-400" />}
              suffix="توکن"
            />
          </div>
        </div>

        {/* پیش‌نمایش قیمت‌ها */}
        <div className="mt-4 rounded-2xl bg-amber-500/5 dark:bg-amber-400/5 border border-amber-500/20 p-4">
          <p className="text-xs font-black text-amber-700 dark:text-amber-300 mb-2.5">پیش‌نمایش قیمت برای کاربر</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-background/60 px-2 py-2.5">
              <p className="text-[10px] font-bold text-muted-foreground">۱ هزار توکن</p>
              <p className="text-sm font-black mt-0.5">{fa(pricePer1k)} تومان</p>
            </div>
            <div className="rounded-xl bg-background/60 px-2 py-2.5">
              <p className="text-[10px] font-bold text-muted-foreground">۱۰۰ هزار توکن</p>
              <p className="text-sm font-black mt-0.5">{fa(pricePer100k)} تومان</p>
            </div>
            <div className="rounded-xl bg-amber-500/10 px-2 py-2.5 border border-amber-500/30">
              <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300">۱ میلیون توکن</p>
              <p className="text-sm font-black mt-0.5 text-amber-700 dark:text-amber-300">{fa(pricePer1M)} تومان</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── پاداش‌ها و سقف شارژ ─── */}
      <div className="rounded-3xl border border-border/60 bg-card p-5">
        <h3 className="font-black text-sm mb-4 flex items-center gap-2">
          <Gift className="size-4.5 text-amber-600 dark:text-amber-400" /> پاداش‌ها و سقف شارژ دلخواه
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumberField
            label="هدیه خوش‌آمد (توکن)"
            hint="اولین ساخت کیف پول — کاربران جدید و قدیمی در اولین مراجعه"
            value={form.signupBonus}
            onChange={(n) => setForm({ ...form, signupBonus: n })}
            suffix="توکن"
          />
          <NumberField
            label="پاداش روزانه حضور (توکن)"
            hint="کاربر با هر مراجعه‌ی روزانه یک‌بار می‌تواند دریافت کند (۰ = غیرفعال)"
            value={form.dailyBonus}
            onChange={(n) => setForm({ ...form, dailyBonus: n })}
            suffix="توکن"
          />
          <NumberField
            label="حداقل مقدار شارژ (توکن)"
            hint="کمتر از این مقدار در فرم شارژ کاربر پذیرفته نمی‌شود"
            value={form.minChargeTokens}
            onChange={(n) => setForm({ ...form, minChargeTokens: n })}
            suffix="توکن"
          />
          <NumberField
            label="حداکثر مقدار شارژ (توکن)"
            hint="سقف هر تراکنش شارژ دلخواه"
            value={form.maxChargeTokens}
            onChange={(n) => setForm({ ...form, maxChargeTokens: n })}
            suffix="توکن"
          />
        </div>
      </div>

      {/* ─── درگاه زرین‌پال ─── */}
      <div className="rounded-3xl border border-border/60 bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-sm flex items-center gap-2">
            <Landmark className="size-4.5 text-amber-600 dark:text-amber-400" /> درگاه پرداخت زرین‌پال
          </h3>
          {form.zarinpal.merchantIdSet ? (
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0">
              <ShieldCheck className="size-3.5" /> مرچنت تنظیم شده
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/40">
              مرچنت تنظیم نشده
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>شناسه پذیرنده (Merchant ID — ۳۶ کاراکتر)</Label>
            <Input
              dir="ltr"
              value={merchantInput}
              onChange={(e) => setMerchantInput(e.target.value)}
              placeholder={form.zarinpal.merchantIdSet ? form.zarinpal.merchantId : MERCHANT_PLACEHOLDER}
              className="font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              از پنل زرین‌پال (زرین‌پال.connect → درگاه‌ها) قابل دریافت است — خالی بگذارید تا تغییر نکند
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>توضیح پرداخت (روی رسید درگاه)</Label>
            <Input
              value={form.zarinpal.description}
              onChange={(e) => setForm({ ...form, zarinpal: { ...form.zarinpal, description: e.target.value } })}
            />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>آدرس بازگشت سفارشی (Callback URL)</Label>
            <Input
              dir="ltr"
              value={form.zarinpal.callbackUrl}
              onChange={(e) => setForm({ ...form, zarinpal: { ...form.zarinpal, callbackUrl: e.target.value } })}
              placeholder="خالی = خودکار از دامنه‌ی درخواست (پیشنهادی)"
            />
          </div>
          <div className="sm:col-span-2 rounded-2xl bg-accent/40 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {form.zarinpal.sandbox ? (
                <FlaskConical className="size-5 text-sky-600 dark:text-sky-400" />
              ) : (
                <Globe className="size-5 text-emerald-600 dark:text-emerald-400" />
              )}
              <div>
                <p className="text-sm font-bold">محیط {form.zarinpal.sandbox ? "آزمایشی (Sandbox)" : "واقعی"}</p>
                <p className="text-[11px] text-muted-foreground">
                  {form.zarinpal.sandbox
                    ? "پرداخت‌ها شبیه‌سازی می‌شوند و پول واقعی جابه‌جا نمی‌شود — برای تست"
                    : "پرداخت‌های واقعی — پس از تست کامل فعال کنید"}
                </p>
              </div>
            </div>
            <Switch
              checked={form.zarinpal.sandbox}
              onCheckedChange={(v) => setForm({ ...form, zarinpal: { ...form.zarinpal, sandbox: v } })}
            />
          </div>
        </div>

        {gatewayMsg && (
          <div className={cn(
            "mt-3 rounded-2xl px-4 py-3 text-xs font-bold",
            gatewayMsg.ok ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
          )}>
            {gatewayMsg.text}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          <Button variant="outline" onClick={testGateway} disabled={testing}>
            {testing ? <Loader2 className="size-4 animate-spin" /> : <Landmark className="size-4" />}
            تست اتصال درگاه
          </Button>
          <p className="text-[11px] text-muted-foreground self-center">
            تست با درخواست پرداخت ۱,۰۰۰ تومانی انجام می‌شود و سفارشی ثبت نمی‌کند
          </p>
        </div>
      </div>

      {/* ─── ذخیره ─── */}
      <div className="sticky bottom-4 z-10">
        <Button
          onClick={() => save()}
          disabled={saving}
          className="w-full shahryar-gradient text-white font-black h-12 shadow-lg"
        >
          {saving ? "در حال ذخیره..." : "ذخیره همه تنظیمات اقتصاد توکن"}
        </Button>
      </div>
    </div>
  );
}
