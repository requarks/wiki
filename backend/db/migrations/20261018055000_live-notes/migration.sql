CREATE TABLE "liveNoteImages" (
	"assetId" uuid PRIMARY KEY,
	"noteId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "liveNoteRevisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"noteId" uuid NOT NULL,
	"content" text NOT NULL,
	"authorIds" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "liveNotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"siteId" uuid NOT NULL,
	"key" varchar(24) NOT NULL,
	"title" varchar(255) DEFAULT '' NOT NULL,
	"access" varchar(16) DEFAULT 'editable' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"state" bytea,
	"pendingAuthorIds" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
	"creatorId" uuid,
	"lastEditorId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "liveNoteImages_noteId_idx" ON "liveNoteImages" ("noteId");--> statement-breakpoint
CREATE INDEX "liveNoteRevisions_noteId_createdAt_idx" ON "liveNoteRevisions" ("noteId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "liveNotes_key_key" ON "liveNotes" ("key");--> statement-breakpoint
CREATE INDEX "liveNotes_siteId_idx" ON "liveNotes" ("siteId");--> statement-breakpoint
ALTER TABLE "liveNoteImages" ADD CONSTRAINT "liveNoteImages_assetId_assets_id_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "liveNoteImages" ADD CONSTRAINT "liveNoteImages_noteId_liveNotes_id_fkey" FOREIGN KEY ("noteId") REFERENCES "liveNotes"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "liveNoteRevisions" ADD CONSTRAINT "liveNoteRevisions_noteId_liveNotes_id_fkey" FOREIGN KEY ("noteId") REFERENCES "liveNotes"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "liveNotes" ADD CONSTRAINT "liveNotes_siteId_sites_id_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "liveNotes" ADD CONSTRAINT "liveNotes_creatorId_users_id_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "liveNotes" ADD CONSTRAINT "liveNotes_lastEditorId_users_id_fkey" FOREIGN KEY ("lastEditorId") REFERENCES "users"("id") ON DELETE SET NULL;