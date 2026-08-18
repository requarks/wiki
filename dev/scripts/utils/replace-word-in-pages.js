#!/usr/bin/env node
/**
 * Replace a search string across wiki page fields.
 *
 * Usage (local dev container):
 *   docker exec wiki-app sh -c "dockerdev=1 node dev/scripts/utils/replace-word-in-pages.js --from=old --to=new --dry-run"
 *   docker exec wiki-app sh -c "dockerdev=1 node dev/scripts/utils/replace-word-in-pages.js --from=old --to=new"
 *
 * Options:
 *   --from=TEXT           Required. Text to find (literal unless --regex)
 *   --to=TEXT             Required. Replacement text
 *   --dry-run             Print changes without writing
 *   --no-render           Update fields only, skip re-render when content changes
 *   --locale=bn           Limit to one locale
 *   --path=1234           Limit to one page path
 *   --title-like=Pdf:%    Limit to pages whose title matches (SQL LIKE)
 *   --fields=content      Comma-separated: content,title,description,extraJs,extraCss
 *   --case-insensitive    Case-insensitive match
 *   --whole-word          Match whole words only (\b boundaries; ASCII-oriented)
 *   --regex               Treat --from as a regular expression
 */

const path = require('path')
const cheerio = require('cheerio')
const _ = require('lodash')

const FIELD_CONTENT = 'content'
const FIELD_TITLE = 'title'
const FIELD_DESCRIPTION = 'description'
const FIELD_EXTRA_JS = 'extraJs'
const FIELD_EXTRA_CSS = 'extraCss'
const DEFAULT_FIELDS = [FIELD_CONTENT]
const ALL_FIELDS = [
  FIELD_CONTENT,
  FIELD_TITLE,
  FIELD_DESCRIPTION,
  FIELD_EXTRA_JS,
  FIELD_EXTRA_CSS
]

function parseArgs (argv) {
  const args = {
    from: null,
    to: null,
    dryRun: false,
    noRender: false,
    locale: null,
    path: null,
    titleLike: null,
    fields: [...DEFAULT_FIELDS],
    caseInsensitive: false,
    wholeWord: false,
    regex: false
  }

  for (const arg of argv) {
    if (arg === '--dry-run') { args.dryRun = true }
    else if (arg === '--no-render') { args.noRender = true }
    else if (arg === '--case-insensitive') { args.caseInsensitive = true }
    else if (arg === '--whole-word') { args.wholeWord = true }
    else if (arg === '--regex') { args.regex = true }
    else if (arg.startsWith('--from=')) { args.from = arg.slice('--from='.length) }
    else if (arg.startsWith('--to=')) { args.to = arg.slice('--to='.length) }
    else if (arg.startsWith('--locale=')) { args.locale = arg.slice('--locale='.length) }
    else if (arg.startsWith('--path=')) { args.path = arg.slice('--path='.length) }
    else if (arg.startsWith('--title-like=')) { args.titleLike = arg.slice('--title-like='.length) }
    else if (arg.startsWith('--fields=')) {
      const raw = arg.slice('--fields='.length)
      args.fields = raw.split(',').map(s => s.trim()).filter(Boolean)
    }
  }

  return args
}

function escapeRegex (text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildPattern (from, { caseInsensitive, wholeWord, regex }) {
  const flags = caseInsensitive ? 'gi' : 'g'
  if (regex) {
    return new RegExp(from, flags)
  }

  const escaped = escapeRegex(from)
  const source = wholeWord ? `\\b${escaped}\\b` : escaped
  return new RegExp(source, flags)
}

function replaceInText (text, from, to, options) {
  if (text == null || typeof text !== 'string' || !from) {
    return { text: text || '', count: 0 }
  }

  const pattern = buildPattern(from, options)
  let count = 0
  const next = text.replace(pattern, () => {
    count++
    return to
  })

  return { text: next, count }
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
  if (!args.from) {
    throw new Error('Missing required option: --from=TEXT')
  }
  if (args.to == null) {
    throw new Error('Missing required option: --to=TEXT')
  }

  const invalidFields = args.fields.filter(field => !ALL_FIELDS.includes(field))
  if (invalidFields.length > 0) {
    throw new Error(`Unknown field(s): ${invalidFields.join(', ')}. Allowed: ${ALL_FIELDS.join(', ')}`)
  }

  if (args.regex) {
    try {
      buildPattern(args.from, args)
    } catch (err) {
      throw new Error(`Invalid regular expression in --from: ${err.message}`)
    }
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

function applyReplacements (page, args) {
  const patch = {}
  const fieldCounts = {}
  let contentChanged = false

  if (args.fields.includes(FIELD_CONTENT)) {
    const result = replaceInText(page.content, args.from, args.to, args)
    if (result.count > 0) {
      patch.content = result.text
      fieldCounts[FIELD_CONTENT] = result.count
      contentChanged = true
    }
  }

  if (args.fields.includes(FIELD_TITLE)) {
    const result = replaceInText(page.title, args.from, args.to, args)
    if (result.count > 0) {
      patch.title = result.text
      fieldCounts[FIELD_TITLE] = result.count
    }
  }

  if (args.fields.includes(FIELD_DESCRIPTION)) {
    const result = replaceInText(page.description, args.from, args.to, args)
    if (result.count > 0) {
      patch.description = result.text
      fieldCounts[FIELD_DESCRIPTION] = result.count
    }
  }

  const extraFields = args.fields.includes(FIELD_EXTRA_JS) || args.fields.includes(FIELD_EXTRA_CSS)
  if (extraFields) {
    const extra = normalizeExtra(page.extra)
    const nextExtra = { css: extra.css, js: extra.js }
    let extraChanged = false

    if (args.fields.includes(FIELD_EXTRA_JS)) {
      const result = replaceInText(extra.js, args.from, args.to, args)
      if (result.count > 0) {
        nextExtra.js = result.text
        fieldCounts[FIELD_EXTRA_JS] = result.count
        extraChanged = true
      }
    }

    if (args.fields.includes(FIELD_EXTRA_CSS)) {
      const result = replaceInText(extra.css, args.from, args.to, args)
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
    contentChanged
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
  WIKI.logger = require('../../../server/core/logger').init('REPLACE-WORD-IN-PAGES')

  WIKI.models = require('../../../server/core/db').init()
  await WIKI.configSvc.loadFromDb()
  await WIKI.configSvc.applyFlags()

  WIKI.logger.info(
    `Postgres: ${WIKI.config.db.user}@${WIKI.config.db.host}:${WIKI.config.db.port}/${WIKI.config.db.db}`
  )

  let query = WIKI.models.pages.query()
    .select('id', 'path', 'localeCode', 'title', 'description', 'content', 'extra', 'contentType', 'editorKey')

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
    from: args.from,
    to: args.to,
    fields: args.fields,
    caseInsensitive: args.caseInsensitive,
    wholeWord: args.wholeWord,
    regex: args.regex,
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
    `Scanning ${pages.length} page(s) for "${args.from}" → "${args.to}" ` +
    `fields=[${args.fields.join(', ')}] dryRun=${args.dryRun}`
  )

  for (const page of pages) {
    try {
      const { patch, fieldCounts, totalReplacements, contentChanged } = applyReplacements(page, args)

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

      if (contentChanged && !args.noRender) {
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
