ALTER TABLE "approvalRules" ADD COLUMN "name" varchar(255) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "approvalRules" ADD COLUMN "isEnabled" boolean DEFAULT true NOT NULL;