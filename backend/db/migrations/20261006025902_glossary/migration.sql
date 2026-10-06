CREATE TABLE "glossaryTermRelations" (
	"termId" uuid,
	"relatedId" uuid,
	CONSTRAINT "glossaryTermRelations_pkey" PRIMARY KEY("termId","relatedId"),
	CONSTRAINT "glossaryTermRelations_order_check" CHECK ("termId" < "relatedId")
);
--> statement-breakpoint
CREATE TABLE "glossaryTerms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"siteId" uuid NOT NULL,
	"locale" varchar(255) NOT NULL,
	"term" varchar(255) NOT NULL,
	"expansion" varchar(255),
	"definition" text DEFAULT '' NOT NULL,
	"aliases" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"documentationPath" varchar(255),
	"documentationLabel" varchar(255),
	"references" jsonb DEFAULT '[]' NOT NULL,
	"caseSensitive" boolean DEFAULT false NOT NULL,
	"autoLink" boolean DEFAULT true NOT NULL,
	"category" varchar(255),
	"creatorId" uuid,
	"authorId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "glossaryTermRelations_relatedId_idx" ON "glossaryTermRelations" ("relatedId");--> statement-breakpoint
CREATE INDEX "glossaryTerms_site_locale_idx" ON "glossaryTerms" ("siteId","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "glossaryTerms_site_locale_term_key" ON "glossaryTerms" ("siteId","locale",lower("term"));--> statement-breakpoint
CREATE INDEX "glossaryTerms_documentation_idx" ON "glossaryTerms" ("siteId","locale","documentationPath") WHERE "documentationPath" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "glossaryTermRelations" ADD CONSTRAINT "glossaryTermRelations_termId_glossaryTerms_id_fkey" FOREIGN KEY ("termId") REFERENCES "glossaryTerms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "glossaryTermRelations" ADD CONSTRAINT "glossaryTermRelations_relatedId_glossaryTerms_id_fkey" FOREIGN KEY ("relatedId") REFERENCES "glossaryTerms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "glossaryTerms" ADD CONSTRAINT "glossaryTerms_siteId_sites_id_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "glossaryTerms" ADD CONSTRAINT "glossaryTerms_creatorId_users_id_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "glossaryTerms" ADD CONSTRAINT "glossaryTerms_authorId_users_id_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL;