// ═══════════════════════════════════════════════════════════════
// ویرایشگر مقاله نشریه انجمن — هسته (MDXEditor حرفه‌ای)
// ═══════════════════════════════════════════════════════════════
// پک حرفه‌ای ساختاردهی متن برای رئیس انجمن:
//  • بلوک‌ها: پاراگراف / تیتر ۱-۴ / نقل‌قول / جداکننده
//  • متن: درشت، مورب، زیرخط، خط‌خورده، کد درون‌خطی
//  • فهرست‌ها: نقطه‌ای، شماره‌دار، بررسی
//  • پیوند با دیالوگ کامل (متن/عنوان/نشانی)
//  • تصویر: بارگذاری از دستگاه (scope=article) + تغییر اندازه کشیدنی
//    (دستگیره‌های گوشه) + تنظیم عرض/ارتفاع عددی + متن جایگزین
//  • جدول + میان‌بُرهای مارک‌داون هنگام تایپ
//  • سه حالت: دیداری / مقایسه تغییرات / کد مارک‌داون
// محتوای مقاله همیشه «مارک‌داون» ذخیره می‌شود — قابل‌حمل و بی‌وابستگی.
// ═══════════════════════════════════════════════════════════════
"use client";

import { forwardRef } from "react";
import {
  MDXEditor,
  type MDXEditorMethods,
  type Translation,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  linkPlugin,
  linkDialogPlugin,
  imagePlugin,
  tablePlugin,
  markdownShortcutPlugin,
  toolbarPlugin,
  diffSourcePlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  ListsToggle,
  CreateLink,
  InsertImage,
  InsertTable,
  InsertThematicBreak,
  CodeToggle,
  Separator,
  DiffSourceToggleWrapper,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import { uploadMedia } from "@/lib/client/media";

// ─── بومی‌سازی کامل فارسی رابط ویرایشگر ───
const FA_STRINGS: Record<string, string> = {
  "toolbar.richText": "ویرایش دیداری",
  "toolbar.diffMode": "مقایسه تغییرات",
  "toolbar.source": "کد مارک‌داون",
  "toolbar.bold": "درشت (Ctrl+B)",
  "toolbar.removeBold": "حذف درشت",
  "toolbar.italic": "مورب (Ctrl+I)",
  "toolbar.removeItalic": "حذف مورب",
  "toolbar.underline": "زیرخط (Ctrl+U)",
  "toolbar.removeUnderline": "حذف زیرخط",
  "toolbar.strikethrough": "خط‌خورده",
  "toolbar.removeStrikethrough": "حذف خط‌خورده",
  "toolbar.inlineCode": "کد درون‌خطی",
  "toolbar.thematicBreak": "درج جداکننده افقی",
  "toolbar.bulletedList": "فهرست نقطه‌ای",
  "toolbar.numberedList": "فهرست شماره‌دار",
  "toolbar.checkList": "فهرست بررسی",
  "toolbar.table": "درج جدول",
  "toolbar.image": "درج تصویر در مقاله",
  "toolbar.link": "درج پیوند",
  "toolbar.blockTypes.paragraph": "پاراگراف",
  "toolbar.blockTypes.quote": "نقل‌قول",
  "toolbar.blockTypeSelect.selectBlockTypeTooltip": "انتخاب نوع بلوک",
  "toolbar.blockTypeSelect.placeholder": "نوع بلوک…",
  "toolbar.undo": "واگرد (Ctrl+Z)",
  "toolbar.redo": "بازانجام (Ctrl+Y)",
  "createLink.url": "نشانی پیوند",
  "createLink.urlPlaceholder": "نشانی را انتخاب یا وارد کنید",
  "createLink.text": "متن پیوند",
  "createLink.textTooltip": "متنی که برای پیوند نمایش داده می‌شود",
  "createLink.title": "عنوان پیوند",
  "createLink.titleTooltip": "عنوان پیوند که هنگام اشاره نشان داده می‌شود",
  "createLink.saveTooltip": "ثبت نشانی",
  "createLink.cancelTooltip": "لغو تغییر",
  "dialogControls.save": "ذخیره",
  "dialogControls.cancel": "انصراف",
  "linkPreview.open": "بازکردن {{url}} در پنجره جدید",
  "linkPreview.edit": "ویرایش نشانی پیوند",
  "linkPreview.copyToClipboard": "کپی در حافظه",
  "linkPreview.copied": "کپی شد!",
  "linkPreview.remove": "حذف پیوند",
  "uploadImage.dialogTitle": "درج تصویر در مقاله",
  "uploadImage.uploadInstructions": "بارگذاری تصویر از دستگاه شما:",
  "uploadImage.addViaUrlInstructions": "یا افزودن تصویر از نشانی:",
  "uploadImage.addViaUrlInstructionsNoUpload": "نشانی تصویر:",
  "uploadImage.autoCompletePlaceholder": "نشانی تصویر را وارد کنید",
  "uploadImage.alt": "متن جایگزین (توضیح تصویر):",
  "uploadImage.title": "عنوان تصویر:",
  "uploadImage.width": "عرض (پیکسل):",
  "uploadImage.height": "ارتفاع (پیکسل):",
};

const faTranslate: Translation = (key, defaultValue, interpolations) => {
  const fa = FA_STRINGS[key];
  if (!fa) return defaultValue;
  if (!interpolations) return fa;
  return fa.replace(/\{\{(\w+)\}\}/g, (_, k) =>
    interpolations[k] === undefined ? "" : String(interpolations[k])
  );
};

export interface ArticleEditorCoreProps {
  markdown: string;
  onChange: (markdown: string) => void;
  onBlur?: () => void;
}

/** بارگذار تصویر ویرایشگر — آپلود امن به scope مقاله + پروگرس شناور */
const handleImageUpload = async (image: File): Promise<string> => {
  const saved = await uploadMedia(image, "article");
  if (!saved) {
    throw new Error("بارگذاری تصویر ناموفق بود؛ دوباره تلاش کنید");
  }
  return saved.url;
};

const ArticleEditorCore = forwardRef<MDXEditorMethods, ArticleEditorCoreProps>(
  function ArticleEditorCore({ markdown, onChange, onBlur }, ref) {
    return (
      <MDXEditor
        ref={ref}
        markdown={markdown}
        onChange={onChange}
        onBlur={onBlur}
        translation={faTranslate}
        placeholder="نوشتن متن مقاله… از نوار بالا برای ساختاردهی، درج تصویر و جدول استفاده کنید"
        className="article-editor-root"
        contentEditableClassName="article-editor-content"
        suppressHtmlProcessing={false}
        plugins={[
          toolbarPlugin({
            toolbarContents: () => (
              <DiffSourceToggleWrapper>
                <UndoRedo />
                <Separator />
                <BlockTypeSelect />
                <Separator />
                <BoldItalicUnderlineToggles />
                <CodeToggle />
                <Separator />
                <ListsToggle />
                <Separator />
                <CreateLink />
                <InsertImage />
                <InsertTable />
                <InsertThematicBreak />
              </DiffSourceToggleWrapper>
            ),
          }),
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          linkPlugin(),
          linkDialogPlugin(),
          imagePlugin({
            imageUploadHandler: handleImageUpload,
            // دستگیره‌های کشیدنی تغییر اندازه تصویر (پیش‌فرض فعال)
            disableImageResize: false,
            // فیلدهای عرض/ارتفاع عددی در دیالوگ تصویر
            allowSetImageDimensions: true,
          }),
          tablePlugin(),
          markdownShortcutPlugin(),
          diffSourcePlugin(),
        ]}
      />
    );
  }
);

export default ArticleEditorCore;
