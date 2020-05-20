exports.up = knex => {
  return knex.schema
    .alterTable('users', table => {
      table.string('lastLoginAt')
    })
}

exports.down = knex => { }
