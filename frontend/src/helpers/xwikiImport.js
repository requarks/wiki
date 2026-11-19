import { LONG_REQUEST, postBatch } from './wkbackupImport'
import {
  STOCK_SPACES,
  commentsOf,
  decodeBase64,
  readArchive,
  readDocument,
  referenceKey
} from './xwikiSource'
import { isPagePath, normalizeNewPagePath, pathSegmentFromTitle } from './pagePaths'

/**
 * Driving an Import from XWiki, once `helpers/xwikiSource.js` has read the XAR.
 *
 * Two halves, as for DokuWiki (`helpers/dokuwikiImport.js`). `buildPlan` decides where everything
 * goes — the browser's to decide, since it holds every document: a space is a folder, its `WebHome`
 * is the page AT that folder, and two names that come out as the same path segment need telling
 * apart. `runXwikiImport` then posts it through the import session routes: the index of everything a
 * body may point at and the folders first, then each document in turn — its attachments, the page,
 * its earlier versions and its comments, read out of the XAR once and posted in batches per stream.
 * `models/importXwiki.ts` is the other end.
 */

/** Records per request for anything carrying a body. */
const BODY_BATCH_SIZE = 100

/** Records per request for rows: the index, folders, attachments' metadata. */
const ROW_BATCH_SIZE = 500

/** What a batch aims to weigh — the same budget, for the same reason, as the `.wkbackup` import's. */
const BATCH_BYTES = 4 * 1024 * 1024

/** XWiki's home page, which becomes the site's — or the page at the path the wiki goes under. */
const HOME_KEY = 'Main.WebHome'

function joinPath(folder, segment) {
  return folder ? `${folder}/${segment}` : segment
}

/** What a document is called when it has no title: its name, or its space's for a `WebHome`. */
function nameOf(document) {
  return document.name === 'WebHome' ? (document.space.at(-1) ?? 'Home') : document.name
}

function titleOf(document) {
  return document.title || nameOf(document)
}

/** The space at the top a document is in. */
function topOf(document) {
  return document.space[0]
}

/** Whether a document comes over, by the namespaces ticked and whether hidden ones were asked for. */
function wanted(document, chosen, includeHidden) {
  return chosen.has(topOf(document)) && (includeHidden || !(document.hidden || document.technical))
}

/**
 * What the overlay lists under Spaces: each space at the top, with how many pages and attachments it
 * holds. XWiki's own spaces, and any space with nothing in it but hidden pages, start unticked.
 */
export function describeSpaces(index, { includeHidden }) {
  const entries = new Map()
  for (const document of index.documents.values()) {
    const id = topOf(document)
    const entry = entries.get(id) ?? { id, pages: 0, files: 0, hidden: 0 }
    if (includeHidden || !(document.hidden || document.technical)) {
      entry.pages++
      entry.files += document.attachments.length
    } else {
      entry.hidden++
    }
    entries.set(id, entry)
  }
  return [...entries.values()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((entry) => ({ ...entry, include: entry.pages > 0 && !STOCK_SPACES.has(entry.id) }))
}

/**
 * Who wrote what in the spaces chosen, for the overlay to map onto accounts here: each user with the
 * name and address their profile gives, and how much is theirs. Most first. The guest is nobody to
 * map, and becomes the importer.
 */
export function describeAuthors(index, { spaces, includeHidden }) {
  const chosen = new Set(spaces)
  const counts = new Map()
  const add = (id, kind) => {
    if (!id) {
      return
    }
    const entry = counts.get(id) ?? { pages: 0, versions: 0, files: 0, comments: 0 }
    entry[kind]++
    counts.set(id, entry)
  }
  for (const document of index.documents.values()) {
    if (!wanted(document, chosen, includeHidden)) {
      continue
    }
    add(document.authorId, 'pages')
    for (const header of document.versionHeaders.slice(1)) {
      add(header.authorId, 'versions')
    }
    for (const attachment of document.attachments) {
      add(attachment.authorId, 'files')
    }
    for (const author of document.commentAuthors) {
      add(author, 'comments')
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
        total: entry.pages + entry.versions + entry.files + entry.comments
      }
    })
    .sort((a, b) => b.total - a.total || a.id.localeCompare(b.id))
}

/**
 * Where everything goes.
 *
 * - The whole wiki goes under `prefix` (empty is the site root). A **space** is a folder under it,
 *   named after the space; its **`WebHome`** is the page AT that folder. `Main.WebHome`, XWiki's home
 *   page, is the site's home page — or the page at the prefix — and the rest of `Main` is in a folder
 *   of its own, as any other space.
 * - Every other document is in its space's folder, named after itself (`pathSegmentFromTitle`), told
 *   apart from a sibling — a page or a space — with `-2`, `-3`… At the site root, a name the app
 *   itself owns (`isPagePath`) counts as taken.
 * - An **attachment** goes in the folder of the page it is on: a space's folder for a `WebHome`, a
 *   folder at the page's own path otherwise, which is titled after the page.
 *
 * @param {{ spaces: string[], prefix: string, includeHidden: boolean }} choice The spaces at the top
 *   chosen, where the wiki goes, and whether hidden documents come too
 */
export function buildPlan(index, { spaces, prefix, includeHidden }) {
  const chosen = new Set(spaces)
  const prefixPath = normalizeNewPagePath(prefix ?? '')
  const documents = [...index.documents.values()].filter((document) =>
    wanted(document, chosen, includeHidden)
  )

  // -> The spaces anything chosen is in, each with what is directly in it
  const tree = new Map()
  const ensure = (parts) => {
    const key = referenceKey(parts)
    if (!tree.has(key)) {
      tree.set(key, { key, parts, children: new Set(), documents: [] })
      if (parts.length > 0) {
        ensure(parts.slice(0, -1)).children.add(key)
      }
    }
    return tree.get(key)
  }
  ensure([])
  for (const document of documents) {
    ensure(document.space).documents.push(document)
  }

  const taken = new Map()
  const isTaken = (folder, segment) =>
    taken.get(folder)?.has(segment) || (folder === '' && !isPagePath(`/${segment}`))
  const unique = (folder, base) => {
    let segment = base
    for (let n = 2; isTaken(folder, segment); n++) {
      segment = `${base}-${n}`
    }
    const set = taken.get(folder) ?? new Set()
    set.add(segment)
    taken.set(folder, set)
    return segment
  }
  if (!prefixPath) {
    unique('', 'home')
  }

  const homePath = prefixPath || 'home'
  const folders = new Map([['', prefixPath]])
  const paths = new Map()
  const place = (spaceKey) => {
    const space = tree.get(spaceKey)
    const folder = folders.get(spaceKey)
    const children = [...space.children].sort()
    for (const childKey of children) {
      const name = tree.get(childKey).parts.at(-1)
      folders.set(childKey, joinPath(folder, unique(folder, pathSegmentFromTitle(name) || 'space')))
    }
    /*
      A document whose name is already a segment as it stands is placed first, so it keeps that name
      and `My_Page` is the one that becomes `my-page-2` beside `my-page`. Code-unit order after that,
      so the outcome does not depend on the browser's collation.
    */
    const segmentOf = (document) => pathSegmentFromTitle(document.name) || 'page'
    const ordered = space.documents
      .filter((document) => document.name !== 'WebHome')
      .sort(
        (a, b) =>
          Number(segmentOf(a) !== a.name) - Number(segmentOf(b) !== b.name) ||
          (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
      )
    for (const document of space.documents) {
      if (document.name === 'WebHome') {
        paths.set(document.key, document.key === HOME_KEY ? homePath : folder)
      }
    }
    for (const document of ordered) {
      paths.set(document.key, joinPath(folder, unique(folder, segmentOf(document))))
    }
    for (const childKey of children) {
      place(childKey)
    }
  }
  place('')

  const webHomeOf = (spaceKey) =>
    index.documents.get(referenceKey([...tree.get(spaceKey).parts, 'WebHome']))
  // -> `Main`'s folder is not titled after the home page, which is not in it
  const spaceTitle = (spaceKey) => {
    const home = webHomeOf(spaceKey)
    if (home && spaceKey && home.key !== HOME_KEY) {
      return titleOf(home)
    }
    return tree.get(spaceKey).parts.at(-1) ?? (index.name || prefixPath.split('/').at(-1) || 'Home')
  }
  /** The folder a document's attachments go in: its space's for a `WebHome`, its own path otherwise. */
  const fileFolderOf = (document) =>
    document.key === HOME_KEY
      ? prefixPath
      : document.name === 'WebHome'
        ? folders.get(referenceKey(document.space))
        : paths.get(document.key)
  // -> Whether a space's page has other pages under it to list, should it come out empty
  const hasChildren = (document) => {
    if (document.name !== 'WebHome') {
      return false
    }
    const space = tree.get(referenceKey(document.space))
    return space.children.size > 0 || space.documents.some((other) => other !== document)
  }

  const folderRecords = new Map()
  for (const key of tree.keys()) {
    if (folders.get(key)) {
      folderRecords.set(folders.get(key), spaceTitle(key))
    }
  }
  const pageRecords = documents.map((document) => ({
    key: document.key,
    file: document.file,
    path: paths.get(document.key),
    title: titleOf(document),
    hasChildren: hasChildren(document),
    fileFolder: fileFolderOf(document),
    attachments: document.attachments.filter((attachment) => attachment.name).map((a) => a.name),
    versions: Math.max(0, document.versionHeaders.length - 1)
  }))
  for (const page of pageRecords) {
    if (page.attachments.length > 0 && page.fileFolder && !folderRecords.has(page.fileFolder)) {
      folderRecords.set(page.fileFolder, page.title)
    }
  }
  const folderList = [...folderRecords]
    .map(([path, title]) => ({ path, title }))
    .sort((a, b) => a.path.split('/').length - b.path.split('/').length)

  const indexRecords = [
    ...pageRecords.map((page) => ({
      kind: 'page',
      id: page.key,
      path: page.path,
      title: page.title
    })),
    ...[...tree.keys()].map((key) => ({
      kind: 'space',
      id: key,
      folder: folders.get(key),
      title: spaceTitle(key)
    })),
    ...pageRecords.flatMap((page) =>
      page.attachments.map((name) => ({
        kind: 'file',
        page: page.key,
        name,
        folder: page.fileFolder,
        fileName: name
      }))
    ),
    ...[...index.users.values()].map((user) => ({ kind: 'user', id: user.id, name: user.name }))
  ]

  return {
    prefix: prefixPath,
    pages: pageRecords,
    tree: folderList,
    index: indexRecords,
    files: pageRecords.reduce((sum, page) => sum + page.attachments.length, 0),
    versions: pageRecords.reduce((sum, page) => sum + page.versions, 0)
  }
}

const SKIPPED_LABELS = {
  translations: 'translations of pages, which come over in their default language only',
  preferences: 'space preference documents (WebPreferences)',
  groups: 'group documents',
  duplicates: 'documents that appeared twice in the XAR',
  unreadable: 'files that could not be read as XWiki documents'
}

/**
 * Run the import.
 *
 * @param source         What `openSource` returned, still open
 * @param index          What `readIndex` returned
 * @param spaces         The spaces at the top chosen
 * @param prefix         Where the wiki goes; empty is the site root
 * @param includeHidden  Whether hidden and technical documents come too
 * @param siteId         The site everything lands in
 * @param includes       Of `pages`, `history`, `assets`, `comments`
 * @param users          `[{ sourceId, userId }]` — users mapped onto accounts; the rest are the importer
 * @param log            `(level, message)`
 * @param onProgress     `(fraction)`
 */
export async function runXwikiImport({
  source,
  index,
  spaces,
  prefix,
  includeHidden,
  siteId,
  includes,
  overwrite,
  htmlConversion,
  users,
  log,
  onProgress
}) {
  const plan = buildPlan(index, { spaces, prefix, includeHidden })
  const wants = (kind) => includes.includes(kind)
  log(
    'info',
    `Found ${plan.pages.length} pages in ${plan.tree.length} folders` +
      (wants('history') ? `, ${plan.versions} earlier versions` : '') +
      (wants('assets') ? `, ${plan.files} attachments` : '') +
      '.'
  )
  for (const [kind, count] of index.skipped) {
    log('info', `Left out ${count} ${SKIPPED_LABELS[kind] ?? kind}.`)
  }
  if (wants('history') && !index.withHistory) {
    log(
      'info',
      'This XAR holds no earlier versions of its pages. Export the pages from XWiki with their history to bring them along.'
    )
  }
  log(
    'warn',
    "XWiki's access rights are not imported: every page is readable by whoever this site's own rules allow. Review the group rules over the imported paths before opening them up."
  )

  const session = await API_CLIENT.post('import/sessions', {
    json: {
      source: 'xwiki',
      /*
        Part of the namespace the history and comment ids are derived in. A version is a document and
        a version number, and a comment a document and an object number, which two wikis could share;
        the prefix is what keeps the same wiki imported twice into one site under two paths from
        claiming the same rows.
      */
      sourceInstanceId: `prefix:${plan.prefix}`,
      sites: [{ sourceId: 'xwiki', siteId }],
      includes,
      overwrite,
      htmlConversion,
      users
    }
  }).json()
  log('info', 'Import session opened.')

  let done = 0
  onProgress(0)
  try {
    const url = (stream) => `import/sessions/${session.id}/sites/${siteId}/streams/${stream}`
    await postAll(url('index'), plan.index, 'Index', log)
    await postAll(url('tree'), plan.tree, 'Folders', log)

    const queues = {
      assets: new Queue(url('assets'), 'Attachments', log, ROW_BATCH_SIZE),
      pages: new Queue(url('pages'), 'Pages', log, BODY_BATCH_SIZE),
      history: new Queue(url('page-history'), 'Page history', log, BODY_BATCH_SIZE),
      comments: new Queue(url('comments'), 'Comments', log, ROW_BATCH_SIZE)
    }
    // -> Versions and comments name their page, which has to have been written first
    queues.history.before = queues.comments.before = () => queues.pages.flush()
    let brokenHistory = 0
    let missingFiles = 0

    for (const page of plan.pages) {
      const document = readDocument((await source.text(page.file)) ?? '', { withContent: true })
      if (!document) {
        queues.pages.totals.skipped++
        continue
      }
      if (wants('assets')) {
        for (const attachment of document.attachments) {
          if (!page.attachments.includes(attachment.name)) {
            continue
          }
          const bytes = attachment.base64 ? decodeBase64(attachment.base64) : null
          if (!bytes || bytes.length < 1) {
            missingFiles++
            continue
          }
          const { digest } = await API_CLIENT.post(`import/sessions/${session.id}/uploads`, {
            ...LONG_REQUEST,
            body: bytes,
            headers: { 'content-type': 'application/octet-stream' }
          }).json()
          await queues.assets.push({
            id: `${document.key}@${attachment.name}`,
            folder: page.fileFolder,
            fileName: attachment.name,
            blob: digest,
            authorId: attachment.authorId
          })
        }
      }
      await queues.pages.push({
        id: document.key,
        path: page.path,
        title: page.title,
        syntax: document.syntax,
        body: document.content,
        tags: document.tags,
        authorId: document.authorId,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
        hasChildren: page.hasChildren
      })
      if (wants('history') && document.versions) {
        let versions = []
        try {
          versions = readArchive(document.versions)
        } catch (err) {
          brokenHistory++
          console.warn(`XWiki import: the history of ${document.key} could not be read`, err)
        }
        for (const [position, version] of versions.entries()) {
          if (version.version === document.version) {
            continue
          }
          const old = readDocument(version.xml, { withContent: true })
          if (!old) {
            brokenHistory++
            continue
          }
          await queues.history.push({
            id: `${document.key}@${version.version}`,
            pageId: document.key,
            path: page.path,
            title: old.title || page.title,
            syntax: old.syntax,
            body: old.content,
            authorId: old.authorId ?? version.authorId,
            date: old.updatedAt ?? version.date,
            comment: old.comment || version.log,
            created: position === 0
          })
        }
      }
      if (wants('comments')) {
        for (const comment of commentsOf(document)) {
          await queues.comments.push(comment)
        }
      }
      onProgress(Math.min(1, ++done / Math.max(plan.pages.length, 1)))
    }
    await queues.assets.flush()
    await queues.pages.flush()
    await queues.history.flush()
    await queues.comments.flush()

    if (missingFiles > 0) {
      log('warn', `Attachments: ${missingFiles} files were empty or missing from the XAR.`)
    }
    if (brokenHistory > 0) {
      log(
        'warn',
        `Page history: the earlier versions of ${brokenHistory} pages could not be read out of the XAR and were left out.`
      )
    }
    for (const queue of Object.values(queues)) {
      queue.report()
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
  'page-history': 'earlier versions',
  assets: 'attachments',
  comments: 'comments'
}

/** Post records in batches, reporting the totals and passing on the server's warnings. */
async function postAll(url, records, label, log) {
  if (records.length < 1) {
    return
  }
  const queue = new Queue(url, label, log, ROW_BATCH_SIZE)
  for (const record of records) {
    await queue.push(record)
  }
  await queue.flush()
  queue.report()
}

/**
 * Records of one stream, posted a batch at a time as they fill — by count, and by the same weight
 * `inBatches` keeps a batch under. `before` runs ahead of every post, for a stream whose records name
 * what another stream writes.
 */
class Queue {
  constructor(url, label, log, maxRecords) {
    this.url = url
    this.label = label
    this.log = log
    this.maxRecords = maxRecords
    this.records = []
    this.bytes = 0
    this.totals = { imported: 0, skipped: 0 }
    this.before = null
  }

  async push(record) {
    const size = JSON.stringify(record).length
    if (
      this.records.length > 0 &&
      (this.records.length >= this.maxRecords || this.bytes + size > BATCH_BYTES)
    ) {
      await this.flush()
    }
    this.records.push(record)
    this.bytes += size
  }

  async flush() {
    if (this.records.length < 1) {
      return
    }
    await this.before?.()
    const batch = this.records
    this.records = []
    this.bytes = 0
    const result = await postBatch(this.url, batch, this.label, this.log)
    this.totals.imported += result.imported ?? 0
    this.totals.skipped += result.skipped ?? 0
    for (const warning of result.warnings ?? []) {
      this.log('warn', warning)
    }
  }

  report() {
    if (this.totals.imported + this.totals.skipped > 0) {
      this.log(
        'info',
        `${this.label}: ${this.totals.imported} imported, ${this.totals.skipped} skipped.`
      )
    }
  }
}
