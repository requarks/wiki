-- A rule of the site's navigation, off: a page sharing its path with a folder shows that folder's menu
-- while it inherits, rather than the menu of the folder above both.
--
-- A data migration for the reason the other navigation settings had one: a site's settings are read
-- back from the `config` JSONB column verbatim, so a key added in the code is missing from every site
-- that already exists. Off here as it is for a new site, so that no page changes the menu it shows
-- until an administrator asks for it -- which is also why no page needs resolving again here.
--
-- Only where the key is absent, so that running it again changes nothing.
UPDATE "sites"
SET "config" = jsonb_set(
		"config",
		'{navigation}',
		'{"folderMenuOnFolderPage":false}'::jsonb || coalesce("config" -> 'navigation', '{}'::jsonb),
		true
	)
WHERE "config" -> 'navigation' -> 'folderMenuOnFolderPage' IS NULL;
