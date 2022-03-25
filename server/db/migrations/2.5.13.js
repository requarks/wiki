exports.up = async knex => {
  await knex.schema
    .alterTable('pages', table => {
      table.integer('minTocLevel').notNullable().defaultTo(0)
      table.integer('tocLevel').notNullable().defaultTo(0)
      table.integer('tocCollapseLevel').notNullable().defaultTo(0)
      table.boolean('doUseTocDefault').notNullable().defaultTo(true)
    })
}

exports.down = knex => { }
