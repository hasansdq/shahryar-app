// ═════ دیالوگ وظیفه — ساخت/ویرایش با اولویت، موعد و توضیحات ═════
"use client";

import { useEffect, useState } from "react";
import { Loader2, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import AppDialog from "@/components/ui/app-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { post, patch } from "@/lib/client/api";
import { LABELS } from "@/lib/client/persian";
import JalaliDatePicker from "@/components/ui/jalali-date-picker";
import { toast } from "@/hooks/use-toast";
import { PRIORITY_COLORS } from "@/lib/client/persian";
import type { Task } from "./helpers";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  goalId: string;
  /** اگر پر باشد → ویرایش */
  editing?: Task | null;
  /** ستون پیش‌فرض برای وظیفه‌ی جدید */
  defaultStatus?: Task["status"];
}

export default function TaskFormDialog({ open, onClose, onSaved, goalId, editing, defaultStatus = "todo" }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<Task["status"]>("todo");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (editing) {
        setTitle(editing.title);
        setDescription(editing.description || "");
        setPriority(editing.priority);
        setDueDate(editing.dueDate ? editing.dueDate.slice(0, 10) : "");
        setStatus(editing.status);
      } else {
        setTitle(""); setDescription(""); setPriority("medium");
        setDueDate(""); setStatus(defaultStatus);
      }
    }
  }, [open, editing, defaultStatus]);

  const submit = async () => {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = editing
        ? await patch(`/api/tasks/${editing.id}`, {
            title: title.trim(),
            description: description.trim() || null,
            priority,
            dueDate: dueDate || null,
            status,
          })
        : await post("/api/tasks", {
            goalId,
            title: title.trim(),
            description: description.trim() || null,
            priority,
            dueDate: dueDate || null,
            status,
          });
      if (res.success) {
        toast({ title: editing ? "وظیفه به‌روزرسانی شد" : "وظیفه اضافه شد" });
        onSaved();
        onClose();
      } else {
        toast({ title: "خطا", description: res.error, variant: "destructive" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      icon={ListChecks}
      locked={submitting}
      title={editing ? "ویرایش وظیفه" : "وظیفه جدید"}
      description={editing ? "جزئیات وظیفه را به‌روز کن" : "یک قدم کوچک به سمت هدف"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} className="rounded-xl">انصراف</Button>
          <Button
            onClick={submit}
            disabled={!title.trim() || submitting}
            className="shahryar-gradient text-white border-0 rounded-xl font-bold min-w-24"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? "ذخیره" : "افزودن"}
          </Button>
        </>
      }
    >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>عنوان *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: خرید کتاب آموزشی"
              className="rounded-xl"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>
          <div className="space-y-2">
            <Label>توضیحات</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="جزئیات اجرا (اختیاری)"
              className="rounded-xl min-h-16 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>اولویت</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl">
                  {Object.entries(LABELS.priorities).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      <span className={`inline-flex items-center gap-1.5 ${PRIORITY_COLORS[k] ? "px-1.5 py-0.5 rounded-md" : ""}`}>
                        {v}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>موعد (اختیاری)</Label>
              <JalaliDatePicker value={dueDate} onChange={setDueDate} placeholder="انتخاب موعد" />
            </div>
          </div>
          {editing && (
            <div className="space-y-2">
              <Label>وضعیت</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Task["status"])}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl">
                  {Object.entries(LABELS.taskStatus).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
    </AppDialog>
  );
}
