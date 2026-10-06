// ═════ دسته‌بندی‌های اهداف — GET/POST /api/admin/goal-categories ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getAdmin, assertWritableAdmin } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { listGoalCategoriesForAdmin, slugifyCategoryKey } from "@/lib/modules/cms/service";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);


    const categories = await listGoalCategoriesForAdmin();
    return ok({ categories });
  } catch (err) {
    console.error("خطای فهرست دسته‌بندی اهداف:", err);
    return fail("خطای داخلی سرور", 500);
  }
}

interface Body {
  name?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);
    const writeGate = assertWritableAdmin(admin);
    if (writeGate) return writeGate;

    const body = await parseJson<Body>(req);
    const name = body?.name?.trim().slice(0, 40);
    if (!name) return fail("نام دسته‌بندی الزامی است");

    const icon = (body?.icon || "target").slice(0, 40);
    const color = body?.color && HEX_COLOR.test(body.color) ? body.color : "#0e8a5a";
    const sortOrder = Math.min(999, Math.max(0, Math.round(Number(body?.sortOrder) || 100)));

    // کلید یکتا — از نام لاتین یا شناسه‌ی زمان‌دار
    let key = slugifyCategoryKey(name);
    const exists = await db.goalCategory.findUnique({ where: { key } });
    if (exists) key = `${key}-${Date.now().toString(36).slice(-4)}`;

    const category = await db.goalCategory.create({
      data: { key, name, icon, color, sortOrder },
    });

    await logActivity({
      adminId: admin.id,
      actorType: "admin",
      action: "cms.goalCategory.create",
      entity: "goalCategory",
      entityId: category.id,
      details: { name, key },
    });

    return ok({ category });
  } catch (err) {
    console.error("خطای ساخت دسته‌بندی هدف:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
