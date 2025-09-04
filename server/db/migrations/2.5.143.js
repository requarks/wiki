exports.up = function (knex) {
  return knex.schema.table('users', function (table) {
    table.boolean('welcomeMailWasSent').notNullable().defaultTo(false)
    table.boolean('createdByScript').notNullable().defaultTo(false)
  })
}

exports.down = function (knex) {
  return knex.schema.table('users', function (table) {
    table.dropColumn('welcomeMailWasSent')
    table.dropColumn('createdByScript')
  })
}
