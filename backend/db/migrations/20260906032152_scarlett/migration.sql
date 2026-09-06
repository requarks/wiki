CREATE TABLE "auditLog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"ts" timestamp DEFAULT now() NOT NULL,
	"kind" varchar(16) NOT NULL,
	"action" varchar(64) NOT NULL,
	"clientIP" varchar(45) DEFAULT '' NOT NULL,
	"meta" jsonb DEFAULT '{}' NOT NULL,
	"userId" uuid
);
--> statement-breakpoint
CREATE INDEX "auditLog_ts_idx" ON "auditLog" ("ts" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "auditLog_userId_idx" ON "auditLog" ("userId","ts" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "auditLog_kind_idx" ON "auditLog" ("kind","ts" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "auditLog_action_idx" ON "auditLog" ("action","ts" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "auditLog" ADD CONSTRAINT "auditLog_userId_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL;