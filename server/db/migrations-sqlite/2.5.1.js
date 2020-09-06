exports.up = async knex => {
  // Check for users using disabled strategies
  let protectedStrategies = []
  const disabledStrategies = await knex('authentication').where('isEnabled', false)
  if (disabledStrategies) {
    const incompatibleUsers = await knex('users').distinct('providerKey').whereIn('providerKey', disabledStrategies.map(s => s.key))
    if (incompatibleUsers && incompatibleUsers.length > 0) {
      protectedStrategies = incompatibleUsers.map(u => u.providerKey)
    }
  }

  // Delete disabled strategies
  await knex('authentication').whereNotIn('key', protectedStrategies).andWhere('isEnabled', false).del()

  // Update table schema
  await knex.schema
    .alterTable('authentication', table => {
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
