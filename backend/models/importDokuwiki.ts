import { pageHistory as pageHistoryTable } from '../db/schema.ts'
import {
  collectDokuwikiRefs,
  dokuwikiToHtml,
  newDokuwikiLosses,
  type DokuwikiConversion,
  type DokuwikiLosses,
  type DokuwikiRefs,
  type DokuwikiResolver
} from '../helpers/dokuwikiSyntax.ts'
import { htmlToMarkdown, type ConversionLosses } from '../helpers/htmlToMarkdown.ts'
import { CustomError } from '../helpers/common.ts'
import { sanitizeFileName } from './assets.ts'

import type { ImportSession, ImportSessionSite, IngestResult } from './import.ts'

/**
 * Import from DokuWiki — writing what the browser read out of a DokuWiki data directory.
 *
 * Confluence's arrangement (`models/importConfluence.ts`), for a smaller source. The directory never
 * reaches this server: the browser opens it (`frontend/src/helpers/dokuwikiSource.js`) — a ZIP of it,
 * or the folder itself — works out where every page and file will live, and posts records of the
 * shapes documented on each stream below through the import session routes. A session opened with
 * `source: 'dokuwiki'` sends every site stream here; the batching, the staged blobs, the id map, the
 * index table, folders, files and finishing are `models/import.ts`'s.
 *
 * **The browser decides the paths, this decides the content.** A path needs every page id in view — a
 * namespace's start page is the page AT its folder, and two ids that come out as the same segment need
 * telling apart — and the browser has them all from its first pass. What a page SAYS needs DokuWiki's
 * syntax converted (`helpers/dokuwikiSyntax.ts`) and then `htmlToMarkdown`, which is cheerio and
 * Turndown. So the browser uploads an index of everything a body may point at (`index`), then the
 * bodies as they are.
 *
 * `dev/specs/dokuwiki-import.md` is the design; `.claude/rules/dokuwiki-import.md` the summary.
 */

/** How many plugin names a batch's line about them lists before it counts the rest. */
const PLUGINS_LISTED = 12

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

interface Converted {
  content: string
  title: string | null
  tags: string[]
}

class DokuwikiImport {
  /**
   * Write one batch of a DokuWiki session.
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
      default:
        throw new CustomError(
          'importUnknownStream',
          `A DokuWiki import has no "${stream}" stream.`,
          400
        )
    }
  }

  // ==============================================================================================
  // INDEX
  // ==============================================================================================

  /**
   * What the bodies may point at, ahead of the bodies, by DokuWiki id.
   *
   * `{ kind: 'page', id, path, title }` — a page. `{ kind: 'namespace', id, home, folder, title }` — a
   * namespace (`''` is the root): the path of its start page, null when it has none, the folder its
   * pages are in, and what a link to it is labelled with. `{ kind: 'file', id, folder, fileName }` — a media file. `{ kind: 'interwiki', id,
   * url }` — a shortcut of the wiki's interwiki map, `id` lowercased.
   */
  async #indexStream(session: ImportSession, records: any[]): Promise<IngestResult> {
    const rows: Array<{ kind: string; key: string; value: unknown }> = []
    let skipped = 0
    for (const record of records) {
      const kind = stringOf(record?.kind)
      const id = stringOf(record?.id)
      if (kind === 'page' && id && typeof record.path === 'string') {
        rows.push({ kind, key: id, value: { path: record.path, title: stringOf(record.title) } })
      } else if (kind === 'namespace' && typeof record?.folder === 'string') {
        rows.push({
          kind,
          key: id,
          value: {
            home: typeof record.home === 'string' ? record.home : null,
            folder: record.folder,
            title: stringOf(record.title)
          }
        })
      } else if (kind === 'file' && id && record.fileName) {
        rows.push({
          kind,
          key: id,
          value: { folder: stringOf(record.folder), fileName: stringOf(record.fileName) }
        })
      } else if (kind === 'interwiki' && id && record.url) {
        rows.push({ kind, key: id.toLowerCase(), value: { url: stringOf(record.url) } })
      } else {
        skipped++
      }
    }
    await WIKI.models.importer.putRefs(session.id, rows)
    return { imported: records.length - skipped, skipped, warnings: [] }
  }

  /** Everything a batch of bodies points at, looked up once per kind, as the resolver the converter asks. */
  async #resolverFor(session: ImportSession, refs: DokuwikiRefs): Promise<DokuwikiResolver> {
    const importer = WIKI.models.importer
    const pages = await importer.getRefs(session.id, 'page', refs.pages)
    const namespaces = await importer.getRefs(session.id, 'namespace', refs.namespaces)
    const files = await importer.getRefs(session.id, 'file', refs.files)
    const interwiki = await importer.getRefs(session.id, 'interwiki', refs.interwiki)
    return {
      pagePath: (id) => pages.get(id)?.path ?? null,
      pageTitle: (id) => pages.get(id)?.title || null,
      namespace: (id) => {
        const found = namespaces.get(id)
        return found
          ? {
              home: found.home ?? null,
              folder: stringOf(found.folder),
              title: stringOf(found.title)
            }
          : null
      },
      filePath: (id) => {
        const found = files.get(id)
        if (!found) {
          return null
        }
        const name = sanitizeFileName(found.fileName)
        return found.folder ? `/${found.folder}/${name}` : `/${name}`
      },
      interwiki: (name) => interwiki.get(name)?.url ?? null
    }
  }

  // ==============================================================================================
  // PAGES
  // ==============================================================================================

  /**
   * Convert a batch of bodies, looking up everything they point at in one go. `pageIdOf` is the
   * DokuWiki id a record's relative links are relative to.
   *
   * A body the converter falls over on comes back as the error instead, for the stream to skip that
   * one record and say why: the rest of the batch is no less importable for it.
   */
  async #convertBatch(
    session: ImportSession,
    records: any[],
    pageIdOf: (record: any) => string,
    losses: DokuwikiLosses,
    codeLosses: Map<string, Set<string>>,
    { markdown }: { markdown: boolean }
  ): Promise<Array<Converted | Error>> {
    const refs: DokuwikiRefs = { pages: [], namespaces: [], files: [], interwiki: [] }
    for (const record of records) {
      const found = collectDokuwikiRefs(stringOf(record?.body), pageIdOf(record))
      refs.pages.push(...found.pages)
      refs.namespaces.push(...found.namespaces)
      refs.files.push(...found.files)
      refs.interwiki.push(...found.interwiki)
    }
    const resolve = await this.#resolverFor(session, refs)

    const finish = (record: any, conversion: DokuwikiConversion): Converted => {
      if (!markdown) {
        return { content: conversion.html, title: conversion.title, tags: conversion.tags }
      }
      const report: ConversionLosses = { codeFormatting: new Set() }
      const content = htmlToMarkdown(conversion.html, report)
      if (report.codeFormatting.size > 0) {
        codeLosses.set(stringOf(record?.path, pageIdOf(record)), report.codeFormatting)
      }
      return { content, title: conversion.title, tags: conversion.tags }
    }

    return records.map((record) => {
      const body = stringOf(record?.body)
      const ctx = { pageId: pageIdOf(record), resolve, dropTitle: true }
      try {
        const converted = finish(record, dokuwikiToHtml(body, ctx, losses))
        if (hasSubstance(converted.content) || !converted.title || record?.hasChildren) {
          return converted
        }
        // -> Nothing but its heading, and no children to list instead (`#emptyPage`): the heading stays
        return finish(
          record,
          dokuwikiToHtml(body, { ...ctx, dropTitle: false }, newDokuwikiLosses())
        )
      } catch (err: any) {
        WIKI.logger.warn(`Import: DokuWiki page "${ctx.pageId}" could not be converted:`)
        WIKI.logger.warn(err)
        return err instanceof Error ? err : new Error(String(err))
      }
    })
  }

  /**
   * `{ id, path, title, body, authorId, createdAt, updatedAt, hasChildren }` — the current version of a
   * page, at the path the browser worked out. Its title is its first heading, which is what DokuWiki
   * calls a page's title, and is taken out of the body when the page opens with it, since this wiki
   * draws the title above the page; `title` is what to call a page with no heading. Its tags are what
   * the tag plugin named.
   *
   * Converted to markdown and filed under the visual editor, or kept as HTML under the markdown editor
   * — the session's `htmlConversion`, as for Confluence.
   */
  async #pagesStream(
    session: ImportSession,
    target: ImportSessionSite,
    records: any[]
  ): Promise<IngestResult> {
    const warnings: string[] = []
    const losses = newDokuwikiLosses()
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
        warnings.push(`The page "${stringOf(record?.id)}" has no path and was not imported.`)
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
      const content = hasSubstance(result.content)
        ? result.content
        : this.#emptyPage(record, markdown)
      const title = result.title || stringOf(record?.title) || pagePath
      try {
        const authorId = await WIKI.models.importer.authorFor(session, record?.authorId)
        const page = await WIKI.models.notifications.withOrigin('import', () =>
          WIKI.models.pages.adoptStoredPage({
            siteId: target.siteId,
            locale,
            path: pagePath,
            title,
            editor,
            tags: result.tags,
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
          // -> Already here with overwrite off: still what this DokuWiki page means, for its history
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
   * What a page says when nothing is left of it — one that held nothing but a listing DokuWiki
   * computed. A page here cannot be empty, so it lists its children if it has any, which is what such a
   * page was for, and says it was empty otherwise.
   */
  #emptyPage(record: any, markdown: boolean): string {
    if (record?.hasChildren) {
      const path = stringOf(record?.path) === 'home' ? '' : stringOf(record?.path)
      return markdown
        ? `::block-index{path="${path}" depth="0" limit="100" columns="1"}\n::\n`
        : `<block-index path="${path}" depth="0" limit="100" columns="1"></block-index>\n`
    }
    return markdown
      ? '*This page had no content in DokuWiki.*\n'
      : '<p><em>This page had no content in DokuWiki.</em></p>\n'
  }

  /** One line per kind of loss in a batch, for the log. */
  #describeLosses(losses: DokuwikiLosses, codeLosses: Map<string, Set<string>>): string[] {
    const lines: string[] = []
    const list = (map: Map<string, number>) => {
      const entries = [...map].sort((a, b) => b[1] - a[1])
      const named = entries
        .slice(0, PLUGINS_LISTED)
        .map(([name, n]) => (n > 1 ? `${name} (x${n})` : name))
      const more = entries.length - named.length
      return `${named.join(', ')}${more > 0 ? ` and ${more} more` : ''}`
    }
    if (losses.unsupported.size > 0) {
      lines.push(
        `DokuWiki plugins with no equivalent here were left as a note where they stood: ${list(losses.unsupported)}.`
      )
    }
    if (losses.dynamic.size > 0) {
      lines.push(
        `DokuWiki plugins and macros that showed something computed when the page was viewed were dropped: ${list(losses.dynamic)}.`
      )
    }
    if (losses.unresolvedLinks > 0) {
      lines.push(
        `${losses.unresolvedLinks} links and images pointed at media, interwiki shortcuts or network shares that are not part of this import; their text was kept.`
      )
    }
    if (losses.missingPages > 0) {
      lines.push(
        `${losses.missingPages} links pointed at pages that did not exist in DokuWiki either; they point at where such a page would be here.`
      )
    }
    if (codeLosses.size > 0) {
      const named = [...codeLosses].slice(0, PLUGINS_LISTED).map(([path, kinds]) => {
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
   * `{ id, pageId, path, title, body, authorId, date, comment, created }` — an earlier revision of a
   * page that was imported, from DokuWiki's attic, converted the same way the page was so that restoring
   * one does not quietly convert the page back. `id` is the page id and the revision's timestamp, and the
   * row is keyed by an id derived from it, so a re-run upserts. The path is the page's current one:
   * DokuWiki keeps no record of where a page was, only what it said.
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
    // -> Losses in an old revision are not worth a second report: the page itself reported them
    const converted = await this.#convertBatch(
      session,
      records,
      (record) => stringOf(record?.pageId),
      newDokuwikiLosses(),
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
          `The revision "${stringOf(record?.id)}" could not be converted and was not imported: ${result.message}`
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
        title: result.title || stringOf(record?.title) || pagePath,
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
      warnings.push(`${skipped} earlier revisions belong to pages that were not imported.`)
    }
    return { imported, skipped: skipped + failed, warnings }
  }
}

export const dokuwikiImporter = new DokuwikiImport()
