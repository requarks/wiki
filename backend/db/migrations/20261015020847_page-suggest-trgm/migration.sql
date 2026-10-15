CREATE INDEX "pages_title_trgm_idx" ON "pages" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "pages_path_trgm_idx" ON "pages" USING gin ("path" gin_trgm_ops);