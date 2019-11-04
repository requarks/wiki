/* global WIKI */

exports.up = knex => {
  const dbCompat = {
    charset: (WIKI.config.db.type === `mysql` || WIKI.config.db.type === `mariadb`)
  }
  return knex.schema
    .createTable('pageLinks', table => {
      if (dbCompat.charset) { table.charset('utf8mb4') }
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
