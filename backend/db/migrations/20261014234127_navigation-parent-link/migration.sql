-- A display setting of the site's navigation, on: a "Go up" link at the top of every menu that is not
-- a locale's root menu, to the page or folder above the one owning it.
--
-- A data migration for the reason the other navigation settings had one: a site's settings are read
-- back from the `config` JSONB column verbatim, so a key added in the code is missing from every site
-- that already exists. On here as it is for a new site -- it changes what a reader is shown, not what
-- is stored anywhere, and turning it off is one switch.
--
-- Only where the key is absent, so that running it again changes nothing.
UPDATE "sites"
SET "config" = jsonb_set(
		"config",
		'{navigation}',
		'{"showParentLink":true}'::jsonb || coalesce("config" -> 'navigation', '{}'::jsonb),
		true
	)
WHERE "config" -> 'navigation' -> 'showParentLink' IS NULL;
