#!/usr/bin/env node
/**
 * Remove a leading <hr> (and blank line after it) before hidden-data blocks on Pdf: pages.
 *
 * Example — before:
 *   <hr>
 *
 *   <div class="hidden-data" style="display: none;" ...></div>
 *
 * After:
 *   <div class="hidden-data" style="display: none;" ...></div>
 *
 * Usage (local dev container):
 *   docker exec wiki-app sh -c "dockerdev=1 node dev/scripts/utils/strip-hr-before-hidden-data.js --dry-run"
 *   docker exec wiki-app sh -c "dockerdev=1 node dev/scripts/utils/strip-hr-before-hidden-data.js"
 *
 * Options:
 *   --dry-run    Print changes without writing
 *   --no-render  Update content only, skip re-render
 *   --locale=bn  Limit to one locale
 *   --path=3103  Limit to one page path
 */

const path = require('path')
const cheerio = require('cheerio')
const _ = require('lodash')

// <hr> or <hr /> followed by optional whitespace/newlines before hidden-data div
const HR_BEFORE_HIDDEN_DATA_RE = /<hr\b[^>]*>\s*(?=<div\s+class=["']hidden-data["'])/gi

function parseArgs (argv) {
  const args = {
    dryRun: false,
    noRender: false,
    locale: null,
    path: null
  }
  for (const arg of argv) {
    if (arg === '--dry-run') { args.dryRun = true }
    else if (arg === '--no-render') { args.noRender = true }
    else if (arg.startsWith('--locale=')) { args.locale = arg.slice('--locale='.length) }
    else if (arg.startsWith('--path=')) { args.path = arg.slice('--path='.length) }
  }
  return args
}

function contentHasHrBeforeHiddenData (content) {
  if (!content || typeof content !== 'string') { return false }
  HR_BEFORE_HIDDEN_DATA_RE.lastIndex = 0
  return HR_BEFORE_HIDDEN_DATA_RE.test(content)
}

function stripHrBeforeHiddenData (content) {
  if (!content || typeof content !== 'string') { return content || '' }
  HR_BEFORE_HIDDEN_DATA_RE.lastIndex = 0
  return content.replace(HR_BEFORE_HIDDEN_DATA_RE, '').replace(/^\s+/, '')
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

async function main () {
  const args = parseArgs(process.argv.slice(2))

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
  WIKI.logger = require('../../../server/core/logger').init('STRIP-HR-HIDDEN-DATA')

  WIKI.models = require('../../../server/core/db').init()
  await WIKI.configSvc.loadFromDb()
  await WIKI.configSvc.applyFlags()

  WIKI.logger.info(
    `Postgres: ${WIKI.config.db.user}@${WIKI.config.db.host}:${WIKI.config.db.port}/${WIKI.config.db.db}`
  )

  let query = WIKI.models.pages.query()
    .select('id', 'path', 'localeCode', 'title', 'content', 'contentType', 'editorKey')
    .where('title', 'like', 'Pdf:%')
    .where('content', 'ilike', '%<hr%')
    .where('content', 'ilike', '%hidden-data%')

  if (args.locale) {
    query = query.where('localeCode', args.locale)
  }
  if (args.path) {
    query = query.where('path', args.path)
  }

  const pages = await query.orderBy('path', 'asc')

  const summary = {
    dryRun: args.dryRun,
    scanned: pages.length,
    updated: 0,
    skipped: 0,
    rendered: 0,
    sample: [],
    errors: []
  }

  WIKI.logger.info(`Scanning ${pages.length} Pdf: page(s) with <hr> + hidden-data ... dryRun=${args.dryRun}`)

  for (const page of pages) {
    try {
      if (!contentHasHrBeforeHiddenData(page.content)) {
        summary.skipped++
        continue
      }

      const nextContent = stripHrBeforeHiddenData(page.content)
      if (nextContent === page.content) {
        summary.skipped++
        continue
      }

      summary.updated++
      WIKI.logger.info(`[UPDATE] ${page.localeCode}/${page.path} — ${page.title}`)

      if (summary.sample.length < 10) {
        summary.sample.push(`${page.localeCode}/${page.path}`)
      }

      if (args.dryRun) {
        continue
      }

      await WIKI.models.pages.query()
        .patch({ content: nextContent })
        .where('id', page.id)

      if (!args.noRender) {
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
  WIKI.logger.info(`Skipped (no matching <hr>): ${summary.skipped}`)
  if (!args.dryRun && summary.rendered > 0) {
    WIKI.logger.info(`Re-rendered: ${summary.rendered}`)
  }
  WIKI.logger.info(JSON.stringify(summary, null, 2))

  await WIKI.models.knex.destroy()
  process.exit(summary.errors.length > 0 ? 1 : 0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
