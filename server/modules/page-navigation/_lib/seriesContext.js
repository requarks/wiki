const _ = require('lodash')

/* global WIKI */

function escapeRegex (str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function compileRegex (pattern, flags = 'i') {
  try {
    return new RegExp(pattern, flags)
  } catch (err) {
    WIKI.logger.warn(`[Page Customization] Invalid regex: ${pattern}`)
    return null
  }
}

function splitRegexAlternates (pattern) {
  const parts = []
  let depth = 0
  let current = ''

  for (const char of String(pattern || '')) {
    if (char === '(') {
      depth++
    } else if (char === ')') {
      depth = Math.max(0, depth - 1)
    } else if (char === '|' && depth === 0) {
      if (current.trim()) {
        parts.push(current.trim())
      }
      current = ''
      continue
    }
    current += char
  }

  if (current.trim()) {
    parts.push(current.trim())
  }

  return parts
}

function isFromAlternate (pattern) {
  return /\^from:/i.test(String(pattern || ''))
}

function flattenLegacyMultilineRegexes (raw) {
  return String(raw || '')
    .split(/\n\s*\n/)
    .flatMap(block => block.split('\n'))
    .map(line => line.trim())
    .filter(Boolean)
}

function getPageGroupTagRegex (config) {
  if (config.pageGroupTagRegex) {
    return config.pageGroupTagRegex
  }
  if (config.pageGroupTagRegexes) {
    return flattenLegacyMultilineRegexes(config.pageGroupTagRegexes).join('|')
  }
  if (config.fromSeriesTagRegex || config.downloadGroupTagRegexes) {
    const parts = []
    if (config.fromSeriesTagRegex) {
      parts.push(String(config.fromSeriesTagRegex).trim())
    }
    if (config.downloadGroupTagRegexes) {
      parts.push(...flattenLegacyMultilineRegexes(config.downloadGroupTagRegexes))
    }
    return parts.join('|')
  }
  const fromPrefix = config.fromTagPrefix || 'from:'
  const download = config.downloadSeriesTag || 'download'
  const upPrefix = config.upTagPrefix || 'up:'
  return [
    `^${escapeRegex(fromPrefix)}.+`,
    `^${escapeRegex(download)}$`,
    `^${escapeRegex(upPrefix)}.+`
  ].join('|')
}

function resolveFromSeriesWithRegex (page, regex) {
  const fromTag = page.tags.find(t => regex.test(t.tag))
  if (!fromTag) {
    return null
  }

  return {
    mode: 'from',
    tagValues: [fromTag.tag],
    indexHref: `/t/${fromTag.tag.replace(/,/g, '/')}`
  }
}

function resolveDownloadGroupWithRequiredTags (page, requiredTags) {
  const requiredTagSet = new Set(requiredTags)

  const tagValues = [...requiredTags]

  const upTags = page.tags.filter(t => requiredTagSet.has(t.tag) && /^up:/i.test(t.tag))
  const downloadTag = requiredTags.find(t => /^download$/i.test(t)) || 'download'

  const indexParts = [
    ...upTags.map(t => t.tag),
    downloadTag
  ]

  return {
    mode: 'download',
    tagValues,
    indexHref: `/t/${indexParts.join('/')}`
  }
}

function resolveSeriesContext (page, config) {
  const pattern = getPageGroupTagRegex(config)
  const alternatePatterns = splitRegexAlternates(pattern)
  if (!alternatePatterns.length) {
    return null
  }

  const fromPatterns = alternatePatterns.filter(isFromAlternate)
  for (const alternatePattern of fromPatterns) {
    const regex = compileRegex(alternatePattern)
    if (!regex) {
      continue
    }
    const result = resolveFromSeriesWithRegex(page, regex)
    if (result) {
      return result
    }
  }

  const requiredPatterns = alternatePatterns.filter(pattern => !isFromAlternate(pattern))
  if (!requiredPatterns.length) {
    return null
  }

  const requiredTags = []
  for (const alternatePattern of requiredPatterns) {
    const regex = compileRegex(alternatePattern)
    if (!regex) {
      return null
    }
    const match = page.tags.find(t => regex.test(t.tag))
    if (!match) {
      return null
    }
    requiredTags.push(match.tag)
  }

  return resolveDownloadGroupWithRequiredTags(page, requiredTags)
}

function isNavigationDisabled (page, config) {
  const disableNavTag = config.disableNavTag || 'nav:off'
  return page.tags.some(t => t.tag === disableNavTag)
}

async function querySeriesPages (page, seriesContext, cache) {
  const tagValues = seriesContext.tagValues
  const cacheKey = `${page.localeCode}:${tagValues.slice().sort().join('\0')}`

  if (cache && cache.has(cacheKey)) {
    return cache.get(cacheKey)
  }

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

  const result = { pages, idx }

  if (cache) {
    cache.set(cacheKey, result)
  }

  return result
}

module.exports = {
  compileRegex,
  getPageGroupTagRegex,
  isNavigationDisabled,
  resolveSeriesContext,
  querySeriesPages
}
