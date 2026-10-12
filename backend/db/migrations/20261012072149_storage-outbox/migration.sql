CREATE TABLE "storageOutbox" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "storageOutbox_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"targetId" uuid NOT NULL,
	"kind" varchar(16) NOT NULL,
	"op" varchar(16) NOT NULL,
	"path" text NOT NULL,
	"previousPath" text,
	"label" text NOT NULL,
	"previousLabel" text,
	"data" bytea,
	"actorId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storageSyncState" (
	"targetId" uuid PRIMARY KEY,
	"remote" text NOT NULL,
	"branch" varchar(255) NOT NULL,
	"commit" varchar(64) NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "storageOutbox_targetId_idx" ON "storageOutbox" ("targetId","id");--> statement-breakpoint
CREATE INDEX "storageOutbox_path_idx" ON "storageOutbox" ("targetId","path");--> statement-breakpoint
ALTER TABLE "storageOutbox" ADD CONSTRAINT "storageOutbox_targetId_storage_id_fkey" FOREIGN KEY ("targetId") REFERENCES "storage"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "storageSyncState" ADD CONSTRAINT "storageSyncState_targetId_storage_id_fkey" FOREIGN KEY ("targetId") REFERENCES "storage"("id") ON DELETE CASCADE;