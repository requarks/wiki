CREATE TABLE "personalTokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"userId" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"keyShort" varchar(8) NOT NULL,
	"scopes" jsonb DEFAULT '[]' NOT NULL,
	"expiration" timestamp NOT NULL,
	"lastUsedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "personalTokens_userId_idx" ON "personalTokens" ("userId");--> statement-breakpoint
ALTER TABLE "personalTokens" ADD CONSTRAINT "personalTokens_userId_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;