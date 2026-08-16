const {
  isNavigationDisabled,
  resolveSeriesContext,
  querySeriesPages
} = require('../_lib/seriesContext')

/* global WIKI */

function cleanTitle (title) {
  return title.replace(/\|\s*SUNNI NOOR/i, '').trim()
}

function buildPageHref (page, targetPath) {
  const localePrefix = WIKI.config.lang.namespacing ? `/${page.localeCode}` : ''
  return `${localePrefix}/${targetPath}`
}

module.exports = {
  /**
   * Resolve index (সূচী) and prev/next arrows for a page series.
   *
   * @param {Object} page Page instance (must include path, localeCode, tags)
   * @param {Object} config Module configuration
   * @returns {Promise<Object|null>} Navigation data or null when not applicable
   */
  async resolve (page, config = {}, options = {}) {
    if (!page?.tags?.length) {
      return null
    }

    if (isNavigationDisabled(page, config)) {
      return null
    }

    const seriesContext = resolveSeriesContext(page, config)
    if (!seriesContext) {
      return null
    }

    const series = await querySeriesPages(page, seriesContext, options.seriesCache)
    if (!series) {
      return null
    }

    const { pages, idx } = series
    const prev = pages[idx - 1]
    const next = pages[idx + 1]

    return {
      index: {
        href: seriesContext.indexHref,
        label: config.indexLabel || 'সূচী'
      },
      prev: prev ? { href: buildPageHref(page, prev.path), title: cleanTitle(prev.title) } : null,
      next: next ? { href: buildPageHref(page, next.path), title: cleanTitle(next.title) } : null,
      related: null
    }
  }
}
