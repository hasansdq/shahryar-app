// ═════ قالب‌های دسته‌بندی مالی — GET/POST /api/admin/finance/categories ═════
// قالب‌ها هنگام ثبت‌نام/اولین استفاده‌ی کاربر جدید سید می‌شوند
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson, getAdmin, assertWritableAdmin } from "@/lib/core/api";
import { logActivity } from "@/lib/core/logger";
import { listFinanceTemplatesForAdmin } from "@/lib/modules/cms/service";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);


    const templates = await listFinanceTemplatesForAdmin();
    return ok({ templates });
  } catch (err) {
    console.error("خطای فهرست قالب‌های مالی:", err);
    return fail("خطای داخلی سرور", 500);
  }
}

interface Body {
  name?: string;
  type?: string; // income | expense
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
    const type = body?.type === "income" ? "income" : "expense";
    const icon = (body?.icon || "tag").slice(0, 40);
    const color = body?.color && HEX_COLOR.test(body.color) ? body.color : "#7f8c8d";
    const sortOrder = Math.min(999, Math.max(0, Math.round(Number(body?.sortOrder) || 100)));

    // جلوگیری از تکرار نام در همان نوع
    const dup = await db.financeCategoryTemplate.findFirst({ where: { name, type } });
    if (dup) return fail("قالبی با این نام و نوع وجود دارد", 400);

    const template = await db.financeCategoryTemplate.create({
      data: { name, type, icon, color, sortOrder },
    });

    await logActivity({
      adminId: admin.id,
      actorType: "admin",
      action: "cms.financeCategory.create",
      entity: "financeCategoryTemplate",
      entityId: template.id,
      details: { name, type },
    });

    return ok({ template });
  } catch (err) {
    console.error("خطای ساخت قالب مالی:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
