-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT,
    "fullName" TEXT,
    "email" TEXT,
    "avatarUrl" TEXT,
    "avatarColor" TEXT NOT NULL DEFAULT '0',
    "city" TEXT NOT NULL DEFAULT 'رفسنجان',
    "gender" TEXT,
    "birthYear" INTEGER,
    "birthDate" DATETIME,
    "interests" TEXT,
    "bio" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" DATETIME,
    "restrictedUntil" DATETIME,
    "restrictionReason" TEXT,
    "lastLoginAt" DATETIME,
    "loginCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jti" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "device" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "lastUsedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdminUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'مدیر سیستم',
    "role" TEXT NOT NULL DEFAULT 'SUPER_ADMIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" DATETIME,
    "loginCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdminSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jti" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BusinessCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'Store',
    "color" TEXT NOT NULL DEFAULT '#0e8a5a',
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Business" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "ownerName" TEXT,
    "phone" TEXT,
    "phone2" TEXT,
    "email" TEXT,
    "address" TEXT,
    "district" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "workingHours" TEXT,
    "website" TEXT,
    "instagram" TEXT,
    "telegram" TEXT,
    "whatsapp" TEXT,
    "services" TEXT,
    "keywords" TEXT,
    "imageUrl" TEXT,
    "gallery" TEXT,
    "rating" REAL NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Business_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BusinessCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BusinessReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "quality" INTEGER,
    "priceFair" INTEGER,
    "behavior" INTEGER,
    "speed" INTEGER,
    "pros" TEXT,
    "cons" TEXT,
    "wouldRecommend" BOOLEAN NOT NULL DEFAULT true,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "helpfulVoters" TEXT,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessReview_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FavoriteBusiness" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FavoriteBusiness_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FavoriteBusiness_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChatSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'گفتگوی تازه',
    "mode" TEXT NOT NULL DEFAULT 'chat',
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "thinking" TEXT,
    "searchUsed" BOOLEAN NOT NULL DEFAULT false,
    "searchResults" TEXT,
    "imageData" TEXT,
    "imagePrompt" TEXT,
    "attachmentUrl" TEXT,
    "attachmentName" TEXT,
    "attachmentMime" TEXT,
    "generatedFiles" JSONB,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AIMemory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'personal',
    "importance" INTEGER NOT NULL DEFAULT 5,
    "confidence" REAL NOT NULL DEFAULT 0.8,
    "source" TEXT NOT NULL DEFAULT 'auto',
    "hitsCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AIMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Goal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'personal',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'active',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '#0e8a5a',
    "deadline" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "goalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "dueDate" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CityData" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL DEFAULT 'news',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "source" TEXT,
    "imageUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Setting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "group" TEXT NOT NULL DEFAULT 'general',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "adminId" TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'user',
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "details" TEXT,
    "level" TEXT NOT NULL DEFAULT 'info',
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DocumentExtraction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mediaUrl" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "fullLength" INTEGER NOT NULL DEFAULT 0,
    "wasTruncated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FinanceAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'cash',
    "initialBalance" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '#0e8a5a',
    "icon" TEXT NOT NULL DEFAULT 'wallet',
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinanceAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FinanceCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'tag',
    "color" TEXT NOT NULL DEFAULT '#0e8a5a',
    "kind" TEXT NOT NULL DEFAULT 'custom',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinanceCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FinanceTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "categoryId" TEXT,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "transferToId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinanceTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FinanceTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FinanceTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinanceCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FinanceTransaction_transferToId_fkey" FOREIGN KEY ("transferToId") REFERENCES "FinanceAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FinanceBudget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinanceBudget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FinanceBudget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinanceCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FinanceGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetAmount" INTEGER NOT NULL,
    "currentAmount" INTEGER NOT NULL DEFAULT 0,
    "deadline" DATETIME,
    "color" TEXT NOT NULL DEFAULT '#0e8a5a',
    "icon" TEXT NOT NULL DEFAULT 'target',
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinanceGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FinanceDebt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'i_owe',
    "personName" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "remainingAmount" INTEGER NOT NULL,
    "dueDate" DATETIME,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "settledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinanceDebt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FinanceRecurring" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'expense',
    "amount" INTEGER NOT NULL,
    "cadence" TEXT NOT NULL DEFAULT 'monthly',
    "accountId" TEXT NOT NULL,
    "categoryId" TEXT,
    "nextRunDate" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinanceRecurring_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FinanceRecurring_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FinanceRecurring_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinanceCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SocialProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "headline" TEXT,
    "bio" TEXT,
    "city" TEXT,
    "bannerUrl" TEXT,
    "bannerTheme" TEXT NOT NULL DEFAULT 'aurora',
    "skills" TEXT,
    "interests" TEXT,
    "education" TEXT,
    "experience" TEXT,
    "links" TEXT,
    "isDiscoverable" BOOLEAN NOT NULL DEFAULT true,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "agentEnabled" BOOLEAN NOT NULL DEFAULT true,
    "agentName" TEXT,
    "agentGreeting" TEXT,
    "agentStyle" TEXT NOT NULL DEFAULT 'professional',
    "agentInstructions" TEXT,
    "agentForbidden" TEXT,
    "agentUseProfile" BOOLEAN NOT NULL DEFAULT true,
    "agentSuggestHandoff" BOOLEAN NOT NULL DEFAULT true,
    "agentQuestions" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SocialProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "KnowledgeItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'text',
    "content" TEXT NOT NULL,
    "fileName" TEXT,
    "charCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KnowledgeItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SocialConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'dm',
    "userAId" TEXT NOT NULL,
    "userBId" TEXT,
    "ownerId" TEXT,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SocialConversation_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SocialConversation_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SocialConversation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SocialMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT,
    "senderType" TEXT NOT NULL DEFAULT 'user',
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SocialMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SocialConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SocialMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProfileViewLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProfileViewLog_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "SocialProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProfileViewLog_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SkillEndorsement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "endorserId" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SkillEndorsement_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "SocialProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SkillEndorsement_endorserId_fkey" FOREIGN KEY ("endorserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "module_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT NOT NULL DEFAULT 'Sparkles',
    "group" TEXT NOT NULL DEFAULT 'main',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isCore" BOOLEAN NOT NULL DEFAULT false,
    "config" TEXT NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "goal_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'target',
    "color" TEXT NOT NULL DEFAULT '#0e8a5a',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "finance_category_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'tag',
    "color" TEXT NOT NULL DEFAULT '#7f8c8d',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "ctaLabel" TEXT,
    "ctaView" TEXT,
    "audience" TEXT NOT NULL DEFAULT 'all',
    "filters" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "scheduledAt" DATETIME,
    "expiresAt" DATETIME,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OtpCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "ip" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SmsSetting" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'main',
    "provider" TEXT NOT NULL DEFAULT 'melipayamak',
    "username" TEXT,
    "passwordEnc" TEXT,
    "fromNumber" TEXT,
    "patternCode" TEXT,
    "patternVars" TEXT,
    "otpTemplate" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "lastTestAt" DATETIME,
    "lastTestOk" BOOLEAN,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "NotificationRecipient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationRecipient_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NotificationRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "forums" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coverImage" TEXT,
    "type" TEXT NOT NULL DEFAULT 'PUBLIC',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "chairId" TEXT NOT NULL,
    "agentEnabled" BOOLEAN NOT NULL DEFAULT true,
    "agentName" TEXT,
    "agentGreeting" TEXT,
    "agentInstructions" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "forums_chairId_fkey" FOREIGN KEY ("chairId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "forum_members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "forumId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestNote" TEXT,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "forum_members_forumId_fkey" FOREIGN KEY ("forumId") REFERENCES "forums" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "forum_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "forum_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "forumId" TEXT NOT NULL,
    "thread" TEXT NOT NULL DEFAULT 'FORUM',
    "threadUserId" TEXT,
    "senderId" TEXT,
    "isFromAgent" BOOLEAN NOT NULL DEFAULT false,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "forum_messages_forumId_fkey" FOREIGN KEY ("forumId") REFERENCES "forums" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "forum_messages_threadUserId_fkey" FOREIGN KEY ("threadUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "forum_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "agent_leads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scope" TEXT NOT NULL DEFAULT 'user',
    "ownerKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "forumId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "note" TEXT,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "firstMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "agent_leads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "agent_leads_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "agent_leads_forumId_fkey" FOREIGN KEY ("forumId") REFERENCES "forums" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "forum_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "forumId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "forum_events_forumId_fkey" FOREIGN KEY ("forumId") REFERENCES "forums" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "forum_events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "forum_articles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "forumId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT NOT NULL,
    "coverImage" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "views" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "forum_articles_forumId_fkey" FOREIGN KEY ("forumId") REFERENCES "forums" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "forum_articles_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "forum_knowledge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "forumId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "forum_knowledge_forumId_fkey" FOREIGN KEY ("forumId") REFERENCES "forums" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "forum_knowledge_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "social_posts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "pinnedAt" DATETIME,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "editedAt" DATETIME,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "social_posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "social_post_attachments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "durationMs" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "social_post_attachments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "social_posts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "social_post_likes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "social_post_likes_postId_fkey" FOREIGN KEY ("postId") REFERENCES "social_posts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "social_post_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "social_post_comments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "social_post_comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "social_posts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "social_post_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "social_post_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedById" TEXT,
    "resolvedAt" DATETIME,
    "resolutionNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "social_post_reports_postId_fkey" FOREIGN KEY ("postId") REFERENCES "social_posts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "social_post_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "token_wallets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "lifetimeGranted" INTEGER NOT NULL DEFAULT 0,
    "lifetimePurchased" INTEGER NOT NULL DEFAULT 0,
    "lifetimeSpent" INTEGER NOT NULL DEFAULT 0,
    "lastDailyBonusAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "token_wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "token_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "feature" TEXT,
    "refId" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "token_transactions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "token_wallets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "token_usages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "chargedTokens" INTEGER NOT NULL DEFAULT 0,
    "estimated" BOOLEAN NOT NULL DEFAULT false,
    "model" TEXT,
    "title" TEXT,
    "refId" TEXT,
    "meta" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "token_packages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "tokens" INTEGER NOT NULL,
    "bonusTokens" INTEGER NOT NULL DEFAULT 0,
    "priceToman" INTEGER NOT NULL,
    "popular" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "payment_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "packageId" TEXT,
    "packageTitle" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL,
    "bonusTokens" INTEGER NOT NULL DEFAULT 0,
    "priceToman" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "gateway" TEXT NOT NULL DEFAULT 'zarinpal',
    "authority" TEXT,
    "refId" TEXT,
    "cardPan" TEXT,
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "payment_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payment_orders_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "token_packages" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_status_createdAt_idx" ON "User"("status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_phone_idx" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Session_jti_key" ON "Session"("jti");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AdminUser_username_key" ON "AdminUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AdminSession_jti_key" ON "AdminSession"("jti");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminSession_adminId_idx" ON "AdminSession"("adminId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BusinessCategory_name_key" ON "BusinessCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BusinessCategory_slug_key" ON "BusinessCategory"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BusinessCategory_sortOrder_idx" ON "BusinessCategory"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Business_slug_key" ON "Business"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Business_categoryId_isActive_idx" ON "Business"("categoryId", "isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Business_isFeatured_rating_idx" ON "Business"("isFeatured", "rating");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Business_name_idx" ON "Business"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BusinessReview_businessId_createdAt_idx" ON "BusinessReview"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BusinessReview_businessId_helpfulCount_idx" ON "BusinessReview"("businessId", "helpfulCount");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BusinessReview_businessId_userId_key" ON "BusinessReview"("businessId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FavoriteBusiness_userId_idx" ON "FavoriteBusiness"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FavoriteBusiness_userId_businessId_key" ON "FavoriteBusiness"("userId", "businessId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChatSession_userId_updatedAt_idx" ON "ChatSession"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChatMessage_sessionId_createdAt_idx" ON "ChatMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AIMemory_userId_category_importance_idx" ON "AIMemory"("userId", "category", "importance");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AIMemory_userId_key_key" ON "AIMemory"("userId", "key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Goal_userId_status_idx" ON "Goal"("userId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Goal_userId_deadline_idx" ON "Goal"("userId", "deadline");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Task_goalId_status_sortOrder_idx" ON "Task"("goalId", "status", "sortOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CityData_category_isPublished_publishedAt_idx" ON "CityData"("category", "isPublished", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Setting_key_key" ON "Setting"("key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Setting_group_idx" ON "Setting"("group");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActivityLog_action_createdAt_idx" ON "ActivityLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActivityLog_userId_createdAt_idx" ON "ActivityLog"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentExtraction_mediaUrl_key" ON "DocumentExtraction"("mediaUrl");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DocumentExtraction_updatedAt_idx" ON "DocumentExtraction"("updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FinanceAccount_userId_isActive_idx" ON "FinanceAccount"("userId", "isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FinanceCategory_userId_type_idx" ON "FinanceCategory"("userId", "type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FinanceTransaction_userId_date_type_idx" ON "FinanceTransaction"("userId", "date", "type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FinanceTransaction_userId_categoryId_idx" ON "FinanceTransaction"("userId", "categoryId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FinanceBudget_userId_monthKey_idx" ON "FinanceBudget"("userId", "monthKey");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FinanceBudget_userId_categoryId_monthKey_key" ON "FinanceBudget"("userId", "categoryId", "monthKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FinanceGoal_userId_status_idx" ON "FinanceGoal"("userId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FinanceDebt_userId_status_idx" ON "FinanceDebt"("userId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FinanceRecurring_userId_isActive_nextRunDate_idx" ON "FinanceRecurring"("userId", "isActive", "nextRunDate");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SocialProfile_userId_key" ON "SocialProfile"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SocialProfile_isDiscoverable_updatedAt_idx" ON "SocialProfile"("isDiscoverable", "updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KnowledgeItem_userId_updatedAt_idx" ON "KnowledgeItem"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SocialConversation_key_key" ON "SocialConversation"("key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SocialConversation_userAId_updatedAt_idx" ON "SocialConversation"("userAId", "updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SocialConversation_userBId_updatedAt_idx" ON "SocialConversation"("userBId", "updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SocialConversation_ownerId_updatedAt_idx" ON "SocialConversation"("ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SocialMessage_conversationId_createdAt_idx" ON "SocialMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProfileViewLog_profileId_updatedAt_idx" ON "ProfileViewLog"("profileId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProfileViewLog_profileId_viewerId_key" ON "ProfileViewLog"("profileId", "viewerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SkillEndorsement_profileId_skill_idx" ON "SkillEndorsement"("profileId", "skill");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SkillEndorsement_profileId_endorserId_skill_key" ON "SkillEndorsement"("profileId", "endorserId", "skill");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "module_configs_key_key" ON "module_configs"("key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "module_configs_isEnabled_idx" ON "module_configs"("isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "goal_categories_key_key" ON "goal_categories"("key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "goal_categories_isActive_sortOrder_idx" ON "goal_categories"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "finance_category_templates_type_isActive_sortOrder_idx" ON "finance_category_templates"("type", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_isActive_createdAt_idx" ON "Notification"("isActive", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OtpCode_phone_purpose_createdAt_idx" ON "OtpCode"("phone", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OtpCode_expiresAt_idx" ON "OtpCode"("expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NotificationRecipient_userId_createdAt_idx" ON "NotificationRecipient"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationRecipient_notificationId_userId_key" ON "NotificationRecipient"("notificationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "forums_slug_key" ON "forums"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "forums_status_type_idx" ON "forums"("status", "type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "forums_chairId_idx" ON "forums"("chairId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "forum_members_forumId_status_idx" ON "forum_members"("forumId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "forum_members_userId_idx" ON "forum_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "forum_members_forumId_userId_key" ON "forum_members"("forumId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "forum_messages_forumId_thread_createdAt_idx" ON "forum_messages"("forumId", "thread", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "forum_messages_forumId_thread_threadUserId_createdAt_idx" ON "forum_messages"("forumId", "thread", "threadUserId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "agent_leads_ownerKey_status_lastMessageAt_idx" ON "agent_leads"("ownerKey", "status", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "agent_leads_ownerKey_userId_key" ON "agent_leads"("ownerKey", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "forum_events_forumId_startsAt_idx" ON "forum_events"("forumId", "startsAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "forum_articles_forumId_status_publishedAt_idx" ON "forum_articles"("forumId", "status", "publishedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "forum_knowledge_forumId_updatedAt_idx" ON "forum_knowledge"("forumId", "updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "social_posts_deletedAt_createdAt_idx" ON "social_posts"("deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "social_posts_authorId_deletedAt_isPinned_createdAt_idx" ON "social_posts"("authorId", "deletedAt", "isPinned", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "social_posts_deletedAt_likeCount_idx" ON "social_posts"("deletedAt", "likeCount");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "social_post_attachments_postId_sortOrder_idx" ON "social_post_attachments"("postId", "sortOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "social_post_likes_userId_createdAt_idx" ON "social_post_likes"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "social_post_likes_postId_userId_key" ON "social_post_likes"("postId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "social_post_comments_postId_createdAt_idx" ON "social_post_comments"("postId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "social_post_reports_status_createdAt_idx" ON "social_post_reports"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "social_post_reports_postId_reporterId_key" ON "social_post_reports"("postId", "reporterId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "token_wallets_userId_key" ON "token_wallets"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "token_transactions_userId_createdAt_idx" ON "token_transactions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "token_transactions_type_createdAt_idx" ON "token_transactions"("type", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "token_transactions_feature_idx" ON "token_transactions"("feature");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "token_usages_userId_createdAt_idx" ON "token_usages"("userId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "token_usages_userId_feature_idx" ON "token_usages"("userId", "feature");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "token_usages_section_createdAt_idx" ON "token_usages"("section", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "token_usages_feature_createdAt_idx" ON "token_usages"("feature", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "token_packages_active_sortOrder_idx" ON "token_packages"("active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payment_orders_authority_key" ON "payment_orders"("authority");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payment_orders_userId_createdAt_idx" ON "payment_orders"("userId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payment_orders_status_createdAt_idx" ON "payment_orders"("status", "createdAt");

