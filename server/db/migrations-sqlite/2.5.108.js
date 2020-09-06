const has = require('lodash/has')

exports.up = async knex => {
  // -> Fix 2.5.1 added isEnabled columns for beta users
  const localStrategy = await knex('authentication').where('key', 'local').first()
  if (localStrategy && !has(localStrategy, 'isEnabled')) {
    await knex.schema
      .alterTable('authentication', table => {
        table.boolean('isEnabled').notNullable().defaultTo(true)
      })
  }
}

exports.down = knex => { }
