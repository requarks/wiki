CREATE TYPE "importSessionState" AS ENUM('open', 'finished', 'failed');--> statement-breakpoint
CREATE TABLE "importIdMap" (
	"sessionId" uuid,
	"entity" varchar(32),
	"sourceId" varchar(255),
	"targetId" uuid NOT NULL,
	CONSTRAINT "importIdMap_pkey" PRIMARY KEY("sessionId","entity","sourceId")
);
--> statement-breakpoint
CREATE TABLE "importSessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"namespace" uuid NOT NULL,
	"source" varchar(32) NOT NULL,
	"sites" jsonb DEFAULT '[]' NOT NULL,
	"includes" jsonb DEFAULT '[]' NOT NULL,
	"overwrite" boolean DEFAULT false NOT NULL,
	"state" "importSessionState" DEFAULT 'open'::"importSessionState" NOT NULL,
	"progress" jsonb DEFAULT '{}' NOT NULL,
	"warnings" jsonb DEFAULT '[]' NOT NULL,
	"actorId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "importSessions_createdAt_idx" ON "importSessions" ("createdAt");--> statement-breakpoint
ALTER TABLE "importIdMap" ADD CONSTRAINT "importIdMap_sessionId_importSessions_id_fkey" FOREIGN KEY ("sessionId") REFERENCES "importSessions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "importSessions" ADD CONSTRAINT "importSessions_actorId_users_id_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL;