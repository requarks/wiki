exports.up = knex => {
  return knex.schema
    .createTable('pageLinks', table => {
      table.increments('id').primary()
      table.integer('pageId').unsigned().references('id').inTable('pages').onDelete('CASCADE')
      table.string('path').notNullable()
      table.string('localeCode', 5).notNullable()
    })
    .table('pageLinks', table => {
      table.index(['path', 'localeCode'])
    })
}

exports.down = knex => {
  return knex.schema
    .dropTableIfExists('pageLinks')
}
