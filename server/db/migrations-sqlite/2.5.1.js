exports.up = async knex => {
  await knex('authentication').where('isEnabled', false).del()

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
