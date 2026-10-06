// ═════ دانش ایجنت من — GET / POST /api/social/knowledge ═════
// GET: فهرست منابع دانش (کامل — داده‌ی خودم)
// POST: افزودن منبع جدید (متن خام یا متنِ استخراج‌شده از فایل)
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getUser, guardModule } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { rateLimit, getClientIp } from "@/lib/core/rate-limit";

const MAX_ITEMS_DEFAULT = 12;
const MAX_TITLE = 80;
const MAX_CONTENT = 60000; // کاراکتر
const MAX_TOTAL_CHARS = 240000;

export async function GET(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("social");
    if (gate) return gate;

    const items = await db.knowledgeItem.findMany({
      where: { userId: auth.id },
      orderBy: { updatedAt: "desc" },
    });

    return ok({
      items: items.map((i) => ({
        id: i.id,
        title: i.title,
        sourceType: i.sourceType,
        fileName: i.fileName,
        charCount: i.charCount,
        content: i.content,
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString(),
      })),
      limits: { maxItems: MAX_ITEMS_DEFAULT, maxContentChars: MAX_CONTENT },
    });
  } catch (err) {
    console.error("خطای GET دانش:", err);
    return fail("خطای داخلی سرور", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("social");
    if (gate) return gate;

    const rl = rateLimit(`social-knowledge:${auth.id}:${getClientIp(req)}`, 20, 3600_000);
    if (!rl.allowed) return fail("درخواست‌های زیاد؛ کمی بعد دوباره تلاش کنید", 429);

    const body = await parseJson<{
      title?: string;
      content?: string;
      sourceType?: string; // text | file
      fileName?: string;
    }>(req);
    if (!body) return fail("درخواست نامعتبر است");

    const title = (body.title || "").trim().slice(0, MAX_TITLE);
    const content = (body.content || "").trim();
    const sourceType = body.sourceType === "file" ? "file" : "text";
    const fileName = sourceType === "file" ? (body.fileName || "").trim().slice(0, 120) : null;

    if (!title) return fail("عنوان منبع دانش الزامی است");
    if (!content) return fail("محتوای دانش خالی است");
    if (content.length > MAX_CONTENT) {
      return fail(`محتوای هر منبع حداکثر ${MAX_CONTENT.toLocaleString("fa-IR")} کاراکتر می‌تواند باشد`);
    }

    // سقف تعداد و حجم کل — از کانفیگ ماژول (پیش‌فرض ۱۲)
    const { getModuleState } = await import("@/lib/modules/cms/service");
    const state = await getModuleState("social");
    const maxItems = typeof state?.config?.maxKnowledgeItems === "number" && state.config.maxKnowledgeItems > 0
      ? state.config.maxKnowledgeItems
      : MAX_ITEMS_DEFAULT;

    const agg = await db.knowledgeItem.aggregate({
      where: { userId: auth.id },
      _count: { _all: true },
      _sum: { charCount: true },
    });
    if (agg._count._all >= maxItems) {
      return fail(`حداکثر ${maxItems} منبع دانش می‌توانید داشته باشید (برای افزودن، یکی را حذف یا ادغام کنید)`);
    }
    if ((agg._sum.charCount || 0) + content.length > MAX_TOTAL_CHARS) {
      return fail("سقف کل حجم دانش ایجنت پر شده است؛ منابع قدیمی را کوتاه یا حذف کنید");
    }

    const item = await db.knowledgeItem.create({
      data: {
        userId: auth.id,
        title,
        content,
        sourceType,
        fileName,
        charCount: content.length,
      },
    });

    await logActivity({
      userId: auth.id,
      action: "social.knowledge.create",
      entity: "knowledge-item",
      entityId: item.id,
      details: { title, sourceType, chars: content.length },
    });

    return ok({
      id: item.id,
      title: item.title,
      sourceType: item.sourceType,
      fileName: item.fileName,
      charCount: item.charCount,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    });
  } catch (err) {
    console.error("خطای POST دانش:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
