exports.up = knex => {
  return knex.schema
    .alterTable('pageHistory', table => {
      table.string('versionDate').notNullable().defaultTo('')
    })
    .raw(`UPDATE pageHistory AS h1 INNER JOIN pageHistory AS h2 ON h2.id = (SELECT prev.id FROM pageHistory AS prev WHERE prev.pageId = h1.pageId AND prev.id < h1.id ORDER BY prev.id DESC LIMIT 1) SET h1.versionDate = h2.createdAt`)
}

exports.down = knex => { }
