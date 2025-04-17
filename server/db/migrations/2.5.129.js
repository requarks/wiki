exports.up = async knex => {
  await knex.schema
    .alterTable('pages', table => {
      table.integer('orderPriority').unsigned().notNullable().defaultTo(0)
    })
}

exports.down = knex => { }
