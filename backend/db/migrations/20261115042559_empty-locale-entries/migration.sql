-- Folders and files filed under an EMPTY locale, and everything that hangs off them.
--
-- The asset upload and the folder create resolved the requested locale with `??`, so a request
-- sending `locale=` kept the empty string instead of falling back to the site's primary locale. No
-- client of the wiki sends one: the file manager, the tree browser, the editor and live notes always
-- send a real locale or none. What such a request wrote was filed under a locale no site has, out of
-- sight of the file manager, and -- since `ruleIsScopedTo` read an empty locale as an absent one --
-- outside every locale-scoped group rule. That was the point of writing one, so these rows are
-- removed rather than re-filed under the primary locale, where they would stand beside the real
-- content at the same paths.
--
-- Pages are left alone: page create and move always resolved the locale with `||`, so none can be
-- filed under an empty one.

-- The sidebar menus such an entry owned, keyed by the entry's own id, and the site-wide menu of the
-- empty locale that a folder created there could have brought into being
DELETE FROM "navigation"
WHERE "locale" = ''
  OR "id" IN (SELECT "id" FROM "tree" WHERE "locale" = '' AND "tree" IN ('folder', 'asset'));
--> statement-breakpoint
-- The assets themselves, which share their id with the tree row. Live note images cascade.
DELETE FROM "assets"
WHERE "id" IN (SELECT "id" FROM "tree" WHERE "locale" = '' AND "tree" = 'asset');
--> statement-breakpoint
DELETE FROM "tree"
WHERE "locale" = '' AND "tree" IN ('folder', 'asset');
--> statement-breakpoint
-- A git target's queued changes for those files. The stored path starts with the locale's segment,
-- so an empty locale left it beginning with `/` (or holding `//` after a site prefix), which the
-- sync's `absPathIn` refuses as outside the repository -- and since a failed sync keeps its queue,
-- one such row stopped every sync of that target after it. No real path holds an empty segment.
DELETE FROM "storageOutbox"
WHERE "kind" = 'asset'
  AND (
    "path" LIKE '/%'
    OR "path" LIKE '%//%'
    OR "previousPath" LIKE '/%'
    OR "previousPath" LIKE '%//%'
  );
