CREATE TABLE "approvalRules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"match" varchar(16) DEFAULT 'START' NOT NULL,
	"path" varchar(2048) DEFAULT '' NOT NULL,
	"submitterGroups" jsonb DEFAULT '[]' NOT NULL,
	"reviewerGroups" jsonb DEFAULT '[]' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"siteId" uuid NOT NULL
);
--> statement-breakpoint
CREATE INDEX "approvalRules_siteId_idx" ON "approvalRules" ("siteId");--> statement-breakpoint
ALTER TABLE "approvalRules" ADD CONSTRAINT "approvalRules_siteId_sites_id_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id");