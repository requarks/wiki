exports.up = async knex => {
  await knex.schema
    .alterTable('groups', table => {
      table.string('redirectOnLogin').notNullable().defaultTo('/')
    })
}

exports.down = knex => { }
