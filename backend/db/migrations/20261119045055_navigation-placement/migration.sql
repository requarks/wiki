-- Where the navigation automations put a link they add to a menu: `alphabetical` among the items of
-- the menu's last section, where the editor's Smart Sort would put it, or at the `end`. One setting
-- per automation that adds links -- `addPagesPlacement` for Add New Pages to Direct Parent Menu, and
-- `migrateLinksPlacement` for what Migrate Link from Direct Parent Menu on Page Move carries into the
-- menu of the folder arrived in. Alphabetical, as it is for a new site -- the settings only move where
-- an automation the site already turned on places a link, and `end` is one switch away for a site that
-- wants it back.
--
-- A data migration because a site's settings are read back from the `config` JSONB column verbatim,
-- so a key added in the code is missing from every site that already exists.
--
-- The defaults go on the LEFT of `||`, so that a key a site already holds wins and running this again
-- changes nothing.
UPDATE "sites"
SET "config" = jsonb_set(
		"config",
		'{navigation}',
		'{"addPagesPlacement":"alphabetical","migrateLinksPlacement":"alphabetical"}'::jsonb
			|| coalesce("config" -> 'navigation', '{}'::jsonb),
		true
	)
WHERE "config" -> 'navigation' -> 'addPagesPlacement' IS NULL
	OR "config" -> 'navigation' -> 'migrateLinksPlacement' IS NULL;
