CREATE TABLE "pageRatings" (
	"pageId" uuid,
	"userId" uuid,
	"kind" varchar(16) NOT NULL,
	"value" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pageRatings_pkey" PRIMARY KEY("pageId","userId")
);
--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "ratings" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "pages" DROP COLUMN "ratingScore";--> statement-breakpoint
ALTER TABLE "pages" DROP COLUMN "ratingCount";--> statement-breakpoint
CREATE INDEX "pageRatings_userId_idx" ON "pageRatings" ("userId");--> statement-breakpoint
ALTER TABLE "pageRatings" ADD CONSTRAINT "pageRatings_pageId_pages_id_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pageRatings" ADD CONSTRAINT "pageRatings_userId_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;