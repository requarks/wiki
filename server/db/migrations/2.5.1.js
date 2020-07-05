/* global WIKI */

exports.up = async knex => {
  await knex('authentication').where('isEnabled', false).del()

  // -> Knex bug #3855 workaround
  // -> https://github.com/knex/knex/pull/3855
  if (WIKI.config.db.type === 'mssql') {
    await knex.schema.raw(`
      DECLARE @constraint varchar(100) = (SELECT default_constraints.name
                                          FROM sys.all_columns
                                          INNER JOIN sys.tables
                                            ON all_columns.object_id = tables.object_id
                                          INNER JOIN sys.schemas
                                            ON tables.schema_id = schemas.schema_id
                                          INNER JOIN sys.default_constraints
                                            ON all_columns.default_object_id = default_constraints.object_id
                                          WHERE schemas.name = 'dbo'
                                          AND tables.name = 'authentication'
                                          AND all_columns.name = 'isEnabled')

      IF @constraint IS NOT NULL EXEC('ALTER TABLE authentication DROP CONSTRAINT ' + @constraint)`)
  }

  await knex.schema
    .alterTable('authentication', table => {
      table.dropColumn('isEnabled')
      table.integer('order').unsigned().notNullable().defaultTo(0)
      table.string('strategyKey').notNullable().defaultTo('')
      table.string('displayName').notNullable().defaultTo('')
    })

  // Fix pre-2.5 strategies
  const strategies = await knex('authentication')
  let idx = 1
  for (const strategy of strategies) {
    await knex('authentication').where('key', strategy.key).update({
      strategyKey: strategy.key,
      order: (strategy.key === 'local') ? 0 : idx++
    })
  }
}

exports.down = knex => { }
