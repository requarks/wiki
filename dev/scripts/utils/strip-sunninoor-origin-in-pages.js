#!/usr/bin/env node
/**
 * Remove https://sunninoor.com (and http/www variants) from page fields.
 *
 * Typical fix:
 *   window.location.href="https://sunninoor.com/t/foo?sort=title"
 *   -> window.location.href="/t/foo?sort=title"
 *
 * Usage (local dev container):
 *   docker exec wiki-app sh -c "dockerdev=1 node dev/scripts/utils/strip-sunninoor-origin-in-pages.js --dry-run"
 *   docker exec wiki-app sh -c "dockerdev=1 node dev/scripts/utils/strip-sunninoor-origin-in-pages.js"
 *
 * Usage (production container; copy script into /wiki first):
 *   docker exec wiki sh -c "cd /wiki && CONFIG_FILE=config.yml node dev/scripts/utils/strip-sunninoor-origin-in-pages.js --dry-run"
 *
 * Options:
 *   --dry-run             Print changes without writing
 *   --no-render           Update fields only, skip re-render when content changes
 *   --locale=bn           Limit to one locale
 *   --path=some/page      Limit to one page path
 *   --title-like=%        Limit to pages whose title matches (SQL LIKE)
 *   --fields=content      Comma-separated: content,title,description,extraJs,extraCss,render
 *   --script-only         Only strip inside <script> blocks and location.href assignments (default)
 *   --all-urls            Strip origin anywhere in selected fields
 *   --origin=https://sunninoor.com  Override origin prefix to remove (repeatable)
 */

const path = require('path')
const cheerio = require('cheerio')
const _ = require('lodash')

const FIELD_CONTENT = 'content'
const FIELD_TITLE = 'title'
const FIELD_DESCRIPTION = 'description'
const FIELD_EXTRA_JS = 'extraJs'
const FIELD_EXTRA_CSS = 'extraCss'
const FIELD_RENDER = 'render'
const DEFAULT_FIELDS = [FIELD_CONTENT, FIELD_EXTRA_JS]
const ALL_FIELDS = [
  FIELD_CONTENT,
  FIELD_TITLE,
  FIELD_DESCRIPTION,
  FIELD_EXTRA_JS,
  FIELD_EXTRA_CSS,
  FIELD_RENDER
]

const DEFAULT_ORIGINS = [
  'https://sunninoor.com',
  'http://sunninoor.com',
  'https://www.sunninoor.com',
  'http://www.sunninoor.com'
]

const SCRIPT_BLOCK_PATTERN = /<script\b[^>]*>[\s\S]*?<\/script>/gi
const LOCATION_ASSIGNMENT_PATTERN = /((?:window\.)?location(?:\.href)?\s*=\s*["'])([\s\S]*?)(["'])/gi

function parseArgs (argv) {
  const args = {
    dryRun: false,
    noRender: false,
    locale: null,
    path: null,
    titleLike: null,
    fields: [...DEFAULT_FIELDS],
    scriptOnly: true,
    allUrls: false,
    origins: [...DEFAULT_ORIGINS]
  }

  for (const arg of argv) {
    if (arg === '--dry-run') { args.dryRun = true }
    else if (arg === '--no-render') { args.noRender = true }
    else if (arg === '--script-only') { args.scriptOnly = true; args.allUrls = false }
    else if (arg === '--all-urls') { args.allUrls = true; args.scriptOnly = false }
    else if (arg.startsWith('--locale=')) { args.locale = arg.slice('--locale='.length) }
    else if (arg.startsWith('--path=')) { args.path = arg.slice('--path='.length) }
    else if (arg.startsWith('--title-like=')) { args.titleLike = arg.slice('--title-like='.length) }
    else if (arg.startsWith('--fields=')) {
      const raw = arg.slice('--fields='.length)
      args.fields = raw.split(',').map(s => s.trim()).filter(Boolean)
    } else if (arg.startsWith('--origin=')) {
      args.origins.push(arg.slice('--origin='.length))
    }
  }

  args.origins = _.uniq(args.origins.map(origin => origin.trim()).filter(Boolean))
  return args
}

function escapeRegex (text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildOriginPattern (origins) {
  const parts = origins.map(origin => escapeRegex(origin.replace(/\/+$/, '')))
  return new RegExp(`(?:${parts.join('|')})`, 'gi')
}

function stripOrigins (text, originPattern) {
  if (text == null || typeof text !== 'string' || !text) {
    return { text: text || '', count: 0 }
  }

  let count = 0
  const next = text.replace(originPattern, () => {
    count++
    return ''
  })

  return { text: next, count }
}

function stripOriginsInScriptBlocks (text, originPattern) {
  if (!text) {
    return { text: text || '', count: 0 }
  }

  let count = 0
  const next = text.replace(SCRIPT_BLOCK_PATTERN, (block) => {
    const updated = block.replace(originPattern, () => {
      count++
      return ''
    })
    return updated
  })

  return { text: next, count }
}

function stripOriginsInLocationAssignments (text, originPattern) {
  if (!text) {
    return { text: text || '', count: 0 }
  }

  let count = 0
  const next = text.replace(
    LOCATION_ASSIGNMENT_PATTERN,
    (match, prefix, urlValue, suffix) => {
      const updated = urlValue.replace(originPattern, () => {
        count++
        return ''
      })
      if (updated === urlValue) {
        return match
      }
      return `${prefix}${updated}${suffix}`
    }
  )

  return { text: next, count }
}

function transformText (text, args, originPattern) {
  if (args.allUrls) {
    return stripOrigins(text, originPattern)
  }

  let totalCount = 0
  let current = text

  const locationResult = stripOriginsInLocationAssignments(current, originPattern)
  current = locationResult.text
  totalCount += locationResult.count

  const scriptResult = stripOriginsInScriptBlocks(current, originPattern)
  current = scriptResult.text
  totalCount += scriptResult.count

  return { text: current, count: totalCount }
}

function normalizeExtra (extra) {
  if (_.isPlainObject(extra)) {
    return {
      css: extra.css || '',
      js: extra.js || ''
    }
  }
  return { css: '', js: '' }
}

function validateArgs (args) {
  const invalidFields = args.fields.filter(field => !ALL_FIELDS.includes(field))
  if (invalidFields.length > 0) {
    throw new Error(`Unknown field(s): ${invalidFields.join(', ')}. Allowed: ${ALL_FIELDS.join(', ')}`)
  }

  if (args.origins.length < 1) {
    throw new Error('At least one origin is required. Use --origin=https://example.com')
  }
}

async function renderPage (pageId) {
  const page = await WIKI.models.pages.getPageFromDb(pageId)
  if (!page) {
    throw new Error(`Invalid page id ${pageId}`)
  }

  await WIKI.models.renderers.fetchDefinitions()
  const pipeline = await WIKI.models.renderers.getRenderingPipeline(page.contentType)

  let output = page.content
  for (const core of pipeline) {
    const renderer = require(path.join(WIKI.SERVERPATH, 'modules/rendering', `${_.kebabCase(core.key)}/renderer.js`))
    output = await renderer.render.call({
      config: core.config,
      children: core.children,
      page,
      input: output
    })
  }

  const $ = cheerio.load(output)
  const isStrict = $('h1').length > 0
  const toc = { root: [] }

  $('h1,h2,h3,h4,h5,h6').each((idx, el) => {
    const depth = _.toSafeInteger(el.name.substring(1)) - (isStrict ? 1 : 2)
    let leafPathError = false

    const leafPath = _.reduce(_.times(depth), (curPath) => {
      if (_.has(toc, curPath)) {
        const lastLeafIdx = _.get(toc, curPath).length - 1
        if (lastLeafIdx >= 0) {
          curPath = `${curPath}[${lastLeafIdx}].children`
        } else {
          leafPathError = true
        }
      }
      return curPath
    }, 'root')

    if (leafPathError) { return }

    const leafSlug = $('.toc-anchor', el).first().attr('href')
    $('.toc-anchor', el).remove()

    _.get(toc, leafPath).push({
      title: _.trim($(el).text()),
      anchor: leafSlug,
      children: []
    })
  })

  await WIKI.models.pages.query()
    .patch({
      render: output,
      toc: JSON.stringify(toc.root)
    })
    .where('id', page.id)

  await WIKI.models.pages.savePageToCache({
    ...page,
    render: output,
    toc: JSON.stringify(toc.root)
  })
}

function applyTransform (page, args, originPattern) {
  const patch = {}
  const fieldCounts = {}
  let contentChanged = false
  let renderChanged = false

  if (args.fields.includes(FIELD_CONTENT)) {
    const result = transformText(page.content, args, originPattern)
    if (result.count > 0) {
      patch.content = result.text
      fieldCounts[FIELD_CONTENT] = result.count
      contentChanged = true
    }
  }

  if (args.fields.includes(FIELD_TITLE)) {
    const result = transformText(page.title, args, originPattern)
    if (result.count > 0) {
      patch.title = result.text
      fieldCounts[FIELD_TITLE] = result.count
    }
  }

  if (args.fields.includes(FIELD_DESCRIPTION)) {
    const result = transformText(page.description, args, originPattern)
    if (result.count > 0) {
      patch.description = result.text
      fieldCounts[FIELD_DESCRIPTION] = result.count
    }
  }

  if (args.fields.includes(FIELD_RENDER)) {
    const result = transformText(page.render, args, originPattern)
    if (result.count > 0) {
      patch.render = result.text
      fieldCounts[FIELD_RENDER] = result.count
      renderChanged = true
    }
  }

  const extraFields = args.fields.includes(FIELD_EXTRA_JS) || args.fields.includes(FIELD_EXTRA_CSS)
  if (extraFields) {
    const extra = normalizeExtra(page.extra)
    const nextExtra = { css: extra.css, js: extra.js }
    let extraChanged = false

    if (args.fields.includes(FIELD_EXTRA_JS)) {
      const result = transformText(extra.js, args, originPattern)
      if (result.count > 0) {
        nextExtra.js = result.text
        fieldCounts[FIELD_EXTRA_JS] = result.count
        extraChanged = true
      }
    }

    if (args.fields.includes(FIELD_EXTRA_CSS)) {
      const result = transformText(extra.css, args, originPattern)
      if (result.count > 0) {
        nextExtra.css = result.text
        fieldCounts[FIELD_EXTRA_CSS] = result.count
        extraChanged = true
      }
    }

    if (extraChanged) {
      patch.extra = nextExtra
    }
  }

  const totalReplacements = Object.values(fieldCounts).reduce((sum, n) => sum + n, 0)

  return {
    patch,
    fieldCounts,
    totalReplacements,
    contentChanged,
    renderChanged
  }
}

async function main () {
  const args = parseArgs(process.argv.slice(2))
  validateArgs(args)

  if (!process.env.dockerdev && !process.env.CONFIG_FILE) {
    process.env.dockerdev = '1'
  }

  global.WIKI = {
    ROOTPATH: path.resolve(__dirname, '../../..'),
    SERVERPATH: path.resolve(__dirname, '../../../server'),
    IS_DEBUG: false
  }

  WIKI.configSvc = require('../../../server/core/config')
  WIKI.configSvc.init()
  WIKI.logger = require('../../../server/core/logger').init('STRIP-SUNNINOOR-ORIGIN')

  WIKI.models = require('../../../server/core/db').init()
  await WIKI.configSvc.loadFromDb()
  await WIKI.configSvc.applyFlags()

  const originPattern = buildOriginPattern(args.origins)

  WIKI.logger.info(
    `Postgres: ${WIKI.config.db.user}@${WIKI.config.db.host}:${WIKI.config.db.port}/${WIKI.config.db.db}`
  )

  let query = WIKI.models.pages.query()
    .select('id', 'path', 'localeCode', 'title', 'description', 'content', 'render', 'extra', 'contentType', 'editorKey')

  if (args.locale) {
    query = query.where('localeCode', args.locale)
  }
  if (args.path) {
    query = query.where('path', args.path)
  }
  if (args.titleLike) {
    query = query.where('title', 'like', args.titleLike)
  }

  const pages = await query.orderBy('path', 'asc')

  const summary = {
    dryRun: args.dryRun,
    mode: args.allUrls ? 'all-urls' : 'script-only',
    origins: args.origins,
    fields: args.fields,
    scanned: pages.length,
    updated: 0,
    skipped: 0,
    totalReplacements: 0,
    replacementsByField: {},
    rendered: 0,
    sample: [],
    errors: []
  }

  WIKI.logger.info(
    `Scanning ${pages.length} page(s) to strip origins [${args.origins.join(', ')}] ` +
    `mode=${summary.mode} fields=[${args.fields.join(', ')}] dryRun=${args.dryRun}`
  )

  for (const page of pages) {
    try {
      const {
        patch,
        fieldCounts,
        totalReplacements,
        contentChanged,
        renderChanged
      } = applyTransform(page, args, originPattern)

      if (totalReplacements === 0) {
        summary.skipped++
        continue
      }

      summary.updated++
      summary.totalReplacements += totalReplacements
      for (const [field, count] of Object.entries(fieldCounts)) {
        summary.replacementsByField[field] = (summary.replacementsByField[field] || 0) + count
      }

      const fieldSummary = Object.entries(fieldCounts)
        .map(([field, count]) => `${field}:${count}`)
        .join(', ')

      WIKI.logger.info(
        `[UPDATE] ${page.localeCode}/${page.path} — ${page.title} (${fieldSummary})`
      )

      if (summary.sample.length < 25) {
        summary.sample.push({
          page: `${page.localeCode}/${page.path}`,
          title: page.title,
          replacements: fieldCounts
        })
      }

      if (args.dryRun) {
        continue
      }

      await WIKI.models.pages.query()
        .patch(patch)
        .where('id', page.id)

      if (contentChanged && !args.noRender && !renderChanged) {
        await renderPage(page.id)
        summary.rendered++
      }
    } catch (err) {
      summary.errors.push({ page: `${page.localeCode}/${page.path}`, message: err.message })
      WIKI.logger.error(`Failed on ${page.localeCode}/${page.path}: ${err.message}`)
    }
  }

  const actionLabel = args.dryRun ? 'Would update' : 'Updated'
  WIKI.logger.info('Done.')
  WIKI.logger.info(`${actionLabel}: ${summary.updated} page(s)`)
  WIKI.logger.info(`Skipped (no match): ${summary.skipped}`)
  WIKI.logger.info(`Total replacements: ${summary.totalReplacements}`)
  if (!args.dryRun && summary.rendered > 0) {
    WIKI.logger.info(`Re-rendered: ${summary.rendered}`)
  }
  WIKI.logger.info(JSON.stringify(summary, null, 2))

  await WIKI.models.knex.destroy()
  process.exit(summary.errors.length > 0 ? 1 : 0)
}

main().catch(err => {
  console.error(err.message || err)
  process.exit(1)
})
