const { isPostgres } = require('./_helpers')

exports.up = async function (knex) {
  if (!isPostgres(knex)) {
    return
  }

  await knex.transaction(async (trx) => {
    const hasColumn = await trx.schema.hasColumn('sites', 'show_recent_activities')
    if (!hasColumn) {
      await knex.schema.alterTable('sites', (table) => {
        table.boolean('show_recent_activities').defaultTo(true)
      })

      // Safety: ensure any NULLs (if present) are set to false
      await trx.raw(`
        UPDATE sites
        SET show_recent_activities = true
        WHERE show_recent_activities IS NULL
      `)
    }
  })
}

exports.down = async function (knex) {
  if (!isPostgres(knex)) {
    return
  }

  await knex.transaction(async (trx) => {
    const hasColumn = await trx.schema.hasColumn('sites', 'show_recent_activities')
    if (hasColumn) {
      await trx.schema.table('sites', (table) => {
        table.dropColumn('show_recent_activities')
      })
    }
  })
}