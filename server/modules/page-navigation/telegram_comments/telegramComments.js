const { compileRegex, isNavigationDisabled } = require('../_lib/seriesContext')

/* global WIKI */

function pageMatchesTagRegex (page, config) {
  const pattern = String(config.pageGroupTagRegex ?? '').trim()
  if (!pattern) {
    return true
  }

  const regex = compileRegex(pattern)
  if (!regex) {
    return false
  }

  return page.tags.some(t => regex.test(t.tag))
}

module.exports = {
  /**
   * Resolve Telegram Comments.app settings for a page.
   *
   * @param {Object} page Page instance (must include tags, title)
   * @param {Object} config Module configuration
   * @param {Object} options Runtime options (pageUrl)
   * @returns {Object|null} Telegram config or null when not applicable
   */
  resolve (page, config = {}, options = {}) {
    const websiteId = String(config.commentsAppWebsiteId || '').trim()
    if (!websiteId || !page?.tags?.length) {
      return null
    }

    if (isNavigationDisabled(page, config)) {
      return null
    }

    if (!pageMatchesTagRegex(page, config)) {
      return null
    }

    return {
      websiteId,
      limit: Number(config.commentsAppLimit) || 5,
      pageUrl: options.pageUrl || null,
      pageTitle: options.pageTitle || page.title || null
    }
  }
}
