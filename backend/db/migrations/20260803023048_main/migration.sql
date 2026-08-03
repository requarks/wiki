CREATE TABLE "pageRenderQueue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"allowScripts" boolean DEFAULT false NOT NULL,
	"allowStyles" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"pageId" uuid NOT NULL UNIQUE,
	"siteId" uuid NOT NULL,
	"requestedById" uuid
);
--> statement-breakpoint
CREATE INDEX "pageRenderQueue_createdAt_idx" ON "pageRenderQueue" ("createdAt");--> statement-breakpoint
ALTER TABLE "pageRenderQueue" ADD CONSTRAINT "pageRenderQueue_pageId_pages_id_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pageRenderQueue" ADD CONSTRAINT "pageRenderQueue_siteId_sites_id_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id");--> statement-breakpoint
ALTER TABLE "pageRenderQueue" ADD CONSTRAINT "pageRenderQueue_requestedById_users_id_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL;