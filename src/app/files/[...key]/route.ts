// ═══════════════════════════════════════════════════════════════
// سرو فایل‌های رسانه — GET/HEAD /files/[...key] (نسخه ۲)
// ═══════════════════════════════════════════════════════════════
// تنها نقطه خروجی فایل‌های سامانه. مستقیم از مخزن کانونی
// (storage/media) می‌خواند — نه از public، نه از خروجی build؛
// بنابراین در dev ، next start و standalone یکسان کار می‌کند.
//
// امکانات: ETag/304، کش ابدی immutable (نام فایل‌ها یکتاست)،
// درخواست‌های Range تک‌بازه (پخش صوتی/تصویری)،
// Content-Disposition هوشمند، مسدودسازی ساختاری path traversal.
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { createReadStream } from "fs";
import { Readable } from "stream";
import { MIME_BY_EXT, INLINE_EXTS } from "@/lib/media/config";
import { statMediaFile, resolveMediaAbsPath } from "@/lib/media/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";

function notFound(key: string): Response {
  return Response.json(
    { success: false, error: "فایل یافت نشد", key },
    { status: 404, headers: { "Cache-Control": "no-store" } }
  );
}

/** تفسیر هدر Range تک‌بازه — bytes=start-end | bytes=start- | bytes=-suffix */
function parseRange(
  header: string,
  size: number
): { start: number; end: number } | "invalid" | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;
  const [, rawStart, rawEnd] = m;
  if (rawStart === "" && rawEnd === "") return null;

  let start: number;
  let end: number;
  if (rawStart === "") {
    // bytes=-N → N بایت آخر
    const suffix = parseInt(rawEnd, 10);
    if (suffix <= 0) return "invalid";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = parseInt(rawStart, 10);
    end = rawEnd === "" ? size - 1 : parseInt(rawEnd, 10);
  }
  if (isNaN(start) || isNaN(end) || start > end || start >= size) return "invalid";
  end = Math.min(end, size - 1);
  return { start, end };
}

async function serve(
  segments: string[],
  req: NextRequest,
  headOnly: boolean
): Promise<Response> {
  const key = segments.join("/");
  const st = await statMediaFile(key);
  if (!st) return notFound(key);

  // مسیر واقعی — ریشه کانونی یا ریشه آپلود قدیمی (fallback)
  const absPath = resolveMediaAbsPath(key);
  if (!absPath) return notFound(key);
  const fileName = segments[segments.length - 1];
  const ext = (fileName.split(".").pop() || "bin").toLowerCase();
  const contentType = MIME_BY_EXT[ext] || "application/octet-stream";
  const etag = `"${st.size}-${Math.round(st.mtimeMs)}"`;
  const lastModified = new Date(st.mtimeMs).toUTCString();

  // ─── نام دانلودی زیبا (اختیاری) — پارامتر ?name= ───
  // فایل‌های تولیدی هوشیار نام‌های uuid دارند؛ کارت دانلود، نام
  // فارسی خوانا را از این مسیر به هدر Content-Disposition می‌رساند.
  let downloadName = fileName;
  const reqName = req.nextUrl.searchParams.get("name");
  if (reqName) {
    const cleaned = reqName
      // فقط کاراکترهای امن هدر — بدون کنترل، کوتیشن، مسیر
      .replace(/[\r\n\"\\/\u0000-\u001F]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100)
      .replace(/[. ]+$/g, "");
    if (cleaned) {
      // پسوند اصلی فایل همیشه حفظ شود
      const cleanedExt = (cleaned.split(".").pop() || "").toLowerCase();
      downloadName = cleanedExt === ext ? cleaned : `${cleaned}.${ext}`;
    }
  }

  // ── کش مشروط: 304 بدون بدنه ──
  const ifNoneMatch = req.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatch === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Last-Modified": lastModified,
        "Cache-Control": IMMUTABLE_CACHE,
      },
    });
  }

  // ── هدرهای مشترک ──
  const baseHeaders: Record<string, string> = {
    "Content-Type": contentType,
    ETag: etag,
    "Last-Modified": lastModified,
    "Cache-Control": IMMUTABLE_CACHE,
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `${INLINE_EXTS.has(ext) ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
    "Accept-Ranges": "bytes",
  };

  // ── درخواست Range (تک‌بازه) ──
  const rangeHeader = req.headers.get("range");
  if (rangeHeader) {
    const range = parseRange(rangeHeader, st.size);
    if (range === "invalid") {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${st.size}`, "Accept-Ranges": "bytes" },
      });
    }
    if (range) {
      const { start, end } = range;
      const headers = new Headers(baseHeaders);
      headers.set("Content-Length", String(end - start + 1));
      headers.set("Content-Range", `bytes ${start}-${end}/${st.size}`);
      if (headOnly) return new Response(null, { status: 206, headers });
      const stream = Readable.toWeb(
        createReadStream(absPath, { start, end })
      ) as unknown as ReadableStream<Uint8Array>;
      return new Response(stream, { status: 206, headers });
    }
    // Range ناقص/نامعتبر دیگر → سرو کامل
  }

  const headers = new Headers(baseHeaders);
  headers.set("Content-Length", String(st.size));

  if (headOnly) return new Response(null, { status: 200, headers });

  const stream = Readable.toWeb(
    createReadStream(absPath)
  ) as unknown as ReadableStream<Uint8Array>;
  return new Response(stream, { status: 200, headers });
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ key?: string[] }> }
): Promise<Response> {
  const segments = (await ctx.params).key || [];
  return serve(segments, req, false);
}

export async function HEAD(
  req: NextRequest,
  ctx: { params: Promise<{ key?: string[] }> }
): Promise<Response> {
  const segments = (await ctx.params).key || [];
  return serve(segments, req, true);
}
