CREATE TABLE "feedbackStatuses" (
	"pageId" uuid PRIMARY KEY,
	"status" varchar(32) NOT NULL,
	"commentId" uuid,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"updatedById" uuid
);
--> statement-breakpoint
CREATE INDEX "feedbackStatuses_status_idx" ON "feedbackStatuses" ("status");--> statement-breakpoint
CREATE INDEX "pageRatings_recent_upvotes_idx" ON "pageRatings" ("updatedAt") WHERE "kind" = 'thumbs' AND "value" = 1;--> statement-breakpoint
CREATE INDEX "pages_feedback_boards_idx" ON "pages" ("siteId") WHERE "editor" = 'feedback';--> statement-breakpoint
ALTER TABLE "feedbackStatuses" ADD CONSTRAINT "feedbackStatuses_pageId_pages_id_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "feedbackStatuses" ADD CONSTRAINT "feedbackStatuses_commentId_comments_id_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "feedbackStatuses" ADD CONSTRAINT "feedbackStatuses_updatedById_users_id_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
-- The Feedback Board editor, for every site that already exists. A site's settings are read back
-- verbatim and never merged with the defaults a new site is created with (see the note in
-- `20260914043258_visual_editor`), so without this an existing site has no `editors.feedback` and
-- never offers New Feedback Board. A `config` with no `editors` object at all is left alone, as
-- there: `jsonb_set` cannot create a key whose parent is missing.
UPDATE "sites"
SET "config" = jsonb_set(
		"config",
		'{editors,feedback}',
		'{"isActive":true,"config":{"submissionInterval":"1m"}}'::jsonb,
		true
	)
WHERE jsonb_typeof("config" -> 'editors') = 'object'
	AND "config" -> 'editors' -> 'feedback' IS NULL;
