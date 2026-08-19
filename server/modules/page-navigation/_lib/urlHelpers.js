/* global WIKI */

function getActiveLocaleCode (page, options = {}) {
  return page?.localeCode || options.locale || WIKI.config.lang.code
}

function normalizePagePath (targetPath) {
  return String(targetPath || '').replace(/^\/+/, '')
}

function shouldPrefixLocaleInPath (localeCode) {
  // Always keep the active locale in navigation URLs. Wiki.js accepts explicit
  // locale segments even when lang.namespacing is disabled (production often
  // serves /home at / while local dev uses /bn/home with namespacing on).
  return Boolean(localeCode)
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
