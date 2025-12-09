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

async function getDefaultSiteIdIfNeeded(siteId) {
  return getSiteIdByPath('default')
}

function buildPageTree(pages, defaultSiteId) {
  let tree = []
  let treeMap = new Map()
  let pik = 0

  function getKey(page, currentPath) {
    return `${page.localeCode}:${page.siteId}:${currentPath}`
  }

  function createNode({
    id, page, currentPath, depth, isFolder, parentId, ancestors, defaultSiteId
  }) {
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
      child_position: 0
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

  const groupedByParent = _.groupBy(tree, node => `${node.parent || 0}-${node.siteId}`)

  for (const groupKey in groupedByParent) {
    const siblings = groupedByParent[groupKey]

    const sortedSiblings = _.orderBy(siblings, ['isFolder', 'title'], ['desc', 'asc'])
    sortedSiblings.forEach((node, index) => {
      node.child_position = index
    })
  }

  return tree
}

async function deletePageTree(siteId) {
  if (!isEmptySiteId(siteId)) {
    await WIKI.models.knex.table('pageTree').where('siteId', '=', siteId).del()
  } else {
    await WIKI.models.knex.table('pageTree').del()
  }
}

async function insertPageTree(tree) {
  if (tree.length === 0) return
  const dbType = WIKI.config.db.type
  let chunkSize = 100
  if (dbType === 'postgres') chunkSize = 500
  else if (dbType === 'sqlite') chunkSize = 60
  for (const chunk of _.chunk(tree, chunkSize)) {
    await WIKI.models.knex.table('pageTree').insert(chunk)
  }
}

module.exports = async (siteId) => {
  WIKI.logger.info(`Rebuilding page tree...`)
  await WIKI.configSvc.loadFromDb()
  await WIKI.configSvc.applyFlags()
  try {
    let defaultSiteId
    const noSiteSelected = isEmptySiteId(siteId)
    if (noSiteSelected) {
      defaultSiteId = await getDefaultSiteIdIfNeeded(siteId)
      WIKI.logger.info(`Rebuilding page tree for all sites`)
    } else {
      WIKI.logger.info(`Rebuilding page tree for siteId: ${typeof siteId === 'object' ? JSON.stringify(siteId) : siteId}`)
    }

    const pages = await WIKI.models.pages
      .query()
      .select('id', 'path', 'localeCode', 'title', 'isPrivate', 'privateNS', 'siteId')
      .where(builder => {
        if (!noSiteSelected) {
          builder.where('siteId', '=', siteId)
        }
      })
      .orderBy(['localeCode', 'path'])
    const tree = buildPageTree(pages, defaultSiteId)
    await deletePageTree(siteId)
    await insertPageTree(tree)
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
