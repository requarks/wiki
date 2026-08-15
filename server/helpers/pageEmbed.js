const _ = require('lodash')

const HIDDEN_DATA_TAG_RE = /<div\s+class=["']hidden-data["'][^>]*>/i
const HIDDEN_DATA_BLOCK_RE = /<div\s+class=["']hidden-data["'][^>]*>[\s\S]*?<\/div>/gi

function parseDataAttributes (tagStr) {
  const attrs = {}
  const re = /data-([a-z0-9-]+)=["']([^"']*)["']/gi
  let match
  while ((match = re.exec(tagStr))) {
    attrs[_.camelCase(match[1])] = match[2].trim()
  }
  return attrs
}

function buildGdriveViewUrl (value) {
  if (!value) { return null }
  if (/^https?:\/\//i.test(value)) {
    return value.replace(/\/preview$/, '/view')
  }
  return `https://drive.google.com/file/d/${value}/view`
}

function buildGdrivePreviewUrl (value) {
  if (!value) { return null }
  if (/^https?:\/\//i.test(value)) {
    return value
  }
  return `https://drive.google.com/file/d/${value}/preview`
}

function buildArchiveEmbedUrl (value) {
  if (!value) { return null }
  const url = /^https?:\/\//i.test(value)
    ? value
    : `https://archive.org/${value.replace(/^\//, '')}`
  return `${url.replace(/\/$/, '')}/mode/1up?view=theater`
}

function parseFromTags (tags) {
  if (!Array.isArray(tags) || tags.length < 1) {
    return {}
  }

  const result = {}
  for (const tag of tags) {
    const raw = String(tag.tag || tag).trim()
    const lower = raw.toLowerCase()

    if (lower.startsWith('embed:gdrive:')) {
      const id = raw.slice('embed:gdrive:'.length).trim()
      result.gdriveUrl = buildGdriveViewUrl(id)
      result.gdrivePreviewUrl = buildGdrivePreviewUrl(id)
    } else if (lower.startsWith('embed:archive:')) {
      const path = raw.slice('embed:archive:'.length).trim()
      result.archiveUrl = buildArchiveEmbedUrl(path)
    } else if (lower.startsWith('embed:content:')) {
      result.contentUrl = raw.slice('embed:content:'.length).trim()
    } else if (lower.startsWith('embed:related:')) {
      result.relatedUrl = raw.slice('embed:related:'.length).trim()
    }
  }

  return result
}

function parseFromHtml (html) {
  if (!html || typeof html !== 'string') {
    return { html, embed: {} }
  }

  const tagMatch = html.match(HIDDEN_DATA_TAG_RE)
  if (!tagMatch) {
    return { html, embed: {} }
  }

  const attrs = parseDataAttributes(tagMatch[0])
  const embed = {}

  if (attrs.gdriveUrl) {
    embed.gdriveUrl = buildGdriveViewUrl(attrs.gdriveUrl)
    embed.gdrivePreviewUrl = buildGdrivePreviewUrl(attrs.gdriveUrl)
  }
  if (attrs.archiveUrl) {
    embed.archiveUrl = buildArchiveEmbedUrl(attrs.archiveUrl)
  }
  if (attrs.contentUrl) {
    embed.contentUrl = attrs.contentUrl
  }
  if (attrs.relatedUrl) {
    embed.relatedUrl = attrs.relatedUrl
  }

  const cleanedHtml = html.replace(HIDDEN_DATA_BLOCK_RE, '').trim()
  return { html: cleanedHtml, embed }
}

function mergeEmbed (tagEmbed, htmlEmbed) {
  return _.pickBy({
    archiveUrl: tagEmbed.archiveUrl || htmlEmbed.archiveUrl || null,
    gdriveUrl: tagEmbed.gdriveUrl || htmlEmbed.gdriveUrl || null,
    gdrivePreviewUrl: tagEmbed.gdrivePreviewUrl || htmlEmbed.gdrivePreviewUrl || null,
    contentUrl: tagEmbed.contentUrl || htmlEmbed.contentUrl || null,
    relatedUrl: tagEmbed.relatedUrl || htmlEmbed.relatedUrl || null
  }, v => !_.isEmpty(v))
}

module.exports = {
  parseFromTags,
  parseFromHtml,

  resolve (page, html, options = {}) {
    const tagEmbed = parseFromTags(page?.tags || [])
    const renderParsed = parseFromHtml(html)
    let embed = mergeEmbed(tagEmbed, renderParsed.embed)

    // Migrated pages may still have stale render while hidden-data lives in content.
    if (_.isEmpty(embed) && page?.content) {
      const contentParsed = parseFromHtml(page.content)
      embed = mergeEmbed(embed, contentParsed.embed)
    }

    const hasReaderEmbed = !_.isEmpty(embed)
    const hasTelegram = !_.isEmpty(options.telegramWebsiteId)
    const resultEmbed = hasReaderEmbed ? { ...embed } : {}

    if (hasTelegram) {
      resultEmbed.telegram = {
        websiteId: options.telegramWebsiteId,
        limit: options.telegramLimit || 5,
        pageUrl: options.pageUrl || null,
        pageTitle: options.pageTitle || null
      }
    }

    return {
      html: renderParsed.html,
      embed: (hasReaderEmbed || hasTelegram) ? resultEmbed : null
    }
  }
}
