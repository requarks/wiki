exports.up = knex => {
  return knex.schema
    .table('assets', table => {
      table.dropColumn('basename')
      table.string('hash').notNullable().defaultTo('')
    })
}

exports.down = knex => {
  return knex.schema
    .table('assets', table => {
      table.dropColumn('hash')
      table.string('basename').notNullable().defaultTo('')
    })
}
