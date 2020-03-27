exports.up = knex => {
  return knex.schema
    .createTable('apiKeys', table => {
      table.increments('id').primary()
      table.string('name').notNullable()
      table.text('key').notNullable()
      table.string('expiration').notNullable()
      table.boolean('isRevoked').notNullable().defaultTo(false)
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()
    })
}

exports.down = knex => { }
