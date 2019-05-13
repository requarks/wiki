exports.up = knex => {
  return knex.schema
    .createTable('assetData', table => {
      table.integer('id').primary()
      table.binary('data').notNullable()
    })
}

exports.down = knex => {
  return knex.schema
    .dropTableIfExists('assetData')
}
