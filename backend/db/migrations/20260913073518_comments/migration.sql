CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"pageId" uuid NOT NULL,
	"parentId" uuid,
	"content" text NOT NULL,
	"authorId" uuid,
	"authorName" varchar(255) NOT NULL,
	"authorEmail" varchar(255) DEFAULT '' NOT NULL,
	"authorIP" varchar(255) DEFAULT '' NOT NULL,
	"meta" jsonb DEFAULT '{}' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "handle" varchar(64);--> statement-breakpoint
CREATE INDEX "comments_page_created_idx" ON "comments" ("pageId","createdAt");--> statement-breakpoint
CREATE INDEX "comments_parentId_idx" ON "comments" ("parentId");--> statement-breakpoint
CREATE INDEX "comments_authorId_idx" ON "comments" ("authorId");--> statement-breakpoint
CREATE UNIQUE INDEX "users_handle_idx" ON "users" (lower("handle"));--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_pageId_pages_id_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parentId_comments_id_fkey" FOREIGN KEY ("parentId") REFERENCES "comments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_authorId_users_id_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL;