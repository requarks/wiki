DROP INDEX "liveNotes_key_key";--> statement-breakpoint
DROP INDEX "liveNotes_siteId_idx";--> statement-breakpoint
ALTER TABLE "liveNotes" ALTER COLUMN "key" SET DATA TYPE varchar(64) USING "key"::varchar(64);--> statement-breakpoint
CREATE UNIQUE INDEX "liveNotes_siteId_key_key" ON "liveNotes" ("siteId","key");