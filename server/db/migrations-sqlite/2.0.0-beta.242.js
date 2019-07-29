exports.up = knex => {
  return knex.schema
    .table('users', table => {
      table.boolean('mustChangePwd').notNullable().defaultTo(false)
    })
}

exports.down = knex => {
  return knex.schema
    .table('users', table => {
      table.dropColumn('mustChangePwd')
    })
}
