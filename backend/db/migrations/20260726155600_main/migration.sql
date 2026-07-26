CREATE TABLE "storage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"module" varchar(255) NOT NULL,
	"isEnabled" boolean DEFAULT false NOT NULL,
	"contentTypes" jsonb DEFAULT '{}' NOT NULL,
	"assetDelivery" jsonb DEFAULT '{}' NOT NULL,
	"versioning" jsonb DEFAULT '{}' NOT NULL,
	"config" jsonb DEFAULT '{}' NOT NULL,
	"state" jsonb DEFAULT '{}' NOT NULL,
	"siteId" uuid NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "storage_composite_idx" ON "storage" ("siteId","module");--> statement-breakpoint
ALTER TABLE "storage" ADD CONSTRAINT "storage_siteId_sites_id_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id");