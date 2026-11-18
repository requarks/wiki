import { inBatches } from './wkbackup'
import { LONG_REQUEST, postBatch } from './wkbackupImport'
import { attachmentEntry, readAttachment, readBodies } from './confluenceBackup'
import {
  isPagePath,
  isValidPathSegment,
  normalizeNewPagePath,
  pathSegmentFromTitle
} from './pagePaths'

/**
 * Driving an Import from Confluence, once `helpers/confluenceBackup.js` has read the backup.
 *
 * Two halves. `buildPlan` decides where everything goes — which is the browser's to decide, since it
 * is the side that holds the whole page tree: a page's path is its space's prefix and its ancestors'
 * titles, and two siblings whose titles come out the same need telling apart. `runConfluenceImport`
 * then posts it through the import session routes, a stream at a time, in the order the server reads
 * them in: the index of everything a body may point at, the folders, the attachments, the pages, and
 * then their history and comments. `models/importConfluence.ts` is the other end.
 *
 * Reports as it goes, like the `.wkbackup` import (`helpers/wkbackupImport.js`), whose batch poster
 * this shares.
 */

/** Records per request for anything carrying a body. */
const BODY_BATCH_SIZE = 100

/** Records per request for rows: the index, folders, attachments' metadata. */
const ROW_BATCH_SIZE = 500

/** What a batch aims to weigh — the same budget, for the same reason, as the `.wkbackup` import's. */
const BATCH_BYTES = 4 * 1024 * 1024

/** Attachments' metadata is posted this many at a time, once their bytes are staged. */
const ASSET_BATCH_SIZE = 50

/** Whether a content is the current version of itself, as opposed to an old one or a draft. */
function isCurrent(content) {
  return content.status === 'current' && !content.originalId
}

/** Sort by Confluence's own order among siblings, then by age, which is what the id says. */
function bySiblingOrder(a, b) {
  const pa = Number.isFinite(a.position) ? a.position : Number.POSITIVE_INFINITY
  const pb = Number.isFinite(b.position) ? b.position : Number.POSITIVE_INFINITY
  return pa - pb || Number(a.id) - Number(b.id) || a.id.localeCompare(b.id)
}

/**
 * What the overlay lists under Spaces: each space, its page count, and the path it would go under.
 *
 * The default is the space key — what a Confluence URL names a space by — except for a personal
 * space, whose key is an account id with a tilde in front and is named after its owner instead.
 * Defaults that come out the same are told apart.
 */
export function describeSpaces(index) {
  const pageCounts = new Map()
  for (const content of index.contents.values()) {
    if (content.type === 'page' && isCurrent(content)) {
      pageCounts.set(content.spaceId, (pageCounts.get(content.spaceId) ?? 0) + 1)
    }
  }
  const used = new Set()
  return [...index.spaces.values()]
    .filter((space) => space.status !== 'ARCHIVED' || pageCounts.get(space.id))
    .sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'global' ? -1 : 1
    )
    .map((space) => {
      const base =
        (space.type === 'personal'
          ? pathSegmentFromTitle(space.name)
          : pathSegmentFromTitle(space.key)) || `space-${space.id}`
      let prefix = base
      for (let n = 2; used.has(prefix); n++) {
        prefix = `${base}-${n}`
      }
      used.add(prefix)
      return {
        id: space.id,
        key: space.key,
        name: space.name,
        type: space.type,
        pages: pageCounts.get(space.id) ?? 0,
        prefix
      }
    })
}

/**
 * Whether a prefix is one a space may go under, as an error message or null. Blank is the site root.
 */
export function prefixError(prefix) {
  const normalized = normalizeNewPagePath(prefix)
  if (!normalized) {
    return null
  }
  const segments = normalized.split('/')
  if (!segments.every(isValidPathSegment)) {
    return 'invalid'
  }
  if (!isPagePath(`/${normalized}`)) {
    return 'reserved'
  }
  return null
}

/**
 * Who wrote what in the chosen spaces, for the overlay to map onto accounts here: each author with an
 * address when the backup has one, and how much is theirs. Most first.
 */
export function describeAuthors(index, spaceIds) {
  const chosen = new Set(spaceIds)
  const pages = new Map()
  for (const content of index.contents.values()) {
    if (
      (content.type === 'page' || content.type === 'folder') &&
      isCurrent(content) &&
      chosen.has(content.spaceId)
    ) {
      pages.set(content.id, content)
    }
  }
  const counts = new Map()
  const add = (userId, kind) => {
    if (!userId) {
      return
    }
    const entry = counts.get(userId) ?? { pages: 0, versions: 0, comments: 0, files: 0 }
    entry[kind]++
    counts.set(userId, entry)
  }
  for (const content of index.contents.values()) {
    if (content.status !== 'current') {
      continue
    }
    if (content.type === 'page' && pages.has(content.id)) {
      add(content.modifierId, 'pages')
    } else if (content.type === 'page' && content.originalId && pages.has(content.originalId)) {
      add(content.modifierId, 'versions')
    } else if (content.type === 'comment' && pages.has(content.containerId)) {
      add(content.creatorId, 'comments')
    } else if (
      content.type === 'attachment' &&
      isCurrent(content) &&
      pages.has(content.containerId)
    ) {
      add(content.modifierId, 'files')
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
        total: entry.pages + entry.versions + entry.comments + entry.files
      }
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
}

/**
 * Where everything goes.
 *
 * - A space's **home page** is the page AT its prefix — or the site's home page, for a space put at the
 *   root — and its children are directly under the prefix. A top-level page that is not the home page
 *   sits beside them.
 * - A page or a folder's own segment is its title as a path segment (`pathSegmentFromTitle`), told
 *   apart from a sibling's with `-2`, `-3`… in Confluence's own order. A title with no letter or digit
 *   in it is `page-<id>`. At the site root, a name the app itself owns (`isPagePath`) counts as taken.
 * - A **folder** is created, with a title, for every Confluence folder, every page with children or
 *   attachments (the folder they are in is named after it) and every prefix.
 * - **Attachments** go in the folder of the page they are on, the latest version of each.
 * - Drafts, deleted content, embeds, whiteboards, databases and blog posts are left out and counted,
 *   and so is an attachment whose bytes are not in the backup — which is then not in the index
 *   either, so a link to it is kept as its text rather than pointed at a file that never arrives.
 *
 * @param {Array<{ id: string, prefix: string }>} spaces The spaces chosen, each with its prefix
 * @param {(content: object) => boolean} hasFile Whether an attachment's bytes are in the backup
 */
export function buildPlan(index, spaces, hasFile = () => true) {
  const chosen = new Map(
    spaces.map((space) => [space.id, normalizeNewPagePath(space.prefix ?? '')])
  )
  const nodes = new Map()
  const skipped = new Map()
  const skip = (kind) => skipped.set(kind, (skipped.get(kind) ?? 0) + 1)

  for (const content of index.contents.values()) {
    if (!chosen.has(content.spaceId)) {
      continue
    }
    if (content.type === 'page' || content.type === 'folder') {
      if (isCurrent(content)) {
        nodes.set(content.id, content)
      } else if (!content.originalId) {
        skip(
          content.status === 'draft'
            ? 'drafts'
            : content.status === 'deleted'
              ? 'deleted'
              : content.status
        )
      }
    } else if (
      content.status === 'current' &&
      !content.originalId &&
      content.type !== 'comment' &&
      content.type !== 'attachment'
    ) {
      skip(content.type.startsWith('other:') ? null : content.type)
    }
  }
  skipped.delete(null)

  // -> Children by parent: a node id, or the space itself for its top level
  const children = new Map()
  const homes = new Map()
  for (const node of nodes.values()) {
    const space = index.spaces.get(node.spaceId)
    if (node.id === space?.homePageId) {
      homes.set(node.spaceId, node)
      continue
    }
    let parent = node.parentId && nodes.has(node.parentId) ? node.parentId : null
    if (!parent || parent === space?.homePageId) {
      parent = `space:${node.spaceId}`
    }
    children.set(parent, [...(children.get(parent) ?? []), node])
  }

  const taken = new Map()
  const take = (folder, segment) => {
    const set = taken.get(folder) ?? new Set()
    set.add(segment)
    taken.set(folder, set)
  }
  const isTaken = (folder, segment) =>
    taken.get(folder)?.has(segment) || (folder === '' && !isPagePath(`/${segment}`))

  // -> Every prefix's own segments are spoken for before any page is placed beside them
  for (const prefix of chosen.values()) {
    const parts = prefix ? prefix.split('/') : ['home']
    parts.forEach((part, i) => take(parts.slice(0, i).join('/'), part))
  }

  const paths = new Map()
  const place = (key, folder) => {
    for (const node of (children.get(key) ?? []).sort(bySiblingOrder)) {
      const base = pathSegmentFromTitle(node.title) || `${node.type}-${node.id}`
      let segment = base
      for (let n = 2; isTaken(folder, segment); n++) {
        segment = `${base}-${n}`
      }
      take(folder, segment)
      const path = folder ? `${folder}/${segment}` : segment
      paths.set(node.id, path)
      place(node.id, path)
    }
  }
  for (const [spaceId, prefix] of chosen) {
    const home = homes.get(spaceId)
    if (home) {
      paths.set(home.id, prefix || 'home')
    }
    place(`space:${spaceId}`, prefix)
  }

  const spaceOf = (node) => index.spaces.get(node.spaceId)
  const pages = [...nodes.values()].filter((node) => node.type === 'page' && paths.has(node.id))
  const pageById = new Map(pages.map((page) => [page.id, page]))

  const attachments = []
  const comments = []
  const history = []
  for (const content of index.contents.values()) {
    if (content.type === 'attachment' && isCurrent(content) && pageById.has(content.containerId)) {
      if (hasFile(content)) {
        attachments.push(content)
      } else {
        skip('missingFiles')
      }
    } else if (
      content.type === 'comment' &&
      content.status === 'current' &&
      pageById.has(content.containerId)
    ) {
      comments.push(content)
    } else if (
      content.type === 'page' &&
      content.status === 'current' &&
      content.originalId &&
      pageById.has(content.originalId)
    ) {
      history.push(content)
    }
  }

  // -> Folders: Confluence's own, pages with something under them, and the prefixes
  const folders = new Map()
  for (const node of nodes.values()) {
    if (node.type === 'folder' && paths.has(node.id)) {
      folders.set(paths.get(node.id), node.title)
    }
  }
  const hasAttachments = new Set(attachments.map((content) => content.containerId))
  for (const page of pages) {
    if (children.has(page.id) || hasAttachments.has(page.id)) {
      folders.set(paths.get(page.id), page.title)
    }
  }
  for (const [spaceId, prefix] of chosen) {
    if (prefix) {
      folders.set(prefix, index.spaces.get(spaceId)?.name ?? prefix)
    }
  }
  const tree = [...folders]
    .map(([path, title]) => ({ path, title }))
    .sort((a, b) => a.path.split('/').length - b.path.split('/').length)

  // -> A reply answers its thread here, one level deep
  const commentById = new Map(comments.map((content) => [content.id, content]))
  const threadOf = (content) => {
    let current = content
    const seen = new Set()
    while (
      current.parentCommentId &&
      commentById.has(current.parentCommentId) &&
      !seen.has(current.id)
    ) {
      seen.add(current.id)
      current = commentById.get(current.parentCommentId)
    }
    return current.id
  }
  const byDate = (a, b) =>
    (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || Number(a.id) - Number(b.id)
  const commentRecords = comments
    .map((content) => {
      const thread = threadOf(content)
      const page = pageById.get(content.containerId)
      const isInline =
        content.props['inline-comment'] === 'true' ||
        content.props.actualCommentType === 'inline' ||
        Boolean(content.props['inline-marker-ref'])
      return {
        id: content.id,
        pageId: content.containerId,
        parentId: thread === content.id ? null : thread,
        spaceKey: spaceOf(page)?.key ?? '',
        pageTitle: page.title,
        authorId: content.creatorId,
        createdAt: content.createdAt,
        updatedAt: content.updatedAt,
        inline:
          isInline && thread === content.id
            ? {
                markerRef: content.props['inline-marker-ref'] ?? '',
                selection: content.props['inline-original-selection'] ?? ''
              }
            : null
      }
    })
    // -> Every thread before any reply, so a reply's thread is always there to hang off
    .sort((a, b) => Number(Boolean(a.parentId)) - Number(Boolean(b.parentId)) || byDate(a, b))

  const pageRecords = pages.map((page) => ({
    id: page.id,
    spaceKey: spaceOf(page)?.key ?? '',
    title: page.title,
    path: paths.get(page.id),
    labels: index.labels.get(page.id) ?? [],
    // -> What an empty page becomes an index of
    hasChildren:
      children.has(page.id) ||
      (page.id === index.spaces.get(page.spaceId)?.homePageId &&
        children.has(`space:${page.spaceId}`)),
    authorId: page.modifierId,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt
  }))

  const historyRecords = history
    .filter((content) => content.version < pageById.get(content.originalId).version)
    .map((content) => {
      const page = pageById.get(content.originalId)
      return {
        id: content.id,
        pageId: page.id,
        version: content.version,
        title: content.title || page.title,
        path: paths.get(page.id),
        spaceKey: spaceOf(page)?.key ?? '',
        pageTitle: page.title,
        authorId: content.modifierId,
        date: content.updatedAt,
        comment: content.versionComment
      }
    })

  const fileRecords = attachments.map((content) => {
    const page = pageById.get(content.containerId)
    return {
      id: content.id,
      content,
      spaceKey: spaceOf(page)?.key ?? '',
      title: page.title,
      folder: paths.get(page.id),
      fileName: content.title,
      authorId: content.modifierId
    }
  })

  const indexRecords = [
    ...pageRecords.map((page) => ({
      kind: 'page',
      id: page.id,
      spaceKey: page.spaceKey,
      title: page.title,
      path: page.path
    })),
    ...fileRecords.map((file) => ({
      kind: 'file',
      spaceKey: file.spaceKey,
      title: file.title,
      fileName: file.fileName,
      folder: file.folder
    })),
    ...[...index.users.values()]
      .filter((user) => user.name)
      .map((user) => ({ kind: 'user', id: user.id, name: user.name })),
    ...[...chosen].map(([spaceId, prefix]) => ({
      kind: 'space',
      spaceKey: index.spaces.get(spaceId)?.key ?? '',
      path: prefix || 'home'
    }))
  ]

  return {
    pages: pageRecords,
    history: historyRecords,
    comments: commentRecords,
    files: fileRecords,
    tree,
    index: indexRecords,
    skipped
  }
}

const SKIPPED_LABELS = {
  drafts: 'unpublished drafts (Confluence keeps them private to their author)',
  deleted: 'deleted pages',
  embed: 'Smart Link embeds',
  whiteboard: 'whiteboards',
  database: 'databases',
  blogpost: 'blog posts',
  missingFiles:
    'attachments whose files are not in the backup (it was probably made with "Backup attachments" off); links to them were kept as text'
}

/**
 * Run the import.
 *
 * @param backup     What `openBackup` returned, still open
 * @param index      What `readIndex` returned
 * @param spaces     `[{ id, prefix }]` — the spaces chosen and where each goes
 * @param siteId     The site everything lands in
 * @param includes   Of `pages`, `history`, `comments`, `assets`
 * @param users      `[{ sourceId, userId }]` — authors mapped onto accounts; the rest are the importer
 * @param log        `(level, message)`
 * @param onProgress `(fraction)`
 */
export async function runConfluenceImport({
  backup,
  index,
  spaces,
  siteId,
  includes,
  overwrite,
  htmlConversion,
  users,
  log,
  onProgress
}) {
  const plan = buildPlan(index, spaces, (content) => Boolean(attachmentEntry(backup, content)))
  const wants = (kind) => includes.includes(kind)
  log(
    'info',
    `Found ${plan.pages.length} pages and ${plan.tree.length} folders` +
      (wants('history') ? `, ${plan.history.length} earlier versions` : '') +
      (wants('comments') ? `, ${plan.comments.length} comments` : '') +
      (wants('assets') ? `, ${plan.files.length} attachments` : '') +
      '.'
  )
  for (const [kind, count] of plan.skipped) {
    log('info', `Left out ${count} ${SKIPPED_LABELS[kind] ?? kind}.`)
  }
  log(
    'warn',
    "Confluence's space permissions and page restrictions are not imported: every page is readable by whoever this site's own rules allow. Review the group rules over the imported paths before opening them up."
  )

  const session = await API_CLIENT.post('import/sessions', {
    json: {
      source: 'confluence',
      sourceInstanceId: index.sourceId,
      sites: [{ sourceId: 'confluence', siteId }],
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
    (wants('comments') ? plan.comments.length : 0) +
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
      await importAttachments({ backup, plan, session, url: url('assets'), log, advance })
    }

    // -> Pages: one pass over the bodies, posted as they are found
    await streamBodies({
      backup,
      records: plan.pages,
      label: 'Pages',
      url: url('pages'),
      log,
      advance,
      // -> A page with no body at all — one that only ever had children — is still a page
      withoutBody: (record) => ({ ...record, body: '', bodyEncoding: 'plain' })
    })

    if (wants('history')) {
      await streamBodies({
        backup,
        records: plan.history,
        label: 'Page history',
        url: url('page-history'),
        log,
        advance,
        withoutBody: () => null
      })
    }

    if (wants('comments')) {
      /*
        Bodies first, in the backup's order, then posted in the plan's: every thread before any reply.
        Comments are short, so holding a backup's worth of them is cheap.
      */
      const bodies = new Map()
      for await (const body of readBodies(backup, new Set(plan.comments.map((c) => c.id)))) {
        bodies.set(body.contentId, body)
      }
      const records = plan.comments.map((record) => ({
        ...record,
        body: bodies.get(record.id)?.body ?? '',
        bodyEncoding: bodies.get(record.id)?.encoding ?? 'plain'
      }))
      await postAll(url('comments'), records, 'Comments', log, BODY_BATCH_SIZE, advance)
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
async function postAll(url, records, label, log, maxRecords, advance = null) {
  if (records.length < 1) {
    return
  }
  const totals = { imported: 0, skipped: 0 }
  for await (const batch of inBatches(records, { maxRecords, maxBytes: BATCH_BYTES })) {
    const result = await postBatch(url, batch, label, log)
    tally(totals, result, log)
    advance?.(batch.length)
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
 * Post records that each carry a body, read in one pass over the backup's bodies and sent as they
 * are found. A record whose body the backup does not hold goes through `withoutBody` — sent without
 * one, or (null) not sent.
 */
async function streamBodies({ backup, records, label, url, log, advance, withoutBody }) {
  if (records.length < 1) {
    return
  }
  log('info', `${label}: starting (${records.length} records)...`)
  const byId = new Map(records.map((record) => [record.id, record]))
  const seen = new Set()
  const totals = { imported: 0, skipped: 0 }

  async function* withBodies() {
    for await (const body of readBodies(backup, new Set(byId.keys()))) {
      // -> A content has one storage body, but a backup has been known to list one twice
      if (seen.has(body.contentId)) {
        continue
      }
      seen.add(body.contentId)
      yield { ...byId.get(body.contentId), body: body.body, bodyEncoding: body.encoding }
    }
    for (const [id, record] of byId) {
      if (!seen.has(id)) {
        const next = withoutBody(record)
        if (next) {
          yield next
        } else {
          totals.skipped++
          advance(1)
        }
      }
    }
  }

  for await (const batch of inBatches(withBodies(), {
    maxRecords: BODY_BATCH_SIZE,
    maxBytes: BATCH_BYTES
  })) {
    const result = await postBatch(url, batch, label, log)
    tally(totals, result, log)
    advance(batch.length)
  }
  log('info', `${label}: ${totals.imported} imported, ${totals.skipped} skipped.`)
}

/**
 * Upload each attachment's bytes, then post its metadata naming them by the digest the server
 * answered with. One file at a time: an attachment can be hundreds of megabytes, and only the one in
 * flight is held.
 */
async function importAttachments({ backup, plan, session, url, log, advance }) {
  if (plan.files.length < 1) {
    return
  }
  log('info', `Attachments: starting (${plan.files.length} files)...`)
  const totals = { imported: 0, skipped: 0 }
  let missing = 0
  let batch = []
  const flush = async () => {
    if (batch.length > 0) {
      const result = await postBatch(url, batch, 'Attachments', log)
      tally(totals, result, log)
      advance(batch.length)
      batch = []
    }
  }
  for (const file of plan.files) {
    const bytes = await readAttachment(backup, file.content)
    if (!bytes) {
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
    log('warn', `Attachments: ${missing} files could not be read from the backup.`)
  }
  log('info', `Attachments: ${totals.imported} imported, ${totals.skipped + missing} skipped.`)
}
