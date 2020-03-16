/* global WIKI */

exports.up = knex => {
  let sqlVersionDate = ''
  switch (WIKI.config.db.type) {
    case 'postgres':
    case 'mssql':
      sqlVersionDate = 'UPDATE "pageHistory" h1 SET "versionDate" = COALESCE((SELECT prev."createdAt" FROM "pageHistory" prev WHERE prev."pageId" = h1."pageId" AND prev.id < h1.id ORDER BY prev.id DESC LIMIT 1), h1."createdAt")'
      break
    case 'mysql':
    case 'mariadb':
      sqlVersionDate = `UPDATE pageHistory AS h1 INNER JOIN pageHistory AS h2 ON h2.id = (SELECT prev.id FROM pageHistory AS prev WHERE prev.pageId = h1.pageId AND prev.id < h1.id ORDER BY prev.id DESC LIMIT 1) SET h1.versionDate = h2.createdAt`
      break
  }
  return knex.schema
    .alterTable('pageHistory', table => {
      table.string('versionDate').notNullable().defaultTo('')
    })
    .raw(sqlVersionDate)
}

exports.down = knex => { }
