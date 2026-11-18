import { inBatches } from './wkbackup'
import { LONG_REQUEST, postBatch } from './wkbackupImport'
import { readRevision } from './dokuwikiSource'
import { isPagePath, normalizeNewPagePath, pathSegmentFromTitle } from './pagePaths'

/**
 * Driving an Import from DokuWiki, once `helpers/dokuwikiSource.js` has read the data directory.
 *
 * Two halves, as for Confluence (`helpers/confluenceImport.js`). `buildPlan` decides where everything
 * goes — the browser's to decide, since it holds every id: a namespace is a folder, its start page is
 * the page AT that folder, and two names that come out as the same path segment need telling apart.
 * `runDokuwikiImport` then posts it through the import session routes, a stream at a time, in the order
 * the server reads them: the index of everything a body may point at, the folders, the media files, the
 * pages, and then their earlier revisions. `models/importDokuwiki.ts` is the other end.
 */

/** Records per request for anything carrying a body. */
const BODY_BATCH_SIZE = 100

/** Records per request for rows: the index, folders. */
const ROW_BATCH_SIZE = 500

/** What a batch aims to weigh — the same budget, for the same reason, as the `.wkbackup` import's. */
const BATCH_BYTES = 4 * 1024 * 1024

/** Media files' metadata is posted this many at a time, once their bytes are staged. */
const ASSET_BATCH_SIZE = 50

/** The pages a DokuWiki install ships with, which a namespace holding nothing else is not ticked for. */
const STOCK_PAGES = new Set([
  'wiki:dokuwiki',
  'wiki:syntax',
  'wiki:welcome',
  'playground:playground'
])

function namespaceOf(id) {
  const at = id.lastIndexOf(':')
  return at < 0 ? '' : id.slice(0, at)
}

function nameOf(id) {
  return id.slice(id.lastIndexOf(':') + 1)
}

/** The namespace at the top that an id is in, `''` for a page or file at the root. */
function topOf(id) {
  const at = id.indexOf(':')
  return at < 0 ? '' : id.slice(0, at)
}

/** What a page with no heading, or a namespace with no start page, is called: its name, as words. */
function humanize(name) {
  const words = name.replaceAll('_', ' ').trim()
  return words ? words[0].toUpperCase() + words.slice(1) : name
}

function joinPath(folder, segment) {
  return folder ? `${folder}/${segment}` : segment
}

function isoOf(seconds) {
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null
}

/**
 * What the overlay lists under Namespaces: the pages at the root, and each namespace at the top, with
 * how many pages and files each holds. One holding nothing but DokuWiki's own sample pages (`wiki`,
 * `playground`) starts unticked.
 */
export function describeNamespaces(index) {
  const entries = new Map()
  const entry = (id) => {
    if (!entries.has(id)) {
      entries.set(id, { id, pages: 0, files: 0, stockOnly: true })
    }
    return entries.get(id)
  }
  for (const page of index.pages.values()) {
    const found = entry(topOf(page.id))
    found.pages++
    found.stockOnly &&= STOCK_PAGES.has(page.id)
  }
  for (const file of index.media.values()) {
    entry(topOf(file.id)).files++
  }
  return [...entries.values()]
    .sort((a, b) => (a.id === '' ? -1 : b.id === '' ? 1 : a.id.localeCompare(b.id)))
    .map((found) => ({
      id: found.id,
      pages: found.pages,
      files: found.files,
      include: !(found.id !== '' && found.pages > 0 && found.stockOnly)
    }))
}

/** The author of a page's current text: whoever made its last change. Empty for an anonymous one. */
function currentChangeOf(index, id) {
  return index.changes.get(id)?.at(-1) ?? null
}

/**
 * Who wrote what in the namespaces chosen, for the overlay to map onto accounts here: each login with
 * the name and address `users.auth.php` gives it, and how much is theirs. Most first. Anonymous edits
 * (an IP address and no login) are nobody to map, and become the importer's.
 */
export function describeAuthors(index, namespaceIds) {
  const chosen = new Set(namespaceIds)
  const counts = new Map()
  const add = (login, kind) => {
    if (!login) {
      return
    }
    const entry = counts.get(login) ?? { pages: 0, versions: 0, files: 0 }
    entry[kind]++
    counts.set(login, entry)
  }
  for (const page of index.pages.values()) {
    if (!chosen.has(topOf(page.id))) {
      continue
    }
    const log = index.changes.get(page.id) ?? []
    add(log.at(-1)?.user, 'pages')
    const current = log.at(-1)?.date
    for (const revision of index.attic.get(page.id) ?? []) {
      if (revision.rev !== current) {
        add(log.find((change) => change.date === revision.rev)?.user, 'versions')
      }
    }
  }
  for (const file of index.media.values()) {
    if (chosen.has(topOf(file.id))) {
      add(file.authorId, 'files')
    }
  }
  return [...counts]
    .map(([id, entry]) => {
      const user = index.users.get(id)
      return {
        id,
        name: user?.name ?? '',
        email: user?.email ?? '',
        ...entry,
        total: entry.pages + entry.versions + entry.files
      }
    })
    .sort((a, b) => b.total - a.total || a.id.localeCompare(b.id))
}

/**
 * Where everything goes.
 *
 * - The whole wiki goes under `prefix` (empty is the site root). A **namespace** is a folder under it,
 *   named after the namespace; its **start page** is the page AT that folder — the root's is the site's
 *   home page, or the page at the prefix. The start page is DokuWiki's own choice in DokuWiki's own
 *   order: `ns:start`, then `ns:ns`, then the page `ns` beside the namespace.
 * - Every other page is in its namespace's folder, named after its id (`pathSegmentFromTitle`), told
 *   apart from a sibling — a page or a namespace — with `-2`, `-3`… At the site root, a name the app
 *   itself owns (`isPagePath`) counts as taken.
 * - A **media file** goes in the folder of its namespace, under its own name.
 * - A page's title is its first heading, or its name as words.
 *
 * @param {{ namespaces: string[], prefix: string }} choice The namespaces at the top chosen (`''` is
 *   the root's own pages and files), and where the wiki goes
 */
export function buildPlan(index, { namespaces, prefix }) {
  const chosen = new Set(namespaces)
  const prefixPath = normalizeNewPagePath(prefix ?? '')
  const pages = [...index.pages.values()].filter((page) => chosen.has(topOf(page.id)))
  const files = [...index.media.values()].filter((file) => chosen.has(topOf(file.id)))
  const pageIds = new Set(pages.map((page) => page.id))

  // -> The namespaces anything chosen is in, each with what is directly in it
  const tree = new Map()
  const ensure = (id) => {
    if (!tree.has(id)) {
      tree.set(id, { id, children: new Set(), pages: [], files: [] })
      if (id) {
        ensure(namespaceOf(id)).children.add(id)
      }
    }
    return tree.get(id)
  }
  ensure('')
  for (const page of pages) {
    ensure(namespaceOf(page.id)).pages.push(page)
  }
  for (const file of files) {
    ensure(namespaceOf(file.id)).files.push(file)
  }

  const homes = new Map()
  for (const id of tree.keys()) {
    const candidates = id ? [`${id}:${index.start}`, `${id}:${nameOf(id)}`, id] : [index.start]
    const home = candidates.find((candidate) => pageIds.has(candidate))
    if (home) {
      homes.set(id, home)
    }
  }
  const homeOfPage = new Map([...homes].map(([ns, page]) => [page, ns]))

  const taken = new Map()
  const take = (folder, segment) => {
    const set = taken.get(folder) ?? new Set()
    set.add(segment)
    taken.set(folder, set)
  }
  const isTaken = (folder, segment) =>
    taken.get(folder)?.has(segment) || (folder === '' && !isPagePath(`/${segment}`))
  const unique = (folder, base) => {
    let segment = base
    for (let n = 2; isTaken(folder, segment); n++) {
      segment = `${base}-${n}`
    }
    take(folder, segment)
    return segment
  }
  if (!prefixPath) {
    take('', 'home')
  }

  const folders = new Map([['', prefixPath]])
  const paths = new Map()
  const place = (nsId) => {
    const ns = tree.get(nsId)
    const folder = folders.get(nsId)
    const children = [...ns.children].sort()
    for (const child of children) {
      const segment = unique(folder, pathSegmentFromTitle(nameOf(child)) || 'namespace')
      folders.set(child, joinPath(folder, segment))
    }
    /*
      A page whose name is already a segment as it stands is placed first, so it keeps that name and
      `my_page` is the one that becomes `my-page-2` beside `my-page`. Code-unit order after that, so the
      outcome does not depend on the browser's collation.
    */
    const segmentOf = (page) => pathSegmentFromTitle(nameOf(page.id)) || 'page'
    const ordered = [...ns.pages].sort(
      (a, b) =>
        Number(segmentOf(a) !== nameOf(a.id)) - Number(segmentOf(b) !== nameOf(b.id)) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    )
    for (const page of ordered) {
      const homeOf = homeOfPage.get(page.id)
      if (homeOf !== undefined) {
        paths.set(page.id, folders.get(homeOf) || 'home')
      } else {
        paths.set(page.id, joinPath(folder, unique(folder, segmentOf(page))))
      }
    }
    for (const child of children) {
      place(child)
    }
  }
  place('')

  const titleOf = (page) => page.title || humanize(nameOf(page.id))
  const namespaceTitle = (id) => {
    const home = homes.get(id)
    if (home) {
      return titleOf(index.pages.get(home))
    }
    return id ? humanize(nameOf(id)) : index.title || prefixPath.split('/').at(-1) || 'Home'
  }
  // -> Whether a start page has anything under it to list, should it come out empty
  const hasChildren = (nsId) => {
    const ns = tree.get(nsId)
    return (
      ns.children.size > 0 ||
      ns.files.length > 0 ||
      ns.pages.some((page) => page.id !== homes.get(nsId))
    )
  }

  const folderRecords = [...tree.keys()]
    .filter((id) => folders.get(id))
    .map((id) => ({ path: folders.get(id), title: namespaceTitle(id) }))
    .sort((a, b) => a.path.split('/').length - b.path.split('/').length)

  const pageRecords = pages.map((page) => {
    const log = index.changes.get(page.id) ?? []
    const current = log.at(-1)
    const homeOf = homeOfPage.get(page.id)
    return {
      id: page.id,
      path: paths.get(page.id),
      title: titleOf(page),
      hasChildren: homeOf !== undefined && hasChildren(homeOf),
      authorId: current?.user || null,
      createdAt: isoOf(log[0]?.date) ?? isoOf(page.modified / 1000),
      updatedAt: isoOf(current?.date) ?? isoOf(page.modified / 1000),
      file: page.file
    }
  })

  // -> Every revision but the current one, which DokuWiki also keeps in the attic
  const history = []
  let unreadable = 0
  for (const page of pages) {
    const log = index.changes.get(page.id) ?? []
    const current = log.at(-1)?.date
    for (const revision of index.attic.get(page.id) ?? []) {
      if (revision.rev === current || (Number.isFinite(current) && revision.rev > current)) {
        continue
      }
      if (revision.encoding === 'bz2') {
        unreadable++
        continue
      }
      const change = log.find((entry) => entry.date === revision.rev)
      history.push({
        id: `${page.id}@${revision.rev}`,
        pageId: page.id,
        path: paths.get(page.id),
        title: titleOf(page),
        authorId: change?.user || null,
        date: isoOf(revision.rev),
        comment: change?.summary ?? '',
        created: change?.type === 'C',
        revision
      })
    }
  }
  history.sort((a, b) => a.revision.rev - b.revision.rev)

  const fileRecords = files.map((file) => ({
    id: file.id,
    folder: folders.get(namespaceOf(file.id)),
    fileName: nameOf(file.id),
    authorId: file.authorId,
    file: file.file
  }))

  const indexRecords = [
    ...pageRecords.map((page) => ({
      kind: 'page',
      id: page.id,
      path: page.path,
      title: page.title
    })),
    ...[...tree.keys()].map((id) => ({
      kind: 'namespace',
      id,
      home: homes.has(id) ? paths.get(homes.get(id)) : null,
      folder: folders.get(id),
      title: namespaceTitle(id)
    })),
    ...fileRecords.map((file) => ({
      kind: 'file',
      id: file.id,
      folder: file.folder,
      fileName: file.fileName
    })),
    ...Object.entries(index.interwiki).map(([id, url]) => ({ kind: 'interwiki', id, url }))
  ]

  // -> What was in the source and is not coming over, for the log
  const skipped = new Map()
  const deleted = [...index.changes.keys()].filter(
    (id) =>
      !index.pages.has(id) && chosen.has(topOf(id)) && index.changes.get(id).at(-1)?.type === 'D'
  ).length
  if (deleted > 0) {
    skipped.set('deleted', deleted)
  }
  if (index.templates > 0) {
    skipped.set('templates', index.templates)
  }
  if (unreadable > 0) {
    skipped.set('bzip2', unreadable)
  }

  return {
    prefix: prefixPath,
    pages: pageRecords,
    history,
    files: fileRecords,
    tree: folderRecords,
    index: indexRecords,
    skipped
  }
}

const SKIPPED_LABELS = {
  deleted: 'deleted pages, and their history',
  templates: 'namespace templates (_template.txt)',
  bzip2: 'earlier revisions compressed with bzip2, which a browser cannot read'
}

/**
 * Run the import.
 *
 * @param source     What `openSource` returned, still open
 * @param index      What `readIndex` returned
 * @param namespaces The namespaces at the top chosen, `''` for the root's own pages and files
 * @param prefix     Where the wiki goes; empty is the site root
 * @param siteId     The site everything lands in
 * @param includes   Of `pages`, `history`, `assets`
 * @param users      `[{ sourceId, userId }]` — logins mapped onto accounts; the rest are the importer
 * @param log        `(level, message)`
 * @param onProgress `(fraction)`
 */
export async function runDokuwikiImport({
  source,
  index,
  namespaces,
  prefix,
  siteId,
  includes,
  overwrite,
  htmlConversion,
  users,
  log,
  onProgress
}) {
  const plan = buildPlan(index, { namespaces, prefix })
  const wants = (kind) => includes.includes(kind)
  log(
    'info',
    `Found ${plan.pages.length} pages in ${plan.tree.length} folders` +
      (wants('history') ? `, ${plan.history.length} earlier revisions` : '') +
      (wants('assets') ? `, ${plan.files.length} media files` : '') +
      '.'
  )
  for (const [kind, count] of plan.skipped) {
    log('info', `Left out ${count} ${SKIPPED_LABELS[kind] ?? kind}.`)
  }
  log(
    'warn',
    "DokuWiki's access control lists (conf/acl.auth.php) are not imported: every page is readable by whoever this site's own rules allow. Review the group rules over the imported paths before opening them up."
  )

  const session = await API_CLIENT.post('import/sessions', {
    json: {
      source: 'dokuwiki',
      /*
        Part of the namespace the history's ids are derived in. DokuWiki has no id of its own to
        offer, and needs none: a revision is a page id and a timestamp, which two wikis do not share.
        The prefix is what keeps the same wiki imported twice into one site under two paths from
        claiming the same history rows.
      */
      sourceInstanceId: `prefix:${plan.prefix}`,
      sites: [{ sourceId: 'dokuwiki', siteId }],
      includes,
      overwrite,
      htmlConversion,
      users
    }
  }).json()
  log('info', 'Import session opened.')

  const total =
    plan.pages.length +
    (wants('history') ? plan.history.length : 0) +
    (wants('assets') ? plan.files.length : 0)
  let done = 0
  const advance = (n) => {
    done += n
    onProgress(Math.min(1, done / Math.max(total, 1)))
  }
  onProgress(0)

  try {
    const url = (stream) => `import/sessions/${session.id}/sites/${siteId}/streams/${stream}`

    await postAll(url('index'), plan.index, 'Index', log, ROW_BATCH_SIZE)
    await postAll(url('tree'), plan.tree, 'Folders', log, ROW_BATCH_SIZE)

    if (wants('assets')) {
      await importFiles({ source, plan, session, url: url('assets'), log, advance })
    }

    await postBodies({
      records: plan.pages,
      label: 'Pages',
      url: url('pages'),
      log,
      advance,
      read: async ({ file, ...record }) => ({ ...record, body: (await source.text(file)) ?? '' })
    })

    if (wants('history')) {
      await postBodies({
        records: plan.history,
        label: 'Page history',
        url: url('page-history'),
        log,
        advance,
        read: async ({ revision, ...record }) => {
          const body = await readRevision(source, revision)
          return body === null ? null : { ...record, body }
        }
      })
    }
  } catch (err) {
    try {
      await API_CLIENT.post(`import/sessions/${session.id}/abandon`)
    } catch {
      // -> Swept with the other stale sessions after two days
    }
    throw err
  }

  const summary = await API_CLIENT.post(`import/sessions/${session.id}/finish`, LONG_REQUEST).json()
  const written = Object.entries(summary.progress ?? {})
    .filter(([stream]) => stream !== 'index')
    .map(([stream, count]) => `${count} ${LABELS[stream] ?? stream}`)
    .join(', ')
  log('success', `Import finished. ${written || 'Nothing was written.'}`)
  if (summary.pendingRenders > 0) {
    log(
      'info',
      `${summary.pendingRenders} pages are waiting to be rendered. They will fill in as the renderer works through them.`
    )
  }
  onProgress(1)
  return summary
}

const LABELS = {
  tree: 'folders',
  pages: 'pages',
  'page-history': 'earlier revisions',
  assets: 'media files'
}

/** Post records in batches, reporting the totals and passing on the server's warnings. */
async function postAll(url, records, label, log, maxRecords) {
  if (records.length < 1) {
    return
  }
  const totals = { imported: 0, skipped: 0 }
  for await (const batch of inBatches(records, { maxRecords, maxBytes: BATCH_BYTES })) {
    tally(totals, await postBatch(url, batch, label, log), log)
  }
  log('info', `${label}: ${totals.imported} imported, ${totals.skipped} skipped.`)
}

function tally(totals, result, log) {
  totals.imported += result.imported ?? 0
  totals.skipped += result.skipped ?? 0
  for (const warning of result.warnings ?? []) {
    log('warn', warning)
  }
}

/**
 * Post records that each carry a body, reading each body only as its batch fills — a wiki's worth of
 * text is never held at once. `read` returns null for a record whose body cannot be read, which is
 * counted as skipped and not sent.
 */
async function postBodies({ records, label, url, log, advance, read }) {
  if (records.length < 1) {
    return
  }
  log('info', `${label}: starting (${records.length} records)...`)
  const totals = { imported: 0, skipped: 0 }

  async function* withBodies() {
    for (const record of records) {
      const next = await read(record)
      if (next) {
        yield next
      } else {
        totals.skipped++
        advance(1)
      }
    }
  }

  for await (const batch of inBatches(withBodies(), {
    maxRecords: BODY_BATCH_SIZE,
    maxBytes: BATCH_BYTES
  })) {
    tally(totals, await postBatch(url, batch, label, log), log)
    advance(batch.length)
  }
  log('info', `${label}: ${totals.imported} imported, ${totals.skipped} skipped.`)
}

/**
 * Upload each media file's bytes, then post its metadata naming them by the digest the server
 * answered with — through `POST …/uploads`, which hashes on the server, since a browser cannot outside
 * a secure context. One file at a time: only the one in flight is held.
 */
async function importFiles({ source, plan, session, url, log, advance }) {
  if (plan.files.length < 1) {
    return
  }
  log('info', `Media files: starting (${plan.files.length} files)...`)
  const totals = { imported: 0, skipped: 0 }
  let missing = 0
  let batch = []
  const flush = async () => {
    if (batch.length > 0) {
      tally(totals, await postBatch(url, batch, 'Media files', log), log)
      advance(batch.length)
      batch = []
    }
  }
  for (const file of plan.files) {
    const bytes = await source.bytes(file.file)
    if (!bytes || bytes.length < 1) {
      missing++
      advance(1)
      continue
    }
    const { digest } = await API_CLIENT.post(`import/sessions/${session.id}/uploads`, {
      ...LONG_REQUEST,
      body: bytes,
      headers: { 'content-type': 'application/octet-stream' }
    }).json()
    batch.push({
      id: file.id,
      folder: file.folder,
      fileName: file.fileName,
      blob: digest,
      authorId: file.authorId
    })
    if (batch.length >= ASSET_BATCH_SIZE) {
      await flush()
    }
  }
  await flush()
  if (missing > 0) {
    log('warn', `Media files: ${missing} files were empty or could not be read.`)
  }
  log('info', `Media files: ${totals.imported} imported, ${totals.skipped + missing} skipped.`)
}
