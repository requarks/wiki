import { zstdDecompressSync } from 'node:zlib'
import { inArray } from 'drizzle-orm'

import {
  commentAnnotations as annotationsTable,
  comments as commentsTable,
  pageHistory as pageHistoryTable,
  users as usersTable
} from '../db/schema.ts'
import {
  collectStorageRefs,
  newStorageLosses,
  storageToHtml,
  type StorageLosses,
  type StorageRefs,
  type StorageResolver
} from '../helpers/confluenceStorage.ts'
import { htmlToMarkdown, type ConversionLosses } from '../helpers/htmlToMarkdown.ts'
import { CustomError } from '../helpers/common.ts'
import { sanitizeFileName } from './assets.ts'

import type { CommentAnchor } from './comments.ts'
import type { ImportSession, ImportSessionSite, IngestResult } from './import.ts'

/**
 * Import from Confluence — writing what the browser read out of a Confluence backup.
 *
 * The backup itself never reaches this server, as a `.wkbackup` does not: the browser opens it
 * (`frontend/src/helpers/confluenceBackup.js`), works out where every page will live, and posts records
 * of the shape documented on each stream below through the import session routes. A session opened
 * with `source: 'confluence'` sends every site stream here instead of to the 2.x reader in
 * `models/import.ts`; the batching, the staged blobs, the id map and finishing are that model's.
 *
 * **The browser decides the paths, this decides the content.** A page's path needs the whole tree in
 * view — its ancestors' titles, its siblings' for a collision — and the browser has that from its first
 * pass. What a page SAYS needs the storage format converted (`helpers/confluenceStorage.ts`), which is
 * cheerio and Turndown, and a Cloud backup's bodies are zstd that only this side can inflate. So the
 * browser uploads an index of everything a body may point at (`index`), then the bodies as they are.
 *
 * `dev/specs/confluence-import.md` is the design; `.claude/rules/confluence-import.md` the summary.
 */

/** What an index row is, by `kind`. Keys are joined with a newline, which no title or name holds. */
type RefKind = 'page' | 'pageId' | 'file' | 'user' | 'space' | 'anchor'

const KEY_SEPARATOR = '\n'

/** How many macro names a batch's line about them lists before it counts the rest. */
const MACROS_LISTED = 12

/** A body as the browser sends it: XHTML as stored, or a Cloud backup's base64 zstd. */
function decodeBody(record: any): string {
  const body = typeof record?.body === 'string' ? record.body : ''
  if (record?.bodyEncoding === 'zstd') {
    return zstdDecompressSync(Buffer.from(body, 'base64')).toString('utf8')
  }
  return body
}

function stringOf(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function dateOf(value: unknown): Date | undefined {
  if (typeof value !== 'string' || !value) {
    return undefined
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

/**
 * Whether a converted page says anything — a word, a picture, a block. One left with nothing but a
 * rule or some punctuation was only ever a frame for what a macro listed.
 */
function hasSubstance(content: string): boolean {
  return /[\p{L}\p{N}]/u.test(content) || /!\[|<img|block-/.test(content)
}

function keyOf(...parts: string[]): string {
  return parts.join(KEY_SEPARATOR)
}

class ConfluenceImport {
  /**
   * Write one batch of a Confluence session.
   *
   * Called by `importer.ingest` once the session, the stream's tick and the target site are checked;
   * what it returns is counted against the session there.
   */
  async ingest(
    session: ImportSession,
    stream: string,
    target: ImportSessionSite,
    records: any[]
  ): Promise<IngestResult> {
    switch (stream) {
      case 'index':
        return this.#indexStream(session, records)
      case 'tree':
        return WIKI.models.importer.folderStream(target, records)
      case 'assets':
        return WIKI.models.importer.fileStream(session, target, records)
      case 'pages':
        return this.#pagesStream(session, target, records)
      case 'page-history':
        return this.#historyStream(session, target, records)
      case 'comments':
        return this.#commentsStream(session, target, records)
      default:
        throw new CustomError(
          'importUnknownStream',
          `A Confluence import has no "${stream}" stream.`,
          400
        )
    }
  }

  // ==============================================================================================
  // INDEX
  // ==============================================================================================

  /**
   * What the bodies may point at, ahead of the bodies.
   *
   * `{ kind: 'page', id, spaceKey, title, path }` — a page by its space and title (what a link names)
   * and by its content id (what a newer link names). `{ kind: 'file', spaceKey, title, fileName,
   * folder }` — an attachment, by the page it is on. `{ kind: 'user', id, name }` — a person, by
   * account id or user key. `{ kind: 'space', spaceKey, path }` — where a space's pages went.
   *
   * Upserted, so a re-run that sends the index again is a no-op on what is already there.
   */
  async #indexStream(session: ImportSession, records: any[]): Promise<IngestResult> {
    const rows: Array<{ kind: RefKind; key: string; value: any }> = []
    let skipped = 0
    for (const record of records) {
      const kind = stringOf(record?.kind)
      if (kind === 'page' && record.title && typeof record.path === 'string') {
        rows.push({
          kind: 'page',
          key: keyOf(stringOf(record.spaceKey), record.title),
          value: { path: record.path, id: String(record.id ?? '') }
        })
        if (record.id) {
          rows.push({ kind: 'pageId', key: String(record.id), value: { path: record.path } })
        }
      } else if (kind === 'file' && record.fileName) {
        rows.push({
          kind: 'file',
          key: keyOf(stringOf(record.spaceKey), stringOf(record.title), record.fileName),
          value: { folder: stringOf(record.folder), fileName: record.fileName }
        })
      } else if (kind === 'user' && record.id) {
        rows.push({ kind: 'user', key: String(record.id), value: { name: stringOf(record.name) } })
      } else if (kind === 'space' && record.spaceKey) {
        rows.push({ kind: 'space', key: record.spaceKey, value: { path: stringOf(record.path) } })
      } else {
        skipped++
      }
    }
    await WIKI.models.importer.putRefs(session.id, rows)
    return { imported: records.length - skipped, skipped, warnings: [] }
  }

  /**
   * Everything a batch of bodies points at, looked up once per kind, as the resolver the converter
   * asks. A person is named by what Confluence called them, or failing that by the account they were
   * mapped onto here.
   */
  async #resolverFor(session: ImportSession, refs: StorageRefs): Promise<StorageResolver> {
    const pages = await WIKI.models.importer.getRefs(
      session.id,
      'page',
      refs.pages.map((ref) => keyOf(ref.spaceKey, ref.title))
    )
    const pageIds = await WIKI.models.importer.getRefs(session.id, 'pageId', refs.pageIds)
    const files = await WIKI.models.importer.getRefs(
      session.id,
      'file',
      refs.files.map((ref) => keyOf(ref.spaceKey, ref.title, ref.fileName))
    )
    const users = await WIKI.models.importer.getRefs(session.id, 'user', refs.users)
    const spaces = await WIKI.models.importer.getRefs(session.id, 'space', refs.spaces)

    const mapped = await WIKI.models.importer.resolveIds(session.id, 'user', refs.users)
    const accountNames = new Map<string, string>()
    if (mapped.size > 0) {
      const rows = await WIKI.db
        .select({ id: usersTable.id, name: usersTable.name })
        .from(usersTable)
        .where(inArray(usersTable.id, [...new Set(mapped.values())]))
      const byId = new Map(rows.map((row) => [row.id, row.name]))
      for (const [sourceId, userId] of mapped) {
        const name = byId.get(userId)
        if (name) {
          accountNames.set(sourceId, name)
        }
      }
    }

    // -> The site's home page is `home` as a path and `/` as an address
    const href = (path: string) => (path === 'home' ? '' : path)
    return {
      pagePath: (spaceKey, title) => {
        const found = pages.get(keyOf(spaceKey, title))
        return found ? href(found.path) : null
      },
      pagePathById: (id) => {
        const found = pageIds.get(id)
        return found ? href(found.path) : null
      },
      filePath: (spaceKey, title, fileName) => {
        const found = files.get(keyOf(spaceKey, title, fileName))
        if (!found) {
          return null
        }
        const name = sanitizeFileName(found.fileName)
        return found.folder ? `/${found.folder}/${name}` : `/${name}`
      },
      userName: (id) => users.get(id)?.name || accountNames.get(id) || null,
      spacePath: (spaceKey) => {
        const found = spaces.get(spaceKey)
        return found ? href(found.path) : null
      }
    }
  }

  // ==============================================================================================
  // PAGES
  // ==============================================================================================

  /**
   * Decode and convert a batch of bodies, looking up everything they point at in one go.
   *
   * @returns Per record, the converted content (null when the body could not be read) and the inline
   *   comment passages it marks.
   */
  async #convertBatch(
    session: ImportSession,
    records: any[],
    losses: StorageLosses,
    codeLosses: Map<string, Set<string>>,
    { markdown }: { markdown: boolean }
  ): Promise<Array<{ content: string; anchors: Map<string, CommentAnchor> } | null>> {
    const decoded = records.map((record) => {
      try {
        return decodeBody(record)
      } catch {
        return null
      }
    })
    const refs: StorageRefs = { pages: [], pageIds: [], files: [], users: [], spaces: [] }
    decoded.forEach((body, index) => {
      if (!body) {
        return
      }
      const found = collectStorageRefs(
        body,
        stringOf(records[index]?.spaceKey),
        stringOf(records[index]?.pageTitle ?? records[index]?.title)
      )
      refs.pages.push(...found.pages)
      refs.pageIds.push(...found.pageIds)
      refs.files.push(...found.files)
      refs.users.push(...found.users)
      refs.spaces.push(...found.spaces)
    })
    const resolve = await this.#resolverFor(session, refs)

    return decoded.map((body, index) => {
      if (body === null) {
        return null
      }
      const record = records[index]
      const { html, anchors } = storageToHtml(
        body,
        {
          spaceKey: stringOf(record?.spaceKey),
          // -> An attachment with no page named is on the page the body belongs to — for a comment,
          //    the page it is ON, not its own empty title
          title: stringOf(record?.pageTitle ?? record?.title),
          // -> The home page's children are at the site root, everybody else's under their page
          childrenPath: stringOf(record?.path) === 'home' ? '' : stringOf(record?.path),
          resolve
        },
        losses
      )
      if (!markdown) {
        return { content: html, anchors }
      }
      const report: ConversionLosses = { codeFormatting: new Set() }
      const content = htmlToMarkdown(html, report)
      if (report.codeFormatting.size > 0) {
        codeLosses.set(stringOf(record?.path, stringOf(record?.title)), report.codeFormatting)
      }
      return { content, anchors }
    })
  }

  /**
   * `{ id, spaceKey, title, path, body, bodyEncoding, labels, hasChildren, authorId, createdAt,
   * updatedAt }` — the current version of a page, at the path the browser worked out. Its labels in Confluence's
   * `global` namespace are its tags; the others are Confluence's own bookkeeping and never sent.
   *
   * Converted to markdown and filed under the visual editor, or kept as HTML under the markdown
   * editor, which renders it as it stands — the session's `htmlConversion`, as for a 2.x page written
   * in its WYSIWYG editor.
   */
  async #pagesStream(
    session: ImportSession,
    target: ImportSessionSite,
    records: any[]
  ): Promise<IngestResult> {
    const warnings: string[] = []
    const losses = newStorageLosses()
    const codeLosses = new Map<string, Set<string>>()
    const markdown = session.htmlConversion !== 'html'
    const editor = markdown ? 'visual' : 'markdown'
    const locale = WIKI.models.importer.primaryLocaleOf(target.siteId)
    const converted = await this.#convertBatch(session, records, losses, codeLosses, { markdown })
    const anchors: Array<{ kind: RefKind; key: string; value: any }> = []
    let imported = 0
    let skipped = 0

    for (const [index, record] of records.entries()) {
      const pagePath = stringOf(record?.path).replace(/^\/+|\/+$/g, '')
      const result = converted[index]
      if (!pagePath || !result) {
        warnings.push(
          `The page "${stringOf(record?.title, String(record?.id))}" could not be read and was not imported.`
        )
        skipped++
        continue
      }
      for (const [ref, anchor] of result.anchors) {
        anchors.push({ kind: 'anchor', key: ref, value: anchor })
      }
      const content = hasSubstance(result.content)
        ? result.content
        : this.#emptyPage(record, markdown)
      try {
        const authorId = await WIKI.models.importer.authorFor(session, record?.authorId)
        const page = await WIKI.models.notifications.withOrigin('import', () =>
          WIKI.models.pages.adoptStoredPage({
            siteId: target.siteId,
            locale,
            path: pagePath,
            title: stringOf(record?.title, pagePath) || pagePath,
            editor,
            tags: (Array.isArray(record?.labels) ? record.labels : []).map((label: unknown) =>
              stringOf(label)
            ),
            isPublished: true,
            content,
            createdAt: dateOf(record?.createdAt),
            updatedAt: dateOf(record?.updatedAt),
            authorId,
            overwrite: session.overwrite
          })
        )
        const pageId =
          page?.id ??
          // -> Already here with overwrite off: still what this Confluence page means, for its
          //    history and comments
          (await WIKI.models.importer.pageIdAt(target.siteId, locale, pagePath))
        if (pageId) {
          await WIKI.models.importer.remember(session.id, 'page', [
            { sourceId: record?.id, targetId: pageId }
          ])
        }
        if (!page) {
          skipped++
          continue
        }
        await WIKI.models.importer.markPendingRender(target.siteId, page.id, editor)
        imported++
      } catch (err: any) {
        warnings.push(`"${pagePath}" could not be imported: ${err.message}`)
        WIKI.logger.warn(`Import: page "${pagePath}" could not be imported: ${err.message}`)
        skipped++
      }
    }
    await WIKI.models.importer.putRefs(session.id, anchors)
    warnings.push(...this.#describeLosses(losses, codeLosses))
    return { imported, skipped, warnings }
  }

  /**
   * What a page says when nothing is left of it — a Confluence page that only ever held its title, or
   * only a report macro, which is how Confluence's "index" pages are made. A page here cannot be empty,
   * so it lists its children if it has any, which is what such a page was for, and says it was empty
   * otherwise.
   */
  #emptyPage(record: any, markdown: boolean): string {
    if (record?.hasChildren) {
      const path = stringOf(record?.path) === 'home' ? '' : stringOf(record?.path)
      return markdown
        ? `::block-index{path="${path}" depth="0" limit="100" columns="1"}\n::\n`
        : `<block-index path="${path}" depth="0" limit="100" columns="1"></block-index>\n`
    }
    return markdown
      ? '*This page had no content in Confluence.*\n'
      : '<p><em>This page had no content in Confluence.</em></p>\n'
  }

  /** One line per kind of loss in a batch, for the log. */
  #describeLosses(losses: StorageLosses, codeLosses: Map<string, Set<string>>): string[] {
    const lines: string[] = []
    const list = (map: Map<string, number>) => {
      const entries = [...map].sort((a, b) => b[1] - a[1])
      const named = entries
        .slice(0, MACROS_LISTED)
        .map(([name, n]) => (n > 1 ? `${name} (x${n})` : name))
      const more = entries.length - named.length
      return `${named.join(', ')}${more > 0 ? ` and ${more} more` : ''}`
    }
    if (losses.unsupported.size > 0) {
      lines.push(
        `Confluence macros with no equivalent here were left as a note where they stood: ${list(losses.unsupported)}.`
      )
    }
    if (losses.dynamic.size > 0) {
      lines.push(
        `Confluence macros that list or report on other content were dropped, as what they showed was computed by Confluence: ${list(losses.dynamic)}.`
      )
    }
    if (losses.unresolvedLinks > 0) {
      lines.push(
        `${losses.unresolvedLinks} links and images pointed at pages or files that are not part of this import; their text was kept.`
      )
    }
    if (codeLosses.size > 0) {
      const named = [...codeLosses].slice(0, MACROS_LISTED).map(([path, kinds]) => {
        return `"${path}" (${[...kinds].join(', ')})`
      })
      const more = codeLosses.size - named.length
      lines.push(
        `${codeLosses.size} pages had formatting inside code, which markdown cannot hold there; the text was kept and the formatting dropped: ${named.join(', ')}${more > 0 ? ` and ${more} more` : ''}.`
      )
    }
    return lines
  }

  // ==============================================================================================
  // HISTORY
  // ==============================================================================================

  /**
   * `{ id, pageId, version, title, path, body, bodyEncoding, authorId, date, comment }` — an earlier
   * version of a page that was imported, converted the same way the page was, so that restoring one
   * does not quietly convert the page back. Keyed by a derived id, as a 2.x version is. The path is
   * the page's current one: Confluence does not keep where a page was, only what it said.
   */
  async #historyStream(
    session: ImportSession,
    target: ImportSessionSite,
    records: any[]
  ): Promise<IngestResult> {
    const warnings: string[] = []
    const losses = newStorageLosses()
    const markdown = session.htmlConversion !== 'html'
    const editor = markdown ? 'visual' : 'markdown'
    const locale = WIKI.models.importer.primaryLocaleOf(target.siteId)
    const pageMap = await WIKI.models.importer.resolveIds(
      session.id,
      'page',
      records.map((record) => record?.pageId)
    )
    // -> Losses in an old version are not worth a second report: the page itself reported them
    const converted = await this.#convertBatch(session, records, losses, new Map(), { markdown })
    let imported = 0
    let skipped = 0

    for (const [index, record] of records.entries()) {
      const pageId = pageMap.get(String(record?.pageId))
      const result = converted[index]
      if (!pageId || !result) {
        skipped++
        continue
      }
      const pagePath = stringOf(record?.path)
      const values = {
        id: WIKI.models.importer.derive(session, target.sourceId, 'pageHistory', record?.id),
        pageId,
        action: Number(record?.version) === 1 ? 'created' : 'updated',
        locale,
        path: pagePath,
        title: stringOf(record?.title, pagePath) || pagePath,
        content: result.content,
        meta: { editor, publishState: 'published', tags: [] },
        reason: stringOf(record?.comment).trim().slice(0, 255) || null,
        versionDate: dateOf(record?.date) ?? new Date(),
        authorId: await WIKI.models.importer.authorFor(session, record?.authorId),
        siteId: target.siteId
      }
      await WIKI.db
        .insert(pageHistoryTable)
        .values(values)
        .onConflictDoUpdate({ target: pageHistoryTable.id, set: values })
      imported++
    }
    if (skipped > 0) {
      warnings.push(`${skipped} earlier versions belong to pages that were not imported.`)
    }
    return { imported, skipped, warnings }
  }

  // ==============================================================================================
  // COMMENTS
  // ==============================================================================================

  /**
   * `{ id, pageId, parentId, body, bodyEncoding, spaceKey, pageTitle, authorId, createdAt, updatedAt,
   * inline }` — a page comment or a reply to one, or an inline comment: `inline` is
   * `{ markerRef, selection }`, and such a comment becomes an ANNOTATION of the passage it was made on
   * — the comment with no text of its own and the passage carrying the note, which is what this wiki
   * posts when somebody annotates an article. The passage is the one the page's own body marked
   * (`anchor` rows, written by the pages stream); failing that, the text Confluence recorded as
   * selected.
   *
   * Replies are one level deep here, so the browser sends a reply's THREAD as its parent, and every
   * top-level comment before any reply. Always markdown, whatever the session converts pages to:
   * a comment never holds HTML.
   */
  async #commentsStream(
    session: ImportSession,
    target: ImportSessionSite,
    records: any[]
  ): Promise<IngestResult> {
    const warnings: string[] = []
    const losses = newStorageLosses()
    const pageMap = await WIKI.models.importer.resolveIds(
      session.id,
      'page',
      records.map((record) => record?.pageId)
    )
    const anchorRefs = await WIKI.models.importer.getRefs(
      session.id,
      'anchor',
      records.map((record) => stringOf(record?.inline?.markerRef)).filter(Boolean)
    )
    const converted = await this.#convertBatch(session, records, losses, new Map(), {
      markdown: true
    })

    // -> A reply whose thread was not imported starts a thread of its own rather than failing
    const parentIds = records
      .filter((record) => record?.parentId)
      .map((record) =>
        WIKI.models.importer.derive(session, target.sourceId, 'comment', record.parentId)
      )
    const existingParents = new Set(
      parentIds.length > 0
        ? (
            await WIKI.db
              .select({ id: commentsTable.id })
              .from(commentsTable)
              .where(inArray(commentsTable.id, [...new Set(parentIds)]))
          ).map((row) => row.id)
        : []
    )

    const authorIds = new Map<string, string>()
    for (const record of records) {
      authorIds.set(
        String(record?.authorId ?? ''),
        await WIKI.models.importer.authorFor(session, record?.authorId)
      )
    }
    const nameRows = await WIKI.db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .where(inArray(usersTable.id, [...new Set(authorIds.values())]))
    const names = new Map(nameRows.map((row) => [row.id, row.name]))

    let imported = 0
    let skipped = 0
    let annotated = 0
    let orphans = 0
    for (const [index, record] of records.entries()) {
      const pageId = pageMap.get(String(record?.pageId))
      const result = converted[index]
      if (!pageId) {
        orphans++
        skipped++
        continue
      }
      if (!result) {
        skipped++
        continue
      }
      const id = WIKI.models.importer.derive(session, target.sourceId, 'comment', record?.id)
      const parentId = record?.parentId
        ? WIKI.models.importer.derive(session, target.sourceId, 'comment', record.parentId)
        : null
      const authorId = authorIds.get(String(record?.authorId ?? ''))!
      const anchor = !parentId && record?.inline ? this.#anchorFor(record.inline, anchorRefs) : null
      const text = result.content.trim()
      const values = {
        id,
        pageId,
        parentId: parentId && existingParents.has(parentId) ? parentId : null,
        // -> An annotation's words are its note; the comment carrying it says nothing of its own
        content: anchor ? '' : text,
        authorId,
        authorName: names.get(authorId) ?? 'Unknown',
        authorEmail: '',
        authorIP: '',
        createdAt: dateOf(record?.createdAt) ?? new Date(),
        updatedAt: dateOf(record?.updatedAt) ?? dateOf(record?.createdAt) ?? new Date()
      }
      await WIKI.db
        .insert(commentsTable)
        .values(values)
        .onConflictDoUpdate({ target: commentsTable.id, set: values })
      // -> Threads come first in the same batch as their replies, which then find them here
      existingParents.add(id)
      if (anchor) {
        const annotation = {
          id: WIKI.models.importer.derive(session, target.sourceId, 'annotation', record?.id),
          commentId: id,
          position: 0,
          note: text,
          anchor,
          createdAt: values.createdAt,
          updatedAt: values.updatedAt
        }
        await WIKI.db
          .insert(annotationsTable)
          .values(annotation)
          .onConflictDoUpdate({ target: annotationsTable.id, set: annotation })
        annotated++
      }
      imported++
    }
    if (orphans > 0) {
      warnings.push(`${orphans} comments belong to pages that were not imported.`)
    }
    if (annotated > 0) {
      warnings.push(
        `Inline comments that became annotations of the passage they were made on: ${annotated}. One whose passage has since changed is listed with its thread as no longer found.`
      )
    }
    return { imported, skipped, warnings }
  }

  /** The passage an inline comment was made on: as the page marked it, or as Confluence recorded it. */
  #anchorFor(inline: any, anchorRefs: Map<string, any>): CommentAnchor | null {
    const marked = anchorRefs.get(stringOf(inline?.markerRef))
    if (marked?.exact) {
      return marked as CommentAnchor
    }
    // -> Confluence cuts a long selection off and says so with an ellipsis, which is not page text
    const selection = stringOf(inline?.selection)
      .replace(/\s+/g, ' ')
      .replace(/\s*(?:\.\.\.|…)$/, '')
      .trim()
      .slice(0, 1000)
    if (!selection) {
      return null
    }
    return { exact: selection, prefix: '', suffix: '', heading: null, offset: 0 }
  }
}

export const confluenceImporter = new ConfluenceImport()
