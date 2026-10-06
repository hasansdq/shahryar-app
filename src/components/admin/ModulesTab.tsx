// ═════ ماژول‌های اپ — فعال/غیرفعال + کانفیگ حرفه‌ای هر ماژول ═════
"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Blocks, Settings2, RotateCcw, Loader2, Lock, ShieldCheck, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import AppDialog from "@/components/ui/app-dialog";
import { get, patch } from "@/lib/client/api";
import { faNum, faRelative } from "@/lib/client/persian";
import { iconOf } from "@/lib/client/iconRegistry";
import { toast } from "@/hooks/use-toast";

interface ConfigField {
  key: string;
  label: string;
  type: "boolean" | "number";
  default: boolean | number;
  min?: number;
  max?: number;
  hint?: string;
}

interface ModuleRow {
  key: string;
  name: string;
  description: string | null;
  icon: string;
  group: string;
  isCore: boolean;
  isEnabled: boolean;
  sortOrder: number;
  config: Record<string, boolean | number>;
  updatedAt: string;
  usage: number;
  configSchema: ConfigField[];
}

export default function ModulesTab() {
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // دیالوگ تنظیمات
  const [editing, setEditing] = useState<ModuleRow | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [draftConfig, setDraftConfig] = useState<Record<string, boolean | number>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await get<{ modules: ModuleRow[] }>("/api/admin/modules");
    if (res.success && res.data) setModules(res.data.modules);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  /** فعال/غیرفعال‌کردن سریع */
  const toggle = async (m: ModuleRow) => {
    if (m.isCore) return;
    setBusyKey(m.key);
    const res = await patch(`/api/admin/modules/${m.key}`, { isEnabled: !m.isEnabled });
    setBusyKey(null);
    if (res.success) {
      toast({
        title: !m.isEnabled ? `ماژول «${m.name}» فعال شد` : `ماژول «${m.name}» غیرفعال شد`,
        description: !m.isEnabled ? "برای کاربران در دسترس است" : "از ناوبری اپ حذف می‌شود و APIها هم بسته می‌شوند",
      });
      load();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const openSettings = (m: ModuleRow) => {
    setEditing(m);
    setDraftName(m.name);
    setDraftDesc(m.description || "");
    setDraftConfig({ ...m.config });
  };

  const saveSettings = async (reset = false) => {
    if (!editing || saving) return;
    setSaving(true);
    const res = await patch(`/api/admin/modules/${editing.key}`, {
      name: draftName.trim(),
      description: draftDesc.trim(),
      ...(reset ? { reset: true } : { config: draftConfig }),
    });
    setSaving(false);
    if (res.success) {
      toast({
        title: reset ? "کانفیگ به پیش‌فرض بازگشت" : "تنظیمات ماژول ذخیره شد",
        description: `ماژول «${reset ? editing.name : draftName.trim()}» به‌روزرسانی شد`,
      });
      setEditing(null);
      load();
    } else {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
    }
  };

  const usageLabel = (m: ModuleRow): string => {
    switch (m.key) {
      case "chat": return `${faNum(m.usage)} پیام`;
      case "goals": return `${faNum(m.usage)} هدف و وظیفه`;
      case "finance": return `${faNum(m.usage)} تراکنش`;
      case "businesses": return `${faNum(m.usage)} کسب‌وکار`;
      default: return `${faNum(m.usage)} کاربر`;
    }
  };

  return (
    <div className="space-y-5">
      {/* هدر */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Blocks className="w-7 h-7 text-blue-400" />
            ماژول‌ها و امکانات اپ
          </h2>
          <p className="text-slate-400 text-sm mt-1.5 leading-relaxed max-w-xl">
            فعال/غیرفعال‌سازی بخش‌های اپ، ویرایش نام و توضیح و تنظیمات حرفه‌ی هر ماژول —
            تغییرات بلافاصله روی همه‌ی کاربران اعمال می‌شود.
          </p>
        </div>
        <Badge className="bg-emerald-500/15 text-emerald-400 border-0 gap-1.5 px-3 py-1.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          {faNum(modules.filter((m) => m.isEnabled).length)} از {faNum(modules.length)} فعال
        </Badge>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {modules.map((m, i) => {
            const Icon = iconOf(m.icon);
            return (
              <motion.div
                key={m.key}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className={`bg-slate-900/70 border rounded-2xl p-5 transition-colors ${
                  m.isEnabled ? "border-slate-800 hover:border-slate-700" : "border-slate-800/50 opacity-70"
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    m.isEnabled ? "shahryar-gradient shadow-lg" : "bg-slate-800"
                  }`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-white font-bold text-base">{m.name}</h3>
                      {m.isCore && (
                        <Badge className="text-[9px] border-0 bg-blue-500/15 text-blue-400 gap-1">
                          <Lock className="w-2.5 h-2.5" /> هسته
                        </Badge>
                      )}
                      {!m.isEnabled && (
                        <Badge className="text-[9px] border-0 bg-rose-500/15 text-rose-400">غیرفعال</Badge>
                      )}
                    </div>
                    <p className="text-slate-400 text-xs mt-1.5 leading-relaxed line-clamp-2">
                      {m.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2.5 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        {usageLabel(m)}
                      </span>
                      <span>·</span>
                      <span>{faRelative(m.updatedAt)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    {busyKey === m.key ? (
                      <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                    ) : (
                      <Switch
                        checked={m.isEnabled}
                        disabled={m.isCore || busyKey !== null}
                        onCheckedChange={() => toggle(m)}
                        title={m.isCore ? "ماژول هسته — همیشه فعال" : undefined}
                      />
                    )}
                    <button
                      onClick={() => openSettings(m)}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-blue-400 transition-colors px-2 py-1 rounded-lg hover:bg-slate-800"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                      تنظیمات
                    </button>
                  </div>
                </div>

                {m.configSchema.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-800/70 flex flex-wrap gap-1.5">
                    {m.configSchema.map((f) => (
                      <Badge
                        key={f.key}
                        className={`text-[9px] border-0 ${
                          m.config[f.key] === false || m.config[f.key] === 0 && f.key.startsWith("enable")
                            ? "bg-slate-800 text-slate-500"
                            : "bg-blue-500/10 text-blue-300"
                        }`}
                      >
                        {f.label}
                      </Badge>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ─── دیالوگ تنظیمات ماژول ─── */}
      <AppDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        variant="admin"
        icon={Settings2}
        size="lg"
        locked={saving}
        title={`تنظیمات «${editing?.name || ""}»`}
        description="کانفیگ حرفه‌ای ماژول اپ"
        footer={
          <div className="flex flex-row-reverse gap-2">
            <Button
              onClick={() => saveSettings(false)}
              disabled={saving || !draftName.trim()}
              className="shahryar-gradient text-white border-0 rounded-xl font-bold min-w-28"
            >
              {saving ? "در حال ذخیره..." : "ذخیره تنظیمات"}
            </Button>
            {editing && editing.configSchema.length > 0 && (
              <Button
                onClick={() => saveSettings(true)}
                disabled={saving}
                variant="ghost"
                className="rounded-xl text-slate-400 gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                پیش‌فرض‌ها
              </Button>
            )}
            <Button variant="ghost" onClick={() => setEditing(null)} className="rounded-xl text-slate-400">
              انصراف
            </Button>
          </div>
        }
      >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">نام نمایشی</Label>
              <Input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="rounded-xl bg-slate-800/70 border-slate-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">توضیح (برای پنل و اعلان غیرفعالی)</Label>
              <Textarea
                value={draftDesc}
                onChange={(e) => setDraftDesc(e.target.value)}
                className="rounded-xl bg-slate-800/70 border-slate-700 text-white min-h-20"
              />
            </div>

            {editing && editing.configSchema.length > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-slate-800">
                <p className="text-xs font-bold text-slate-400 pt-1">کانفیگ اختصاصی ماژول</p>
                {editing.configSchema.map((f) => (
                  <div
                    key={f.key}
                    className="flex items-center justify-between gap-3 bg-slate-800/50 rounded-xl px-3.5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-slate-200 font-medium">{f.label}</p>
                      {f.hint && <p className="text-[11px] text-slate-500 mt-0.5">{f.hint}</p>}
                    </div>
                    {f.type === "boolean" ? (
                      <Switch
                        checked={draftConfig[f.key] === true}
                        onCheckedChange={(v) => setDraftConfig((c) => ({ ...c, [f.key]: v }))}
                      />
                    ) : (
                      <Input
                        type="number"
                        value={String(draftConfig[f.key] ?? f.default)}
                        min={f.min}
                        max={f.max}
                        onChange={(e) => setDraftConfig((c) => ({ ...c, [f.key]: Number(e.target.value) }))}
                        className="w-24 rounded-xl bg-slate-800 border-slate-700 text-white text-center"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
      </AppDialog>
    </div>
  );
}
