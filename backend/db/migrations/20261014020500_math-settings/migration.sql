-- Every site's editor settings gain the block that typesets its math: KaTeX, the same as a site
-- created from now on.
--
-- - Markdown's `inlineMath`: which math block draws a formula written as $`E = mc^2`$ in a line of
--   text, or `off`.
-- - AsciiDoc's `math`: which one draws `latexmath:[…]` / `stem:[…]` and the `[latexmath]` / `[stem]`
--   blocks, or `off`.
--
-- A data migration rather than a schema one, for the reason given in `20260914043258_visual_editor`:
-- a site's settings are read back from the `config` JSONB column verbatim, with no merge against the
-- defaults a site is created with, so a key added in the code is simply missing from every site that
-- already exists.
--
-- Only where the key is absent, so that running it again changes nothing. A site with no `config`
-- object for the editor is left alone: `jsonb_set` cannot create a key whose parent is missing, and
-- that is not a shape this application produces.
UPDATE "sites"
SET "config" = jsonb_set(
		"config",
		'{editors,markdown,config,inlineMath}',
		'"katex"'::jsonb,
		true
	)
WHERE jsonb_typeof("config" -> 'editors' -> 'markdown' -> 'config') = 'object'
	AND "config" -> 'editors' -> 'markdown' -> 'config' -> 'inlineMath' IS NULL;
--> statement-breakpoint
UPDATE "sites"
SET "config" = jsonb_set(
		"config",
		'{editors,asciidoc,config,math}',
		'"katex"'::jsonb,
		true
	)
WHERE jsonb_typeof("config" -> 'editors' -> 'asciidoc' -> 'config') = 'object'
	AND "config" -> 'editors' -> 'asciidoc' -> 'config' -> 'math' IS NULL;
