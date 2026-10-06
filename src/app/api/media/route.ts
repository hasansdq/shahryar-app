// ═════ آپلود رسانه — POST /api/media ═════
// روت نازک: کل منطق در src/lib/media/upload-api.ts
// (تک‌endpoint رسمی آپلود — بدون مسیر جایگزین و بدون استثنا)
export { POST, GET } from "@/lib/media/upload-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
