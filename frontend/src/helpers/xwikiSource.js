import { BlobReader, Uint8ArrayWriter, ZipReader } from '@zip.js/zip.js'

/**
 * Reading an XWiki XAR export in the browser, for **Import from XWiki**.
 *
 * A XAR is a ZIP: a `package.xml` naming what is in it, and one XML file per document and per
 * translation of one, at `<Space>/<Sub>/<Page>.xml` (`<Page>.<locale>.xml` for a translation). Each
 * holds an `<xwikidoc>`:
 *
 * ```
 * <xwikidoc version="1.5" reference="Main.WebHome" locale="">
 *   <web>Main</web> <name>WebHome</name> <language/> <translation>0</translation>
 *   <creator>xwiki:XWiki.Admin</creator> <creationDate>1700000000000</creationDate>
 *   <author>…</author> <date>…</date> <version>1.3</version>
 *   <title>Home</title> <comment>…</comment> <syntaxId>xwiki/2.1</syntaxId> <hidden>false</hidden>
 *   <content>the page, in its syntax</content>
 *   <attachment> <filename/> <filesize/> <author/> <date/> <content>base64</content> </attachment>
 *   <object> <className>XWiki.XWikiComments</className> <number>0</number>
 *     <property><comment>…</comment></property> … </object>
 *   <versions>an RCS archive of every version's XML — only in an export "with history"</versions>
 * </xwikidoc>
 * ```
 *
 * The XML is read by `parseXml` here rather than the browser's `DOMParser`: XWiki writes XML 1.1, so
 * that a page may hold control characters as `&#1;`, and an XML 1.0 parser refuses the whole file for
 * one of those. The shape is simple and XWiki's own, and the reader only has to be right for it.
 *
 * A document's history is the RCS archive in `<versions>` (`readArchive`): the newest version whole,
 * and each older one as the edit script that turns the version after it into it, with a whole one kept
 * every few versions. Each version is a complete `<xwikidoc>` of its own, so its title, author and
 * content are read the way the current one's are.
 *
 * References are spelt as `helpers/xwikiSyntax.ts` on the server spells them (`referenceKey`), since
 * the index the browser uploads is looked up by what the converter asks for.
 */

/** Refused by the reader, since the server never sees the source. */
export class SourceError extends Error {}

/** Spaces of XWiki's own, which start unticked: they hold the wiki's machinery and its sample pages. */
export const STOCK_SPACES = new Set(['XWiki', 'Help', 'Sandbox'])

/**
 * Classes whose object makes a document part of the wiki's machinery rather than its content — a
 * skin, a stylesheet, a macro written in a page, a sheet binding. Such a document is hidden in a
 * modern XWiki anyway; this catches the ones an older one left visible.
 */
const TECHNICAL_CLASSES = new Set([
  'XWiki.StyleSheetExtension',
  'XWiki.JavaScriptExtension',
  'XWiki.UIExtensionClass',
  'XWiki.WikiMacroClass',
  'XWiki.XWikiSkins',
  'XWiki.ClassSheetBinding',
  'XWiki.DocumentSheetBinding',
  'XWiki.TemplateProviderClass',
  'XWiki.TranslationDocumentClass',
  'XWiki.XWikiPreferences',
  'XWiki.XWikiGlobalRights',
  'XWiki.ConfigurableClass',
  'XWiki.ScriptComponentClass',
  'XWiki.ComponentClass',
  'XWiki.SchedulerJobClass',
  'XWiki.RequiredRightClass',
  'Panels.PanelClass',
  'AppWithinMinutes.LiveTableClass',
  'AppWithinMinutes.MetadataClass'
])

// ================================================================================================
// THE ARCHIVE
// ================================================================================================

/**
 * Open a XAR (a `File`).
 *
 * @returns {Promise<{ names(), text(name), close() }>} `text(name)` is an entry as text, or null.
 */
export async function openSource(file) {
  const reader = new ZipReader(new BlobReader(file))
  let entries
  try {
    entries = await reader.getEntries()
  } catch (err) {
    await reader.close().catch(() => {})
    throw new SourceError(
      `This file could not be opened as a XAR, which is a ZIP archive. (${err.message})`
    )
  }
  const files = new Map()
  for (const entry of entries) {
    if (!entry.directory) {
      files.set(entry.filename.replaceAll('\\', '/'), entry)
    }
  }
  if (![...files.keys()].some((name) => name.endsWith('.xml') && name !== 'package.xml')) {
    await reader.close().catch(() => {})
    throw new SourceError(
      'No XWiki documents were found in this file. Export the pages from XWiki as a XAR (Administration → Content → Export) and select that.'
    )
  }
  const decoder = new TextDecoder()
  return {
    *names() {
      yield* files.keys()
    },
    text: async (name) => {
      const entry = files.get(name)
      return entry ? decoder.decode(await entry.getData(new Uint8ArrayWriter())) : null
    },
    close: () => reader.close().catch(() => {})
  }
}

// ================================================================================================
// XML
// ================================================================================================

const ENTITIES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }

function decodeEntities(text) {
  if (!text.includes('&')) {
    return text
  }
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (match, name) => {
    if (name.startsWith('#')) {
      const code = name[1] === 'x' ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1))
      try {
        return String.fromCodePoint(code)
      } catch {
        return ''
      }
    }
    return ENTITIES[name] ?? match
  })
}

/**
 * XML as a tree of `{ name, attrs, children }`, a child being an element or a string. Comments,
 * processing instructions and a doctype are skipped; CDATA is text. Non-validating, and forgiving the
 * way a reader of one producer's output can be: a stray close tag is ignored.
 */
export function parseXml(text) {
  const root = { name: '#document', attrs: {}, children: [] }
  const stack = [root]
  const pushText = (value) => {
    if (value) {
      stack.at(-1).children.push(value)
    }
  }
  let i = 0
  while (i < text.length) {
    const lt = text.indexOf('<', i)
    if (lt < 0) {
      pushText(decodeEntities(text.slice(i)))
      break
    }
    if (lt > i) {
      pushText(decodeEntities(text.slice(i, lt)))
    }
    if (text.startsWith('<!--', lt)) {
      const end = text.indexOf('-->', lt + 4)
      i = end < 0 ? text.length : end + 3
      continue
    }
    if (text.startsWith('<![CDATA[', lt)) {
      const end = text.indexOf(']]>', lt + 9)
      pushText(text.slice(lt + 9, end < 0 ? text.length : end))
      i = end < 0 ? text.length : end + 3
      continue
    }
    if (text[lt + 1] === '?' || text[lt + 1] === '!') {
      const end = text.indexOf('>', lt)
      i = end < 0 ? text.length : end + 1
      continue
    }
    if (text[lt + 1] === '/') {
      const end = text.indexOf('>', lt)
      const name = text.slice(lt + 2, end < 0 ? text.length : end).trim()
      const at = stack.findLastIndex((el) => el.name === name)
      if (at > 0) {
        stack.length = at
      }
      i = end < 0 ? text.length : end + 1
      continue
    }
    // -> A start tag, to the `>` that is not inside a quoted attribute
    let end = lt + 1
    let quote = ''
    for (; end < text.length; end++) {
      const char = text[end]
      if (quote) {
        if (char === quote) {
          quote = ''
        }
      } else if (char === '"' || char === "'") {
        quote = char
      } else if (char === '>') {
        break
      }
    }
    const raw = text.slice(lt + 1, end)
    const selfClosing = raw.endsWith('/')
    const body = selfClosing ? raw.slice(0, -1) : raw
    const name = /^[^\s/>]+/.exec(body)?.[0] ?? ''
    const attrs = {}
    for (const match of body
      .slice(name.length)
      .matchAll(/([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
      attrs[match[1]] = decodeEntities(match[3] ?? match[4] ?? '')
    }
    const element = { name, attrs, children: [] }
    stack.at(-1).children.push(element)
    if (!selfClosing) {
      stack.push(element)
    }
    i = end + 1
  }
  return root
}

function child(element, name) {
  return element?.children.find((node) => typeof node !== 'string' && node.name === name) ?? null
}

function childrenNamed(element, name) {
  return (element?.children ?? []).filter((node) => typeof node !== 'string' && node.name === name)
}

function textOf(element) {
  if (!element) {
    return ''
  }
  return element.children.map((node) => (typeof node === 'string' ? node : textOf(node))).join('')
}

// ================================================================================================
// REFERENCES — the same spelling as `helpers/xwikiSyntax.ts`
// ================================================================================================

function indexOfUnescaped(text, char) {
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\') {
      i++
    } else if (text[i] === char) {
      return i
    }
  }
  return -1
}

/** A reference's names: the wiki dropped, split on unescaped dots, unescaped. */
export function parseReference(text) {
  let value = (text ?? '').trim()
  const colon = indexOfUnescaped(value, ':')
  if (colon >= 0) {
    value = value.slice(colon + 1)
  }
  value = value.replace(/^\./, '')
  const parts = []
  let current = ''
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '\\' && i + 1 < value.length) {
      current += value[++i]
    } else if (value[i] === '.') {
      parts.push(current)
      current = ''
    } else {
      current += value[i]
    }
  }
  parts.push(current)
  return parts.filter((part) => part !== '')
}

/** The key a document or space is indexed by. */
export function referenceKey(parts) {
  return parts.map((part) => part.replaceAll('\\', '\\\\').replaceAll('.', '\\.')).join('.')
}

/**
 * Who a user reference is, as the key of their profile document (`XWiki.jdoe`) — or null for the
 * guest, whose edits become the importer's. A bare name is in the `XWiki` space, as XWiki reads one.
 */
export function authorKey(reference) {
  const parts = parseReference(reference)
  if (parts.length < 1) {
    return null
  }
  const key = referenceKey(parts.length === 1 ? ['XWiki', parts[0]] : parts)
  return key === 'XWiki.XWikiGuest' ? null : key
}

// ================================================================================================
// DOCUMENTS
// ================================================================================================

/** An `<xwikidoc>` date: milliseconds since the epoch, as XWiki writes them. ISO, or null. */
function epochOf(text) {
  const ms = Number.parseInt((text ?? '').trim(), 10)
  return Number.isFinite(ms) && ms > 0
    ? Temporal.Instant.fromEpochMilliseconds(ms).toString()
    : null
}

/**
 * A date property of an object (`2024-03-01 14:05:09.0`). XWiki writes it in the server's own time
 * zone and does not say which; the browser running the import is taken to be in the same one.
 */
function propertyDateOf(text) {
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)/.exec((text ?? '').trim())
  if (!match) {
    return null
  }
  try {
    return Temporal.PlainDateTime.from(`${match[1]}T${match[2]}`)
      .toZonedDateTime(Temporal.Now.timeZoneId())
      .toInstant()
      .toString()
  } catch {
    return null
  }
}

/** An object's properties: a name → its text, or the list of its `<value>`s for a list property. */
function propertiesOf(object) {
  const properties = new Map()
  for (const property of childrenNamed(object, 'property')) {
    for (const node of property.children) {
      if (typeof node === 'string') {
        continue
      }
      const values = childrenNamed(node, 'value')
      properties.set(node.name, values.length > 0 ? values.map(textOf) : textOf(node))
    }
  }
  return properties
}

/** A document's title as XWiki showed it, unless it is a script, which cannot be run here. */
function plainTitle(title) {
  const value = (title ?? '').trim()
  return /[$#]/.test(value) ? '' : value
}

/**
 * One `<xwikidoc>`, as what the import needs of it. `withContent` reads the body, the attachments'
 * bytes, the comments and the history archive too — the import's second pass, one document at a time.
 */
export function readDocument(xml, { withContent = false } = {}) {
  const doc = child(parseXml(xml), 'xwikidoc')
  if (!doc) {
    return null
  }
  const text = (name) => textOf(child(doc, name)).trim()
  const parts = doc.attrs.reference
    ? parseReference(doc.attrs.reference)
    : [...parseReference(text('web')), text('name')].filter(Boolean)
  if (parts.length < 2) {
    return null
  }
  const objects = childrenNamed(doc, 'object').map((object) => ({
    className: textOf(child(object, 'className')).trim(),
    number: textOf(child(object, 'number')).trim(),
    properties: propertiesOf(object)
  }))
  const classDefinition = child(doc, 'class')
  const definesClass = Boolean(
    classDefinition?.children.some(
      (node) => typeof node !== 'string' && node.children.some((sub) => typeof sub !== 'string')
    )
  )
  const user = objects.find((object) => object.className === 'XWiki.XWikiUsers')
  const tagObject = objects.find((object) => object.className === 'XWiki.TagClass')
  const rawTags = tagObject?.properties.get('tags') ?? []
  const tags = (Array.isArray(rawTags) ? rawTags : rawTags.split(/[|,]/))
    .map((tag) => tag.trim())
    .filter(Boolean)
  const comments = objects.filter((object) => object.className === 'XWiki.XWikiComments')
  const versions = textOf(child(doc, 'versions'))

  const result = {
    key: referenceKey(parts),
    space: parts.slice(0, -1),
    name: parts.at(-1),
    locale: doc.attrs.locale ?? text('language'),
    isTranslation: text('translation') === '1',
    title: plainTitle(text('title')),
    syntax: text('syntaxId') || 'xwiki/1.0',
    hidden: text('hidden') === 'true',
    technical: definesClass || objects.some((object) => TECHNICAL_CLASSES.has(object.className)),
    isGroup: objects.some((object) => object.className === 'XWiki.XWikiGroups'),
    user: user
      ? {
          name:
            [user.properties.get('first_name'), user.properties.get('last_name')]
              .filter((part) => typeof part === 'string' && part.trim())
              .join(' ')
              .trim() || parts.at(-1),
          email: String(user.properties.get('email') ?? '').trim()
        }
      : null,
    authorId: authorKey(text('contentAuthor') || text('author')),
    creatorId: authorKey(text('creator')),
    createdAt: epochOf(text('creationDate')),
    updatedAt: epochOf(text('contentUpdateDate')) ?? epochOf(text('date')),
    version: text('version'),
    comment: text('comment'),
    tags,
    attachments: childrenNamed(doc, 'attachment').map((attachment) => ({
      name: textOf(child(attachment, 'filename')).trim(),
      size: Number.parseInt(textOf(child(attachment, 'filesize')), 10) || 0,
      authorId: authorKey(textOf(child(attachment, 'author'))),
      ...(withContent ? { base64: textOf(child(attachment, 'content')) } : {})
    })),
    commentCount: comments.length,
    commentAuthors: comments.map((object) => commentAuthorOf(object)),
    // -> The authors and dates of the versions, out of the archive's header, without rebuilding any
    versionHeaders: versions ? readArchiveHeader(versions) : []
  }
  if (withContent) {
    result.content = textOf(child(doc, 'content'))
    result.comments = comments
    result.versions = versions
  }
  return result
}

/** Who wrote a comment: a user, or null for a guest, who signs with a name rather than a reference. */
function commentAuthorOf(object) {
  const author = String(object.properties.get('author') ?? '').trim()
  return author.includes('.') || author.includes(':') ? authorKey(author) : null
}

/**
 * A document's comments as the comments stream takes them, threads first. Replies are one level deep
 * here, so a reply to a reply names the comment that started its thread.
 */
export function commentsOf(document) {
  const byNumber = new Map(document.comments.map((object) => [object.number, object]))
  const threadOf = (object) => {
    const seen = new Set()
    let current = object
    for (;;) {
      const parent = String(current.properties.get('replyto') ?? '').trim()
      if (!parent || parent === '-1' || !byNumber.has(parent) || seen.has(parent)) {
        return current === object ? null : current.number
      }
      seen.add(parent)
      current = byNumber.get(parent)
    }
  }
  const records = document.comments.map((object) => {
    const thread = threadOf(object)
    const selection = String(object.properties.get('selection') ?? '').trim()
    return {
      id: `${document.key}#${object.number}`,
      pageId: document.key,
      parentId: thread === null ? null : `${document.key}#${thread}`,
      syntax: document.syntax,
      body: String(object.properties.get('comment') ?? ''),
      authorId: commentAuthorOf(object),
      createdAt: propertyDateOf(String(object.properties.get('date') ?? '')),
      selection: selection
        ? {
            exact: selection,
            prefix: String(object.properties.get('selectionLeftContext') ?? ''),
            suffix: String(object.properties.get('selectionRightContext') ?? '')
          }
        : null
    }
  })
  return [
    ...records.filter((record) => !record.parentId),
    ...records.filter((record) => record.parentId)
  ]
}

/** An attachment's bytes, out of its base64. */
export function decodeBase64(base64) {
  const clean = base64.replace(/\s+/g, '')
  if (typeof Uint8Array.fromBase64 === 'function') {
    return Uint8Array.fromBase64(clean)
  }
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// ================================================================================================
// HISTORY
// ================================================================================================

const RCS_KEYWORDS = new Set([
  'head',
  'branch',
  'access',
  'symbols',
  'locks',
  'strict',
  'comment',
  'expand',
  'date',
  'author',
  'state',
  'branches',
  'next',
  'desc',
  'log',
  'text'
])

/** An RCS file's tokens: words, `;`, and `@strings@` with `@@` for an at sign. */
function rcsTokens(text) {
  const tokens = []
  let i = 0
  while (i < text.length) {
    const char = text[i]
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === '\f') {
      i++
    } else if (char === ';') {
      tokens.push({ type: ';' })
      i++
    } else if (char === '@') {
      let value = ''
      i++
      for (;;) {
        const at = text.indexOf('@', i)
        if (at < 0) {
          value += text.slice(i)
          i = text.length
          break
        }
        value += text.slice(i, at)
        if (text[at + 1] === '@') {
          value += '@'
          i = at + 2
        } else {
          i = at + 1
          break
        }
      }
      tokens.push({ type: 'string', value })
    } else {
      let end = i
      while (end < text.length && !/[\s;@]/.test(text[end])) {
        end++
      }
      tokens.push({ type: 'word', value: text.slice(i, end) })
      i = end
    }
  }
  return tokens
}

/**
 * An RCS archive as `{ head, revisions }`, each revision `{ version, date, author, state, next, log,
 * text }`. The admin and delta phrases are `keyword values… ;`; a revision number where a keyword
 * would be starts the next revision. The deltatexts after `desc` are each a revision number, its
 * `log` and its `text`.
 */
function parseArchive(text, { headerOnly = false } = {}) {
  const tokens = rcsTokens(
    headerOnly ? text.slice(0, text.search(/\ndesc\b/) + 1 || text.length) : text
  )
  const revisions = new Map()
  let head = null
  let current = null
  let p = 0
  while (p < tokens.length) {
    const token = tokens[p]
    if (token.type !== 'word') {
      p++
      continue
    }
    if (token.value === 'desc') {
      p += tokens[p + 1]?.type === 'string' ? 2 : 1
      break
    }
    if (!RCS_KEYWORDS.has(token.value) && /^\d+(?:\.\d+)+$/.test(token.value)) {
      current = {
        version: token.value,
        date: '',
        author: '',
        state: '',
        next: '',
        log: '',
        text: null
      }
      revisions.set(token.value, current)
      p++
      continue
    }
    const keyword = token.value
    const values = []
    for (p++; p < tokens.length && tokens[p].type !== ';'; p++) {
      values.push(tokens[p].value)
    }
    p++
    if (keyword === 'head') {
      head = values[0] ?? null
    } else if (current && ['date', 'author', 'state', 'next'].includes(keyword)) {
      current[keyword] = values[0] ?? ''
    }
  }
  while (p < tokens.length) {
    const token = tokens[p]
    const revision = token.type === 'word' ? revisions.get(token.value) : null
    if (!revision) {
      p++
      continue
    }
    for (p++; p < tokens.length; p++) {
      const word = tokens[p].type === 'word' ? tokens[p].value : null
      if (word === 'log' && tokens[p + 1]?.type === 'string') {
        revision.log = tokens[++p].value
      } else if (word === 'text' && tokens[p + 1]?.type === 'string') {
        revision.text = tokens[++p].value
        p++
        break
      }
    }
  }
  return { head, revisions }
}

/** An RCS date (`2024.03.01.14.05.09`, UTC) as ISO, or null. Two-digit years are 19xx, as in RCS. */
function rcsDateOf(value) {
  const match = /^(\d{2,4})\.(\d{1,2})\.(\d{1,2})\.(\d{1,2})\.(\d{1,2})\.(\d{1,2})$/.exec(
    value ?? ''
  )
  if (!match) {
    return null
  }
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number)
  try {
    return Temporal.PlainDateTime.from({
      year: year < 100 ? 1900 + year : year,
      month,
      day,
      hour,
      minute,
      second
    })
      .toZonedDateTime('UTC')
      .toInstant()
      .toString()
  } catch {
    return null
  }
}

/** The versions an archive holds, newest first, without their text: `{ version, authorId, date }`. */
function readArchiveHeader(text) {
  try {
    const { head, revisions } = parseArchive(text, { headerOnly: true })
    return chainOf(head, revisions).map((revision) => ({
      version: revision.version,
      authorId: authorKey(revision.author),
      date: rcsDateOf(revision.date)
    }))
  } catch {
    return []
  }
}

/** The trunk, from the head down `next`, newest first. */
function chainOf(head, revisions) {
  const chain = []
  const seen = new Set()
  for (let version = head; version && revisions.has(version) && !seen.has(version);) {
    seen.add(version)
    const revision = revisions.get(version)
    chain.push(revision)
    version = revision.next
  }
  return chain
}

/** A text as RCS counts it: lines, without the empty one after a final newline. */
function linesOf(text) {
  const lines = text.split('\n')
  if (lines.at(-1) === '') {
    lines.pop()
  }
  return lines
}

/**
 * Apply an RCS edit script — `dL N` deletes N lines from line L, `aL N` adds the N lines that follow
 * after line L, every number counted in the text it is applied to — to the lines of the version after.
 */
function applyEditScript(base, script) {
  const commands = linesOf(script)
  const out = []
  let pos = 0
  for (let k = 0; k < commands.length;) {
    const command = /^([ad])(\d+) (\d+)$/.exec(commands[k])
    if (!command) {
      throw new Error(`Not an RCS edit command: "${commands[k].slice(0, 40)}"`)
    }
    const at = Number(command[2])
    const n = Number(command[3])
    if (command[1] === 'd') {
      while (pos < at - 1) {
        out.push(base[pos++])
      }
      pos += n
      k++
    } else {
      while (pos < at) {
        out.push(base[pos++])
      }
      out.push(...commands.slice(k + 1, k + 1 + n))
      k += 1 + n
    }
  }
  while (pos < base.length) {
    out.push(base[pos++])
  }
  return out
}

/**
 * Every version of a document out of its `<versions>` archive, oldest first: `{ version, xml, date,
 * author, log }`. XWiki marks a version kept whole with the state `full` and one kept as an edit
 * script with `diff`; a state it did not write is told by looking — a whole version is XML.
 */
export function readArchive(text) {
  const { head, revisions } = parseArchive(text)
  const versions = []
  let lines = null
  for (const revision of chainOf(head, revisions)) {
    if (revision.text === null) {
      throw new Error(`The version ${revision.version} has no text in the archive.`)
    }
    const whole =
      revision.state === 'full' ||
      lines === null ||
      (revision.state !== 'diff' && /^\s*</.test(revision.text))
    lines = whole ? linesOf(revision.text) : applyEditScript(lines, revision.text)
    versions.push({
      version: revision.version,
      xml: lines.join('\n'),
      date: rcsDateOf(revision.date),
      authorId: authorKey(revision.author),
      log: revision.log
    })
  }
  return versions.reverse()
}

// ================================================================================================
// THE INDEX
// ================================================================================================

/**
 * Everything but the bodies, the attachments' bytes and the versions' text, which are read again as
 * they are posted — a XAR's worth of them is never held at once.
 *
 * @returns {Promise<{
 *   name: string, withHistory: boolean,
 *   documents: Map<string, object>, users: Map<string, { id, name, email }>,
 *   skipped: Map<string, number>
 * }>} `documents` are what `readDocument` reads, plus the entry they are in (`file`). Translations,
 *   space preferences, user profiles and groups are not documents to import, and are counted instead.
 */
export async function readIndex(source, { onProgress } = {}) {
  const names = [...source.names()].filter(
    (name) => name.endsWith('.xml') && name !== 'package.xml'
  )
  const packageXml = await source.text('package.xml')
  const infos = packageXml ? child(child(parseXml(packageXml), 'package'), 'infos') : null

  const documents = new Map()
  const users = new Map()
  const skipped = new Map()
  const skip = (kind) => skipped.set(kind, (skipped.get(kind) ?? 0) + 1)
  let withHistory = false
  let done = 0
  for (const name of names) {
    if (++done % 50 === 0) {
      onProgress?.(done / names.length)
    }
    let document
    try {
      document = readDocument((await source.text(name)) ?? '')
    } catch {
      document = null
    }
    if (!document) {
      skip('unreadable')
      continue
    }
    if (document.user) {
      users.set(document.key, { id: document.key, ...document.user })
      continue
    }
    if (document.isTranslation) {
      skip('translations')
      continue
    }
    if (document.name === 'WebPreferences' || document.key === 'XWiki.XWikiPreferences') {
      skip('preferences')
      continue
    }
    if (document.isGroup) {
      skip('groups')
      continue
    }
    if (documents.has(document.key)) {
      skip('duplicates')
      continue
    }
    withHistory ||= document.versionHeaders.length > 1
    documents.set(document.key, { ...document, file: name })
  }
  onProgress?.(1)
  return {
    name: textOf(child(infos, 'name')).trim(),
    withHistory,
    documents,
    users,
    skipped
  }
}
