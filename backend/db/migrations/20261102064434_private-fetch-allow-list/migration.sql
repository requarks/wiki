-- The private-address allow list moves from `auth.avatarFetchAllowList` to
-- `security.privateFetchAllowList`: it is no longer about avatars alone, since the HedgeDoc import
-- downloads the images it copies through the same `fetchPublic` guard.
--
-- Merged into the `security` row rather than replacing it, and created when an installation somehow
-- has none. Only where the old key holds a list, so that running it again changes nothing.
INSERT INTO "settings" ("key", "value")
SELECT 'security', jsonb_build_object('privateFetchAllowList', "value" -> 'avatarFetchAllowList')
FROM "settings"
WHERE "key" = 'auth'
	AND jsonb_typeof("value" -> 'avatarFetchAllowList') = 'array'
ON CONFLICT ("key") DO UPDATE
SET "value" = "settings"."value" || jsonb_build_object(
		'privateFetchAllowList',
		EXCLUDED."value" -> 'privateFetchAllowList'
	);
--> statement-breakpoint
UPDATE "settings"
SET "value" = "value" - 'avatarFetchAllowList'
WHERE "key" = 'auth'
	AND "value" ? 'avatarFetchAllowList';
