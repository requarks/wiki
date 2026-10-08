DROP INDEX "tree_folderpath_idx";--> statement-breakpoint
CREATE INDEX "tree_folderpath_idx" ON "tree" USING hash ("folderPath");