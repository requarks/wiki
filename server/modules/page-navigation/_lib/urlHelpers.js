/* global WIKI */

function getActiveLocaleCode (page, options = {}) {
  return page?.localeCode || options.locale || WIKI.config.lang.code
}

function normalizePagePath (targetPath) {
  return String(targetPath || '').replace(/^\/+/, '')
}

function shouldPrefixLocaleInPath (localeCode) {
  if (WIKI.config.lang.namespacing) {
    return true
  }

  return Boolean(localeCode && localeCode !== WIKI.config.lang.code)
}

function buildPageHref (page, targetPath, options = {}) {
  const localeCode = getActiveLocaleCode(page, options)
  const path = normalizePagePath(targetPath)

  if (shouldPrefixLocaleInPath(localeCode)) {
    return `/${localeCode}/${path}`
  }

  return `/${path}`
}

function buildTagIndexHref (page, tagPath, options = {}) {
  const localeCode = getActiveLocaleCode(page, options)
  const normalizedTagPath = String(tagPath || '').replace(/^\/+/, '')
  const href = `/t/${normalizedTagPath}`

  if (shouldPrefixLocaleInPath(localeCode)) {
    return `${href}?lang=${encodeURIComponent(localeCode)}`
  }

  return href
}

module.exports = {
  buildPageHref,
  buildTagIndexHref,
  getActiveLocaleCode,
  shouldPrefixLocaleInPath
}
