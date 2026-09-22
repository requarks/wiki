const _ = require('lodash')
const fs = require('fs-extra')
const path = require('path')
const crypto = require('crypto')
const { Readable } = require('node:stream')
const { ZipWriter } = require('../helpers/zip')

/* global WIKI */

/**
 * .wkbackup package writer, for migrating a 2.x instance to 3.x.
 *
 * The package is a ZIP holding a manifest, a set of NDJSON record streams and
 * one content-addressed entry per distinct file. See dev/specs/wkbackup.md in
 * the 3.x repository for the format itself.
 *
 * Records are written in 2.x's own shape, with 2.x's integer ids left intact:
 * `source.kind: wikijs2` tells the 3.x importer to run the translation, and the
 * importer derives every UUID from those source ids. This exporter judges
 * nothing it cannot judge from here, and reports what it knows will not carry
 * over in `manifest.warnings`.
 */

const FORMAT_VERSION = 1
const EXPORTER_VERSION = '1.0.0'

// 2.x has no sites, so the single site it does have is named `default`.
const SITE_ID = 'default'

// A content or render field over this size spills to a blob, so that no single
// NDJSON line forces a multi-megabyte string through the reader's parser.
const BLOB_SPILL_THRESHOLD = 1024 * 1024

const BATCH_SIZE = {
  assets: 25,
  comments: 50,
  history: 10,
  pages: 10,
  tree: 100,
  users: 50
}

/**
 * Permissions Wiki.js 3.x knows about, as listed by its group editor.
 *
 * A 2.x permission missing from this set has no 3.x equivalent. It is carried
 * in the package as-is and reported in `manifest.warnings`, never remapped: an
 * unrecognised permission string silently never matches, so a wrong guess would
 * hide controls with no error anywhere.
 */
const WIKI3_PERMISSIONS = [
  'access:admin', 'delete:pages', 'manage:assets', 'manage:comments',
  'manage:groups', 'manage:navigation', 'manage:pages', 'manage:scim',
  'manage:sites', 'manage:storage', 'manage:system', 'manage:theme',
  'manage:users', 'manage:webhooks', 'read:assets', 'read:audit',
  'read:comments', 'read:groups', 'read:history', 'read:metrics',
  'read:pages', 'read:source', 'read:users', 'read:webhooks',
  'review:pages', 'write:assets', 'write:comments', 'write:groups',
  'write:pages', 'write:scripts', 'write:styles', 'write:tags',
  'write:users'
]

/**
 * Yield every row of a table in batches, so no table is ever fully resident.
 */
async function * batched (fetch, batchSize, onBatch) {
  let offset = 0
  while (true) {
    const rows = await fetch(offset, batchSize)
    // Stop only on an empty batch, and advance by what was actually consumed.
    // Treating a short batch as the end would silently truncate a stream the
    // moment a query returned fewer rows than it was asked for.
    if (rows.length < 1) { break }
    for (const row of rows) {
      yield row
    }
    if (onBatch) { onBatch(rows.length) }
    offset += rows.length
  }
}

/**
 * Turn an async iterable of records into a stream of NDJSON lines.
 */
function ndjson (records) {
  return Readable.from((async function * () {
    for await (const record of records) {
      yield Buffer.from(JSON.stringify(record) + '\n')
    }
  })())
}

function sha256 (buf) {
  return crypto.createHash('sha256').update(buf).digest('hex')
}

module.exports = {
  status: {
    status: 'notrunning',
    progress: 0,
    message: '',
    startedAt: null,
    filename: null,
    filePath: null,
    fileSize: null
  },

  /**
   * Directory holding generated packages. The operator downloads the file from
   * here; nothing ever expires it, because no server holds a package for the
   * import's sake.
   */
  get outputDir () {
    return path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'backup')
  },

  /**
   * Resolve a package filename to a path inside the backup directory, or null
   * if it names anything else.
   */
  resolveFile (filename) {
    if (!/^[A-Za-z0-9._-]+\.wkbackup$/.test(filename)) {
      return null
    }
    const target = path.resolve(this.outputDir, filename)
    if (path.dirname(target) !== this.outputDir) {
      return null
    }
    return target
  },

  /**
   * Generate a .wkbackup package.
   *
   * @param {Object} opts
   * @param {string[]} opts.entities Entities to include.
   */
  async create (opts) {
    const status = this.status
    const startedAt = new Date()

    status.status = 'running'
    status.progress = 0
    status.message = ''
    status.startedAt = startedAt
    status.filename = null
    status.filePath = null
    status.fileSize = null

    const entities = opts.entities
    const has = entity => entities.includes(entity)

    // Millisecond precision, so two runs never name the same file and abort
    // the earlier package's cleanup over a previous one.
    const filename = `wikijs-${startedAt.toISOString().replace(/[-:.]/g, '')}.wkbackup`
    const filePath = path.join(this.outputDir, filename)
    const tmpPath = path.join(this.outputDir, `.tmp-${startedAt.getTime()}`)

    WIKI.logger.info(`Backup started to ${filePath}`)
    WIKI.logger.info(`Entities to include: ${entities.join(', ')}`)

    const zip = new ZipWriter(filePath, { tmpPath })

    // Blobs referenced by the streams, written last. Content addressing makes
    // "have I already written this one?" answerable without any bookkeeping.
    const blobs = new Map()

    try {
      await fs.ensureDir(this.outputDir)
      await zip.open()

      // -----------------------------------------
      // COUNTS
      // -----------------------------------------
      // Counting first is what lets the manifest be written as the first entry
      // with real counts, while the streams are produced afterwards.
      const counts = {
        assets: has('assets') ? await this.countOf(WIKI.models.assets) : 0,
        comments: has('comments') ? await this.countOf(WIKI.models.comments) : 0,
        groups: has('groups') ? await this.countOf(WIKI.models.groups) : 0,
        history: has('history') ? await this.countOf(WIKI.models.pageHistory) : 0,
        locales: await this.countOf(WIKI.models.locales),
        pages: has('pages') ? await this.countOf(WIKI.models.pages) : 0,
        tree: has('pages') ? await this.countOfFolders() : 0,
        users: has('users') ? await this.countOf(WIKI.models.users) : 0
      }
      const blobBytes = has('assets') ? await this.sumAssetBytes() : 0

      const warnings = await this.collectWarnings(entities)

      // -> Steps, for progress reporting
      const steps = ['manifest']
      if (has('settings')) { steps.push('settings') }
      steps.push('locales')
      if (has('groups')) { steps.push('groups') }
      if (has('users')) { steps.push('users') }
      steps.push('site')
      if (has('navigation')) { steps.push('navigation') }
      if (has('pages')) { steps.push('tree', 'pages') }
      if (has('history')) { steps.push('history') }
      if (has('comments')) { steps.push('comments') }
      if (has('assets')) { steps.push('assets') }
      steps.push('blobs')

      let doneSteps = 0
      const stepDone = () => {
        doneSteps++
        status.progress = Math.min(100, (doneSteps / steps.length) * 100)
      }
      // Report partial progress through the step currently being written.
      const stepPartial = fraction => {
        status.progress = Math.min(100, ((doneSteps + Math.min(1, fraction)) / steps.length) * 100)
      }
      // Track a streamed step of `total` records, batch by batch.
      const batchTracker = (name, total) => {
        let done = 0
        const track = rows => {
          done += rows
          stepPartial(total > 0 ? done / total : 1)
        }
        // The manifest's count is written before the stream and is what the
        // importer uses as its denominator, so a stream that does not hold
        // exactly that many records is worth saying out loud rather than
        // handing over a quietly wrong package. Rows added or removed while a
        // long export runs can account for a small difference.
        track.verify = () => {
          if (done !== total) {
            WIKI.logger.warn(`Backup: ${name} stream holds ${done} records, but the manifest counted ${total}.`)
          }
        }
        return track
      }

      // -----------------------------------------
      // MANIFEST — always the first entry
      // -----------------------------------------
      const streams = {}
      const siteStreams = {}

      if (has('settings')) { streams.settings = { schema: 1, path: 'streams/settings.json' } }
      streams.locales = { schema: 1, path: 'streams/locales.ndjson', count: counts.locales }
      if (has('groups')) { streams.groups = { schema: 1, path: 'streams/groups.ndjson', count: counts.groups } }
      if (has('users')) { streams.users = { schema: 1, path: 'streams/users.ndjson', count: counts.users } }

      const sitePath = `sites/${SITE_ID}`
      if (has('navigation')) { siteStreams.navigation = { schema: 1, path: `${sitePath}/navigation.json` } }
      if (has('pages')) {
        siteStreams.tree = { schema: 1, path: `${sitePath}/tree.ndjson`, count: counts.tree }
        siteStreams.pages = { schema: 1, path: `${sitePath}/pages.ndjson`, count: counts.pages }
      }
      if (has('history')) { siteStreams['page-history'] = { schema: 1, path: `${sitePath}/page-history.ndjson`, count: counts.history } }
      if (has('comments')) { siteStreams.comments = { schema: 1, path: `${sitePath}/comments.ndjson`, count: counts.comments } }
      if (has('assets')) { siteStreams.assets = { schema: 1, path: `${sitePath}/assets.ndjson`, count: counts.assets, blobBytes } }

      const manifest = {
        format: 'wkbackup',
        formatVersion: FORMAT_VERSION,
        createdAt: startedAt.toISOString(),
        generator: {
          product: 'wiki.js',
          version: WIKI.version,
          exporter: EXPORTER_VERSION
        },
        source: {
          kind: 'wikijs2',
          instanceId: _.get(WIKI.config, 'telemetry.clientId', null),
          baseUrl: WIKI.config.host
        },
        streams,
        sites: [
          {
            id: SITE_ID,
            title: WIKI.config.title,
            hostname: WIKI.config.host,
            locales: _.union([WIKI.config.lang.code], _.get(WIKI.config, 'lang.namespaces', [])),
            streams: siteStreams
          }
        ],
        options: { includes: entities },
        warnings
      }
      await zip.addBuffer('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)))
      stepDone()

      // -----------------------------------------
      // SETTINGS
      // -----------------------------------------
      // Written whole, keyed as 2.x keys it. The exporter cannot know which
      // version will read the package, so the importer owns the mapping.
      if (has('settings')) {
        WIKI.logger.info('Backup: writing settings...')
        const settings = {
          // The database connection is this instance's own, credentials and
          // all, and a 3.x import has no use for it.
          ..._.omit(WIKI.config, ['db']),
          modules: {
            analytics: await WIKI.models.analytics.query(),
            authentication: (await WIKI.models.authentication.query()).map(a => ({
              ...a,
              domainWhitelist: _.get(a, 'domainWhitelist.v', []),
              autoEnrollGroups: _.get(a, 'autoEnrollGroups.v', [])
            })),
            commentProviders: await WIKI.models.commentProviders.query(),
            renderers: await WIKI.models.renderers.query(),
            searchEngines: await WIKI.models.searchEngines.query(),
            storage: await WIKI.models.storage.query()
          },
          apiKeys: await WIKI.models.apiKeys.query().where('isRevoked', false)
        }
        await zip.addBuffer('streams/settings.json', Buffer.from(JSON.stringify(settings, null, 2)))
        stepDone()
      }

      // -----------------------------------------
      // LOCALES
      // -----------------------------------------
      // Codes only; the string sets themselves are 3.x's own.
      WIKI.logger.info('Backup: writing locales...')
      const primaryLocale = WIKI.config.lang.code
      const activeLocales = _.union([primaryLocale], _.get(WIKI.config, 'lang.namespaces', []))
      const locales = await WIKI.models.locales.query()
        .select('code', 'name', 'nativeName', 'isRTL', 'availability', 'createdAt', 'updatedAt')
        .orderBy('code')
      await zip.addStream('streams/locales.ndjson', ndjson(locales.map(lc => ({
        ...lc,
        isPrimary: lc.code === primaryLocale,
        isActive: activeLocales.includes(lc.code)
      }))))
      stepDone()

      // -----------------------------------------
      // GROUPS
      // -----------------------------------------
      if (has('groups')) {
        WIKI.logger.info('Backup: writing groups...')
        const groups = await WIKI.models.groups.query().orderBy('id')
        await zip.addStream('streams/groups.ndjson', ndjson(groups))
        stepDone()
      }

      // -----------------------------------------
      // USERS
      // -----------------------------------------
      // Password hashes and TOTP secrets travel as-is: both versions use
      // bcryptjs at cost 12 and plain RFC 6238 TOTP, so nobody has to reset a
      // password or re-enrol an authenticator after the migration.
      if (has('users')) {
        WIKI.logger.info(`Backup: writing ${counts.users} users...`)
        const onBatch = batchTracker('users', counts.users)
        await zip.addStream('streams/users.ndjson', ndjson(batched(async (offset, limit) => {
          const users = await WIKI.models.users.query()
            .orderBy('id').offset(offset).limit(limit)
            .withGraphFetched({ groups: true })
            .modifyGraph('groups', builder => builder.select('groups.id', 'groups.name'))
          return users.map(usr => ({
            ..._.omit(usr, ['groups']),
            groups: usr.groups.map(g => g.id)
          }))
        }, BATCH_SIZE.users, onBatch)))
        onBatch.verify()
        stepDone()
      }

      // -----------------------------------------
      // SITE
      // -----------------------------------------
      WIKI.logger.info('Backup: writing site settings...')
      await zip.addBuffer(`${sitePath}/site.json`, Buffer.from(JSON.stringify({
        id: SITE_ID,
        title: WIKI.config.title,
        hostname: WIKI.config.host,
        company: WIKI.config.company,
        contentLicense: WIKI.config.contentLicense,
        footerOverride: WIKI.config.footerOverride,
        logoUrl: WIKI.config.logoUrl,
        pageExtensions: WIKI.config.pageExtensions,
        locales: {
          primary: primaryLocale,
          active: activeLocales,
          namespacing: _.get(WIKI.config, 'lang.namespacing', false)
        },
        theme: WIKI.config.theming,
        features: WIKI.config.features,
        security: WIKI.config.security,
        seo: WIKI.config.seo,
        editShortcuts: WIKI.config.editShortcuts,
        uploads: WIKI.config.uploads
      }, null, 2)))
      stepDone()

      // -----------------------------------------
      // NAVIGATION
      // -----------------------------------------
      // 2.x keeps one tree per locale; the importer turns each into the
      // site-wide menu for its locale.
      if (has('navigation')) {
        WIKI.logger.info('Backup: writing navigation...')
        const navigationRaw = await WIKI.models.navigation.query()
        const navigation = navigationRaw.reduce((obj, cur) => {
          obj[cur.key] = cur.config
          return obj
        }, {})
        await zip.addBuffer(`${sitePath}/navigation.json`, Buffer.from(JSON.stringify({
          mode: _.get(WIKI.config, 'nav.mode', 'MIXED'),
          trees: navigation
        }, null, 2)))
        stepDone()
      }

      // -----------------------------------------
      // TREE (folders)
      // -----------------------------------------
      if (has('pages')) {
        WIKI.logger.info(`Backup: writing ${counts.tree} folders...`)
        const onBatch = batchTracker('tree', counts.tree)
        await zip.addStream(`${sitePath}/tree.ndjson`, ndjson(batched(async (offset, limit) => {
          return WIKI.models.knex('pageTree')
            .select('id', 'path', 'depth', 'title', 'isPrivate', 'privateNS', 'parent', 'localeCode')
            .where('isFolder', true)
            .orderBy('id').offset(offset).limit(limit)
        }, BATCH_SIZE.tree, onBatch)))
        onBatch.verify()
        stepDone()

        // -----------------------------------------
        // PAGES
        // -----------------------------------------
        // The render is deliberately left behind: 3.x renders differently
        // enough that a 2.x render would be silently wrong under it, and a
        // stored render says nothing about which pipeline produced it. 3.x
        // produces the HTML itself.
        WIKI.logger.info(`Backup: writing ${counts.pages} pages...`)
        const onPageBatch = batchTracker('pages', counts.pages)
        await zip.addStream(`${sitePath}/pages.ndjson`, ndjson(batched(async (offset, limit) => {
          const pages = await WIKI.models.pages.query()
            .orderBy('id').offset(offset).limit(limit)
            .withGraphFetched({ tags: true })
            .modifyGraph('tags', builder => builder.select('tags.tag', 'tags.title'))
          return Promise.all(pages.map(page => this.spillContent({
            ..._.omit(page, ['render', 'toc']),
            tags: page.tags.map(t => t.tag)
          }, tmpPath, blobs)))
        }, BATCH_SIZE.pages, onPageBatch)))
        onPageBatch.verify()
        stepDone()
      }

      // -----------------------------------------
      // PAGE HISTORY
      // -----------------------------------------
      if (has('history')) {
        WIKI.logger.info(`Backup: writing ${counts.history} page history entries...`)
        const onBatch = batchTracker('history', counts.history)
        await zip.addStream(`${sitePath}/page-history.ndjson`, ndjson(batched(async (offset, limit) => {
          const versions = await WIKI.models.pageHistory.query()
            .orderBy('id').offset(offset).limit(limit)
            .withGraphFetched({ tags: true })
            .modifyGraph('tags', builder => builder.select('tags.tag', 'tags.title'))
          return Promise.all(versions.map(version => this.spillContent({
            ...version,
            tags: version.tags.map(t => t.tag)
          }, tmpPath, blobs)))
        }, BATCH_SIZE.history, onBatch)))
        onBatch.verify()
        stepDone()
      }

      // -----------------------------------------
      // COMMENTS
      // -----------------------------------------
      if (has('comments')) {
        WIKI.logger.info(`Backup: writing ${counts.comments} comments...`)
        const onBatch = batchTracker('comments', counts.comments)
        await zip.addStream(`${sitePath}/comments.ndjson`, ndjson(batched(async (offset, limit) => {
          return WIKI.models.comments.query().orderBy('id').offset(offset).limit(limit)
        }, BATCH_SIZE.comments, onBatch)))
        onBatch.verify()
        stepDone()
      }

      // -----------------------------------------
      // ASSETS
      // -----------------------------------------
      // Metadata only; the bytes go to blobs/, keyed by their own digest.
      if (has('assets')) {
        WIKI.logger.info(`Backup: writing ${counts.assets} assets...`)
        const assetFolders = await WIKI.models.assetFolders.getAllPaths()
        const onBatch = batchTracker('assets', counts.assets)
        await zip.addStream(`${sitePath}/assets.ndjson`, ndjson(batched(async (offset, limit) => {
          const assets = await WIKI.models.knex
            .select('assets.*', 'assetData.data')
            .from('assets')
            .join('assetData', 'assets.id', '=', 'assetData.id')
            .orderBy('assets.id').offset(offset).limit(limit)
          return assets.map(asset => {
            const digest = sha256(asset.data)
            if (!blobs.has(digest)) {
              blobs.set(digest, { kind: 'asset', id: asset.id })
            }
            return {
              ..._.omit(asset, ['data']),
              // 2.x's `hash` is a digest of the path, not of the contents.
              folderPath: (asset.folderId && asset.folderId > 0) ? _.get(assetFolders, asset.folderId, '') : '',
              blob: digest
            }
          })
        }, BATCH_SIZE.assets, onBatch)))
        onBatch.verify()
        stepDone()
      }

      // -----------------------------------------
      // BLOBS
      // -----------------------------------------
      // One entry per distinct file, named after its own digest, stored rather
      // than deflated: deflating a JPEG costs CPU on both ends to make it very
      // slightly larger. Oversized page content spilled here too.
      WIKI.logger.info(`Backup: writing ${blobs.size} blobs...`)
      let doneBlobs = 0
      for (const [digest, ref] of blobs) {
        const data = ref.kind === 'asset' ? _.get(
          await WIKI.models.knex('assetData').select('data').where('id', ref.id).first(),
          'data',
          null
        ) : await fs.readFile(ref.path)
        if (!data) {
          WIKI.logger.warn(`Backup: blob ${digest} has no data, skipping...`)
          continue
        }
        await zip.addBuffer(`blobs/${digest}`, data, { compress: false })
        doneBlobs++
        stepPartial(doneBlobs / blobs.size)
      }
      stepDone()

      await zip.close()

      const { size } = await fs.stat(filePath)
      status.status = 'success'
      status.progress = 100
      status.filename = filename
      status.filePath = filePath
      status.fileSize = size
      WIKI.logger.info(`Backup completed: ${filePath} (${size} bytes)`)
    } catch (err) {
      WIKI.logger.warn(err)
      status.status = 'error'
      status.message = err.message
      await zip.abort().catch(() => {})
    } finally {
      await fs.remove(tmpPath).catch(() => {})
    }
  },

  async countOf (model) {
    const result = await model.query().count('* as total').first()
    return parseInt(result.total)
  },

  async countOfFolders () {
    const result = await WIKI.models.knex('pageTree').where('isFolder', true).count('* as total').first()
    return parseInt(result.total)
  },

  async sumAssetBytes () {
    const result = await WIKI.models.knex('assets').sum('fileSize as total').first()
    return parseInt(_.get(result, 'total', 0)) || 0
  },

  /**
   * Move an oversized `content` field out to a blob, so that no NDJSON line
   * forces a multi-megabyte string through the reader's parser.
   */
  async spillContent (record, tmpPath, blobs) {
    if (!record.content || Buffer.byteLength(record.content, 'utf8') <= BLOB_SPILL_THRESHOLD) {
      return record
    }
    const data = Buffer.from(record.content, 'utf8')
    const digest = sha256(data)
    if (!blobs.has(digest)) {
      const spillPath = path.join(tmpPath, `spill-${digest}`)
      await fs.outputFile(spillPath, data)
      blobs.set(digest, { kind: 'file', path: spillPath })
    }
    return { ...record, content: null, contentBlob: digest }
  },

  /**
   * Things this exporter knows will not carry over, written into the manifest
   * and shown in the import log before the import starts.
   */
  async collectWarnings (entities) {
    const warnings = []

    if (entities.includes('groups')) {
      const groups = await WIKI.models.groups.query().select('id', 'name', 'permissions')
      const unmappable = new Set()
      for (const group of groups) {
        for (const permission of (group.permissions || [])) {
          if (!WIKI3_PERMISSIONS.includes(permission)) {
            unmappable.add(permission)
          }
        }
      }
      if (unmappable.size > 0) {
        warnings.push(`Permissions with no Wiki.js 3.x equivalent will be dropped on import: ${[...unmappable].sort().join(', ')}.`)
      }
    }

    if (entities.includes('pages') || entities.includes('history')) {
      warnings.push('Page renders are not carried over. Wiki.js 3.x renders pages with its own pipeline, so imported pages are re-rendered in the background.')
    }

    if (entities.includes('comments')) {
      const provider = await WIKI.models.commentProviders.query().where('isEnabled', true).first()
      if (provider && provider.key !== 'default') {
        warnings.push(`Comments are handled by the '${provider.key}' provider on this instance; only comments stored by the default provider are included.`)
      }
    }

    if (entities.includes('assets')) {
      warnings.push('Asset folders are carried on each asset as `folderPath`; Wiki.js 2.x has no shared tree for them.')
    }

    if (entities.includes('settings')) {
      warnings.push('Settings are exported in full, keyed as Wiki.js 2.x keys them. The importer applies the keys that have a 3.x equivalent and reports the rest.')
    }

    const missing = ['assets', 'comments', 'groups', 'history', 'navigation', 'pages', 'settings', 'users'].filter(e => !entities.includes(e))
    if (missing.length > 0) {
      warnings.push(`Not included in this package: ${missing.join(', ')}.`)
    }

    return warnings
  }
}
