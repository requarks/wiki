-- The Visual editor replaces the `wysiwyg` placeholder, so every site's stored editor settings move
-- with it: `editors.wysiwyg` becomes `editors.visual`, keeping whether the site had it switched on.
--
-- A data migration rather than a schema one. A site's settings live in the `config` JSONB column and
-- are read back verbatim -- `reloadCache` does no merge with the defaults in `base.yml`, which are
-- applied only when a site is created. So a key renamed in the code is simply missing from every site
-- that already exists, and the frontend reads `editors.visual.isActive` directly: without this, the
-- site payload has no such key, the site store throws while loading, and the whole app fails to
-- start -- login page included.
--
-- Two statements rather than one, so that each is guarded by what it is actually for and neither
-- does anything on a second run. Folded together with a COALESCE they would not be: with `wysiwyg`
-- already gone, the fallback would win and overwrite `visual` with the default, switching the editor
-- back on for a site that had deliberately turned it off.

-- The rename, for a site that has the old key.
UPDATE "sites"
SET "config" = jsonb_set(
		"config" #- '{editors,wysiwyg}',
		'{editors,visual}',
		"config" #> '{editors,wysiwyg}',
		true
	)
WHERE jsonb_typeof("config" -> 'editors' -> 'wysiwyg') = 'object';
--> statement-breakpoint
-- And the default, for a site that had neither -- so that every row comes out of this with an
-- `editors.visual` for the app to read. A `config` with no `editors` object at all is left alone:
-- `jsonb_set` cannot create a key whose parent is missing, and that is not a shape this application
-- produces.
UPDATE "sites"
SET "config" = jsonb_set(
		"config",
		'{editors,visual}',
		'{"isActive":true,"config":{}}'::jsonb,
		true
	)
WHERE jsonb_typeof("config" -> 'editors') = 'object'
	AND "config" -> 'editors' -> 'visual' IS NULL;
