exports.up = knex => {
  return knex.schema.alterTable('users', table => {
    table.integer('failedAttempts').defaultTo(0) // Add the failedAttempts column
    table.boolean('isLocked').defaultTo(false)
  })
}

exports.down = knex => { }
