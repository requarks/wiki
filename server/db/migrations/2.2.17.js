const _ = require('lodash')

/* global WIKI */

exports.up = async knex => {
  let sqlVersionDate = ''
  switch (WIKI.config.db.type) {
    case 'postgres':
      sqlVersionDate = 'UPDATE "pageHistory" h1 SET "versionDate" = COALESCE((SELECT prev."createdAt" FROM "pageHistory" prev WHERE prev."pageId" = h1."pageId" AND prev.id < h1.id ORDER BY prev.id DESC LIMIT 1), h1."createdAt")'
      break
    case 'mssql':
      sqlVersionDate = 'UPDATE h1 SET "versionDate" = COALESCE((SELECT TOP 1 prev."createdAt" FROM "pageHistory" prev WHERE prev."pageId" = h1."pageId" AND prev.id < h1.id ORDER BY prev.id DESC), h1."createdAt") FROM "pageHistory" h1'
      break
    case 'mysql':
    case 'mariadb':
      // -> Fix for 2.2.50 failed migration
      const pageHistoryColumns = await knex.schema.raw('SHOW COLUMNS FROM pageHistory')
      if (_.some(pageHistoryColumns[0], ['Field', 'versionDate'])) {
        console.info('MySQL 2.2.50 Migration Fix - Dropping failed versionDate column...')
        await knex.schema.raw('ALTER TABLE pageHistory DROP COLUMN versionDate')
        console.info('versionDate column dropped successfully.')
      }

      sqlVersionDate = `UPDATE pageHistory AS h1 INNER JOIN pageHistory AS h2 ON h2.id = (SELECT prev.id FROM (SELECT * FROM pageHistory) AS prev WHERE prev.pageId = h1.pageId AND prev.id < h1.id ORDER BY prev.id DESC LIMIT 1) SET h1.versionDate = h2.createdAt`
      break
    // case 'mariadb':
    //   sqlVersionDate = `UPDATE pageHistory AS h1 INNER JOIN pageHistory AS h2 ON h2.id = (SELECT prev.id FROM pageHistory AS prev WHERE prev.pageId = h1.pageId AND prev.id < h1.id ORDER BY prev.id DESC LIMIT 1) SET h1.versionDate = h2.createdAt`
    //   break
  }
  await knex.schema
    .alterTable('pageHistory', table => {
      table.string('versionDate').notNullable().defaultTo('')
    })
    .raw(sqlVersionDate)
}

exports.down = knex => { }
