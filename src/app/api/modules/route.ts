// ═════ ماژول‌های اپ برای کلاینت — GET /api/modules ═════
// وضعیت فعال/غیرفعال + کانفیگ عمومی ماژول‌ها برای فیلتر ناوبری اپ
import { NextRequest } from "next/server";
import { ok, fail, getUser } from "@/lib/core/api";
import { getModuleStates } from "@/lib/modules/cms/service";

export async function GET(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);

    const states = await getModuleStates();
    const modules = Array.from(states.values())
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((m) => ({
        key: m.key,
        name: m.name,
        icon: m.icon,
        isEnabled: m.isEnabled,
        isCore: m.isCore,
        config: m.config, // فقط boolean/number — غیرحساس
      }));

    return ok({ modules });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
