-- A rule's path is compared with a page path exactly, and a page path is always lowercase,
-- NFC-normalized and without whitespace — so a rule written as `HR` or `/My Docs` matched no page at
-- all. Rules are now stored spelled the way page paths are (`normalizeRulePath` in
-- helpers/pageRules.ts), and this brings the existing ones into that shape: for the four literal path
-- kinds (START, END, SUBTREE, EXACT), surrounding whitespace and leading slashes go, runs of whitespace
-- become one hyphen, the rest is lowercased and NFC-normalized, and an EXACT or SUBTREE path also loses
-- its trailing slashes. A REGEX path and the path a tag rule keeps are left as they are.
--
-- Lowercased under the builtin `pg_c_utf8` collation, which folds every script and not only ASCII,
-- and NFC-normalized, both of which need a UTF8 database. A database in another encoding cannot hold
-- a non-ASCII path in the first place, and gets the ASCII folding of the `C` collation instead of a
-- failed upgrade.
DO $$
DECLARE
  "folded" text := CASE
    WHEN current_setting('server_encoding') = 'UTF8'
      THEN 'normalize(lower(%s COLLATE "pg_c_utf8"), NFC)'
    ELSE 'lower(%s COLLATE "C")'
  END;
BEGIN
  EXECUTE format(
    $sql$
      WITH "normalized" AS (
        SELECT
          "groups"."id",
          jsonb_agg(
            CASE
              WHEN "list"."rule"->>'match' IN ('START', 'END', 'SUBTREE', 'EXACT')
                AND jsonb_typeof("list"."rule"->'path') = 'string'
              THEN jsonb_set(
                "list"."rule",
                '{path}',
                to_jsonb(
                  CASE
                    WHEN "list"."rule"->>'match' IN ('EXACT', 'SUBTREE')
                      THEN regexp_replace("spelled"."path", '/+$', '')
                    ELSE "spelled"."path"
                  END
                )
              )
              ELSE "list"."rule"
            END
            ORDER BY "list"."position"
          ) AS "rules"
        FROM "groups"
        CROSS JOIN LATERAL jsonb_array_elements("groups"."rules")
          WITH ORDINALITY AS "list"("rule", "position")
        CROSS JOIN LATERAL (
          SELECT %s AS "path"
        ) AS "spelled"
        GROUP BY "groups"."id"
      )
      UPDATE "groups"
      SET "rules" = "normalized"."rules"
      FROM "normalized"
      WHERE "groups"."id" = "normalized"."id"
        AND "groups"."rules" IS DISTINCT FROM "normalized"."rules"
    $sql$,
    format(
      "folded",
      $expr$regexp_replace(regexp_replace(regexp_replace("list"."rule"->>'path', '^\s+|\s+$', '', 'g'), '^/+', ''), '\s+', '-', 'g')$expr$
    )
  );
END
$$;
