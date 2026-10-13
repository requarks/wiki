-- Every site gains a `navigation` settings object: the menu automations the admin area's Navigation
-- screen sets, all off.
--
-- A data migration rather than a schema one, for the reason given in `20260914043258_visual_editor`:
-- a site's settings are read back from the `config` JSONB column verbatim, with no merge against the
-- defaults a site is created with, so a key added in the code is simply missing from every site that
-- already exists.
--
-- Only where the key is absent, so that running it again changes nothing.
UPDATE "sites"
SET "config" = jsonb_set(
		"config",
		'{navigation}',
		'{"addPagesToParentMenu":false,"removePagesFromParentMenu":false,"createFolderMenus":false,"deleteOrphanedMenus":false}'::jsonb,
		true
	)
WHERE "config" -> 'navigation' IS NULL;
