-- Two display settings of the site's theme, both on: a progress bar along the top of the viewport
-- while a page loads, and a cross-fade between pages.
--
-- A data migration because a site's settings are read back from the `config` JSONB column verbatim,
-- so a key added in the code is missing from every site that already exists. On here as it is for a
-- new site -- both change only what a reader is shown, and turning either off is one switch.
--
-- Only where a key is absent, so that running it again changes nothing.
UPDATE "sites"
SET "config" = jsonb_set(
		"config",
		'{theme}',
		'{"showPageProgress":true,"pageTransitions":true}'::jsonb || coalesce("config" -> 'theme', '{}'::jsonb),
		true
	)
WHERE "config" -> 'theme' -> 'showPageProgress' IS NULL
	OR "config" -> 'theme' -> 'pageTransitions' IS NULL;
