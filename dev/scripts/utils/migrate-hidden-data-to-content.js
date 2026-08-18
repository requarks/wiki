#!/usr/bin/env node
/**
 * Migrate per-page hidden-data blocks into page content as HTML.
 *
 * Primary source: pages.extra.js (Admin → Page Properties → Scripts tab).
 * Wiki.js injects extra.js into the page body via injectCode.body — that is why
 * hidden-data appears on the live site but not in pages.content.
 *
 * For each page this script:
 * 1. Finds the first <div class="hidden-data" ...></div> in extra.js, content, or render
 * 2. By default migrates only blocks with data-gdrive-url or data-archive-url (use --all-hidden-data for the rest)
 * 3. Appends the preserved block unchanged to pages.content
 * 4. Removes the block from extra.js (keeps other scripts such as redirects)
 * 5. Re-renders updated pages
 *
 * Usage (local dev container):
 *   docker exec wiki-app sh -c "dockerdev=1 node dev/scripts/utils/migrate-hidden-data-to-content.js --dry-run"
 *   docker exec wiki-app sh -c "dockerdev=1 node dev/scripts/utils/migrate-hidden-data-to-content.js"
 *
 * Options:
 *   --dry-run          Print changes without writing
 *   --no-render        Update content only, skip re-render
 *   --rerender-only    Re-render pages that already have embed hidden-data in content
 *   --all-hidden-data  Also migrate navigation-only hidden-data (no gdrive/archive)
 *   --locale=bn        Limit to one locale
 *   --path=1234        Limit to one page path
 */

const path = require('path')
const cheerio = require('cheerio')
const _ = require('lodash')

const HIDDEN_DATA_BLOCK_RE = /<div\s+class=["']hidden-data["'][^>]*>[\s\S]*?<\/div>/gi
const HIDDEN_DATA_BLOCK_SINGLE_RE = /<div\s+class=["']hidden-data["'][^>]*>[\s\S]*?<\/div>/i
const INJECT_SCRIPT_RE = /<script\b[^>]*>[\s\S]*?(?:loadiFrame|loadCommentsWidget|comments\.app|querySelector\(["']\.hidden-data|class=["']hidden-data)[\s\S]*?<\/script>/gi

function parseArgs (argv) {
  const args = {
    dryRun: false,
    noRender: false,
    rerenderOnly: false,
    embedOnly: true,
    locale: null,
    path: null
  }
  for (const arg of argv) {
    if (arg === '--dry-run') { args.dryRun = true }
    else if (arg === '--no-render') { args.noRender = true }
    else if (arg === '--rerender-only') { args.rerenderOnly = true }
    else if (arg === '--all-hidden-data') { args.embedOnly = false }
    else if (arg.startsWith('--locale=')) { args.locale = arg.slice('--locale='.length) }
    else if (arg.startsWith('--path=')) { args.path = arg.slice('--path='.length) }
  }
  return args
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

function extractHiddenDataBlock (text) {
  if (!text || typeof text !== 'string') { return null }
  HIDDEN_DATA_BLOCK_RE.lastIndex = 0
  const match = HIDDEN_DATA_BLOCK_SINGLE_RE.exec(text)
  HIDDEN_DATA_BLOCK_SINGLE_RE.lastIndex = 0
  return match ? match[0] : null
}

function extractHiddenData (content, render, extraJs) {
  const sources = [
    ['extra-js', extraJs],
    ['content', content],
    ['render', render]
  ]

  for (const [source, text] of sources) {
    let block = extractHiddenDataBlock(text)
    if (block) {
      return { block, source }
    }
  }

  if (content) {
    const scripts = content.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) || []
    for (const script of scripts) {
      const block = extractHiddenDataBlock(script)
      if (block) {
        return { block, source: 'content-script' }
      }
    }
  }

  return { block: null, source: null }
}

function stripHiddenDataBlocks (text) {
  let cleaned = text || ''
  cleaned = cleaned.replace(HIDDEN_DATA_BLOCK_RE, '')
  cleaned = cleaned.replace(INJECT_SCRIPT_RE, '')
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim()
  return cleaned
}

function contentAlreadyHasHiddenDataHtml (content, block) {
  if (!content || !block) { return false }
  const normalizedContent = content.replace(/\s+/g, ' ').trim()
  const normalizedBlock = block.replace(/\s+/g, ' ').trim()
  return normalizedContent.includes(normalizedBlock)
}

function hasInjectScripts (content) {
  INJECT_SCRIPT_RE.lastIndex = 0
  return INJECT_SCRIPT_RE.test(content || '')
}

function buildUpdatedContent (content, block) {
  if (!hasInjectScripts(content) && contentAlreadyHasHiddenDataHtml(content, block)) {
    return content || ''
  }
  const cleaned = stripHiddenDataBlocks(content)
  return `${cleaned}\n\n${block}\n`
}

function buildUpdatedExtra (extra, block) {
  const parsed = normalizeExtra(extra)
  return {
    css: parsed.css,
    js: stripHiddenDataBlocks(parsed.js)
  }
}

function blockHasGdriveUrl (block) {
  return /data-gdrive-url\s*=/.test(block || '')
}

function blockHasArchiveUrl (block) {
  return /data-archive-url\s*=/.test(block || '')
}

function isEmbedHiddenDataBlock (block) {
  return blockHasGdriveUrl(block) || blockHasArchiveUrl(block)
}

function needsMigration (page, block) {
  const extra = normalizeExtra(page.extra)
  const contentHasBlock = contentAlreadyHasHiddenDataHtml(page.content, block)
  const extraHasBlock = !!extractHiddenDataBlock(extra.js)
  const nextContent = buildUpdatedContent(page.content, block)
  const nextExtra = buildUpdatedExtra(page.extra, block)

  if (nextContent !== (page.content || '')) {
    return true
  }
  if (extraHasBlock && nextExtra.js !== extra.js) {
    return true
  }
  if (!contentHasBlock && block) {
    return true
  }
  return false
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
  WIKI.logger = require('../../../server/core/logger').init('MIGRATE-HIDDEN-DATA')

  WIKI.models = require('../../../server/core/db').init()
  await WIKI.configSvc.loadFromDb()
  await WIKI.configSvc.applyFlags()

  const dbTarget = {
    host: WIKI.config.db.host,
    port: WIKI.config.db.port,
    database: WIKI.config.db.db,
    user: WIKI.config.db.user
  }
  WIKI.logger.info(`Postgres target: ${dbTarget.user}@${dbTarget.host}:${dbTarget.port}/${dbTarget.database}`)
  WIKI.logger.info('Searching: pages.extra.js (primary), pages.content, pages.render')

  let query = WIKI.models.pages.query()
    .select('id', 'path', 'localeCode', 'title', 'content', 'render', 'extra', 'contentType', 'editorKey')

  if (args.locale) {
    query = query.where('localeCode', args.locale)
  }
  if (args.path) {
    query = query.where('path', args.path)
  }

  const pages = await query

  const preScan = await WIKI.models.knex('pages')
    .modify(qb => {
      if (args.locale) { qb.where('localeCode', args.locale) }
      if (args.path) { qb.where('path', args.path) }
    })
    .select(
      WIKI.models.knex.raw(`COUNT(*) FILTER (WHERE extra::text ILIKE '%hidden-data%') AS "hiddenInExtraJs"`),
      WIKI.models.knex.raw(`COUNT(*) FILTER (WHERE extra::text ILIKE '%data-gdrive-url%') AS "gdriveInExtra"`),
      WIKI.models.knex.raw(`COUNT(*) FILTER (WHERE extra::text ILIKE '%data-archive-url%') AS "archiveInExtra"`),
      WIKI.models.knex.raw(`COUNT(*) FILTER (WHERE extra::text ILIKE '%hidden-data%' AND (extra::text ILIKE '%data-gdrive-url%' OR extra::text ILIKE '%data-archive-url%')) AS "embedInExtra"`),
      WIKI.models.knex.raw(`COUNT(*) FILTER (WHERE content ILIKE '%hidden-data%' OR render ILIKE '%hidden-data%') AS "hiddenInContentOrRender"`)
    )
    .first()

  const downloadTagPages = await WIKI.models.knex('pages as p')
    .join('pageTags as pt', 'pt.pageId', 'p.id')
    .join('tags as t', 't.id', 'pt.tagId')
    .where('t.tag', 'download')
    .count('* as count')
    .first()

  const summary = {
    mode: args.embedOnly ? 'embed-only (gdrive/archive)' : 'all-hidden-data',
    scanned: pages.length,
    preScan: {
      hiddenInExtraJs: Number(preScan.hiddenInExtraJs || 0),
      gdriveInExtraJs: Number(preScan.gdriveInExtra || 0),
      archiveInExtraJs: Number(preScan.archiveInExtra || 0),
      embedInExtraJs: Number(preScan.embedInExtra || 0),
      hiddenInContentOrRender: Number(preScan.hiddenInContentOrRender || 0),
      pagesWithDownloadTag: Number(downloadTagPages.count || 0)
    },
    foundWithHiddenData: 0,
    foundWithGdriveUrl: 0,
    foundWithArchiveUrl: 0,
    foundEmbedPages: 0,
    skippedNavigationOnly: 0,
    foundBySource: {
      'extra-js': 0,
      content: 0,
      'content-script': 0,
      render: 0
    },
    updated: 0,
    withoutHiddenData: 0,
    alreadyInContent: 0,
    rendered: 0,
    foundPagesSample: [],
    errors: []
  }

  WIKI.logger.info(`Scanning ${pages.length} page(s)... dryRun=${args.dryRun} mode=${summary.mode}`)
  WIKI.logger.info(
    `Pre-scan: extra.js embed (gdrive/archive)=${summary.preScan.embedInExtraJs}, ` +
    `gdrive=${summary.preScan.gdriveInExtraJs}, archive=${summary.preScan.archiveInExtraJs}, ` +
    `all hidden-data=${summary.preScan.hiddenInExtraJs}, download tag pages=${summary.preScan.pagesWithDownloadTag}`
  )

  for (const page of pages) {
    try {
      const extra = normalizeExtra(page.extra)
      const { block, source } = extractHiddenData(page.content, page.render, extra.js)
      if (!block) {
        summary.withoutHiddenData++
        continue
      }

      summary.foundWithHiddenData++
      if (blockHasGdriveUrl(block)) { summary.foundWithGdriveUrl++ }
      if (blockHasArchiveUrl(block)) { summary.foundWithArchiveUrl++ }
      if (isEmbedHiddenDataBlock(block)) {
        summary.foundEmbedPages++
      }

      if (args.embedOnly && !isEmbedHiddenDataBlock(block)) {
        summary.skippedNavigationOnly++
        continue
      }

      summary.foundBySource[source] = (summary.foundBySource[source] || 0) + 1
      if (summary.foundPagesSample.length < 25) {
        summary.foundPagesSample.push({
          page: `${page.localeCode}/${page.path}`,
          title: page.title,
          source
        })
      }

      if (!needsMigration(page, block)) {
        summary.alreadyInContent++
        if (args.rerenderOnly && isEmbedHiddenDataBlock(block) && contentAlreadyHasHiddenDataHtml(page.content, block)) {
          if (args.dryRun) {
            WIKI.logger.info(`[RERENDER] ${page.localeCode}/${page.path} (${page.title})`)
          } else {
            await renderPage(page.id)
            summary.rendered++
          }
        }
        continue
      }

      const nextContent = buildUpdatedContent(page.content, block)
      const nextExtra = buildUpdatedExtra(page.extra, block)

      summary.updated++
      WIKI.logger.info(`[UPDATE] ${page.localeCode}/${page.path} (${page.title}) source=${source}`)

      if (args.dryRun) {
        WIKI.logger.info(`--- hidden-data block ---\n${block}\n--- end block ---`)
        continue
      }

      await WIKI.models.pages.query()
        .patch({
          content: nextContent,
          extra: nextExtra
        })
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

  WIKI.logger.info('Done.')
  const actionLabel = args.dryRun ? 'Will migrate' : 'Migrated'
  WIKI.logger.info('--- Summary ---')
  WIKI.logger.info(`Mode:                     ${summary.mode}`)
  WIKI.logger.info(`Pages scanned:            ${summary.scanned}`)
  WIKI.logger.info(`Embed pages (gdrive/archive): ${summary.foundEmbedPages}`)
  WIKI.logger.info(`  Google Drive URL:       ${summary.foundWithGdriveUrl}`)
  WIKI.logger.info(`  Archive URL:            ${summary.foundWithArchiveUrl}`)
  if (args.embedOnly) {
    WIKI.logger.info(`Skipped (navigation only):  ${summary.skippedNavigationOnly}`)
  }
  WIKI.logger.info(`Without hidden-data:      ${summary.withoutHiddenData}`)
  WIKI.logger.info(`${actionLabel} to page content: ${summary.updated}`)
  WIKI.logger.info(`Already in page content:  ${summary.alreadyInContent}`)
  if (!args.dryRun && summary.rendered > 0) {
    WIKI.logger.info(`Re-rendered:                ${summary.rendered}`)
  }
  WIKI.logger.info(JSON.stringify(summary, null, 2))

  await WIKI.models.knex.destroy()
  process.exit(summary.errors.length > 0 ? 1 : 0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
