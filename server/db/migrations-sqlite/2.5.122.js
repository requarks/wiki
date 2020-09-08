exports.up = knex => {
  return knex.schema
    .createTable('userAvatars', table => {
      table.integer('id').primary()
      table.binary('data').notNullable()
    })
}

exports.down = knex => { }
