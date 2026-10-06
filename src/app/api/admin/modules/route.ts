// ═════ ماژول‌های اپ — GET /api/admin/modules ═════
// فهرست کامل ماژول‌ها + اسکیمای کانفیگ + آمار استفاده
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, getAdmin } from "@/lib/core/api";
import { getModuleStates, MODULE_DEFS } from "@/lib/modules/cms/service";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail("دسترسی غیرمجاز", 401);

    const states = await getModuleStates();

    // آمار استفاده هر ماژول (برای نمایش در کارت)
    const [usersTotal, goalsTotal, tasksTotal, chatMessages, txTotal, businessesTotal] = await Promise.all([
      db.user.count(),
      db.goal.count(),
      db.task.count(),
      db.chatMessage.count({ where: { role: "user" } }),
      db.financeTransaction.count(),
      db.business.count(),
    ]);
    const usage: Record<string, number> = {
      home: usersTotal,
      chat: chatMessages,
      goals: goalsTotal + tasksTotal,
      finance: txTotal,
      businesses: businessesTotal,
      profile: usersTotal,
    };

    // اسکیمای کانفیگ برای رندر فرم ادمین
    const schemas = new Map(MODULE_DEFS.map((d) => [d.key, d.configSchema]));

    const modules = Array.from(states.values())
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((m) => ({
        ...m,
        usage: usage[m.key] ?? 0,
        configSchema: schemas.get(m.key) || [],
      }));

    return ok({ modules });
  } catch (err) {
    console.error("خطای فهرست ماژول‌ها:", err);
    return fail("خطای داخلی سرور", 500);
  }
}
