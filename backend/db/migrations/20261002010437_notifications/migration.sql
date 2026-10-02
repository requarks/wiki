CREATE TABLE "notificationEvents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"kind" varchar(64) NOT NULL,
	"origin" varchar(16) DEFAULT 'user' NOT NULL,
	"siteId" uuid,
	"actorId" uuid,
	"data" jsonb DEFAULT '{}' NOT NULL,
	"recipients" uuid[],
	"cursor" jsonb,
	"claimedAt" timestamp,
	"claimedBy" varchar(255),
	"processedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"userId" uuid NOT NULL,
	"siteId" uuid,
	"category" varchar(64) NOT NULL,
	"variant" varchar(32) NOT NULL,
	"groupKey" varchar(255) NOT NULL,
	"pageId" uuid,
	"commentId" uuid,
	"actorId" uuid,
	"data" jsonb DEFAULT '{}' NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"lastEventId" uuid NOT NULL,
	"inApp" boolean DEFAULT true NOT NULL,
	"emailState" varchar(16) DEFAULT 'none' NOT NULL,
	"emailAfter" timestamp,
	"emailedAt" timestamp,
	"readAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "userNotificationPrefs" (
	"userId" uuid,
	"category" varchar(64),
	"channel" varchar(16),
	"enabled" boolean NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "userNotificationPrefs_pkey" PRIMARY KEY("userId","category","channel")
);
--> statement-breakpoint
CREATE INDEX "notificationEvents_pending_idx" ON "notificationEvents" ("createdAt") WHERE "processedAt" IS NULL;--> statement-breakpoint
CREATE INDEX "notificationEvents_processed_idx" ON "notificationEvents" ("processedAt") WHERE "processedAt" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "notifications_user_updated_idx" ON "notifications" ("userId","updatedAt");--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications" ("userId","siteId") WHERE "readAt" IS NULL AND "inApp";--> statement-breakpoint
CREATE INDEX "notifications_email_idx" ON "notifications" ("emailAfter") WHERE "emailState" IN ('pending', 'sending');--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_user_group_unread_idx" ON "notifications" ("userId","groupKey") WHERE "readAt" IS NULL;--> statement-breakpoint
CREATE INDEX "notifications_pageId_idx" ON "notifications" ("pageId");--> statement-breakpoint
CREATE INDEX "notifications_commentId_idx" ON "notifications" ("commentId");--> statement-breakpoint
CREATE INDEX "notifications_createdAt_idx" ON "notifications" ("createdAt");--> statement-breakpoint
CREATE INDEX "userNotificationPrefs_optin_idx" ON "userNotificationPrefs" ("category","userId") WHERE "enabled";--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_siteId_sites_id_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_pageId_pages_id_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_commentId_comments_id_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actorId_users_id_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "userNotificationPrefs" ADD CONSTRAINT "userNotificationPrefs_userId_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;