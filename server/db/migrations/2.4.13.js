/* global WIKI */

exports.up = knex => {
  return knex.schema
    .alterTable('pages', table => {
      if (WIKI.config.db.type === 'mysql') {
        table.json('extra')
      } else {
        table.json('extra').notNullable().defaultTo('{}')
      }
    })
    .alterTable('pageHistory', table => {
      if (WIKI.config.db.type === 'mysql') {
        table.json('extra')
      } else {
        table.json('extra').notNullable().defaultTo('{}')
      }
    })
    .alterTable('users', table => {
      table.string('dateFormat').notNullable().defaultTo('')
      table.string('appearance').notNullable().defaultTo('')
    })
}

exports.down = knex => { }
