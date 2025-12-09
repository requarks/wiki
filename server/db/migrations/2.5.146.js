
exports.up = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('pageTree', 'child_position')
  
  if (!hasColumn) {
    // Add child_position column
    await knex.schema.alterTable('pageTree', table => {
      table.integer('child_position').nullable()
    })

    // Populate child_position for existing pages based on alphabetical order by title
    // and isFolder (folders first) - PostgreSQL only
    await knex.raw(`
      UPDATE "pageTree" AS pt
      SET child_position = ranked.row_num
      FROM (
        SELECT 
          id,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(parent, 0), "siteId"
            ORDER BY "isFolder" DESC, title ASC
          ) - 1 AS row_num
        FROM "pageTree"
      ) AS ranked
      WHERE pt.id = ranked.id
    `)

    // Make child_position NOT NULL after populating
    await knex.schema.alterTable('pageTree', table => {
      table.integer('child_position').notNullable().defaultTo(0).alter()
    })
  }
}

exports.down = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('pageTree', 'child_position')
  
  if (hasColumn) {
    await knex.schema.alterTable('pageTree', table => {
      table.dropColumn('child_position')
    })
  }
}
