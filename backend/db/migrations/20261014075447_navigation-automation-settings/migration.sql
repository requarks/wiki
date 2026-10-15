-- Three more navigation automations, all off: migrating links when a page or folder moves, updating
-- link labels when a title changes, and whether any automation runs for what an import or a storage
-- sync does.
--
-- A data migration for the same reason as `20261013075442_navigation-automations`: a site's settings
-- are read back from the `config` JSONB column verbatim, so a key added in the code is missing from
-- every site that already exists.
--
-- The defaults go on the LEFT of `||`, so that a key a site already holds wins and running this again
-- changes nothing. A site with no `navigation` object at all -- which that migration gave every site --
-- gets these three alone.
UPDATE "sites"
SET "config" = jsonb_set(
		"config",
		'{navigation}',
		'{"migrateLinksOnMove":false,"updateLabelsOnRename":false,"includeStorageOperations":false}'::jsonb
			|| coalesce("config" -> 'navigation', '{}'::jsonb),
		true
	)
WHERE "config" -> 'navigation' -> 'migrateLinksOnMove' IS NULL
	OR "config" -> 'navigation' -> 'updateLabelsOnRename' IS NULL
	OR "config" -> 'navigation' -> 'includeStorageOperations' IS NULL;
