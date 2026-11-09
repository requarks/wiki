-- A display setting of the site's navigation, off: show the items of every menu in alphabetical order
-- of their labels, sorted as they are read rather than as they are stored.
--
-- A data migration for the reason the other navigation settings had one: a site's settings are read
-- back from the `config` JSONB column verbatim, so a key added in the code is missing from every site
-- that already exists. Off, as it is for a new site -- it would reorder menus nobody asked to reorder.
--
-- Only where the key is absent, so that running it again changes nothing.
UPDATE "sites"
SET "config" = jsonb_set(
		"config",
		'{navigation}',
		'{"sortAlphabetically":false}'::jsonb || coalesce("config" -> 'navigation', '{}'::jsonb),
		true
	)
WHERE "config" -> 'navigation' -> 'sortAlphabetically' IS NULL;
