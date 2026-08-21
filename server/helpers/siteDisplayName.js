/* global WIKI */

const DEFAULT_WIKI_TITLE = 'Wiki.js'
const SITE_DISPLAY_NAME = 'সুন্নি নূর'
const PWA_APP_NAME = 'Sunni Noor'

/**
 * Public-facing site name for nav, page titles, and Open Graph.
 * Wiki.js defaults config.title to "Wiki.js" until changed in admin.
 */
function getSiteDisplayName () {
  const configuredTitle = WIKI.config && WIKI.config.title
  if (!configuredTitle || configuredTitle === DEFAULT_WIKI_TITLE) {
    return SITE_DISPLAY_NAME
  }
  return configuredTitle
}

/** Latin app name for PWA install prompt and web app manifest. */
function getPwaAppName () {
  return PWA_APP_NAME
}

module.exports = {
  DEFAULT_WIKI_TITLE,
  SITE_DISPLAY_NAME,
  PWA_APP_NAME,
  getSiteDisplayName,
  getPwaAppName
}
