ALTER TABLE "blocks" ADD COLUMN "definition" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "blocks" ADD COLUMN "packageData" bytea;--> statement-breakpoint
ALTER TABLE "blocks" ADD COLUMN "checksum" varchar(64) DEFAULT '' NOT NULL;