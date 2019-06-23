exports.up = knex => {
  return knex.schema
    .createTable('analytics', table => {
      table.string('key').notNullable().primary()
      table.boolean('isEnabled').notNullable().defaultTo(false)
      table.json('config').notNullable()
    })
}

exports.down = knex => {
  return knex.schema
    .dropTableIfExists('analytics')
}
