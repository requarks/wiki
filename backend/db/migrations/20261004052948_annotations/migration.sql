CREATE TABLE "commentAnnotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"commentId" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"note" text NOT NULL,
	"anchor" jsonb NOT NULL,
	"resolvedAt" timestamp,
	"resolvedById" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "deletedAt" timestamp;--> statement-breakpoint
CREATE INDEX "commentAnnotations_commentId_idx" ON "commentAnnotations" ("commentId","position");--> statement-breakpoint
ALTER TABLE "commentAnnotations" ADD CONSTRAINT "commentAnnotations_commentId_comments_id_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "commentAnnotations" ADD CONSTRAINT "commentAnnotations_resolvedById_users_id_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL;