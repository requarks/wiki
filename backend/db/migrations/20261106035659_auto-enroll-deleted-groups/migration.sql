-- A strategy's `autoEnrollGroups` is a uuid array with no foreign key behind it, and deleting a group
-- used to leave its id there. The strategy then could not be saved again: `validateStrategy` rejects
-- an id that matches no group, and the Assign To picker, built from the groups that exist, offers no
-- way to unselect it. `groups.deleteGroup` now removes the id as the group goes; this removes the ids
-- already left behind, keeping the order of the ones that remain.
UPDATE "authentication"
SET "autoEnrollGroups" = COALESCE(
  (
    SELECT array_agg("groupId" ORDER BY "position")
    FROM unnest("authentication"."autoEnrollGroups") WITH ORDINALITY AS "list"("groupId", "position")
    WHERE EXISTS (SELECT 1 FROM "groups" WHERE "groups"."id" = "list"."groupId")
  ),
  '{}'::uuid[]
)
WHERE EXISTS (
  SELECT 1
  FROM unnest("authentication"."autoEnrollGroups") AS "list"("groupId")
  WHERE NOT EXISTS (SELECT 1 FROM "groups" WHERE "groups"."id" = "list"."groupId")
);
