const _ = require('lodash')

/* global WIKI */

const getSiteIdByPath = async (sitePath) => {
  return WIKI.models.sites.getSiteIdByPath({ path: sitePath, forceReload: true })
}

function isEmptySiteId(siteId) {
  return (
    !siteId ||
    siteId === 'undefined' ||
    (typeof siteId === 'object' && siteId !== null && Object.keys(siteId).length === 0)
  )
}

async function getDefaultSiteIdIfNeeded() {
  return getSiteIdByPath('default')
}

function buildPageTree(pages, pageTreeDataToRetain, defaultSiteId, noSiteSelected) {
  let tree = []
  let treeMap = new Map()
  let pik = 0
  const isSiteSelected = !noSiteSelected
  // Determine starting id. if a site is selected, that means pagetree is rebuilt for one
  // individual site (a typical scenario when a page is added or deleted).
  // in that case, the id is starting from max existing id
  if (isSiteSelected && pageTreeDataToRetain.length > 0) { // site is selected and there are records to retain
    pik = Math.max(...pageTreeDataToRetain.map(item => item.id))
  }
  WIKI.logger.info(`buildPageTree, noSiteSelected: ${noSiteSelected}, starting pik: ${pik}`)

  function getKey(page, currentPath) {
    return `${page.localeCode}:${page.siteId}:${currentPath}`
  }

  function createNode({
    id, page, currentPath, depth, isFolder, parentId, ancestors, defaultSiteId
  }) {
    // locate existing record to apply the existing child_position
    const existingPageTreeRecord = pageTreeDataToRetain.find(item =>
      item.pageId === page.id && item.siteId === page.siteId
    )

    // next determine childPosition: which is for existing records the existing child_position otherwise
    // for new records, the max child_position + 1 within the same folder
    const childPosition = existingPageTreeRecord ? existingPageTreeRecord.child_position : (() => {
      const matchingItems = pageTreeDataToRetain.filter(item => {
        const itemPathFolder = item.path.substring(0, item.path.lastIndexOf('/') + 1) || item.path
        const currentPathFolder = currentPath.substring(0, currentPath.lastIndexOf('/') + 1) || currentPath
        return itemPathFolder === currentPathFolder && item.siteId === page.siteId
      })
      return matchingItems.length > 0 ? Math.max(...matchingItems.map(item => item.child_position)) + 1 : 0
    })()
    return {
      id,
      localeCode: page.localeCode,
      path: currentPath,
      depth: depth,
      title: isFolder ? currentPath.split('/').pop() : page.title,
      isFolder: isFolder,
      isPrivate: !isFolder && page.isPrivate,
      privateNS: !isFolder ? page.privateNS : null,
      parent: parentId,
      pageId: isFolder ? null : page.id,
      ancestors: JSON.stringify(ancestors),
      siteId: page.siteId ? page.siteId : defaultSiteId,
      child_position: childPosition
    }
  }

  function processPage(page) {
    const pagePaths = page.path.split('/')
    let currentPath = ''
    let depth = 0
    let parentId = null
    let ancestors = []
    for (const part of pagePaths) {
      depth++
      const isFolder = (depth < pagePaths.length)
      currentPath = currentPath ? `${currentPath}/${part}` : part
      const key = getKey(page, currentPath)
      let found = treeMap.get(key)
      if (!found) {
        pik++
        const node = createNode({
          id: pik,
          page,
          currentPath,
          depth,
          isFolder,
          parentId,
          ancestors: [...ancestors],
          defaultSiteId
        })
        tree.push(node)
        treeMap.set(key, node)
        parentId = pik
      } else {
        if (isFolder && !found.isFolder) {
          found.isFolder = true
        }
        parentId = found.id
      }
      ancestors.push(parentId)
    }
  }

  for (const page of pages) {
    processPage(page)
  }
  return tree
}

async function deletePageTree(siteId, trx = null) {
  const query = trx || WIKI.models.knex
  if (!isEmptySiteId(siteId)) {
    await query.table('pageTree').where('siteId', '=', siteId).del()
  } else {
    await query.table('pageTree').del()
  }
}

async function insertPageTree(tree, trx = null) {
  if (tree.length === 0) return
  const query = trx || WIKI.models.knex
  const dbType = WIKI.config.db.type
  let chunkSize = 100
  if (dbType === 'postgres') chunkSize = 500
  else if (dbType === 'sqlite') chunkSize = 60
  for (const chunk of _.chunk(tree, chunkSize)) {
    await query.table('pageTree').insert(chunk)
  }
}

module.exports = async (siteId) => {
  WIKI.logger.info(`Rebuilding page tree for siteId: ${typeof siteId === 'object' ? JSON.stringify(siteId) : siteId}...`)
  await WIKI.configSvc.loadFromDb()
  await WIKI.configSvc.applyFlags()
  try {
    let defaultSiteId
    const noSiteSelected = isEmptySiteId(siteId)
    if (noSiteSelected) {
      defaultSiteId = await getDefaultSiteIdIfNeeded()
      WIKI.logger.info(`Rebuilding page tree for all sites`)
    } else {
      WIKI.logger.info(`Rebuilding page tree for siteId: ${typeof siteId === 'object' ? JSON.stringify(siteId) : siteId}`)
    }

    const pageTreeDataToRetain = await WIKI.models.knex
      .table('pageTree')
      .select('id', 'pageId', 'path', 'child_position', 'siteId')
    const pages = await WIKI.models.pages
      .query()
      .select('id', 'path', 'localeCode', 'title', 'isPrivate', 'privateNS', 'siteId')
      .where(builder => {
        if (!noSiteSelected) {
          builder.where('siteId', '=', siteId)
        }
      })
      .orderBy(['localeCode', 'path'])
    const tree = buildPageTree(pages, pageTreeDataToRetain, defaultSiteId, noSiteSelected)

    // Use transaction for atomic operations
    await WIKI.models.knex.transaction(async (trx) => {
      await deletePageTree(siteId, trx)
      await insertPageTree(tree, trx)
    })

    WIKI.logger.info(`Rebuilding page tree: [ COMPLETED ]`)
  } catch (err) {
    WIKI.logger.error(`Rebuilding page tree: [ FAILED ]`)
    WIKI.logger.error(err.message)
    throw err
  }
}

module.exports.buildPageTree = buildPageTree
module.exports.isEmptySiteId = isEmptySiteId
module.exports.deletePageTree = deletePageTree
module.exports.insertPageTree = insertPageTree
module.exports.getDefaultSiteIdIfNeeded = getDefaultSiteIdIfNeeded
