CREATE TABLE "pageLinks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"kind" varchar(16) NOT NULL,
	"href" varchar(2048) NOT NULL,
	"targetSiteId" uuid NOT NULL,
	"targetLocale" varchar(255),
	"targetPath" varchar(255),
	"targetRef" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"pageId" uuid NOT NULL,
	"siteId" uuid NOT NULL
);
--> statement-breakpoint
CREATE INDEX "pageLinks_target_idx" ON "pageLinks" ("targetSiteId","targetLocale","targetPath");--> statement-breakpoint
CREATE INDEX "pageLinks_targetRef_idx" ON "pageLinks" ("targetSiteId","kind","targetRef");--> statement-breakpoint
CREATE INDEX "pageLinks_pageId_idx" ON "pageLinks" ("pageId");--> statement-breakpoint
CREATE INDEX "pageLinks_siteId_idx" ON "pageLinks" ("siteId");--> statement-breakpoint
CREATE UNIQUE INDEX "pageLinks_pageId_href_idx" ON "pageLinks" ("pageId","href");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_siteId_locale_path_idx" ON "pages" ("siteId","locale","path");--> statement-breakpoint
ALTER TABLE "pageLinks" ADD CONSTRAINT "pageLinks_targetSiteId_sites_id_fkey" FOREIGN KEY ("targetSiteId") REFERENCES "sites"("id");--> statement-breakpoint
ALTER TABLE "pageLinks" ADD CONSTRAINT "pageLinks_pageId_pages_id_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pageLinks" ADD CONSTRAINT "pageLinks_siteId_sites_id_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id");