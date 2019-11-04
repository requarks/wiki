exports.up = knex => {
  return knex.schema
    .table('storage', table => {
      table.string('syncInterval')
      table.json('state')
    })
}

exports.down = knex => {
  return knex.schema
    .table('storage', table => {
      table.dropColumn('syncInterval')
      table.dropColumn('state')
    })
}
