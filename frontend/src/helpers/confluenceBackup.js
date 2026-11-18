import { BlobReader, TextWriter, Uint8ArrayWriter, ZipReader } from '@zip.js/zip.js'

/**
 * Reading a Confluence backup in the browser, for **Import from Confluence**.
 *
 * Two formats, both a ZIP, and this is the only file that knows which is which:
 *
 * - **CSV** — Confluence Cloud's own backup ("Create backup for cloud"): `metadata.json`, one gzipped
 *   CSV per database table under `data/`, and every attachment under `attachments/<file-store id>`.
 *   Page bodies are base64 zstd, which the browser has no decoder for — they are posted as they are and
 *   inflated by the server.
 * - **XML** — what Data Center exports, and Cloud's "Create backup for server": `exportDescriptor.properties`,
 *   one `entities.xml` holding every row as a Hibernate object, and attachments under
 *   `attachments/<page id>/<attachment id>/<version>`.
 *
 * Both are read into the SAME index, so nothing after this file asks which format it was. The index
 * holds everything but the bodies, which can be most of a backup's weight; `bodies()` streams those
 * past later, a pass per stream that needs them.
 *
 * Nothing here depends on a library beyond the ZIP reader the `.wkbackup` import already loads:
 * gzip is the browser's own `DecompressionStream`, and the CSV and XML readers are small parsers for
 * exactly what Confluence writes (`readCsv`, `readXmlObjects`).
 *
 * `dev/specs/confluence-import.md` has what was learned about both formats from real backups.
 */

/** Refused by the reader, since the server never sees the file. */
export class BackupError extends Error {}

/** Content properties worth keeping, by name: an attachment's type and file, an inline comment's anchor. */
const KEPT_PROPERTIES = new Set([
  'MEDIA_TYPE',
  'FILESIZE',
  'FILESTORE_ID',
  'inline-marker-ref',
  'inline-original-selection',
  'inline-comment',
  'actualCommentType'
])

/** CSV `contenttype` → what the index calls it. Everything else is counted and left alone. */
const CSV_TYPES = {
  PAGE: 'page',
  FOLDER: 'folder',
  COMMENT: 'comment',
  ATTACHMENT: 'attachment',
  EMBED: 'embed',
  BLOGPOST: 'blogpost',
  WHITEBOARD: 'whiteboard',
  DATABASE: 'database'
}

/** XML object classes → the same. A folder is a `Page` with `isFolder` in older exports. */
const XML_TYPES = {
  Page: 'page',
  Folder: 'folder',
  Comment: 'comment',
  Attachment: 'attachment',
  BlogPost: 'blogpost',
  Whiteboard: 'whiteboard',
  Database: 'database',
  Embed: 'embed'
}

/**
 * Open a backup and say which kind it is.
 *
 * @returns `{ format, entry(path), has(path), entries, close() }`
 */
export async function openBackup(file) {
  const reader = new ZipReader(new BlobReader(file))
  let entries
  try {
    entries = await reader.getEntries()
  } catch (err) {
    await reader.close().catch(() => {})
    throw new BackupError(`This file could not be opened as a ZIP archive. (${err.message})`)
  }
  const byName = new Map()
  for (const entry of entries) {
    if (!entry.directory) {
      byName.set(entry.filename, entry)
    }
  }
  const format = byName.has('data/content.csv.gz')
    ? 'csv'
    : byName.has('entities.xml')
      ? 'xml'
      : null
  if (!format) {
    await reader.close().catch(() => {})
    throw new BackupError(
      'This file is not a Confluence backup: it has neither data/content.csv.gz (a cloud backup) nor entities.xml (a server or Data Center backup).'
    )
  }
  return {
    format,
    entry: (path) => byName.get(path) ?? null,
    has: (path) => byName.has(path),
    names: () => byName.keys(),
    close: () => reader.close().catch(() => {})
  }
}

/**
 * Everything but the bodies.
 *
 * @returns {{
 *   format: 'csv'|'xml', sourceId: string,
 *   spaces: Map<string, { id, key, name, type, status, homePageId, creatorId }>,
 *   contents: Map<string, object>,
 *   users: Map<string, { id, name, email }>,
 *   labels: Map<string, string[]>
 * }} A content is `{ id, type, status, title, version, originalId, parentId, spaceId, containerId,
 *   parentCommentId, position, creatorId, modifierId, createdAt, updatedAt, versionComment,
 *   isFolder, isEmbed, props }`, whichever format it came from.
 */
export async function readIndex(backup, { onProgress } = {}) {
  return backup.format === 'csv'
    ? readCsvIndex(backup, onProgress)
    : readXmlIndex(backup, onProgress)
}

/**
 * The bodies of the contents in `wanted`, one at a time and in the backup's own order.
 *
 * @param {Set<string>} wanted Content ids
 * @returns {AsyncGenerator<{ contentId: string, body: string, encoding: 'plain'|'zstd' }>}
 */
export async function* readBodies(backup, wanted) {
  if (backup.format === 'csv') {
    for await (const row of readCsv(backup.entry('data/bodycontent.csv.gz'))) {
      // -> Type 2 is the storage format; 0 and 1 are plain text and a property's JSON
      if (row.bodytypeid === '2' && wanted.has(row.contentid)) {
        yield {
          contentId: row.contentid,
          body: row.body ?? '',
          // -> A Cloud backup compresses most bodies, but not every one: zstd's magic number is
          //    what says, base64-encoded
          encoding: (row.body ?? '').startsWith('KLUv/') ? 'zstd' : 'plain'
        }
      }
    }
    return
  }
  for await (const object of readXmlObjects(backup.entry('entities.xml'), {
    classes: new Set(['BodyContent'])
  })) {
    const contentId = object.refs.content
    if (object.props.bodyType === '2' && wanted.has(contentId)) {
      yield { contentId, body: object.props.body ?? '', encoding: 'plain' }
    }
  }
}

/**
 * An attachment's bytes, or null when the backup was made without them.
 *
 * A cloud backup files an attachment by its file-store id. An XML one by the page it is on, its own
 * id and its version — and a backup whose numbering went astray is searched for the highest version
 * of that attachment rather than given up on.
 */
export async function readAttachment(backup, content) {
  const entry = attachmentEntry(backup, content)
  return entry ? entry.getData(new Uint8ArrayWriter()) : null
}

/** Where an attachment's bytes are in the backup, or null — see `readAttachment`. */
export function attachmentEntry(backup, content) {
  if (backup.format === 'csv') {
    const storeId = content.props.FILESTORE_ID
    return storeId ? backup.entry(`attachments/${storeId}`) : null
  }
  const exact = backup.entry(`attachments/${content.containerId}/${content.id}/${content.version}`)
  if (exact) {
    return exact
  }
  const prefix = `attachments/${content.containerId}/${content.id}/`
  let best = null
  for (const name of backup.names()) {
    if (name.startsWith(prefix)) {
      const version = Number.parseInt(name.slice(prefix.length), 10)
      if (Number.isFinite(version) && (!best || version > best.version)) {
        best = { name, version }
      }
    }
  }
  return best ? backup.entry(best.name) : null
}

// ================================================================================================
// CSV
// ================================================================================================

async function readCsvIndex(backup, onProgress) {
  let sourceId = ''
  const metadata = backup.entry('metadata.json')
  if (metadata) {
    try {
      const meta = JSON.parse(await metadata.getData(new TextWriter()))
      sourceId = meta.cloudId ?? meta.backupId ?? ''
    } catch {
      // -> Only part of the namespace record ids are derived in; the space keys stand in below
    }
  }

  const spaces = new Map()
  for await (const row of readCsv(backup.entry('data/spaces.csv.gz'))) {
    spaces.set(row.spaceid, {
      id: row.spaceid,
      key: row.spacekey,
      name: row.spacename,
      type: row.spacetype,
      status: row.spacestatus,
      homePageId: row.homepage || null,
      creatorId: row.creator || null
    })
  }
  onProgress?.('spaces')

  const contents = new Map()
  for await (const row of readCsv(backup.entry('data/content.csv.gz'))) {
    contents.set(row.contentid, {
      id: row.contentid,
      type: CSV_TYPES[row.contenttype] ?? `other:${row.contenttype}`,
      status: row.content_status,
      title: row.title ?? '',
      version: Number.parseInt(row.version, 10) || 1,
      originalId: row.prevver || null,
      parentId: row.parentid || null,
      spaceId: row.spaceid || null,
      containerId: row.pageid || null,
      parentCommentId: row.parentcommentid || null,
      position: Number.parseInt(row.child_position, 10),
      creatorId: row.creator || null,
      modifierId: row.lastmodifier || row.creator || null,
      createdAt: isoDate(row.creationdate),
      updatedAt: isoDate(row.lastmoddate),
      versionComment: row.versioncomment ?? '',
      isFolder: row.contenttype === 'FOLDER',
      isEmbed: row.contenttype === 'EMBED',
      props: {}
    })
  }
  onProgress?.('content')

  for await (const row of readCsv(backup.entry('data/contentproperties.csv.gz'))) {
    if (KEPT_PROPERTIES.has(row.propertyname)) {
      const content = contents.get(row.contentid)
      if (content) {
        content.props[row.propertyname] = row.stringval || row.longval || ''
      }
    }
  }

  const labelNames = new Map()
  for await (const row of readCsv(backup.entry('data/label.csv.gz'))) {
    if (row.namespace === 'global') {
      labelNames.set(row.labelid, row.name)
    }
  }
  const labels = new Map()
  for await (const row of readCsv(backup.entry('data/content_label.csv.gz'))) {
    const name = labelNames.get(row.labelid)
    if (name && row.contentid) {
      labels.set(row.contentid, [...(labels.get(row.contentid) ?? []), name])
    }
  }

  /*
    A cloud backup knows nobody's name or address: a person is an account id and nothing else. The one
    name it does hold is a personal space's, which is its owner's display name.
  */
  const users = new Map()
  for await (const row of readCsv(backup.entry('data/user_mapping.csv.gz'))) {
    users.set(row.user_key, { id: row.user_key, name: '', email: '' })
  }
  for (const space of spaces.values()) {
    if (space.type === 'personal' && space.creatorId && users.has(space.creatorId)) {
      users.get(space.creatorId).name = space.name
    }
  }
  onProgress?.('done')

  return {
    format: 'csv',
    sourceId:
      sourceId ||
      `csv:${[...spaces.values()]
        .map((space) => space.key)
        .sort()
        .join(',')}`,
    spaces,
    contents,
    users,
    labels
  }
}

/** `2026-11-16 10:57:34.083+00`, or an XML backup's same thing with no offset, which is UTC. */
function isoDate(value) {
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d+)?)/.exec(value ?? '')
  return match ? `${match[1]}T${match[2]}Z` : null
}

/** A gzipped or plain ZIP entry as decoded text, a chunk at a time. */
async function* textOf(entry, { gzip = false } = {}) {
  if (!entry) {
    return
  }
  const stream = new TransformStream()
  const finished = entry.getData(stream.writable)
  finished.catch(() => {})
  let readable = stream.readable
  if (gzip) {
    readable = readable.pipeThrough(new DecompressionStream('gzip'))
  }
  const reader = readable.pipeThrough(new TextDecoderStream()).getReader()
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }
      yield value
    }
  } finally {
    reader.cancel().catch(() => {})
  }
  await finished
}

/**
 * The rows of one of a cloud backup's gzipped CSV tables, as objects keyed by its header.
 *
 * RFC 4180 as PostgreSQL's `COPY … CSV` writes it: a field is quoted when it holds a comma, a quote
 * or a line break, and a quote inside one is doubled. A body runs to megabytes and over many lines,
 * so the state carries across chunks rather than a line being read at a time. A table the backup
 * does not have reads as no rows.
 */
export async function* readCsv(entry) {
  let header = null
  let row = []
  let field = ''
  let quoted = false
  // -> A quote just closed, and the next character says whether it was an escaped one
  let quoteSeen = false

  const finishRow = function* () {
    row.push(field)
    field = ''
    if (!header) {
      header = row
    } else if (row.length > 1 || row[0] !== '') {
      const record = {}
      for (let i = 0; i < header.length; i++) {
        record[header[i]] = row[i] ?? ''
      }
      yield record
    }
    row = []
  }

  for await (const chunk of textOf(entry, { gzip: true })) {
    let start = 0
    for (let i = 0; i < chunk.length; i++) {
      const char = chunk[i]
      if (quoted) {
        if (char === '"') {
          field += chunk.slice(start, i)
          quoted = false
          quoteSeen = true
          start = i + 1
        }
        continue
      }
      if (quoteSeen) {
        quoteSeen = false
        if (char === '"') {
          // -> `""` inside a quoted field: one literal quote, and still inside it
          field += '"'
          quoted = true
          start = i + 1
          continue
        }
      }
      if (char === '"') {
        quoted = true
        start = i + 1
      } else if (char === ',') {
        field += chunk.slice(start, i)
        row.push(field)
        field = ''
        start = i + 1
      } else if (char === '\n') {
        // -> A `\r\n` ending may have had its `\r` in the previous chunk
        field = (field + chunk.slice(start, i)).replace(/\r$/, '')
        yield* finishRow()
        start = i + 1
      }
    }
    field += chunk.slice(start)
  }
  if (field !== '' || row.length > 0) {
    yield* finishRow()
  }
}

// ================================================================================================
// XML
// ================================================================================================

async function readXmlIndex(backup, onProgress) {
  let sourceId = ''
  const descriptor = backup.entry('exportDescriptor.properties')
  if (descriptor) {
    const text = await descriptor.getData(new TextWriter())
    sourceId = /^serverId=(.+)$/m.exec(text)?.[1]?.trim() ?? ''
  }

  const spaces = new Map()
  const contents = new Map()
  const properties = new Map()
  const labelNames = new Map()
  const labellings = []
  const confluenceUsers = new Map()
  const crowdUsers = []
  let seen = 0

  for await (const object of readXmlObjects(backup.entry('entities.xml'), {
    // -> The bodies are most of the file and none of the index; the reader skips their text
    skip: (cls, name) => cls === 'BodyContent' && name === 'body'
  })) {
    seen++
    if (seen % 5000 === 0) {
      onProgress?.('content')
    }
    const { cls, id, props, refs, colls } = object
    if (cls === 'Space') {
      spaces.set(id, {
        id,
        key: props.key ?? '',
        name: props.name ?? props.key ?? '',
        type: props.spaceType ?? 'global',
        status: props.spaceStatus ?? 'CURRENT',
        homePageId: refs.homePage ?? null,
        creatorId: refs.creator ?? null
      })
    } else if (XML_TYPES[cls]) {
      const isFolder = props.isFolder === 'true' || cls === 'Folder'
      const isEmbed = props.isEmbed === 'true' || cls === 'Embed'
      contents.set(id, {
        id,
        type: isFolder ? 'folder' : isEmbed ? 'embed' : XML_TYPES[cls],
        status: props.contentStatus ?? 'current',
        title: props.title ?? '',
        version: Number.parseInt(props.version, 10) || 1,
        originalId: refs.originalVersion ?? (props.originalVersionId || null),
        parentId: cls === 'Comment' ? null : (refs.parent ?? null),
        spaceId: refs.space ?? null,
        containerId: refs.containerContent ?? null,
        parentCommentId: cls === 'Comment' ? (refs.parent ?? null) : null,
        position: Number.parseInt(props.position, 10),
        creatorId: refs.creator ?? null,
        modifierId: refs.lastModifier ?? refs.creator ?? null,
        createdAt: isoDate(props.creationDate),
        updatedAt: isoDate(props.lastModificationDate),
        versionComment: props.versionComment ?? '',
        isFolder,
        isEmbed,
        propertyIds: colls.contentProperties ?? [],
        props: {}
      })
    } else if (cls === 'ContentProperty') {
      if (KEPT_PROPERTIES.has(props.name)) {
        properties.set(id, { name: props.name, value: props.stringValue || props.longValue || '' })
      }
    } else if (cls === 'Label') {
      if (props.namespace === 'global') {
        labelNames.set(id, props.name)
      }
    } else if (cls === 'Labelling') {
      if (refs.label && refs.content) {
        labellings.push({ labelId: refs.label, contentId: refs.content })
      }
    } else if (cls === 'ConfluenceUserImpl') {
      confluenceUsers.set(id, { id, name: props.name ?? '', lowerName: props.lowerName ?? '' })
    } else if (cls === 'InternalUser') {
      crowdUsers.push({
        lowerName: (props.lowerName ?? props.name ?? '').toLowerCase(),
        externalId: props.externalId ?? '',
        displayName: props.displayName ?? '',
        email: props.emailAddress ?? ''
      })
    }
  }
  onProgress?.('done')

  // -> A property is owned by its content through a collection, rather than pointing back at it
  for (const content of contents.values()) {
    for (const propertyId of content.propertyIds) {
      const property = properties.get(propertyId)
      if (property) {
        content.props[property.name] = property.value
      }
    }
    delete content.propertyIds
  }

  const labels = new Map()
  for (const { labelId, contentId } of labellings) {
    const name = labelNames.get(labelId)
    if (name) {
      labels.set(contentId, [...(labels.get(contentId) ?? []), name])
    }
  }

  /*
    A Confluence user is a key that content points at; who they are is the directory's row, joined by
    the account id Cloud keeps in `externalId`, or by the user name Data Center shares between the two.
  */
  const byExternal = new Map(crowdUsers.map((user) => [user.externalId, user]))
  const byName = new Map(crowdUsers.map((user) => [user.lowerName, user]))
  const users = new Map()
  for (const user of confluenceUsers.values()) {
    const crowd = byExternal.get(user.id) ?? byName.get(user.lowerName || user.name.toLowerCase())
    users.set(user.id, {
      id: user.id,
      name: crowd?.displayName || user.name,
      email: crowd?.email ?? ''
    })
  }

  return {
    format: 'xml',
    sourceId:
      sourceId ||
      `xml:${[...spaces.values()]
        .map((space) => space.key)
        .sort()
        .join(',')}`,
    spaces,
    contents,
    users,
    labels
  }
}

const XML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function decodeXmlText(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name) => {
    if (name[0] === '#') {
      const code =
        name[1] === 'x' || name[1] === 'X'
          ? Number.parseInt(name.slice(2), 16)
          : Number(name.slice(1))
      try {
        return String.fromCodePoint(code)
      } catch {
        return whole
      }
    }
    return XML_ENTITIES[name.toLowerCase()] ?? whole
  })
}

/**
 * The objects of an `entities.xml`, one at a time.
 *
 * The file is Hibernate's own dump and only ever has this shape, which is what lets a reader this
 * small stream a file of gigabytes:
 *
 * ```xml
 * <hibernate-generic>
 *   <object class="Page" package="…">
 *     <id name="id">123</id>
 *     <property name="title"><![CDATA[…]]></property>          a value
 *     <property name="space" class="Space" …><id name="id">9</id></property>   a reference
 *     <collection name="bodyContents" …><element …><id name="id">5</id></element></collection>
 *   </object>
 * </hibernate-generic>
 * ```
 *
 * @param {{ classes?: Set<string>, skip?: (cls: string, name: string) => boolean }} options `classes`
 *   limits which objects are assembled at all; `skip` names properties whose text is not wanted.
 * @returns {AsyncGenerator<{ cls: string, id: string, props: object, refs: object, colls: object }>}
 */
export async function* readXmlObjects(entry, { classes = null, skip = null } = {}) {
  let buffer = ''
  /** The object being assembled, or null between objects and inside one nobody asked for. */
  let current = null
  let inObject = false
  /** What the next text belongs to: `{ kind: 'id'|'prop'|'ref'|'element', name }`, or null. */
  let target = null
  let text = []
  let capturing = false
  let collection = null

  const flushText = () => {
    const value = text.join('')
    text = []
    return value
  }

  const onOpen = (name, attrs, selfClosing) => {
    if (name === 'object') {
      inObject = true
      current =
        !classes || classes.has(attrs.class)
          ? { cls: attrs.class, id: '', props: {}, refs: {}, colls: {} }
          : null
      return
    }
    if (!current) {
      return
    }
    if (name === 'property') {
      if (selfClosing) {
        current.props[attrs.name] = ''
        return
      }
      if (attrs.class) {
        target = { kind: 'ref', name: attrs.name }
      } else {
        target = { kind: 'prop', name: attrs.name }
        capturing = !skip?.(current.cls, attrs.name)
        text = []
      }
    } else if (name === 'collection') {
      collection = attrs.name
      current.colls[collection] = []
    } else if (name === 'id') {
      capturing = true
      text = []
    }
  }

  const onClose = (name) => {
    if (name === 'object') {
      inObject = false
      const done = current
      current = null
      return done
    }
    if (!current) {
      return null
    }
    if (name === 'id') {
      const value = flushText().trim()
      capturing = false
      if (target?.kind === 'ref') {
        current.refs[target.name] = value
      } else if (collection) {
        current.colls[collection].push(value)
      } else {
        current.id = value
      }
    } else if (name === 'property') {
      if (target?.kind === 'prop') {
        current.props[target.name] = capturing ? flushText() : ''
      }
      capturing = false
      target = null
    } else if (name === 'collection') {
      collection = null
    }
    return null
  }

  for await (const chunk of textOf(entry)) {
    buffer += chunk
    let pos = 0
    for (;;) {
      const lt = buffer.indexOf('<', pos)
      if (lt < 0) {
        // -> Text with no tag after it yet; kept whole until one arrives, since an entity may be split
        break
      }
      if (lt > pos && capturing) {
        text.push(decodeXmlText(buffer.slice(pos, lt)))
      }
      if (buffer.startsWith('<![CDATA[', lt)) {
        const end = buffer.indexOf(']]>', lt + 9)
        if (end < 0) {
          pos = lt
          break
        }
        if (capturing) {
          text.push(buffer.slice(lt + 9, end))
        }
        pos = end + 3
        continue
      }
      if (buffer.startsWith('<!--', lt)) {
        const end = buffer.indexOf('-->', lt + 4)
        if (end < 0) {
          pos = lt
          break
        }
        pos = end + 3
        continue
      }
      const gt = buffer.indexOf('>', lt + 1)
      if (gt < 0) {
        pos = lt
        break
      }
      const tagText = buffer.slice(lt + 1, gt)
      pos = gt + 1
      if (tagText[0] === '?' || tagText[0] === '!') {
        continue
      }
      if (tagText[0] === '/') {
        const done = onClose(tagText.slice(1).trim())
        if (done) {
          yield done
        }
        continue
      }
      const selfClosing = tagText.endsWith('/')
      const body = selfClosing ? tagText.slice(0, -1) : tagText
      const space = body.search(/\s/)
      const name = space < 0 ? body : body.slice(0, space)
      const attrs = {}
      if (space >= 0) {
        for (const match of body.slice(space).matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) {
          attrs[match[1]] = decodeXmlText(match[2])
        }
      }
      if (inObject || name === 'object') {
        onOpen(name, attrs, selfClosing)
        if (selfClosing && name !== 'property') {
          const done = onClose(name)
          if (done) {
            yield done
          }
        }
      }
    }
    buffer = buffer.slice(pos)
  }
}
