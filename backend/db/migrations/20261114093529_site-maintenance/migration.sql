-- The site's maintenance mode: off, read-only or restricted, and the groups it does not apply to.
-- Off, as it is for a new site, with nobody listed -- `manage:system` is let through regardless of
-- the list, so an administrator turning a mode on is never shut out by an empty one.
--
-- A data migration because a site's settings are read back from the `config` JSONB column verbatim,
-- so a key added in the code is missing from every site that already exists.
--
-- Only where the key is absent, so that running it again changes nothing.
UPDATE "sites"
SET "config" = jsonb_set(
		"config",
		'{maintenance}',
		'{"mode":"off","bypassGroups":[]}'::jsonb,
		true
	)
WHERE "config" -> 'maintenance' IS NULL;
