// ═════ حافظه هوش مصنوعی کاربر — GET/DELETE /api/ai/memories ═════
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, getUser, guardModule } from "@/lib/core/api";
import { getUserMemories } from "@/lib/modules/ai/memory-engine";
import { logActivity } from "@/lib/core/logger";

export async function GET(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("chat");
    if (gate) return gate;

    const memories = await getUserMemories(auth.id);
    return ok({
      memories: memories.map((m) => ({
        id: m.id, key: m.key, value: m.value, category: m.category,
        importance: m.importance, updatedAt: m.updatedAt,
      })),
    });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await getUser(req);
    if (!auth) return fail("احراز هویت نشده‌اید", 401);
    const gate = await guardModule("chat");
    if (gate) return gate;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      // حذف یک حافظه خاص
      const memory = await db.aIMemory.findFirst({ where: { id, userId: auth.id } });
      if (!memory) return fail("حافظه یافت نشد", 404);
      await db.aIMemory.delete({ where: { id } });
      await logActivity({ userId: auth.id, action: "ai.memory_delete", entity: "memory", entityId: id });
      return ok({ message: "حافظه حذف شد" });
    }

    // حذف همه حافظه‌ها
    await db.aIMemory.deleteMany({ where: { userId: auth.id } });
    await logActivity({ userId: auth.id, action: "ai.memory_clear_all", level: "warning" });
    return ok({ message: "همه حافظه‌ها پاک شد" });
  } catch {
    return fail("خطای داخلی سرور", 500);
  }
}
