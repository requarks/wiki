/* global WIKI */

exports.up = knex => {
  const dbCompat = {
    charset: (WIKI.config.db.type === `mysql` || WIKI.config.db.type === `mariadb`)
  }
  return knex.schema
    .createTable('pageLinks', table => {
      if (dbCompat.charset) { table.charset('utf8mb4') }
      table.increments('id').primary()
      table.integer('sourcePageId').unsigned().references('id').inTable('pages').onDelete('CASCADE')
      table.integer('targetPageId').unsigned().references('id').inTable('pages').onDelete('CASCADE')
    })
}

exports.down = knex => {
  return knex.schema
    .dropTableIfExists('pageLinks')
}
