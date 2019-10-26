exports.up = knex => {
  return knex.schema
    .dropTable('pageTree')
    .createTable('pageTree', table => {
      table.integer('id').primary()
      table.string('path').notNullable()
      table.integer('depth').unsigned().notNullable()
      table.string('title').notNullable()
      table.boolean('isPrivate').notNullable().defaultTo(false)
      table.boolean('isFolder').notNullable().defaultTo(false)
      table.string('privateNS')

      table.integer('parent').unsigned().references('id').inTable('pageTree').onDelete('CASCADE')
      table.integer('pageId').unsigned().references('id').inTable('pages').onDelete('CASCADE')
      table.string('localeCode', 5).references('code').inTable('locales')
    })
}

exports.down = knex => {
  return knex.schema
    .dropTable('pageTree')
    .createTable('pageTree', table => {
      table.integer('id').primary()
      table.string('path').notNullable()
      table.integer('depth').unsigned().notNullable()
      table.string('title').notNullable()
      table.boolean('isPrivate').notNullable().defaultTo(false)
      table.boolean('isFolder').notNullable().defaultTo(false)
      table.string('privateNS')

      table.integer('parent').unsigned().references('id').inTable('pageTree')
      table.integer('pageId').unsigned().references('id').inTable('pages')
      table.string('localeCode', 5).references('code').inTable('locales')
    })
}
