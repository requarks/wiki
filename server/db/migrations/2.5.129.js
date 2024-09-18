/* global WIKI */

exports.up = knex => {
  return knex.schema
    .createTable('sites', table => {
      table.uuid('id').notNullable().primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.string('name').notNullable()
      table.string('path').notNullable()
      table.boolean('isEnabled').notNullable().defaultTo(false)
      table.jsonb('config').notNullable()
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now())
      table.unique(['path'])
    })
}

exports.down = knex => { }
