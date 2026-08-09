CREATE TABLE "siteAssets" (
	"siteId" uuid,
	"kind" varchar(255),
	"data" bytea NOT NULL,
	CONSTRAINT "siteAssets_pkey" PRIMARY KEY("siteId","kind")
);
--> statement-breakpoint
ALTER TABLE "siteAssets" ADD CONSTRAINT "siteAssets_siteId_sites_id_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id");