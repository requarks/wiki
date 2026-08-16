const _ = require('lodash')
const moment = require('moment')
const pageHelper = require('./page')
const systemRoutes = require('./systemRoutes')

/* global WIKI */

function isValidRedirectPath (requestedPath) {
  return requestedPath &&
    typeof requestedPath === 'string' &&
    requestedPath.startsWith('/') &&
    !requestedPath.startsWith('//') &&
    !requestedPath.includes('://')
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

async function canGuestAccessPath (guestReq, requestedPath) {
  const pathOnly = requestedPath.split('?')[0]
  const segments = pathOnly.split('/').filter(Boolean)
  const prefix = segments[0] || ''

  if (prefix.length === 1) {
    if (systemRoutes.GUEST_ALLOWED_PREFIXES.has(prefix)) {
      return true
    }
    if (systemRoutes.AUTH_REQUIRED_PREFIXES.has(prefix)) {
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
