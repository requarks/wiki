exports.up = async knex => {
  await knex.schema
    .alterTable('pageTree', table => {
      table.integer('orderPriority').unsigned().notNullable().defaultTo(0)
    })
}

exports.down = knex => { }
