ALTER TABLE "locales" ALTER COLUMN "completeness" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "locales" ALTER COLUMN "completeness" DROP NOT NULL;