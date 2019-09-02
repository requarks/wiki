exports.up = knex => {
  return knex.schema
    .createTable('pageLinks', table => {
      table.increments('id').primary()
      table.integer('sourcePageId').unsigned().references('id').inTable('pages').onDelete('CASCADE')
      table.integer('targetPageId').unsigned().references('id').inTable('pages').onDelete('CASCADE')
    })
}

exports.down = knex => {
  return knex.schema
    .dropTableIfExists('pageLinks')
}
