const {
  isNavigationDisabled,
  resolveSeriesContext,
  querySeriesPages
} = require('../_lib/seriesContext')

/* global WIKI */

function cleanTitle (title) {
  return title.replace(/\|\s*SUNNI NOOR/i, '').trim()
}

function imageIndexForPath (path) {
  let hash = 0
  for (let i = 0; i < path.length; i++) {
    hash = ((hash << 5) - hash) + path.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) % 40
}

function buildCardImage (path, config) {
  const base = (config.relatedImageBaseUrl || 'https://sunninoor.com/images/related/').replace(/\/?$/, '/')
  return `${base}${imageIndexForPath(path)}.jpeg`
}

function buildPageHref (page, targetPath) {
  const localePrefix = WIKI.config.lang.namespacing ? `/${page.localeCode}` : ''
  return `${localePrefix}/${targetPath}`
}

module.exports = {
  /**
   * Resolve postal-card related pages for a page series.
   *
   * @param {Object} page Page instance (must include path, localeCode, tags)
   * @param {Object} config Module configuration
   * @returns {Promise<Object|null>} Related pages data or null when not applicable
   */
  async resolve (page, config = {}, options = {}) {
    if (!page?.tags?.length) {
      return null
    }

    const reuseGroup = config.reuseNavigationGroup !== false
    const seriesConfig = reuseGroup
      ? (options.navigationConfig || WIKI.data.pageNavigation?.config || config)
      : config

    if (isNavigationDisabled(page, seriesConfig)) {
      return null
    }

    const seriesContext = resolveSeriesContext(page, seriesConfig)
    if (!seriesContext) {
      return null
    }

    const series = await querySeriesPages(page, seriesContext, options.seriesCache)
    if (!series) {
      return null
    }

    const cardCount = Math.max(1, Math.min(Number(config.cardCount) || 3, 12))
    const cards = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
      .slice(0, cardCount)
      .map(offset => series.pages[series.idx + offset])
      .filter(Boolean)
      .map(p => ({
        href: buildPageHref(page, p.path),
        title: cleanTitle(p.title),
        description: p.description || '',
        image: buildCardImage(p.path, config)
      }))

    if (!cards.length) {
      return null
    }

    return { cards }
  }
}
