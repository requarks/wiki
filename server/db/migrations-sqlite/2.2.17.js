exports.up = knex => {
  return knex.schema
    .alterTable('pageHistory', table => {
      table.string('versionDate').notNullable().defaultTo('')
    })
    .raw(`UPDATE pageHistory AS h1 SET versionDate = COALESCE((SELECT createdAt FROM pageHistory AS h2 WHERE h2.pageId = h1.pageId AND h2.id < h1.id ORDER BY h2.id DESC LIMIT 1), h1.createdAt, '')`)
}

exports.down = knex => { }
