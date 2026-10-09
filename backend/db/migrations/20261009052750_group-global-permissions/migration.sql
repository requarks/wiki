-- A group's `permissions` holds GLOBAL permissions only — what the route hook checks. Page permissions
-- are granted by its rules, and named in this list they grant nothing, yet the seeded Users and Guests
-- groups and every group created since started with `read:pages`, `read:assets` and `read:comments`
-- there. Every page permission (`PAGE_PERMISSIONS` in models/groups.ts) is taken out of every group's
-- list, keeping the order of what is left; any other name is left alone.
UPDATE "groups"
SET "permissions" = COALESCE(
  (
    SELECT jsonb_agg("permission" ORDER BY "position")
    FROM jsonb_array_elements_text("groups"."permissions") WITH ORDINALITY AS "list"("permission", "position")
    WHERE "permission" NOT IN (
      'read:pages', 'write:pages', 'review:pages', 'manage:pages', 'delete:pages', 'write:tags',
      'write:styles', 'write:scripts', 'read:source', 'read:history', 'read:assets', 'write:assets',
      'manage:assets', 'read:comments', 'write:comments', 'manage:comments', 'manage:navigation',
      'read:glossary', 'manage:glossary'
    )
  ),
  '[]'::jsonb
)
WHERE "permissions" ?| ARRAY[
  'read:pages', 'write:pages', 'review:pages', 'manage:pages', 'delete:pages', 'write:tags',
  'write:styles', 'write:scripts', 'read:source', 'read:history', 'read:assets', 'write:assets',
  'manage:assets', 'read:comments', 'write:comments', 'manage:comments', 'manage:navigation',
  'read:glossary', 'manage:glossary'
];
