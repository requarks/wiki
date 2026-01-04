const _ = require('lodash')

/* global WIKI */

module.exports = async (pageId) => {
  WIKI.logger.info(`Rebuilding page tree...`)

  try {
    WIKI.models = require('../core/db').init()
    await WIKI.configSvc.loadFromDb()
    await WIKI.configSvc.applyFlags()

    await WIKI.models.knex.table('pageTree').truncate()
    const pages = await WIKI.models.pages.query().select('id', 'path', 'localeCode', 'title', 'isPrivate', 'privateNS').orderBy(['localeCode', 'path'])
    let tree = []
    let pik = 0
    let numberOfBatchesSaved = 0
    // -> Save in chunks, because of per query max parameters (35k Postgres, 2k MSSQL, 1k for SQLite)
    let batchSize = (WIKI.config.db.type !== 'sqlite') ? 100 : 60

    for (const page of pages) {
      const pagePaths = page.path.split('/')
      let currentPath = ''
      let depth = 0
      let parentId = null
      let ancestors = []
      for (const part of pagePaths) {
        depth++
        const isFolder = (depth < pagePaths.length)
        currentPath = currentPath ? `${currentPath}/${part}` : part
        const found = _.find(tree, {
          localeCode: page.localeCode,
          path: currentPath
        })
        if (!found) {
          pik++
          tree.push({
            id: pik,
            localeCode: page.localeCode,
            path: currentPath,
            depth: depth,
            title: isFolder ? part : page.title,
            isFolder: isFolder,
            isPrivate: !isFolder && page.isPrivate,
            privateNS: !isFolder ? page.privateNS : null,
            parent: parentId,
            pageId: isFolder ? null : page.id,
            ancestors: JSON.stringify(ancestors)
          })
          parentId = pik
          if (tree.length % batchSize === 0) {
            let chunk = tree.slice(numberOfBatchesSaved * batchSize, (numberOfBatchesSaved + 1) * batchSize)
            // save the current chunk
            await WIKI.models.knex.table('pageTree').insert(chunk)
            numberOfBatchesSaved++
          }
        } else if (isFolder && !found.isFolder) {
          found.isFolder = true
          parentId = found.id
        } else {
          parentId = found.id
        }
        ancestors.push(parentId)
      }
    }

    // if there are any additional records present after the latest batch was saved
    if (tree.length % batchSize !== 0) {
      let chunk = tree.slice(numberOfBatchesSaved * batchSize, tree.length)
      // save the last chunk
      await WIKI.models.knex.table('pageTree').insert(chunk)
    }

    await WIKI.models.knex.destroy()

    WIKI.logger.info(`Rebuilding page tree: [ COMPLETED ]`)
  } catch (err) {
    WIKI.logger.error(`Rebuilding page tree: [ FAILED ]`)
    WIKI.logger.error(err.message)
    // exit process with error code
    throw err
  }
}
