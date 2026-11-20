-- Every block now declares a `version` in its definition, shown beside it under Admin → Content
-- Blocks. A built-in block's definition is read from the compiled manifest, which the build now
-- refuses to write without one, so only a CUSTOM block's stored definition is behind: it was copied
-- from a package built before blocks were versioned.
--
-- Nothing in such a package says which release it was, so it is given 0.0.0 — older than any version
-- its author can have published since. Importing the block's current package replaces the definition
-- whole, version included.
UPDATE "blocks"
SET "definition" = jsonb_set("definition", '{version}', '"0.0.0"')
WHERE "isCustom" = true
  AND NOT ("definition" ? 'version');
