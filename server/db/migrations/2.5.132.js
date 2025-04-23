exports.up = async knex => {
  await knex.schema
    .alterTable('pages', table => {
      table.text('icon').notNullable().defaultTo('text-box')
    })

  await knex.schema
    .alterTable('pageTree', table => {
      table.text('icon').notNullable().defaultTo('text-box')
    })
}

exports.down = knex => { }
