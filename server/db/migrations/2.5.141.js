exports.up = knex => {
  return knex.schema.alterTable('groups', table => {
    table.unique(['name'])
  })
}

exports.down = knex => {
  return knex.schema.alterTable('groups', table => {
    table.dropUnique(['name'])
  })
}
