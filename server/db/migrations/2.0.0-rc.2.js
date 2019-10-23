exports.up = knex => {
  return knex.schema
    .table('pageTree', table => {
      table.dropColumn('parent')
      table.dropColumn('pageId')
    })
    .table('pageTree', table => {
      table.integer('parent').unsigned().references('id').inTable('pageTree').onDelete('CASCADE')
      table.integer('pageId').unsigned().references('id').inTable('pages').onDelete('CASCADE')
    })
}

exports.down = knex => {
  return knex.schema
    .table('pageTree', table => {
      table.dropColumn('parent')
      table.dropColumn('pageId')
    })
    .table('pageTree', table => {
      table.integer('parent').unsigned().references('id').inTable('pageTree')
      table.integer('pageId').unsigned().references('id').inTable('pages')
    })
}
