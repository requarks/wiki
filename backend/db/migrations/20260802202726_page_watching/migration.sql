CREATE TABLE "pageWatching" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"pageId" uuid NOT NULL,
	"siteId" uuid NOT NULL,
	"userId" uuid NOT NULL
);
--> statement-breakpoint
CREATE INDEX "pageWatching_user_site_idx" ON "pageWatching" ("userId","siteId");--> statement-breakpoint
CREATE UNIQUE INDEX "pageWatching_page_user_idx" ON "pageWatching" ("pageId","userId");--> statement-breakpoint
ALTER TABLE "pageWatching" ADD CONSTRAINT "pageWatching_pageId_pages_id_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pageWatching" ADD CONSTRAINT "pageWatching_siteId_sites_id_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id");--> statement-breakpoint
ALTER TABLE "pageWatching" ADD CONSTRAINT "pageWatching_userId_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;