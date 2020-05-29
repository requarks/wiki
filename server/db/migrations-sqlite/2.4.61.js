exports.up = knex => {
  return knex.schema
    .alterTable('comments', table => {
      table.integer('replyTo').unsigned().notNullable().defaultTo(0)
    })
}

exports.down = knex => { }
