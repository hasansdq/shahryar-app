// ═════ استور مرکزی آپلود شهریار ═════
// مدیریت صف آپلود با پروگرس، سرعت و پیام‌های حرفه‌ای

"use client";

import { create } from "zustand";

export type UploadStatus = "uploading" | "success" | "error";

export interface UploadItem {
  id: string;
  name: string;
  size: number;
  loaded: number;
  progress: number; // 0-100
  speed: number; // بایت بر ثانیه
  eta: number; // ثانیه باقی‌مانده
  status: UploadStatus;
  error?: string;
  url?: string;
  startedAt: number;
  scopeLabel: string;
  isImage: boolean;
}

interface UploadState {
  items: UploadItem[];
  startUpload: (item: Omit<UploadItem, "loaded" | "progress" | "speed" | "eta" | "status" | "startedAt">) => void;
  updateProgress: (id: string, loaded: number, total: number, speed: number, eta: number) => void;
  finishUpload: (id: string, url: string) => void;
  failUpload: (id: string, error: string) => void;
  removeItem: (id: string) => void;
  clearFinished: () => void;
}

export const useUploadStore = create<UploadState>((set) => ({
  items: [],

  startUpload: (item) =>
    set((s) => ({
      items: [
        {
          ...item,
          loaded: 0,
          progress: 0,
          speed: 0,
          eta: 0,
          status: "uploading" as UploadStatus,
          startedAt: Date.now(),
        },
        ...s.items,
      ].slice(0, 8), // حداکثر ۸ آیتم همزمان در نمایش
    })),

  updateProgress: (id, loaded, total, speed, eta) =>
    set((s) => ({
      items: s.items.map((it) =>
        it.id === id
          ? { ...it, loaded, progress: total > 0 ? Math.min(99.5, (loaded / total) * 100) : 0, speed, eta }
          : it
      ),
    })),

  finishUpload: (id, url) =>
    set((s) => ({
      items: s.items.map((it) =>
        it.id === id ? { ...it, status: "success" as UploadStatus, progress: 100, speed: 0, eta: 0, url } : it
      ),
    })),

  failUpload: (id, error) =>
    set((s) => ({
      items: s.items.map((it) =>
        it.id === id ? { ...it, status: "error" as UploadStatus, speed: 0, eta: 0, error } : it
      ),
    })),

  removeItem: (id) => set((s) => ({ items: s.items.filter((it) => it.id !== id) })),

  clearFinished: () =>
    set((s) => ({ items: s.items.filter((it) => it.status === "uploading") })),
}));

/** قالب‌بندی حجم فایل فارسی */
export function faFileSize(bytes: number): string {
  const fa = (n: number | string) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
  if (bytes < 1024) return `${fa(Math.round(bytes))} بایت`;
  if (bytes < 1024 * 1024) return `${fa((bytes / 1024).toFixed(0))} کیلوبایت`;
  return `${fa((bytes / (1024 * 1024)).toFixed(1))} مگابایت`;
}

/** قالب‌بندی سرعت فارسی */
export function faSpeed(bytesPerSec: number): string {
  const fa = (n: number | string) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
  if (bytesPerSec <= 0) return "—";
  if (bytesPerSec < 1024 * 1024) return `${fa((bytesPerSec / 1024).toFixed(0))} کیلوبایت/ثانیه`;
  return `${fa((bytesPerSec / (1024 * 1024)).toFixed(1))} مگابایت/ثانیه`;
}

/** زمان باقی‌مانده فارسی */
export function faEta(seconds: number): string {
  const fa = (n: number | string) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
  if (!isFinite(seconds) || seconds <= 0) return "—";
  if (seconds < 60) return `${fa(Math.ceil(seconds))} ثانیه`;
  return `${fa(Math.floor(seconds / 60))}:${String(Math.ceil(seconds % 60)).padStart(2, "0").replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d])} دقیقه`;
}
