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

module.exports = {
  /**
   * Resolve prev/next/index/related navigation for a page using server-side DB queries.
   *
   * @param {Object} page Page instance (must include path, localeCode, tags)
   * @param {Object} config Module configuration
   * @returns {Promise<Object|null>} Navigation data or null when not applicable
   */
  async resolve (page, config = {}) {
    if (!page?.tags?.length) {
      return null
    }

    if (page.tags.some(t => t.tag === 'nav:off')) {
      return null
    }

    const fromTagPrefix = config.fromTagPrefix || 'from:'
    const fromTag = page.tags.find(t =>
      t.tag.toLowerCase().startsWith(fromTagPrefix.toLowerCase())
    )
    if (!fromTag) {
      return null
    }

    const relatedOverride = page.tags.find(t => t.tag.startsWith('nav:related:'))
    let relatedHref = null
    if (relatedOverride) {
      relatedHref = '/t/' + relatedOverride.tag.replace(/^nav:related:/, '')
    } else {
      const otherTags = page.tags.filter(t =>
        !t.tag.toLowerCase().startsWith(fromTagPrefix.toLowerCase()) &&
        !t.tag.startsWith('nav:')
      )
      if (otherTags.length) {
        relatedHref = '/t/' + otherTags.map(t => t.tag).join('/')
      }
    }

    const tagValues = [fromTag.tag.toLowerCase()]

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

    const showRelatedCards = config.showRelatedCards !== false
    const cards = showRelatedCards
      ? [1, 2, 3]
        .map(offset => pages[idx + offset])
        .filter(Boolean)
        .map(p => ({
          href: p.path,
          title: cleanTitle(p.title),
          description: p.description || '',
          image: buildCardImage(p.path, config)
        }))
      : []

    return {
      index: {
        href: '/t/' + fromTag.tag.replace(/,/g, '/'),
        label: config.indexLabel || 'সূচী'
      },
      prev: prev ? { href: prev.path, title: cleanTitle(prev.title) } : null,
      next: next ? { href: next.path, title: cleanTitle(next.title) } : null,
      related: relatedHref ? { href: relatedHref, label: config.relatedLabel || 'আরও' } : null,
      cards
    }
  }
}
