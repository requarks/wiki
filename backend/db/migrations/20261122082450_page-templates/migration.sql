ALTER TABLE "pages" ADD COLUMN "isTemplate" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "pages_templates_idx" ON "pages" ("siteId","locale") WHERE "isTemplate";