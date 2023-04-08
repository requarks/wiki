import qs from 'querystring'
import { fromPairs, get, initial, invert, isEmpty, last } from 'lodash-es'
import crypto from 'node:crypto'
import path from 'node:path'

const localeSegmentRegex = /^[A-Z]{2}(-[A-Z]{2})?$/i
const localeFolderRegex = /^([a-z]{2}(?:-[a-z]{2})?\/)?(.*)/i
// eslint-disable-next-line no-control-regex
const unsafeCharsRegex = /[\x00-\x1f\x80-\x9f\\"|<>:*?]/

const contentToExt = {
  markdown: 'md',
  html: 'html'
}
const extToContent = invert(contentToExt)

/**
 * Parse raw url path and make it safe
 */
export function parsePath (rawPath, opts = {}) {
  const pathObj = {
    // TODO: use site base lang
    locale: 'en', // WIKI.config.lang.code,
    path: 'home',
    private: false,
    privateNS: '',
    explicitLocale: false
  }

  // Clean Path
  rawPath = qs.unescape(rawPath).trim()
  if (rawPath.startsWith('/')) { rawPath = rawPath.substring(1) }
  rawPath = rawPath.replace(unsafeCharsRegex, '')
  if (rawPath === '') { rawPath = 'home' }

  rawPath = rawPath.replace(/\\/g, '').replace(/\/\//g, '').replace(/\.\.+/ig, '')

  // Extract Info
  let pathParts = rawPath.split('/').filter(p => {
    p = p.trim()
    return !isEmpty(p) && p !== '..' && p !== '.'
  })
  if (pathParts[0].startsWith('_')) {
    pathParts.shift()
  }
  if (localeSegmentRegex.test(pathParts[0])) {
    pathObj.locale = pathParts[0]
    pathObj.explicitLocale = true
    pathParts.shift()
  }

  // Strip extension
  if (opts.stripExt && pathParts.length > 0) {
    const lastPart = last(pathParts)
    if (lastPart.indexOf('.') > 0) {
      pathParts.pop()
      const lastPartMeta = path.parse(lastPart)
      pathParts.push(lastPartMeta.name)
    }
  }

  pathObj.path = _.join(pathParts, '/')
  return pathObj
}

/**
 * Generate unique hash from page
 */
export function generateHash(opts) {
  return crypto.createHash('sha1').update(`${opts.locale}|${opts.path}|${opts.privateNS}`).digest('hex')
}

/**
 * Inject Page Metadata
 */
export function injectPageMetadata(page) {
  const meta = [
    ['title', page.title],
    ['description', page.description],
    ['published', page.isPublished.toString()],
    ['date', page.updatedAt],
    ['tags', page.tags ? page.tags.map(t => t.tag).join(', ') : ''],
    ['editor', page.editorKey],
    ['dateCreated', page.createdAt]
  ]
  switch (page.contentType) {
    case 'markdown':
      return '---\n' + meta.map(mt => `${mt[0]}: ${mt[1]}`).join('\n') + '\n---\n\n' + page.content
    case 'html':
      return '<!--\n' + meta.map(mt => `${mt[0]}: ${mt[1]}`).join('\n') + '\n-->\n\n' + page.content
    case 'json':
      return {
        ...page.content,
        _meta: fromPairs(meta)
      }
    default:
      return page.content
  }
}

/**
 * Check if path is a reserved path
 */
export function isReservedPath(rawPath) {
  const firstSection = _.head(rawPath.split('/'))
  if (firstSection.length < 1) {
    return true
  } else if (localeSegmentRegex.test(firstSection)) {
    return true
  } else if (
    WIKI.data.reservedPaths.some(p => {
      return p === firstSection
    })) {
    return true
  } else {
    return false
  }
}

/**
 * Get file extension from content type
 */
export function getFileExtension(contentType) {
  return get(contentToExt, contentType, 'txt')
}

/**
 * Get content type from file extension
 */
export function getContentType (filePath) {
  const ext = last(filePath.split('.'))
  return get(extToContent, ext, false)
}

/**
 * Get Page Meta object from disk path
 */
export function getPagePath (filePath) {
  let fpath = filePath
  if (process.platform === 'win32') {
    fpath = filePath.replace(/\\/g, '/')
  }
  let meta = {
    locale: WIKI.config.lang.code,
    path: initial(fpath.split('.')).join('')
  }
  const result = localeFolderRegex.exec(meta.path)
  if (result[1]) {
    meta = {
      locale: result[1].replace('/', ''),
      path: result[2]
    }
  }
  return meta
}
