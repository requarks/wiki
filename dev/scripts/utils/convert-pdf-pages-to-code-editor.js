#!/usr/bin/env node
/**
 * Convert Pdf: pages from Visual Editor (ckeditor) to Raw HTML (code editor).
 *
 * Both editors use contentType html, so only editorKey is updated — content is unchanged.
 *
 * Usage:
 *   docker exec wiki-app sh -c "dockerdev=1 node dev/scripts/utils/convert-pdf-pages-to-code-editor.js --dry-run"
 *   docker exec wiki-app sh -c "dockerdev=1 node dev/scripts/utils/convert-pdf-pages-to-code-editor.js"
 *
 * Options:
 *   --dry-run
 *   --locale=bn
 *   --path=3103
 */

const path = require('path')

const TARGET_EDITOR = 'code'
const SOURCE_EDITORS = ['ckeditor']

function parseArgs (argv) {
  const args = { dryRun: false, locale: null, path: null }
  for (const arg of argv) {
    if (arg === '--dry-run') { args.dryRun = true }
    else if (arg.startsWith('--locale=')) { args.locale = arg.slice('--locale='.length) }
    else if (arg.startsWith('--path=')) { args.path = arg.slice('--path='.length) }
  }
  return args
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
  WIKI.logger = require('../../../server/core/logger').init('CONVERT-PDF-EDITOR')

  WIKI.models = require('../../../server/core/db').init()
  await WIKI.configSvc.loadFromDb()
  await WIKI.configSvc.applyFlags()

  WIKI.logger.info(
    `Postgres: ${WIKI.config.db.user}@${WIKI.config.db.host}:${WIKI.config.db.port}/${WIKI.config.db.db}`
  )

  let query = WIKI.models.pages.query()
    .select('id', 'path', 'localeCode', 'title', 'editorKey')
    .where('title', 'like', 'Pdf:%')
    .whereIn('editorKey', SOURCE_EDITORS)

  if (args.locale) {
    query = query.where('localeCode', args.locale)
  }
  if (args.path) {
    query = query.where('path', args.path)
  }

  const pages = await query.orderBy('path', 'asc')

  const preScan = await WIKI.models.knex('pages')
    .modify(qb => {
      qb.where('title', 'like', 'Pdf:%')
      if (args.locale) { qb.where('localeCode', args.locale) }
      if (args.path) { qb.where('path', args.path) }
    })
    .select(
      WIKI.models.knex.raw(`COUNT(*) AS "totalPdf"`),
      WIKI.models.knex.raw(`COUNT(*) FILTER (WHERE "editorKey" = 'ckeditor') AS "ckeditor"`),
      WIKI.models.knex.raw(`COUNT(*) FILTER (WHERE "editorKey" = 'code') AS "code"`)
    )
    .first()

  const summary = {
    dryRun: args.dryRun,
    targetEditor: TARGET_EDITOR,
    preScan: {
      totalPdfTitlePages: Number(preScan.totalPdf || 0),
      alreadyCodeEditor: Number(preScan.code || 0),
      stillCkeEditor: Number(preScan.ckeditor || 0)
    },
    converted: 0,
    errors: []
  }

  WIKI.logger.info(`Pdf: pages — ckeditor=${summary.preScan.stillCkeEditor}, code=${summary.preScan.alreadyCodeEditor}`)
  WIKI.logger.info(`Will convert ${pages.length} page(s) to Raw HTML (code) ... dryRun=${args.dryRun}`)

  for (const page of pages) {
    try {
      WIKI.logger.info(`[CONVERT] ${page.localeCode}/${page.path} — ${page.title}`)
      if (!args.dryRun) {
        await WIKI.models.pages.query()
          .patch({ editorKey: TARGET_EDITOR })
          .where('id', page.id)
      }
      summary.converted++
    } catch (err) {
      summary.errors.push({ page: `${page.localeCode}/${page.path}`, message: err.message })
      WIKI.logger.error(`Failed on ${page.localeCode}/${page.path}: ${err.message}`)
    }
  }

  const actionLabel = args.dryRun ? 'Would convert' : 'Converted'
  WIKI.logger.info('Done.')
  WIKI.logger.info(`${actionLabel}: ${summary.converted} page(s) ckeditor → code`)
  WIKI.logger.info(JSON.stringify(summary, null, 2))

  await WIKI.models.knex.destroy()
  process.exit(summary.errors.length > 0 ? 1 : 0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
