const _ = require('lodash')
const moment = require('moment')
const qs = require('querystring')
const pageHelper = require('./page')

/* global WIKI */

const SYSTEM_ROUTE_PREFIXES = new Set(['a', 'e', 'h', 's', 'd', 'p', 'i', 't', 'u'])

function isValidRedirectPath (requestedPath) {
  return requestedPath &&
    typeof requestedPath === 'string' &&
    requestedPath.startsWith('/') &&
    !requestedPath.startsWith('//') &&
    !requestedPath.includes('://')
}

function parseRoutePath (urlPath) {
  return pageHelper.parsePath(urlPath.replace(/^\//, ''), { stripExt: true })
}

async function loadPageArgs (guestReq, urlPath) {
  const pageArgs = parseRoutePath(urlPath)
  const page = await WIKI.models.pages.getPageFromDb({
    path: pageArgs.path,
    locale: pageArgs.locale,
    userId: guestReq.user.id,
    isPrivate: false
  })
  pageArgs.tags = _.get(page, 'tags', [])
  return { pageArgs, page }
}

async function canGuestViewPage (guestReq, urlPath) {
  const stripExt = _.some(WIKI.config.pageExtensions, ext => _.endsWith(urlPath.split('?')[0], `.${ext}`))
  const pageArgs = pageHelper.parsePath(urlPath.replace(/^\//, ''), { stripExt })
  const isPage = stripExt || pageArgs.path.indexOf('.') === -1

  if (!isPage) {
    return WIKI.auth.checkAccess(guestReq.user, ['read:assets'], pageArgs)
  }

  try {
    const page = await WIKI.models.pages.getPage({
      path: pageArgs.path,
      locale: pageArgs.locale,
      userId: guestReq.user.id,
      isPrivate: false
    })
    pageArgs.tags = _.get(page, 'tags', [])

    const effectivePermissions = WIKI.auth.getEffectivePermissions(guestReq, pageArgs)
    if (!effectivePermissions.pages.read) {
      return false
    }

    if (page) {
      let pageIsPublished = page.isPublished
      if (pageIsPublished && !_.isEmpty(page.publishStartDate)) {
        pageIsPublished = moment(page.publishStartDate).isSameOrBefore()
      }
      if (pageIsPublished && !_.isEmpty(page.publishEndDate)) {
        pageIsPublished = moment(page.publishEndDate).isSameOrAfter()
      }
      if (!pageIsPublished && !effectivePermissions.pages.write) {
        return false
      }
      return true
    }

    return pageArgs.path === 'home'
  } catch (err) {
    return false
  }
}

async function canGuestAccessEditor (guestReq, urlPath) {
  const { pageArgs, page } = await loadPageArgs(guestReq, urlPath)
  const effectivePermissions = WIKI.auth.getEffectivePermissions(guestReq, pageArgs)

  if (page) {
    return effectivePermissions.pages.write || effectivePermissions.pages.manage
  }

  return effectivePermissions.pages.write
}

async function canGuestAccessHistory (guestReq, urlPath) {
  const { pageArgs, page } = await loadPageArgs(guestReq, urlPath)
  if (!page) {
    return false
  }

  return WIKI.auth.getEffectivePermissions(guestReq, pageArgs).history.read
}

async function canGuestAccessSource (guestReq, urlPath, versionId = 0) {
  const { pageArgs, page } = await loadPageArgs(guestReq, urlPath)
  if (!page) {
    return false
  }

  const effectivePermissions = WIKI.auth.getEffectivePermissions(guestReq, pageArgs)
  return versionId > 0 ? effectivePermissions.history.read : effectivePermissions.source.read
}

async function canGuestAccessPageId (guestReq, pageIdRaw) {
  const pageId = _.toSafeInteger(pageIdRaw)
  if (pageId <= 0) {
    return false
  }

  const page = await WIKI.models.pages.query().column(['path', 'localeCode', 'isPrivate', 'privateNS']).findById(pageId)
  if (!page) {
    return false
  }

  return WIKI.auth.checkAccess(guestReq.user, ['read:pages'], {
    locale: page.localeCode,
    path: page.path,
    private: page.isPrivate,
    privateNS: page.privateNS,
    explicitLocale: false,
    tags: page.tags
  })
}

async function canGuestAccessPath (guestReq, requestedPath) {
  const pathOnly = requestedPath.split('?')[0]
  const segments = pathOnly.split('/').filter(Boolean)
  const prefix = segments[0] || ''

  if (prefix.length === 1 && SYSTEM_ROUTE_PREFIXES.has(prefix)) {
    switch (prefix) {
      case 'a':
      case 'p':
      case 'u':
        return false
      case 't':
        return true
      case 'e':
        return canGuestAccessEditor(guestReq, pathOnly)
      case 'h':
        return canGuestAccessHistory(guestReq, pathOnly)
      case 's': {
        const query = requestedPath.includes('?') ? qs.parse(requestedPath.split('?')[1]) : {}
        const versionId = _.toSafeInteger(query.v)
        return canGuestAccessSource(guestReq, pathOnly, versionId)
      }
      case 'd': {
        const query = requestedPath.includes('?') ? qs.parse(requestedPath.split('?')[1]) : {}
        const versionId = _.toSafeInteger(query.v)
        if (versionId > 0) {
          return canGuestAccessSource(guestReq, pathOnly, versionId)
        }
        const { pageArgs } = await loadPageArgs(guestReq, pathOnly)
        return WIKI.auth.checkAccess(guestReq.user, ['read:source'], pageArgs)
      }
      case 'i':
        return canGuestAccessPageId(guestReq, segments[1])
      default:
        return false
    }
  }

  if (['login', 'logout', 'register'].includes(prefix)) {
    return false
  }

  return canGuestViewPage(guestReq, pathOnly)
}

module.exports = {
  async resolvePostLogoutRedirect (requestedPath) {
    const fallback = '/'

    if (!isValidRedirectPath(requestedPath)) {
      return fallback
    }

    const guestUser = await WIKI.models.users.getGuestUser()
    const guestReq = { user: guestUser }

    if (await canGuestAccessPath(guestReq, requestedPath)) {
      return requestedPath
    }

    return fallback
  }
}
