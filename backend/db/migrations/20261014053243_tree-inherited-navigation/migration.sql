-- Every page and folder that inherits its navigation now carries the menu its location inherits: the
-- `navigationId` of the nearest ancestor that overrides or hides (null under a hide), or the site's
-- menu for its locale when nothing above it does.
--
-- Until now a page was created on the site's menu whatever was above it, so one written under an
-- override after the override was set showed the root menu, and a folder was created with no menu at
-- all. Folders now have a sidebar of their own -- shown at their path while there is no page there --
-- and a new entry starts on its inherited menu, so the rows that already exist are brought to the same
-- answer here rather than read with a fallback.
--
-- The same walk `navigation.ancestorNavId` makes, written once in SQL: within the locale, over pages
-- and folders, nearest first, a page winning a tie with the folder at its own path. An entry at the
-- site root has nothing above it (`x @> ''` holds for no x) and takes the site's menu.
--
-- A site's menu for a locale is created on demand by the application, so a locale holding folders but
-- no page may not have one yet; it is created first, the way `navigation.siteNavId` would.
INSERT INTO "navigation" ("siteId", "locale", "items")
SELECT DISTINCT "siteId", "locale", '[]'::jsonb
FROM "tree"
WHERE "tree" IN ('page', 'folder')
ON CONFLICT ("siteId", "locale") DO NOTHING;
--> statement-breakpoint
UPDATE "tree" AS t
SET "navigationId" = r."navigationId"
FROM (
	SELECT
		e."id",
		CASE WHEN anc."id" IS NOT NULL THEN anc."navigationId" ELSE site_nav."id" END AS "navigationId"
	FROM "tree" e
	LEFT JOIN LATERAL (
		SELECT a."id", a."navigationId"
		FROM "tree" a
		WHERE a."siteId" = e."siteId"
			AND a."locale" = e."locale"
			AND a."tree" IN ('page', 'folder')
			AND a."navigationMode" IN ('override', 'hide')
			AND (a."folderPath" || encode(convert_to(a."fileName", 'UTF8'), 'hex')) @> e."folderPath"
		ORDER BY nlevel(a."folderPath") DESC, (a."tree" = 'page') DESC
		LIMIT 1
	) anc ON true
	LEFT JOIN "navigation" site_nav
		ON site_nav."siteId" = e."siteId" AND site_nav."locale" = e."locale"
	WHERE e."tree" IN ('page', 'folder')
		AND e."navigationMode" = 'inherit'
) r
WHERE t."id" = r."id"
	AND t."navigationId" IS DISTINCT FROM r."navigationId";
