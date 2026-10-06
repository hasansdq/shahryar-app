// ═══════════════════════════════════════════════════════════════
// تایپ‌ها و ثابت‌های فید شهریار — مشترک سرور/کلاینت (بدون وابستگی DB)
// ═══════════════════════════════════════════════════════════════

export const POST_CONTENT_MAX = 5000;
export const COMMENT_CONTENT_MAX = 1000;
export const ATTACHMENTS_MAX = 8;

export const ATTACHMENT_KINDS = ["image", "video", "audio", "file"] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export const REPORT_REASONS = ["spam", "abusive", "inappropriate", "misinformation", "privacy", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "هرزنامه و تبلیغ مزاحم",
  abusive: "توهین و رفتار توهین‌آمیز",
  inappropriate: "محتوای نامناسب",
  misinformation: "اطلاعات گمراه‌کننده",
  privacy: "نقض حریم خصوصی",
  other: "دلیل دیگر",
};

export interface FeedAttachmentDTO {
  id: string;
  kind: AttachmentKind;
  url: string;
  originalName: string;
  mime: string;
  size: number;
  durationMs: number | null;
  width: number | null;
  height: number | null;
}

export interface FeedCommentDTO {
  id: string;
  content: string;
  createdAt: string;
  isMine: boolean;
  canDelete: boolean;
  author: {
    userId: string;
    name: string;
    avatarUrl: string | null;
    avatarColor: string;
    isVerified: boolean;
    headline: string | null;
  };
}

export interface FeedPostDTO {
  id: string;
  content: string;
  createdAt: string;
  editedAt: string | null;
  isPinned: boolean;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  isMine: boolean;
  canPin: boolean;
  reportedByMe: boolean;
  attachments: FeedAttachmentDTO[];
  author: {
    userId: string;
    name: string;
    avatarUrl: string | null;
    avatarColor: string;
    isVerified: boolean;
    headline: string | null;
    city: string | null;
    hasAgent: boolean;
  };
}

export interface FeedPageDTO {
  posts: FeedPostDTO[];
  nextCursor: string | null;
}
