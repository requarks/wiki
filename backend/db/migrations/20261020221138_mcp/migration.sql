CREATE TABLE "oauthClients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(255) NOT NULL,
	"redirectUris" jsonb DEFAULT '[]' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauthCodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"codeHash" varchar(64) NOT NULL,
	"clientId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"siteId" uuid NOT NULL,
	"redirectUri" varchar(2048) NOT NULL,
	"codeChallenge" varchar(128) NOT NULL,
	"scopes" jsonb DEFAULT '[]' NOT NULL,
	"grantExpiration" varchar(16) NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pageHistory" ADD COLUMN "via" varchar(16);--> statement-breakpoint
ALTER TABLE "personalTokens" ADD COLUMN "clientId" uuid;--> statement-breakpoint
ALTER TABLE "personalTokens" ADD COLUMN "refreshHash" varchar(64);--> statement-breakpoint
CREATE UNIQUE INDEX "oauthCodes_codeHash_idx" ON "oauthCodes" ("codeHash");--> statement-breakpoint
CREATE INDEX "personalTokens_clientId_idx" ON "personalTokens" ("clientId");--> statement-breakpoint
ALTER TABLE "oauthCodes" ADD CONSTRAINT "oauthCodes_clientId_oauthClients_id_fkey" FOREIGN KEY ("clientId") REFERENCES "oauthClients"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "oauthCodes" ADD CONSTRAINT "oauthCodes_userId_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "oauthCodes" ADD CONSTRAINT "oauthCodes_siteId_sites_id_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "personalTokens" ADD CONSTRAINT "personalTokens_clientId_oauthClients_id_fkey" FOREIGN KEY ("clientId") REFERENCES "oauthClients"("id") ON DELETE CASCADE;--> statement-breakpoint
-- The MCP settings a site has of its own: the path of its agent guidelines page, whose text the MCP
-- server hands an AI assistant as part of its instructions (see dev/specs/mcp.md). Empty is none.
--
-- A data step because a site's settings are read back from the `config` JSONB column verbatim, so a
-- key added in the code is missing from every site that already exists.
--
-- Only where the key is absent, so that running it again changes nothing.
UPDATE "sites"
SET "config" = jsonb_set(
		"config",
		'{mcp}',
		'{"guidelinesPath":""}'::jsonb || coalesce("config" -> 'mcp', '{}'::jsonb),
		true
	)
WHERE "config" -> 'mcp' -> 'guidelinesPath' IS NULL;
