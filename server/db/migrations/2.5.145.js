/**
 * Migration 2.5.145 - Ensure unique user-group assignments
 * - Removes duplicate rows in userGroups keeping the lowest id per (userId, groupId)
 * - Adds a unique constraint on (userId, groupId)
 */

exports.up = async function (knex) {
    await knex.transaction(async (trx) => {
        // 1. Remove duplicates defensively (id assumed monotonically increasing)
        await trx.raw(`
      WITH ranked AS (
        SELECT id, "userId", "groupId",
               ROW_NUMBER() OVER (PARTITION BY "userId", "groupId" ORDER BY id) AS rn
        FROM "userGroups"
      )
      DELETE FROM "userGroups" ug
      USING ranked r
      WHERE ug.id = r.id
        AND r.rn > 1;
    `)

        // 2. Add unique constraint (creates unique index under the hood)
        await trx.schema.alterTable('userGroups', (table) => {
            table.unique(['userId', 'groupId'], 'user_groups_user_group_unique')
        })
    })
}

exports.down = async function (knex) {
    // Drop the unique constraint; data remains cleaned
    await knex.schema.alterTable('userGroups', (table) => {
        table.dropUnique(['userId', 'groupId'], 'user_groups_user_group_unique')
    })
}
