CREATE TYPE "assetKind" AS ENUM('document', 'image', 'other');--> statement-breakpoint
CREATE TYPE "jobHistoryState" AS ENUM('active', 'completed', 'failed', 'interrupted');--> statement-breakpoint
CREATE TYPE "pagePublishState" AS ENUM('draft', 'published', 'scheduled');--> statement-breakpoint
CREATE TYPE "treeNavigationMode" AS ENUM('inherit', 'override', 'overrideExact', 'hide', 'hideExact');--> statement-breakpoint
CREATE TYPE "treeType" AS ENUM('folder', 'page', 'asset');--> statement-breakpoint
CREATE TABLE "apiKeys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(255) NOT NULL,
	"key" text NOT NULL,
	"expiration" timestamp DEFAULT now() NOT NULL,
	"isRevoked" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"fileName" varchar(255) NOT NULL,
	"fileExt" varchar(255) NOT NULL,
	"isSystem" boolean DEFAULT false NOT NULL,
	"kind" "assetKind" DEFAULT 'other'::"assetKind" NOT NULL,
	"mimeType" varchar(255) DEFAULT 'application/octet-stream' NOT NULL,
	"fileSize" bigint,
	"meta" jsonb DEFAULT '{}' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"data" bytea,
	"preview" bytea,
	"storageInfo" jsonb,
	"authorId" uuid NOT NULL,
	"siteId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "authentication" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"module" varchar(255) NOT NULL,
	"isEnabled" boolean DEFAULT false NOT NULL,
	"displayName" varchar(255) DEFAULT '' NOT NULL,
	"config" jsonb DEFAULT '{}' NOT NULL,
	"registration" boolean DEFAULT false NOT NULL,
	"allowedEmailRegex" varchar(255) DEFAULT '' NOT NULL,
	"autoEnrollGroups" uuid[] DEFAULT '{}'::uuid[]
);
--> statement-breakpoint
CREATE TABLE "blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"block" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(255) NOT NULL,
	"icon" varchar(255) NOT NULL,
	"isEnabled" boolean DEFAULT false NOT NULL,
	"isCustom" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}' NOT NULL,
	"siteId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(255) NOT NULL,
	"permissions" jsonb NOT NULL,
	"rules" jsonb NOT NULL,
	"redirectOnLogin" varchar(255) DEFAULT '' NOT NULL,
	"redirectOnFirstLogin" varchar(255) DEFAULT '' NOT NULL,
	"redirectOnLogout" varchar(255) DEFAULT '' NOT NULL,
	"isSystem" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobHistory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"task" varchar(255) NOT NULL,
	"state" "jobHistoryState" NOT NULL,
	"useWorker" boolean DEFAULT false NOT NULL,
	"wasScheduled" boolean DEFAULT false NOT NULL,
	"payload" jsonb NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"maxRetries" integer DEFAULT 0 NOT NULL,
	"lastErrorMessage" text,
	"executedBy" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobLock" (
	"key" varchar(255) PRIMARY KEY,
	"lastCheckedBy" varchar(255),
	"lastCheckedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobSchedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"task" varchar(255) NOT NULL,
	"cron" varchar(255) NOT NULL,
	"type" varchar(255) DEFAULT 'system' NOT NULL,
	"payload" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"task" varchar(255) NOT NULL,
	"useWorker" boolean DEFAULT false NOT NULL,
	"payload" jsonb NOT NULL,
	"retries" integer DEFAULT 0 NOT NULL,
	"maxRetries" integer DEFAULT 0 NOT NULL,
	"waitUntil" timestamp,
	"isScheduled" boolean DEFAULT false NOT NULL,
	"createdBy" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locales" (
	"code" varchar(255) PRIMARY KEY,
	"name" varchar(255) NOT NULL,
	"nativeName" varchar(255) NOT NULL,
	"language" varchar(8) NOT NULL,
	"region" varchar(3) NOT NULL,
	"script" varchar(4) NOT NULL,
	"isRTL" boolean DEFAULT false NOT NULL,
	"strings" jsonb DEFAULT '[]' NOT NULL,
	"completeness" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "navigation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"items" jsonb DEFAULT '[]' NOT NULL,
	"siteId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"locale" ltree NOT NULL,
	"path" varchar(255) NOT NULL,
	"hash" varchar(255) NOT NULL,
	"alias" varchar(255),
	"title" varchar(255) NOT NULL,
	"description" varchar(255),
	"icon" varchar(255),
	"publishState" "pagePublishState" DEFAULT 'draft'::"pagePublishState" NOT NULL,
	"publishStartDate" timestamp,
	"publishEndDate" timestamp,
	"config" jsonb DEFAULT '{}' NOT NULL,
	"relations" jsonb DEFAULT '[]' NOT NULL,
	"content" text,
	"render" text,
	"searchContent" text,
	"ts" tsvector,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"toc" jsonb,
	"editor" varchar(255) NOT NULL,
	"contentType" varchar(255) NOT NULL,
	"isBrowsable" boolean DEFAULT true NOT NULL,
	"isSearchable" boolean DEFAULT true NOT NULL,
	"isSearchableComputed" boolean GENERATED ALWAYS AS ("pages"."publishState" != 'draft' AND "pages"."isSearchable") STORED,
	"password" varchar(255),
	"ratingScore" integer DEFAULT 0 NOT NULL,
	"ratingCount" timestamp DEFAULT now() NOT NULL,
	"scripts" jsonb DEFAULT '{}' NOT NULL,
	"historyData" jsonb DEFAULT '{}' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"authorId" uuid NOT NULL,
	"creatorId" uuid NOT NULL,
	"ownerId" uuid NOT NULL,
	"siteId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" varchar(255) PRIMARY KEY,
	"value" jsonb DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"hostname" varchar(255) NOT NULL UNIQUE,
	"isEnabled" boolean DEFAULT false NOT NULL,
	"config" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tag" varchar(255) NOT NULL,
	"usageCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"siteId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tree" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"folderPath" ltree,
	"fileName" varchar(255) NOT NULL,
	"hash" varchar(255) NOT NULL,
	"tree" "treeType" NOT NULL,
	"locale" ltree NOT NULL,
	"title" varchar(255) NOT NULL,
	"navigationMode" "treeNavigationMode" DEFAULT 'inherit'::"treeNavigationMode" NOT NULL,
	"navigationId" uuid,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"meta" jsonb DEFAULT '{}' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"siteId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "userAvatars" (
	"id" uuid PRIMARY KEY,
	"data" bytea NOT NULL
);
--> statement-breakpoint
CREATE TABLE "userGroups" (
	"userId" uuid,
	"groupId" uuid,
	CONSTRAINT "userGroups_pkey" PRIMARY KEY("userId","groupId")
);
--> statement-breakpoint
CREATE TABLE "userKeys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"kind" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"meta" jsonb DEFAULT '{}' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"validUntil" timestamp NOT NULL,
	"userId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" varchar(255) NOT NULL UNIQUE,
	"name" varchar(255) NOT NULL,
	"auth" jsonb DEFAULT '{}' NOT NULL,
	"meta" jsonb DEFAULT '{}' NOT NULL,
	"passkeys" jsonb DEFAULT '{}' NOT NULL,
	"prefs" jsonb DEFAULT '{}' NOT NULL,
	"hasAvatar" boolean DEFAULT false NOT NULL,
	"isActive" boolean DEFAULT false NOT NULL,
	"isSystem" boolean DEFAULT false NOT NULL,
	"isVerified" boolean DEFAULT false NOT NULL,
	"lastLoginAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "assets_siteId_idx" ON "assets" ("siteId");--> statement-breakpoint
CREATE INDEX "blocks_siteId_idx" ON "blocks" ("siteId");--> statement-breakpoint
CREATE INDEX "locales_language_idx" ON "locales" ("language");--> statement-breakpoint
CREATE INDEX "navigation_siteId_idx" ON "navigation" ("siteId");--> statement-breakpoint
CREATE INDEX "pages_authorId_idx" ON "pages" ("authorId");--> statement-breakpoint
CREATE INDEX "pages_creatorId_idx" ON "pages" ("creatorId");--> statement-breakpoint
CREATE INDEX "pages_ownerId_idx" ON "pages" ("ownerId");--> statement-breakpoint
CREATE INDEX "pages_siteId_idx" ON "pages" ("siteId");--> statement-breakpoint
CREATE INDEX "pages_ts_idx" ON "pages" USING gin ("ts");--> statement-breakpoint
CREATE INDEX "pages_tags_idx" ON "pages" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "pages_isSearchableComputed_idx" ON "pages" ("isSearchableComputed");--> statement-breakpoint
CREATE INDEX "tags_siteId_idx" ON "tags" ("siteId");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_composite_idx" ON "tags" ("siteId","tag");--> statement-breakpoint
CREATE INDEX "tree_folderpath_idx" ON "tree" ("folderPath");--> statement-breakpoint
CREATE INDEX "tree_folderpath_gist_idx" ON "tree" USING gist ("folderPath");--> statement-breakpoint
CREATE INDEX "tree_fileName_idx" ON "tree" ("fileName");--> statement-breakpoint
CREATE INDEX "tree_hash_idx" ON "tree" ("hash");--> statement-breakpoint
CREATE INDEX "tree_type_idx" ON "tree" ("tree");--> statement-breakpoint
CREATE INDEX "tree_locale_idx" ON "tree" USING gist ("locale");--> statement-breakpoint
CREATE INDEX "tree_navigationMode_idx" ON "tree" ("navigationMode");--> statement-breakpoint
CREATE INDEX "tree_navigationId_idx" ON "tree" ("navigationId");--> statement-breakpoint
CREATE INDEX "tree_tags_idx" ON "tree" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "tree_siteId_idx" ON "tree" ("siteId");--> statement-breakpoint
CREATE INDEX "userGroups_userId_idx" ON "userGroups" ("userId");--> statement-breakpoint
CREATE INDEX "userGroups_groupId_idx" ON "userGroups" ("groupId");--> statement-breakpoint
CREATE INDEX "userGroups_composite_idx" ON "userGroups" ("userId","groupId");--> statement-breakpoint
CREATE INDEX "userKeys_userId_idx" ON "userKeys" ("userId");--> statement-breakpoint
CREATE INDEX "users_lastLoginAt_idx" ON "users" ("lastLoginAt");--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_authorId_users_id_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_siteId_sites_id_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id");--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_siteId_sites_id_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id");--> statement-breakpoint
ALTER TABLE "navigation" ADD CONSTRAINT "navigation_siteId_sites_id_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id");--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_authorId_users_id_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_creatorId_users_id_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_ownerId_users_id_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_siteId_sites_id_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id");--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_siteId_sites_id_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id");--> statement-breakpoint
ALTER TABLE "tree" ADD CONSTRAINT "tree_siteId_sites_id_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id");--> statement-breakpoint
ALTER TABLE "userGroups" ADD CONSTRAINT "userGroups_userId_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "userGroups" ADD CONSTRAINT "userGroups_groupId_groups_id_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "userKeys" ADD CONSTRAINT "userKeys_userId_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id");