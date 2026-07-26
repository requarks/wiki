ALTER TABLE "apiKeys" ADD COLUMN "keyShort" varchar(8) NOT NULL;--> statement-breakpoint
ALTER TABLE "apiKeys" ADD COLUMN "groups" jsonb DEFAULT '[]' NOT NULL;