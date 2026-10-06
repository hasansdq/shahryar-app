// ═════ دیالوگ ساخت/ویرایش هدف — با انتخابگر رنگ و دسته‌بندی زنده ═════
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Target, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import AppDialog from "@/components/ui/app-dialog";
import { get, post, patch } from "@/lib/client/api";
import { LABELS, PRIORITY_COLORS } from "@/lib/client/persian";
import { useAppStore, moduleConfig } from "@/lib/client/store";
import { iconOf } from "@/lib/client/iconRegistry";
import JalaliDatePicker from "@/components/ui/jalali-date-picker";
import { toast } from "@/hooks/use-toast";
import { CATEGORY_META, categoryMeta, type Goal } from "./helpers";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** اگر پر باشد → حالت ویرایش */
  editing?: Goal | null;
}

// رنگ نقطهٔ پیل‌های اولویت — هم‌خانوادهٔ PRIORITY_COLORS (کم→بحرانی: خاکستری→سرخابی)
const PRIORITY_DOT: Record<string, string> = {
  low: "bg-slate-400",
  medium: "bg-sky-500",
  high: "bg-amber-500",
  critical: "bg-rose-500",
};

export default function GoalFormDialog({ open, onClose, onSaved, editing }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("personal");
  const [priority, setPriority] = useState("medium");
  const [deadline, setDeadline] = useState("");
  const [tasksText, setTasksText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  // دسته‌بندی‌های داینامیک CMS (fallback: دسته‌های ثابت)
  const dynCats = useAppStore((s) => s.goalCategories);
  const catOptions = dynCats.length > 0
    ? dynCats.map((c) => ({ key: c.key, label: c.name, color: c.color, icon: iconOf(c.icon) }))
    : Object.entries(CATEGORY_META).map(([key, m]) => ({ key, label: m.label, color: m.color, icon: m.icon }));

  // امکانات هوشیار اهداف از کانفیگ ماژول
  const aiAssistEnabled = moduleConfig("goals", "enableAIAssist", true) === true;

  // پر کردن فرم در حالت ویرایش
  useEffect(() => {
    if (open) {
      if (editing) {
        setTitle(editing.title);
        setDescription(editing.description || "");
        setCategory(editing.category);
        setPriority(editing.priority);
        setDeadline(editing.deadline ? editing.deadline.slice(0, 10) : "");
        setTasksText("");
      } else {
        setTitle(""); setDescription(""); setCategory(catOptions[0]?.key || "personal");
        setPriority("medium"); setDeadline(""); setTasksText("");
      }
    }
  }, [open, editing]);

  // تفکیک هوشمند هوشیار — پیش‌نویس وظایف داخل فرم
  const aiDraftTasks = async () => {
    if (!title.trim() || aiBusy) return;
    setAiBusy(true);
    try {
      const res = await post<{
        suggestions: Array<{ title: string; priority: string; dueInDays: number }>;
      }>("/api/goals/draft", { title: title.trim(), description: description.trim() || null, category });
      if (res.success && res.data?.suggestions?.length) {
        setTasksText(res.data.suggestions.map((s) => s.title).join("\n"));
        toast({ title: "پیش‌نویس هوشیار آماده شد ✨", description: "می‌توانی قبل از ساخت ویرایشش کنی" });
      } else {
        toast({ title: "هوشیار موقتاً در دسترس نیست", description: res.error || "بعداً از داخل هدف امتحان کن", variant: "destructive" });
      }
    } finally {
      setAiBusy(false);
    }
  };

  const submit = async () => {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    try {
      const tasks = tasksText.split("\n").map((t) => t.trim()).filter(Boolean);
      const catColor = categoryMeta(category).color;
      const res = editing
        ? await patch(`/api/goals/${editing.id}`, {
            title: title.trim(),
            description: description.trim() || null,
            category,
            priority,
            color: catColor,
            deadline: deadline || null,
          })
        : await post("/api/goals", {
            title: title.trim(),
            description: description.trim() || null,
            category,
            priority,
            color: catColor,
            deadline: deadline || null,
            tasks,
          });
      if (res.success) {
        toast({
          title: editing ? "هدف به‌روزرسانی شد ✅" : "هدف ساخته شد! 🎯",
          description: editing ? undefined : "حالا وظایفش را در کانبان جابجا کن",
        });
        onSaved();
        onClose();
      } else {
        toast({ title: "خطا", description: res.error, variant: "destructive" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isEdit = Boolean(editing);

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      icon={Target}
      size="lg"
      locked={submitting}
      title={isEdit ? "ویرایش هدف" : "هدف جدید"}
      description={isEdit ? "جزئیات هدف را به‌روز کن" : "هدفت را دقیق تعریف کن تا هوشیار بهتر کمکت کند"}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-start">
          <Button variant="ghost" onClick={onClose} className="rounded-xl h-11 sm:h-9">انصراف</Button>
          <Button
            onClick={submit}
            disabled={!title.trim() || submitting}
            className="shahryar-gradient text-white border-0 rounded-xl font-bold min-w-28 h-11 sm:h-9 w-full sm:w-auto"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> در حال ذخیره...</>
            ) : isEdit ? (
              "ذخیره تغییرات"
            ) : (
              <><Target className="w-4 h-4" /> ساخت هدف</>
            )}
          </Button>
        </div>
      }
    >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>عنوان هدف *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: یادگیری زبان انگلیسی"
              className="rounded-xl h-11 sm:h-9"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>توضیحات</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="چرا این هدف برایت مهم است؟"
              className="rounded-xl min-h-20"
            />
          </div>

          {/* انتخابگر دسته با پیش‌نمایش زنده — دسته‌های CMS (fallback ثابت) */}
          <div className="space-y-2">
            <Label>دسته‌بندی</Label>
            <div className="grid grid-cols-3 gap-2">
              {catOptions.map((opt) => {
                const active = category === opt.key;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setCategory(opt.key)}
                    className={`relative flex flex-col items-center gap-1.5 rounded-2xl border p-2.5 sm:p-3 transition-all active:scale-95 ${
                      active
                        ? "border-primary/60 bg-primary/5 shadow-sm scale-[1.02]"
                        : "border-border/60 hover:border-primary/30 hover:bg-accent/50"
                    }`}
                  >
                    <Icon className="w-5 h-5" style={{ color: active ? opt.color : undefined }} />
                    <span className="text-[11px] sm:text-xs font-medium">{opt.label}</span>
                    {active && (
                      <motion.span
                        layoutId="goal-cat-dot"
                        className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                        style={{ background: opt.color }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* اولویت — پیل‌های لمسی رنگی: یک تپ به‌جای باز کردن دراپ‌داون */}
          <div className="space-y-2">
            <Label>اولویت</Label>
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {Object.entries(LABELS.priorities).map(([k, v]) => {
                const active = priority === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setPriority(k)}
                    className={`h-11 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                      active
                        ? `${PRIORITY_COLORS[k]} border-transparent shadow-sm scale-[1.02]`
                        : "border-border/60 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[k]}`} />
                    {v}
                  </button>
                );
              })}
            </div>
          </div>

          {/* مهلت — تمام-عرض (در موبایل کنار اولویت جا نمی‌شود) */}
          <div className="space-y-2">
            <Label>مهلت (اختیاری)</Label>
            <JalaliDatePicker
              value={deadline}
              onChange={setDeadline}
              placeholder="انتخاب با تقویم جلالی"
            />
          </div>

          {!isEdit && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                <Label>وظایف اولیه (هر خط یک وظیفه)</Label>
                {aiAssistEnabled && (
                  <button
                    type="button"
                    onClick={aiDraftTasks}
                    disabled={!title.trim() || aiBusy}
                    className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 disabled:opacity-40 transition-colors px-2.5 py-1.5 rounded-lg bg-primary/5 active:scale-95"
                  >
                    {aiBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    پیش‌نویس هوشیار
                  </button>
                )}
              </div>
              <Textarea
                value={tasksText}
                onChange={(e) => setTasksText(e.target.value)}
                placeholder={"ثبت‌نام در کلاس\nخرید کتاب آموزشی\nروزی ۳۰ دقیقه تمرین"}
                className="rounded-xl min-h-24 text-sm"
              />
            </div>
          )}
        </div>
    </AppDialog>
  );
}
