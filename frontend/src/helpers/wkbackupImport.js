import { inBatches, openPackage, readBytes, readJson, readRecords, sha256Hex } from './wkbackup'

/**
 * Driving an import of a `.wkbackup` package from the browser.
 *
 * `dev/specs/wkbackup.md` is the design and §11 has the order of operations this follows. The reader
 * is `helpers/wkbackup.js`; this is the half that knows what the records MEAN and which endpoint each
 * stream goes to.
 *
 * It reports as it goes rather than returning at the end: an import of a large wiki runs for hours,
 * so `log` and `onProgress` are how it is watched, and the value it resolves to is only the summary.
 */

/** Records per request. The server's own ceiling — see `MAX_BATCH_RECORDS` in `models/import.ts`. */
const BATCH_SIZE = 500

/**
 * What a batch aims to weigh, in UTF-16 code units of JSON.
 *
 * A quarter of the server's `MAX_BATCH_BYTES`, and the gap is deliberate: the measure under-counts
 * bytes by up to 3x for text outside Latin-1, so a budget at the ceiling would be a 413 for every
 * wiki written in Chinese, Japanese, Korean, Greek, Cyrillic or Arabic. `postBatch` halves anything
 * that is refused anyway, so this only has to be close.
 */
const BATCH_BYTES = 4 * 1024 * 1024

/**
 * The order the streams are walked in, and it is load-bearing.
 *
 * Instance-wide first: a page needs an author and a comment needs one too, and both are resolved by
 * email against the accounts that exist at the time — so a users stream that ran afterwards would
 * leave every record attributed to whoever pressed the button. Groups before users for the same
 * reason one rung down, since a user record names the groups it belongs to.
 *
 * Then, per site: folders (so a folder somebody titled *Guides* is not created as *guides* by the
 * first page filed under it), pages, then the history and comments that hang off them, then assets,
 * then navigation.
 */
const INSTANCE_STREAMS = [
  { name: 'locales', requires: null },
  { name: 'groups', requires: 'groups' },
  { name: 'users', requires: 'users' }
]

const SITE_STREAMS = [
  { name: 'tree', requires: null },
  { name: 'pages', requires: 'pages' },
  { name: 'page-history', requires: 'history' },
  { name: 'assets', requires: 'assets' },
  { name: 'comments', requires: 'comments' }
]

/**
 * Import one package.
 *
 * @param file       The `.wkbackup` the operator picked
 * @param siteId     The site on this instance everything site-scoped lands in
 * @param includes   The content kinds ticked in the overlay
 * @param overwrite  Whether an existing record is replaced
 * @param log        `(level, message)` — `info` / `success` / `warn` / `error`
 * @param onProgress `(fraction)` from 0 to 1
 */
export async function runImport({ file, siteId, includes, overwrite, log, onProgress }) {
  const pkg = await openPackage(file)
  try {
    return await drive({ pkg, siteId, includes, overwrite, log, onProgress })
  } finally {
    await pkg.close()
  }
}

async function drive({ pkg, siteId, includes, overwrite, log, onProgress }) {
  const { manifest } = pkg
  log(
    'info',
    `Package written ${manifest.createdAt ?? 'at an unknown date'} by ${describeGenerator(manifest)}.`
  )

  /*
    Everything answerable from the manifest, before a single record is written. The server owns this
    question rather than the browser: what this wiki can read is what this wiki knows.
  */
  const preflight = await API_CLIENT.post('import/preflight', {
    json: { manifest, siteId }
  }).json()
  for (const warning of preflight.warnings) {
    log('warn', warning)
  }
  if (!preflight.ok) {
    for (const error of preflight.errors) {
      log('error', error)
    }
    throw new Error(preflight.errors[0] ?? 'This package cannot be imported.')
  }
  log('info', 'Package checked.')

  // -> A 2.x package always holds exactly one site; a multi-site package is reported by preflight
  const packageSite = manifest.sites[0]
  const sourceId = String(packageSite.id ?? 'default')

  const session = await API_CLIENT.post('import/sessions', {
    json: {
      source: manifest.source.kind,
      // -> Part of what the server derives this import's record ids from, so that running the same
      //    package again after a failure upserts instead of laying down a second copy of everything
      //    that has no natural key
      sourceInstanceId: manifest.source.instanceId ?? '',
      sites: [{ sourceId, siteId }],
      includes,
      overwrite
    }
  }).json()
  log('info', `Import session opened.`)

  const plan = buildPlan({ manifest, packageSite, includes, log })
  const progress = { done: 0, total: Math.max(plan.total, 1) }
  const advance = (n) => {
    progress.done += n
    onProgress(Math.min(1, progress.done / progress.total))
  }
  onProgress(0)

  /** Blobs already staged this session, so one shared by forty records is uploaded once. */
  const staged = new Set()

  for (const step of plan.steps) {
    const label = step.label
    log('info', `${label}: starting (${step.count === null ? 'unknown' : step.count} records)...`)
    const totals = { imported: 0, skipped: 0 }

    let read = 0
    if (step.kind === 'json') {
      const records = await step.read(pkg)
      read = records.length
      const result = await postBatch(step.url(session, siteId), records, label, log)
      tally(totals, result, log)
      advance(step.count ?? records.length)
    } else {
      for await (const batch of inBatches(
        readRecords(pkg.entry(step.path), {
          onMalformed: () => log('warn', `${label}: a record could not be read and was skipped.`)
        }),
        { maxRecords: BATCH_SIZE, maxBytes: BATCH_BYTES }
      )) {
        read += batch.length
        await stageBlobsFor({ pkg, session, batch, staged, log })
        const result = await postBatch(step.url(session, siteId), batch, label, log)
        tally(totals, result, log)
        advance(batch.length)
      }
    }

    /*
      The manifest counts the records the exporter meant to write; this is how many were actually
      there. When they disagree the package is short, and saying so plainly is the difference between
      "the import lost my pages" and "the export only wrote nine of them" — which are fixed in
      completely different places, and only one of them here.

      A shortfall cascades: everything hanging off the missing records is skipped too, so the log
      below this line fills with history and comments that have nowhere to go. This is the line that
      explains those, which is why it says what it says.
    */
    if (step.count !== null && read !== step.count) {
      const verb = read < step.count ? 'only held' : 'held'
      log(
        'warn',
        `${label}: the package says it contains ${step.count} records but the stream ${verb} ${read}. The package itself is incomplete \u2014 nothing below can import what is not in it.`
      )
    }
    log('info', `${label}: ${totals.imported} imported, ${totals.skipped} skipped.`)
  }

  const summary = await API_CLIENT.post(`import/sessions/${session.id}/finish`).json()
  reportSummary(summary, log)
  onProgress(1)
  return summary
}

/**
 * What will be read, and how many records that is.
 *
 * Built up front from the manifest's counts, which is what makes the progress bar a real fraction
 * rather than a spinner — the counts are in the central directory's first entry, so they are known
 * before anything has been inflated.
 */
function buildPlan({ manifest, packageSite, includes, log }) {
  const steps = []
  let total = 0

  const add = (step) => {
    steps.push(step)
    total += step.count ?? 0
  }

  for (const { name, requires } of INSTANCE_STREAMS) {
    const declared = manifest.streams?.[name]
    if (!declared?.path || (requires && !includes.includes(requires))) {
      continue
    }
    add({
      kind: 'ndjson',
      label: labelFor(name),
      path: declared.path,
      count: declared.count ?? null,
      url: (session) => `import/sessions/${session.id}/streams/${name}`
    })
  }

  /*
    The site's own settings, and they go FIRST of everything site-scoped.

    Not cosmetic ordering: `pageExtensions` is what decides whether an uploaded file is really a page,
    so an asset imported before that setting lands is judged by the wrong list. The locales are the
    same story one level up — content arrives in them, and they should exist first.

    One document, and the only one the manifest does not declare: the exporter writes it
    unconditionally at a path the format fixes (`dev/specs/wkbackup.md` §2), so it is read by
    convention rather than looked up. Absent, the step contributes nothing.
  */
  if (includes.includes('settings')) {
    add({
      kind: 'json',
      label: labelFor('site'),
      count: null,
      url: (session, siteId) => `import/sessions/${session.id}/sites/${siteId}/streams/site`,
      read: async (pkg) => {
        const entry = pkg.entry(`sites/${packageSite.id ?? 'default'}/site.json`)
        if (!entry) {
          log('warn', 'Settings: the package carries no site.json.')
          return []
        }
        return [await readJson(entry)]
      }
    })
  }

  for (const { name, requires } of SITE_STREAMS) {
    const declared = packageSite.streams?.[name]
    if (!declared?.path || (requires && !includes.includes(requires))) {
      continue
    }
    add({
      kind: 'ndjson',
      label: labelFor(name),
      path: declared.path,
      count: declared.count ?? null,
      url: (session, siteId) => `import/sessions/${session.id}/sites/${siteId}/streams/${name}`
    })
  }

  /*
    Navigation is one document rather than a stream — a whole menu is a single column here, so a batch
    of halves would be a sidebar that flickered between them.

    `{ mode, trees: { <key>: <config> } }` is what the 2.x exporter writes, keyed by 2.x's
    `navigation.key`. **Neither half of that key/value pair is what it looks like.**

    The key is not a locale: 2.x keeps its one site-wide tree under the literal `site`
    (`idColumn = 'key'`, `findOne('key', 'site')` in its navigation model). And the value is not a
    list of menu items — it is a list of PER-LOCALE TREES, `[{ locale, items }]`, which is what that
    model iterates to fill `nav:sidebar:<locale>`. So the locale comes from inside the config and the
    key carries nothing at all.

    Reading the config as items produces one blank link per locale, which imports, reports success and
    draws an empty sidebar. That is what this looked like the first two times.

    The one exception is 2.x's own: a config whose first entry has a `kind` is the pre-2.3 flat format,
    and 2.x reads that as locale `en`. Handled here because the exporter writes the column raw, so a
    wiki that has not re-saved its navigation since 2.2 still exports the old shape.
  */
  const nav = packageSite.streams?.navigation
  if (nav?.path && includes.includes('navigation')) {
    add({
      kind: 'json',
      label: labelFor('navigation'),
      count: null,
      url: (session, siteId) => `import/sessions/${session.id}/sites/${siteId}/streams/navigation`,
      read: async (pkg) => {
        const entry = pkg.entry(nav.path)
        if (!entry) {
          return []
        }
        const document = await readJson(entry)
        const primary = packageSite.locales?.length > 0 ? packageSite.locales[0] : 'en'
        const trees = []
        for (const config of Object.values(document?.trees ?? {})) {
          if (!Array.isArray(config) || config.length < 1) {
            continue
          }
          // -> Pre-2.3: a flat list of items, which 2.x itself reads as the `en` tree
          if (config[0]?.kind) {
            trees.push({ localeCode: 'en', items: config })
            continue
          }
          for (const tree of config) {
            if (Array.isArray(tree?.items)) {
              trees.push({ localeCode: tree.locale || primary, items: tree.items })
            }
          }
        }
        /*
          Said out loud per tree. A sidebar that lands in the wrong locale, or that is built out of
          the wrong level of the document, is invisible rather than wrong — it reports success and
          draws nothing — so the log has to carry enough to tell those apart without a database.
        */
        for (const tree of trees) {
          log('info', `Navigation: ${tree.items.length} items for the ${tree.localeCode} sidebar.`)
        }
        if (trees.length < 1) {
          log('warn', 'Navigation: the package holds no menu this wiki could read.')
        }
        return trees
      }
    })
  }

  return { steps, total }
}

/**
 * Upload the blobs a batch is about to reference, once each.
 *
 * Demand-driven rather than a phase of its own: a package's `blobs/` holds every asset in the wiki,
 * and an import of pages alone has no business uploading eight gigabytes of images nobody asked for.
 * Content addressing is what makes this safe to do per batch — "have I already sent this?" is a
 * question about the digest and nothing else.
 */
async function stageBlobsFor({ pkg, session, batch, staged, log }) {
  const wanted = new Set()
  for (const record of batch) {
    for (const digest of [record?.blob, record?.contentBlob]) {
      if (typeof digest === 'string' && digest && !staged.has(digest)) {
        wanted.add(digest)
      }
    }
  }
  for (const digest of wanted) {
    const entry = pkg.entry(`blobs/${digest}`)
    if (!entry) {
      log('warn', `A file the package refers to (${digest.slice(0, 12)}…) is missing from it.`)
      // -> Marked as seen either way, so a blob forty records share is reported once rather than forty
      //    times; the records themselves are then skipped by the server, which says which they were
      staged.add(digest)
      continue
    }
    const bytes = await readBytes(entry)
    const actual = await sha256Hex(bytes)
    if (actual !== digest) {
      log(
        'warn',
        `A file in the package does not match its checksum (${digest.slice(0, 12)}…) and was not imported.`
      )
      staged.add(digest)
      continue
    }
    await API_CLIENT.post(`import/sessions/${session.id}/blobs/${digest}`, {
      body: bytes,
      headers: { 'content-type': 'application/octet-stream' }
    })
    staged.add(digest)
  }
}

/**
 * Post a batch, halving it if the server says it is too large.
 *
 * The size budget above is an estimate over a format this code does not control, so it will sometimes
 * be wrong — a wiki written in a script where one character is three bytes, a page carrying a base64
 * image inline. Halving converges in a handful of requests and needs no tuning, which is a better
 * answer than a constant somebody has to guess right for every wiki in the world.
 *
 * A single record the server still refuses is skipped rather than fatal: one page too large to send
 * is a page to go and look at, not a reason to abandon the other eleven thousand. It is named in the
 * log, which is the only place anybody could act on it.
 */
async function postBatch(url, records, label, log) {
  try {
    return await API_CLIENT.post(url, { json: { records } }).json()
  } catch (err) {
    if (err.response?.status !== 413) {
      throw err
    }
    if (records.length < 2) {
      log('warn', `${label}: one record is too large to send and was skipped.`)
      return { imported: 0, skipped: 1, warnings: [] }
    }
    const half = Math.ceil(records.length / 2)
    const first = await postBatch(url, records.slice(0, half), label, log)
    const second = await postBatch(url, records.slice(half), label, log)
    return {
      imported: first.imported + second.imported,
      skipped: first.skipped + second.skipped,
      warnings: [...(first.warnings ?? []), ...(second.warnings ?? [])]
    }
  }
}

function tally(totals, result, log) {
  totals.imported += result.imported ?? 0
  totals.skipped += result.skipped ?? 0
  for (const warning of result.warnings ?? []) {
    log('warn', warning)
  }
}

function reportSummary(summary, log) {
  const written = Object.entries(summary.progress ?? {})
    .map(([stream, count]) => `${count} ${labelFor(stream).toLowerCase()}`)
    .join(', ')
  // -> The one line reporting the whole run rather than a step of it, and the one somebody watching a
  //    long import is waiting for. `success` is what the log panel draws bold and green.
  log('success', `Import finished. ${written || 'Nothing was written.'}`)

  /*
    The one thing an operator has to be told about a 2.x import: a page arrives with no HTML, because
    a 2.x render is 2.x's output and would be wrong here in ways nothing could later detect. The queue
    that produces the real ones is a single headless browser doing a single page at a time.
  */
  if (summary.pendingRenders > 0) {
    log(
      'info',
      `${summary.pendingRenders} pages are waiting to be rendered. They will fill in as the renderer works through them.`
    )
  }
  if (summary.unrenderable > 0) {
    log(
      'warn',
      `${summary.unrenderable} pages cannot be rendered by the server and will stay blank until somebody opens and saves them.`
    )
  }
}

function describeGenerator(manifest) {
  const product = manifest.generator?.product ?? 'an unknown tool'
  const version = manifest.generator?.version
  return version ? `${product} ${version}` : product
}

const LABELS = {
  site: 'Settings',
  locales: 'Locales',
  groups: 'Groups',
  users: 'Users',
  tree: 'Folders',
  pages: 'Pages',
  'page-history': 'Page history',
  assets: 'Assets',
  comments: 'Comments',
  navigation: 'Navigation'
}

function labelFor(stream) {
  return LABELS[stream] ?? stream
}
