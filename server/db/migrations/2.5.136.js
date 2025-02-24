exports.up = knex => {
  return knex.schema.table('users', table => {
    table.dropColumn('lastLoginAt')
  })
}

exports.down = knex => {}
