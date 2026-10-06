// ═══════════════════════════════════════════════════════════════
// پل مهاجرت — GET /uploads/[...path] (نسخه ۲)
// ═══════════════════════════════════════════════════════════════
// فضای‌نام نسل قبل (/uploads/...) دیگر سرو نمی‌شود؛ به‌جای آن با
// ریدایرکت دائمی 308 به URL کانونی جدید (/files/...) هدایت می‌شود:
//   /uploads/avatars/1405-06/x.png    → /files/avatar/1405-06/x.png
//   /uploads/businesses/1405-06/x.png → /files/business/1405-06/x.png
// این پل تضمین می‌کند هیچ لینک قدیمی (کش مرورگر، تاریخ چت، ...)
// بعد از مهاجرت نشکند. سرو فایل واقعی فقط از /files انجام می‌شود.
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { parseMediaUrl, LEGACY_URL_PREFIX, fileUrl } from "@/lib/media/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function handle(segments: string[]): Response {
  const legacyPath = `${LEGACY_URL_PREFIX}/${segments.join("/")}`;
  const parsed = parseMediaUrl(legacyPath);

  if (!parsed || !parsed.legacy) {
    return Response.json(
      { success: false, error: "مسیر فایل نامعتبر است", path: legacyPath },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  // ریدایرکت دائمی — مرورگرها و خزنده‌ها URL جدید را کش می‌کنند
  return new Response(null, {
    status: 308,
    headers: {
      Location: fileUrl(parsed.key),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> }
): Promise<Response> {
  return handle((await ctx.params).path || []);
}

export async function HEAD(
  _req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> }
): Promise<Response> {
  return handle((await ctx.params).path || []);
}
