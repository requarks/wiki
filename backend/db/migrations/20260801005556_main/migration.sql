CREATE TABLE "pageEditSubmissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"content" text NOT NULL,
	"patch" text NOT NULL,
	"baseHash" varchar(64) NOT NULL,
	"guestName" varchar(255),
	"guestEmail" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"pageId" uuid NOT NULL,
	"siteId" uuid NOT NULL,
	"authorId" uuid
);
--> statement-breakpoint
CREATE INDEX "pageEditSubmissions_pageId_idx" ON "pageEditSubmissions" ("pageId");--> statement-breakpoint
CREATE INDEX "pageEditSubmissions_siteId_idx" ON "pageEditSubmissions" ("siteId");--> statement-breakpoint
CREATE INDEX "pageEditSubmissions_authorId_idx" ON "pageEditSubmissions" ("authorId");--> statement-breakpoint
CREATE UNIQUE INDEX "pageEditSubmissions_page_author_idx" ON "pageEditSubmissions" ("pageId","authorId") WHERE "authorId" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "pageEditSubmissions" ADD CONSTRAINT "pageEditSubmissions_pageId_pages_id_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pageEditSubmissions" ADD CONSTRAINT "pageEditSubmissions_siteId_sites_id_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id");--> statement-breakpoint
ALTER TABLE "pageEditSubmissions" ADD CONSTRAINT "pageEditSubmissions_authorId_users_id_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id");