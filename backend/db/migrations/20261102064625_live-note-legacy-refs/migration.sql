CREATE TABLE "liveNoteLegacyRefs" (
	"siteId" uuid,
	"ref" varchar(255),
	"noteId" uuid NOT NULL,
	CONSTRAINT "liveNoteLegacyRefs_pkey" PRIMARY KEY("siteId","ref")
);
--> statement-breakpoint
CREATE INDEX "liveNoteLegacyRefs_noteId_idx" ON "liveNoteLegacyRefs" ("noteId");--> statement-breakpoint
ALTER TABLE "liveNoteLegacyRefs" ADD CONSTRAINT "liveNoteLegacyRefs_siteId_sites_id_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "liveNoteLegacyRefs" ADD CONSTRAINT "liveNoteLegacyRefs_noteId_liveNotes_id_fkey" FOREIGN KEY ("noteId") REFERENCES "liveNotes"("id") ON DELETE CASCADE;