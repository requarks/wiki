/* global WIKI */

exports.up = knex => {
  const dbCompat = {
    blobLength: (WIKI.config.db.type === `mysql` || WIKI.config.db.type === `mariadb`),
    charset: (WIKI.config.db.type === `mysql` || WIKI.config.db.type === `mariadb`)
  }
  return knex.schema
    .createTable('userAvatars', table => {
      if (dbCompat.charset) { table.charset('utf8mb4') }
      table.integer('id').primary()
      if (dbCompat.blobLength) {
        table.specificType('data', 'LONGBLOB').notNullable()
      } else {
        table.binary('data').notNullable()
      }
    })
}

exports.down = knex => { }
