exports.up = async knex => {
  await knex.schema
    .alterTable('pages', table => {
      table.integer('tocLevel').notNullable().defaultTo(0)
      table.integer('tocCollapseLevel').notNullable().defaultTo(0)
    })
}

exports.down = knex => { }
