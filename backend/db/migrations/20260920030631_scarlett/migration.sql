ALTER TABLE "groups" ADD COLUMN "externalId" varchar(255);--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "isProvisioned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "externalId" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "isProvisioned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "groups_externalId_idx" ON "groups" ("externalId");--> statement-breakpoint
CREATE UNIQUE INDEX "users_externalId_idx" ON "users" ("externalId");