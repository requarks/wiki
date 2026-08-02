CREATE TABLE "rateLimits" (
	"key" varchar(255) PRIMARY KEY,
	"hits" integer DEFAULT 0 NOT NULL,
	"windowStartedAt" timestamp DEFAULT now() NOT NULL,
	"bannedUntil" timestamp,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "rateLimits_updatedAt_idx" ON "rateLimits" ("updatedAt");