// ═══════════════════════════════════════════════════════════════
// موتور حافظه داینامیک هوشیار
// یادگیری خودکار از گفتگو — استخراج و به‌روزرسانی حافظه کاربر
// ═══════════════════════════════════════════════════════════════
import { db } from "@/lib/db";
import { chatCompletion } from "./zai";

interface ExtractedMemory {
  key: string;
  value: string;
  category: string;
  importance: number;
  confidence: number;
}

const MEMORY_EXTRACTION_PROMPT = `تو یک موتور استخراج حافظه هستی. از گفتگوی زیر بین کاربر و دستیار، اطلاعات شخصی، ترجیحات و نکات مهم درباره کاربر را استخراج کن.

فقط اطلاعات پایدار و مفید را استخراج کن (مثل: شغل، خانواده، علایق، سلامت، برنامه‌ها، مهارت‌ها، محل کار، تحصیلات، عادت‌ها).
اطلاعات گذرا (مثل سلام‌کردن یا سوالات عمومی) را نادیده بگیر.

خروجی را فقط و فقط به فرمت JSON آرایه بده، بدون هیچ متن اضافه:
[{"key": "کلید کوتاه مثل شغل", "value": "مقدار", "category": "personal|preference|goal|health|family|other", "importance": 1-10, "confidence": 0-1}]

اگر هیچ اطلاعات قابل استخراجی وجود ندارد، فقط [] بده.`;

/**
 * استخراج حافظه از آخرین پیام‌های گفتگو
 * هر N پیام یک‌بار اجرا می‌شود (بهینه‌سازی هزینه)
 */
export async function extractMemories(userId: string, sessionId: string): Promise<void> {
  try {
    // تنظیمات سیستم
    let memoryEnabled = true;
    let interval = 4;
    try {
      const setting = await db.setting.findUnique({ where: { key: "ai_settings" } });
      if (setting) {
        const cfg = JSON.parse(setting.value);
        memoryEnabled = cfg.memoryEnabled !== false;
        interval = cfg.memoryExtractionInterval || 4;
      }
    } catch {}
    if (!memoryEnabled) return;

    // بررسی فاصله از آخرین استخراج
    const lastExtraction = await db.aIMemory.findFirst({
      where: { userId, source: "auto", updatedAt: { gt: new Date(Date.now() - 5 * 60 * 1000) } },
    });
    // اگر تازه استخراج شده، ادامه نده (خنک‌سازی ۵ دقیقه‌ای)
    if (lastExtraction) return;

    // شمارش پیام‌ها برای تعیین زمان استخراج
    const session = await db.chatSession.findUnique({ where: { id: sessionId }, select: { messageCount: true } });
    if (!session || session.messageCount % interval !== 0) return;

    // آخرین پیام‌های گفتگو
    const messages = await db.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      take: 8,
    });
    if (messages.length < 2) return;

    const conversationText = messages
      .reverse()
      .map((m) => `${m.role === "user" ? "کاربر" : "دستیار"}: ${m.content.slice(0, 500)}`)
      .join("\n");

    // درخواست استخراج از مدل
    const response = await chatCompletion(
      [
        { role: "system", content: MEMORY_EXTRACTION_PROMPT },
        { role: "user", content: conversationText },
      ],
      { thinking: false, temperature: 0.2, maxTokens: 1200 }
    );

    const raw = response.choices?.[0]?.message?.content?.trim() || "[]";
    // استخراج JSON از پاسخ (حتی اگر داخل بلاک کد باشد)
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return;

    const extracted: ExtractedMemory[] = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(extracted) || extracted.length === 0) return;

    // ذخیره یا به‌روزرسانی حافظه‌ها (Upsert)
    for (const mem of extracted) {
      if (!mem.key || !mem.value) continue;
      const key = String(mem.key).slice(0, 60);
      const value = String(mem.value).slice(0, 400);
      const category = ["personal", "preference", "goal", "health", "family", "other"].includes(mem.category)
        ? mem.category
        : "other";
      const importance = Math.min(10, Math.max(1, Math.round(mem.importance || 5)));
      const confidence = Math.min(1, Math.max(0, mem.confidence || 0.8));

      await db.aIMemory.upsert({
        where: { userId_key: { userId, key } },
        update: {
          value,
          category,
          importance,
          confidence,
          source: "auto",
          updatedAt: new Date(),
        },
        create: {
          userId,
          key,
          value,
          category,
          importance,
          confidence,
          source: "auto",
        },
      });
    }

    console.log(`[MEMORY] ${extracted.length} حافظه برای کاربر ${userId} به‌روزرسانی شد`);
  } catch (err) {
    console.error("خطای موتور حافظه:", err);
  }
}

/**
 * حافظه‌های کاربر برای نمایش در پروفایل
 */
export async function getUserMemories(userId: string) {
  return db.aIMemory.findMany({
    where: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
  });
}
