const _ = require('lodash')

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

function tagStartsWith (tag, prefix) {
  return tag.toLowerCase().startsWith(String(prefix || '').toLowerCase())
}

function resolveSeriesContext (page, config) {
  const fromTagPrefix = config.fromTagPrefix || 'from:'
  const downloadSeriesTag = config.downloadSeriesTag || 'download'
  const upTagPrefix = config.upTagPrefix || 'up:'

  const fromTag = page.tags.find(t => tagStartsWith(t.tag, fromTagPrefix))
  if (fromTag) {
    return {
      mode: 'from',
      tagValues: [fromTag.tag],
      indexHref: `/t/${fromTag.tag.replace(/,/g, '/')}`
    }
  }

  const hasDownloadTag = page.tags.some(t =>
    t.tag.toLowerCase() === downloadSeriesTag.toLowerCase()
  )
  const upTags = page.tags.filter(t => tagStartsWith(t.tag, upTagPrefix))
  if (!hasDownloadTag || upTags.length < 1) {
    return null
  }

  const categoryTags = page.tags
    .filter(t =>
      !t.tag.startsWith('nav:') &&
      !t.tag.startsWith('embed:') &&
      !tagStartsWith(t.tag, upTagPrefix) &&
      t.tag.toLowerCase() !== downloadSeriesTag.toLowerCase()
    )
    .map(t => t.tag)

  const tagValues = page.tags
    .filter(t => !t.tag.startsWith('nav:') && !t.tag.startsWith('embed:'))
    .map(t => t.tag)

  const indexParts = [
    ...upTags.map(t => t.tag),
    ...categoryTags,
    downloadSeriesTag
  ]

  return {
    mode: 'download',
    tagValues,
    indexHref: `/t/${indexParts.join('/')}`
  }
}

module.exports = {
  /**
   * Resolve index (সূচী), prev/next arrows, and postal cards for a page.
   *
   * Shown only when either:
   * - the page has a tag starting with fromTagPrefix (default from:), or
   * - the page has downloadSeriesTag (default download) plus an upTagPrefix tag (default up:)
   *
   * The আরও button is handled separately and is not part of this resolver.
   *
   * @param {Object} page Page instance (must include path, localeCode, tags)
   * @param {Object} config Module configuration
   * @returns {Promise<Object|null>} Navigation data or null when not applicable
   */
  async resolve (page, config = {}) {
    if (!page?.tags?.length) {
      return null
    }

    const disableNavTag = config.disableNavTag || 'nav:off'
    if (page.tags.some(t => t.tag === disableNavTag)) {
      return null
    }

    const seriesContext = resolveSeriesContext(page, config)
    if (!seriesContext) {
      return null
    }

    const tagValues = seriesContext.tagValues

    let pages = await WIKI.models.pages.query()
      .select('pages.path', 'pages.title', 'pages.description')
      .withGraphJoined('tags')
      .modifyGraph('tags', builder => {
        builder.select('tag')
      })
      .where('pages.localeCode', page.localeCode)
      .where('pages.isPublished', true)
      .whereIn('tags.tag', tagValues)
      .orderBy('pages.title', 'asc')

    pages = _.uniqBy(pages, 'path')
    pages = pages.filter(p =>
      _.every(tagValues, t => p.tags && p.tags.some(pt => pt.tag === t))
    )

    if (!pages.length) {
      return null
    }

    const idx = pages.findIndex(p => String(p.path) === String(page.path))
    if (idx === -1) {
      return null
    }

    const prev = pages[idx - 1]
    const next = pages[idx + 1]

    const showPostalCards = config.showRelatedCards !== false
    const cards = showPostalCards
      ? [1, 2, 3]
        .map(offset => pages[idx + offset])
        .filter(Boolean)
        .map(p => ({
          href: buildPageHref(page, p.path),
          title: cleanTitle(p.title),
          description: p.description || '',
          image: buildCardImage(p.path, config)
        }))
      : []

    return {
      index: {
        href: seriesContext.indexHref,
        label: config.indexLabel || 'সূচী'
      },
      prev: prev ? { href: buildPageHref(page, prev.path), title: cleanTitle(prev.title) } : null,
      next: next ? { href: buildPageHref(page, next.path), title: cleanTitle(next.title) } : null,
      related: null,
      cards
    }
  }
}
