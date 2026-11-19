import { inArray } from 'drizzle-orm'

import {
  commentAnnotations as annotationsTable,
  comments as commentsTable,
  pageHistory as pageHistoryTable,
  users as usersTable
} from '../db/schema.ts'
import {
  collectXwikiRefs,
  fileKey,
  isMarkdownSyntax,
  newXwikiLosses,
  xwikiToHtml,
  type XwikiLosses,
  type XwikiRefs,
  type XwikiResolver
} from '../helpers/xwikiSyntax.ts'
import { htmlToMarkdown, type ConversionLosses } from '../helpers/htmlToMarkdown.ts'
import { CustomError } from '../helpers/common.ts'
import { sanitizeFileName } from './assets.ts'

import type { CommentAnchor } from './comments.ts'
import type { ImportSession, ImportSessionSite, IngestResult } from './import.ts'

/**
 * Import from XWiki — writing what the browser read out of a XAR export.
 *
 * DokuWiki's arrangement (`models/importDokuwiki.ts`). The XAR never reaches this server: the browser
 * opens it (`frontend/src/helpers/xwikiSource.js`), reads every document's XML, works out where every
 * page and attachment will live, and posts records of the shapes documented on each stream below
 * through the import session routes. A session opened with `source: 'xwiki'` sends every site stream
 * here; the batching, the staged blobs, the id map, the index table, folders, files and finishing are
 * `models/import.ts`'s.
 *
 * **The browser decides the paths, this decides the content.** A path needs every document in view —
 * a space's `WebHome` is the page AT its folder, and two names that come out as the same path segment
 * need telling apart. What a page SAYS needs XWiki's syntax converted (`helpers/xwikiSyntax.ts`) and
 * then `htmlToMarkdown`. So the browser uploads an index of everything a body may point at (`index`),
 * then the bodies as XWiki wrote them.
 *
 * `dev/specs/xwiki-import.md` is the design; `.claude/rules/xwiki-import.md` the summary.
 */

/** How many macro names a batch's line about them lists before it counts the rest. */
const LISTED = 12

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

/** Whether a converted page says anything — a word, a picture, a block. */
function hasSubstance(content: string): boolean {
  return /[\p{L}\p{N}]/u.test(content) || /!\[|<img|block-/.test(content)
}

class XwikiImport {
  /**
   * Write one batch of an XWiki session.
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
          `An XWiki import has no "${stream}" stream.`,
          400
        )
    }
  }

  // ==============================================================================================
  // INDEX
  // ==============================================================================================

  /**
   * What the bodies may point at, ahead of the bodies, by the keys `helpers/xwikiSyntax.ts` asks for
   * (`referenceKey`, which the browser writes the same way).
   *
   * `{ kind: 'page', id, path, title }` — a document. `{ kind: 'space', id, folder, title }` — a space
   * (`''` is the wiki itself), the folder its pages are in. `{ kind: 'file', page, name, folder,
   * fileName }` — an attachment, by the document it is on and its name in XWiki, with where it went
   * here. `{ kind: 'user', id, name }` — a user, by their profile document, for a mention.
   */
  async #indexStream(session: ImportSession, records: any[]): Promise<IngestResult> {
    const rows: Array<{ kind: string; key: string; value: unknown }> = []
    let skipped = 0
    for (const record of records) {
      const kind = stringOf(record?.kind)
      const id = stringOf(record?.id)
      if (kind === 'page' && id && typeof record.path === 'string') {
        rows.push({ kind, key: id, value: { path: record.path, title: stringOf(record.title) } })
      } else if (kind === 'space' && typeof record?.folder === 'string') {
        rows.push({
          kind,
          key: id,
          value: { folder: record.folder, title: stringOf(record.title) }
        })
      } else if (kind === 'file' && record?.page && record.name && record.fileName) {
        rows.push({
          kind,
          key: fileKey(stringOf(record.page), stringOf(record.name)),
          value: { folder: stringOf(record.folder), fileName: stringOf(record.fileName) }
        })
      } else if (kind === 'user' && id && record.name) {
        rows.push({ kind, key: id, value: { name: stringOf(record.name) } })
      } else {
        skipped++
      }
    }
    await WIKI.models.importer.putRefs(session.id, rows)
    return { imported: records.length - skipped, skipped, warnings: [] }
  }

  /** Everything a batch of bodies points at, looked up once per kind, as the resolver the converter asks. */
  async #resolverFor(session: ImportSession, refs: XwikiRefs): Promise<XwikiResolver> {
    const importer = WIKI.models.importer
    const pages = await importer.getRefs(session.id, 'page', refs.pages)
    const spaces = await importer.getRefs(session.id, 'space', refs.spaces)
    const files = await importer.getRefs(session.id, 'file', refs.files)
    const users = await importer.getRefs(session.id, 'user', refs.users)
    return {
      page: (key) => {
        const found = pages.get(key)
        return found ? { path: stringOf(found.path), title: stringOf(found.title) } : null
      },
      space: (key) => {
        const found = spaces.get(key)
        return found ? { folder: stringOf(found.folder), title: stringOf(found.title) } : null
      },
      file: (key) => {
        const found = files.get(key)
        if (!found) {
          return null
        }
        const name = sanitizeFileName(found.fileName)
        return found.folder ? `/${found.folder}/${name}` : `/${name}`
      },
      user: (key) => users.get(key)?.name || null
    }
  }

  // ==============================================================================================
  // CONVERSION
  // ==============================================================================================

  /**
   * Convert a batch of bodies, looking up everything they point at in one go. `docOf` is the document
   * a record's relative references are relative to.
   *
   * A body in markdown is kept as it is, being what this wiki stores already. A body the converter
   * falls over on comes back as the error instead, for the stream to skip that one record and say
   * why: the rest of the batch is no less importable for it.
   */
  async #convertBatch(
    session: ImportSession,
    records: any[],
    docOf: (record: any) => string,
    losses: XwikiLosses,
    codeLosses: Map<string, Set<string>>,
    { markdown }: { markdown: boolean }
  ): Promise<Array<string | Error>> {
    const refs: XwikiRefs = { pages: [], spaces: [], files: [], users: [] }
    for (const record of records) {
      const syntax = stringOf(record?.syntax)
      if (isMarkdownSyntax(syntax)) {
        continue
      }
      const found = collectXwikiRefs(stringOf(record?.body), syntax, docOf(record))
      refs.pages.push(...found.pages)
      refs.spaces.push(...found.spaces)
      refs.files.push(...found.files)
      refs.users.push(...found.users)
    }
    const resolve = await this.#resolverFor(session, refs)

    return records.map((record) => {
      const body = stringOf(record?.body)
      const syntax = stringOf(record?.syntax)
      if (isMarkdownSyntax(syntax)) {
        return body
      }
      try {
        const html = xwikiToHtml(
          body,
          syntax,
          { docKey: docOf(record), resolve, dropHeading: stringOf(record?.title) || null },
          losses
        )
        if (!markdown) {
          return html
        }
        const report: ConversionLosses = { codeFormatting: new Set() }
        const content = htmlToMarkdown(html, report)
        if (report.codeFormatting.size > 0) {
          codeLosses.set(stringOf(record?.path, docOf(record)), report.codeFormatting)
        }
        return content
      } catch (err: any) {
        WIKI.logger.warn(`Import: XWiki document "${docOf(record)}" could not be converted:`)
        WIKI.logger.warn(err)
        return err instanceof Error ? err : new Error(String(err))
      }
    })
  }

  // ==============================================================================================
  // PAGES
  // ==============================================================================================

  /**
   * `{ id, path, title, syntax, body, tags, authorId, createdAt, updatedAt, hasChildren }` — the current
   * version of a document, at the path the browser worked out. `id` is its reference key, `title` what
   * XWiki showed above it (a first heading saying the same is left out of the body), and `tags` what
   * its `XWiki.TagClass` object held.
   *
   * Converted to markdown and filed under the visual editor, or kept as HTML under the markdown editor
   * — the session's `htmlConversion`, as for Confluence and DokuWiki. A page written in markdown is
   * stored as it is, under the same editor.
   */
  async #pagesStream(
    session: ImportSession,
    target: ImportSessionSite,
    records: any[]
  ): Promise<IngestResult> {
    const warnings: string[] = []
    const losses = newXwikiLosses()
    const codeLosses = new Map<string, Set<string>>()
    const markdown = session.htmlConversion !== 'html'
    const editor = markdown ? 'visual' : 'markdown'
    const locale = WIKI.models.importer.primaryLocaleOf(target.siteId)
    const converted = await this.#convertBatch(
      session,
      records,
      (record) => stringOf(record?.id),
      losses,
      codeLosses,
      { markdown }
    )
    let imported = 0
    let skipped = 0

    for (const [index, record] of records.entries()) {
      const pagePath = stringOf(record?.path).replace(/^\/+|\/+$/g, '')
      if (!pagePath) {
        warnings.push(`The document "${stringOf(record?.id)}" has no path and was not imported.`)
        skipped++
        continue
      }
      const result = converted[index]
      if (result instanceof Error) {
        warnings.push(
          `"${pagePath}" could not be converted and was not imported: ${result.message}`
        )
        skipped++
        continue
      }
      const markdownSource = markdown || isMarkdownSyntax(stringOf(record?.syntax))
      const content = hasSubstance(result) ? result : this.#emptyPage(record, markdownSource)
      const tags = Array.isArray(record?.tags)
        ? record.tags.filter((tag: unknown): tag is string => typeof tag === 'string' && !!tag)
        : []
      try {
        const authorId = await WIKI.models.importer.authorFor(session, record?.authorId)
        const page = await WIKI.models.notifications.withOrigin('import', () =>
          WIKI.models.pages.adoptStoredPage({
            siteId: target.siteId,
            locale,
            path: pagePath,
            title: stringOf(record?.title) || pagePath,
            editor,
            tags,
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
          // -> Already here with overwrite off: still what this document means, for its history and comments
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
    warnings.push(...this.#describeLosses(losses, codeLosses))
    return { imported, skipped, warnings }
  }

  /**
   * What a page says when nothing is left of it — one that was a script, or the form of an application
   * entry whose data lived in an object. A page here cannot be empty, so it lists its children if it
   * has any, and says it was empty otherwise.
   */
  #emptyPage(record: any, markdown: boolean): string {
    if (record?.hasChildren) {
      const path = stringOf(record?.path) === 'home' ? '' : stringOf(record?.path)
      return markdown
        ? `::block-index{path="${path}" depth="0" limit="100" columns="1"}\n::\n`
        : `<block-index path="${path}" depth="0" limit="100" columns="1"></block-index>\n`
    }
    return markdown
      ? '*This page had no content that could be imported from XWiki.*\n'
      : '<p><em>This page had no content that could be imported from XWiki.</em></p>\n'
  }

  /** One line per kind of loss in a batch, for the log. */
  #describeLosses(losses: XwikiLosses, codeLosses: Map<string, Set<string>>): string[] {
    const lines: string[] = []
    const list = (map: Map<string, number>) => {
      const entries = [...map].sort((a, b) => b[1] - a[1])
      const named = entries.slice(0, LISTED).map(([name, n]) => (n > 1 ? `${name} (x${n})` : name))
      const more = entries.length - named.length
      return `${named.join(', ')}${more > 0 ? ` and ${more} more` : ''}`
    }
    if (losses.unsupported.size > 0) {
      lines.push(
        `XWiki macros with no equivalent here were left as a note where they stood: ${list(losses.unsupported)}.`
      )
    }
    if (losses.dynamic.size > 0) {
      lines.push(
        `XWiki macros and scripts that showed something computed when the page was viewed were dropped: ${list(losses.dynamic)}.`
      )
    }
    if (losses.asCode.size > 0) {
      lines.push(
        `XWiki macros drawing something from a source were kept as that source, in a code block: ${list(losses.asCode)}.`
      )
    }
    if (losses.syntaxes.size > 0) {
      lines.push(
        `Pages in a syntax that cannot be converted were kept as text in a code block: ${list(losses.syntaxes)}.`
      )
    }
    if (losses.included > 0) {
      lines.push(
        `${losses.included} include and display macros were replaced by a link to the page they showed.`
      )
    }
    if (losses.unresolvedLinks > 0) {
      lines.push(
        `${losses.unresolvedLinks} links and images pointed at attachments, interwiki aliases or server paths that are not part of this import; their text was kept.`
      )
    }
    if (losses.missingPages > 0) {
      lines.push(
        `${losses.missingPages} links pointed at pages that are not part of this import; they point at where such a page would be here.`
      )
    }
    if (codeLosses.size > 0) {
      const named = [...codeLosses].slice(0, LISTED).map(([path, kinds]) => {
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
   * `{ id, pageId, path, title, syntax, body, authorId, date, comment, created }` — an earlier version
   * of a document that was imported, rebuilt by the browser out of the document's `<versions>` archive
   * and converted the same way the page was, so that restoring one does not quietly convert the page
   * back. `id` is the document's key and the version (`Main.WebHome@1.3`), and the row is keyed by an
   * id derived from it, so a re-run upserts. The path is the page's current one.
   */
  async #historyStream(
    session: ImportSession,
    target: ImportSessionSite,
    records: any[]
  ): Promise<IngestResult> {
    const warnings: string[] = []
    const markdown = session.htmlConversion !== 'html'
    const editor = markdown ? 'visual' : 'markdown'
    const locale = WIKI.models.importer.primaryLocaleOf(target.siteId)
    const pageMap = await WIKI.models.importer.resolveIds(
      session.id,
      'page',
      records.map((record) => record?.pageId)
    )
    // -> Losses in an old version are not worth a second report: the page itself reported them
    const converted = await this.#convertBatch(
      session,
      records,
      (record) => stringOf(record?.pageId),
      newXwikiLosses(),
      new Map(),
      { markdown }
    )
    let imported = 0
    let skipped = 0
    let failed = 0

    for (const [index, record] of records.entries()) {
      const pageId = pageMap.get(String(record?.pageId))
      if (!pageId) {
        skipped++
        continue
      }
      const result = converted[index]
      if (result instanceof Error) {
        warnings.push(
          `The version "${stringOf(record?.id)}" could not be converted and was not imported: ${result.message}`
        )
        failed++
        continue
      }
      const pagePath = stringOf(record?.path)
      const values = {
        id: WIKI.models.importer.derive(session, target.sourceId, 'pageHistory', record?.id),
        pageId,
        action: record?.created === true ? 'created' : 'updated',
        locale,
        path: pagePath,
        title: stringOf(record?.title) || pagePath,
        content: result,
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
    return { imported, skipped: skipped + failed, warnings }
  }

  // ==============================================================================================
  // COMMENTS
  // ==============================================================================================

  /**
   * `{ id, pageId, parentId, syntax, body, authorId, createdAt, selection }` — an `XWiki.XWikiComments`
   * object of a document that was imported. `id` is the document's key and the object's number. An
   * annotation is the same object with `selection` set to `{ exact, prefix, suffix }` — the passage, and
   * the text XWiki kept on either side of it — and becomes an annotation of that passage here: the
   * comment with no text of its own and the passage carrying the note, as for Confluence's inline
   * comments.
   *
   * Replies are one level deep here, so the browser sends a reply's THREAD as its parent, and every
   * thread before its replies. Always markdown, regardless of what the session converts pages to: a
   * comment never holds HTML.
   */
  async #commentsStream(
    session: ImportSession,
    target: ImportSessionSite,
    records: any[]
  ): Promise<IngestResult> {
    const warnings: string[] = []
    const losses = newXwikiLosses()
    const pageMap = await WIKI.models.importer.resolveIds(
      session.id,
      'page',
      records.map((record) => record?.pageId)
    )
    const converted = await this.#convertBatch(
      session,
      records,
      (record) => stringOf(record?.pageId),
      losses,
      new Map(),
      { markdown: true }
    )

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
      const key = String(record?.authorId ?? '')
      if (!authorIds.has(key)) {
        authorIds.set(key, await WIKI.models.importer.authorFor(session, record?.authorId))
      }
    }
    const nameRows =
      authorIds.size > 0
        ? await WIKI.db
            .select({ id: usersTable.id, name: usersTable.name })
            .from(usersTable)
            .where(inArray(usersTable.id, [...new Set(authorIds.values())]))
        : []
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
      if (result instanceof Error) {
        warnings.push(
          `The comment "${stringOf(record?.id)}" could not be converted and was not imported: ${result.message}`
        )
        skipped++
        continue
      }
      const id = WIKI.models.importer.derive(session, target.sourceId, 'comment', record?.id)
      const parentId = record?.parentId
        ? WIKI.models.importer.derive(session, target.sourceId, 'comment', record.parentId)
        : null
      const authorId = authorIds.get(String(record?.authorId ?? ''))!
      const anchor = !parentId ? this.#anchorFor(record?.selection) : null
      const text = result.trim()
      const createdAt = dateOf(record?.createdAt) ?? new Date()
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
        createdAt,
        updatedAt: createdAt
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
          createdAt,
          updatedAt: createdAt
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
        `Annotations that became annotations of the passage they were made on here: ${annotated}. One whose passage has since changed is listed with its thread as no longer found.`
      )
    }
    warnings.push(...this.#describeLosses(losses, new Map()))
    return { imported, skipped, warnings }
  }

  /**
   * The passage an annotation was made on, as XWiki kept it: the selection and the text around it,
   * with runs of whitespace folded the way this wiki reads a page's text.
   */
  #anchorFor(selection: any): CommentAnchor | null {
    const fold = (text: unknown) => stringOf(text).replace(/\s+/g, ' ')
    const exact = fold(selection?.exact).trim().slice(0, 1000)
    if (!exact) {
      return null
    }
    return {
      exact,
      prefix: fold(selection?.prefix).trimStart().slice(-32),
      suffix: fold(selection?.suffix).trimEnd().slice(0, 32),
      heading: null,
      offset: 0
    }
  }
}

export const xwikiImporter = new XwikiImport()
