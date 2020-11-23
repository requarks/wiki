exports.up = knex => {
  return knex.schema
    .alterTable('pages', table => {
      table.json('extra').notNullable().defaultTo('{}')
    })
    .alterTable('pageHistory', table => {
      table.json('extra').notNullable().defaultTo('{}')
    })
    .alterTable('users', table => {
      table.string('dateFormat').notNullable().defaultTo('')
      table.string('appearance').notNullable().defaultTo('')
    })
}

exports.down = knex => { }
