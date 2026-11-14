-- A display setting of the site's theme, on: whether the sidebar and the table of contents swap
-- sides on a right-to-left locale, so that a sidebar set to the left -- the side a left-to-right
-- reader starts from -- is on the side a right-to-left reader starts from instead.
--
-- A data migration because a site's settings are read back from the `config` JSONB column verbatim,
-- so a key added in the code is missing from every site that already exists. On as it is for a new
-- site, which moves the sidebar and the contents of every existing site for a reader in a
-- right-to-left locale; turning it off puts them back.
--
-- Only where the key is absent, so that running it again changes nothing.
UPDATE "sites"
SET "config" = jsonb_set(
		"config",
		'{theme}',
		'{"invertPositionsForRtl":true}'::jsonb || coalesce("config" -> 'theme', '{}'::jsonb),
		true
	)
WHERE "config" -> 'theme' -> 'invertPositionsForRtl' IS NULL;
