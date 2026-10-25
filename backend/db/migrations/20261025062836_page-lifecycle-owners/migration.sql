CREATE TABLE "pageLifecycleRules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"pageId" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"trigger" varchar(32) NOT NULL,
	"triggerDays" integer NOT NULL,
	"actions" jsonb DEFAULT '[]' NOT NULL,
	"authorId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastFiredAt" timestamp,
	"fireCount" integer DEFAULT 0 NOT NULL,
	"lastOutcome" jsonb
);
--> statement-breakpoint
CREATE TABLE "pageOwners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"pageId" uuid NOT NULL,
	"userId" uuid,
	"groupId" uuid,
	CONSTRAINT "pageOwners_owner_check" CHECK (num_nonnulls("userId", "groupId") = 1)
);
--> statement-breakpoint
ALTER TABLE "pages" DROP CONSTRAINT "pages_ownerId_users_id_fkey";--> statement-breakpoint
DROP INDEX "pages_ownerId_idx";--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "contentUpdatedAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "lastReviewedAt" timestamp;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "lifecycleBanner" jsonb;--> statement-breakpoint
ALTER TABLE "pages" DROP COLUMN "ownerId";--> statement-breakpoint
CREATE INDEX "pageLifecycleRules_pageId_idx" ON "pageLifecycleRules" ("pageId");--> statement-breakpoint
CREATE UNIQUE INDEX "pageOwners_page_user_idx" ON "pageOwners" ("pageId","userId");--> statement-breakpoint
CREATE UNIQUE INDEX "pageOwners_page_group_idx" ON "pageOwners" ("pageId","groupId");--> statement-breakpoint
CREATE INDEX "pageOwners_userId_idx" ON "pageOwners" ("userId");--> statement-breakpoint
CREATE INDEX "pageOwners_groupId_idx" ON "pageOwners" ("groupId");--> statement-breakpoint
ALTER TABLE "pageLifecycleRules" ADD CONSTRAINT "pageLifecycleRules_pageId_pages_id_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pageLifecycleRules" ADD CONSTRAINT "pageLifecycleRules_authorId_users_id_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "pageOwners" ADD CONSTRAINT "pageOwners_pageId_pages_id_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pageOwners" ADD CONSTRAINT "pageOwners_userId_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pageOwners" ADD CONSTRAINT "pageOwners_groupId_groups_id_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE;--> statement-breakpoint
-- `ownerId` is gone from the page row, so it goes from the two copies of that row as well: the
-- tree entry's `meta` (`pages.treeMeta`, which the page problem scan compares against) and every
-- version's `meta` in `pageHistory`, which held whatever the row did. It was always the creator, and
-- a page with no `pageOwners` row is owned by its creator, so there is nothing to carry across.
UPDATE "tree" SET "meta" = "meta" - 'ownerId' WHERE "meta" ? 'ownerId';--> statement-breakpoint
UPDATE "pageHistory" SET "meta" = "meta" - 'ownerId' WHERE "meta" ? 'ownerId';
--> statement-breakpoint
-- When each existing page's body last changed: the newest version that changed `content`, or that
-- created or restored the page. A page whose history no longer reaches that far (purged by
-- retention) takes `updatedAt`, which is never earlier than the body's last change -- so a rule
-- counting from it can fire late on such a page, never early.
UPDATE "pages" p
SET "contentUpdatedAt" = coalesce(
		(
			SELECT max(h."versionDate")
			FROM "pageHistory" h
			WHERE h."pageId" = p."id"
				AND ('content' = ANY (h."changedFields") OR h."action" IN ('created', 'restored'))
		),
		p."updatedAt"
	);
