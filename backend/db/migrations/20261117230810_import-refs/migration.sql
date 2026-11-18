CREATE TABLE "importRefs" (
	"sessionId" uuid,
	"kind" varchar(32),
	"key" text,
	"value" jsonb NOT NULL,
	CONSTRAINT "importRefs_pkey" PRIMARY KEY("sessionId","kind","key")
);
--> statement-breakpoint
ALTER TABLE "importRefs" ADD CONSTRAINT "importRefs_sessionId_importSessions_id_fkey" FOREIGN KEY ("sessionId") REFERENCES "importSessions"("id") ON DELETE CASCADE;