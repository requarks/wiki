import { validate as uuidValidate } from 'uuid'
import { decodeUrlPath, normalizePagePath, stripPageExtension } from '../helpers/common.ts'
import { htmlToMarkdown } from '../helpers/htmlToMarkdown.ts'
import { resolvePagePath } from '../helpers/appShell.ts'
import { ToolError } from './tool.ts'
import { mayBypassPassword, mayOnPage, mayReadSource, pageUrl, unpublishedFor } from './context.ts'
import type { McpContext } from './context.ts'
import type { Page } from '../models/pages.ts'
import type { TocNode } from '../models/rendering.ts'

/** How a tool is told which page: one of the three, and a locale to go with a bare path. */
export interface PageRef {
  id?: string
  url?: string
  path?: string
  locale?: string
}

/** The argument properties of a `PageRef`, for a tool's input schema. */
export const PAGE_REF_PROPERTIES = {
  id: {
    type: 'string',
    format: 'uuid',
    description: 'The page id, as every result names it.'
  },
  url: {
    type: 'string',
    maxLength: 2048,
    description:
      'A link to the page on this wiki — absolute, or a path from the site root such as /en/guides/setup. The usual way in when a person pasted a link.'
  },
  path: {
    type: 'string',
    maxLength: 2048,
    description: 'The page path without any locale prefix, e.g. guides/setup. Goes with `locale`.'
  },
  locale: {
    type: 'string',
    maxLength: 10,
    description: "The locale of `path`. The site's primary locale when absent."
  }
} as const

/** The source editors whose content is prose an agent can read as written. */
const PROSE_EDITORS = new Set(['markdown', 'visual', 'asciidoc'])

const NOT_READABLE = 'There is no page there that you may read.'

/**
 * The id of the page a reference names, or a `ToolError` saying why there is none.
 *
 * A URL is read the way the frontend router reads it (`resolvePagePath`), page extension and locale
 * prefix included, and is accepted only for this site: an agent connected to one host is not a way
 * to read another.
 */
export async function resolvePageId(ctx: McpContext, ref: PageRef): Promise<string> {
  if (ref.id) {
    if (!uuidValidate(ref.id)) {
      throw new ToolError('`id` is not a page id.')
    }
    return ref.id
  }
  const site = WIKI.sites[ctx.siteId]
  if (ref.url) {
    let urlPath: string
    if (ref.url.startsWith('/') && !ref.url.startsWith('//')) {
      urlPath = ref.url
    } else {
      let parsed: URL
      try {
        parsed = new URL(ref.url)
      } catch {
        throw new ToolError('`url` is neither an absolute URL nor a path from the site root.')
      }
      const mapped = WIKI.sitesMappings[parsed.hostname] ?? WIKI.sitesMappings['*']
      if (mapped !== ctx.siteId || parsed.host !== new URL(ctx.origin).host) {
        throw new ToolError(`This MCP server answers for ${ctx.origin} only.`)
      }
      urlPath = parsed.pathname
    }
    urlPath = urlPath.split(/[?#]/)[0] || '/'
    if (urlPath.length > 1 && urlPath.endsWith('/')) {
      urlPath = urlPath.slice(0, -1)
    }
    urlPath = stripPageExtension(urlPath, site?.config?.pageExtensions) ?? urlPath
    const { locale, path } = resolvePagePath(ctx.siteId, urlPath)
    const id = await WIKI.models.pages.idAtPath(ctx.siteId, locale, path)
    if (!id) {
      throw new ToolError(NOT_READABLE)
    }
    return id
  }
  if (ref.path !== undefined) {
    const locale = ref.locale || site?.config?.locales?.primary || 'en'
    const path = normalizePagePath(decodeUrlPath(ref.path)) || 'home'
    const id = await WIKI.models.pages.idAtPath(ctx.siteId, locale, path)
    if (!id) {
      throw new ToolError(NOT_READABLE)
    }
    return id
  }
  throw new ToolError('Name the page with `id`, `url` or `path`.')
}

/**
 * A page as this caller may see it, or a `ToolError` that does not say which of "not there", "not
 * live" and "not yours to read" it was — the difference is not the caller's to know.
 *
 * Asked exactly as the page route asks: `read:pages` on the page, the source only where the caller
 * may read it, a page that is not live only for whoever may edit it, and the body of a protected page
 * withheld unless the caller may edit it (an agent has no way to enter a password).
 */
export async function loadReadablePage(
  ctx: McpContext,
  id: string,
  { withContent = false }: { withContent?: boolean } = {}
): Promise<Page> {
  const page = await WIKI.models.pages.getPage({
    siteId: ctx.siteId,
    id,
    withContent: withContent ? (target) => mayReadSource(ctx, target) : false,
    unpublished: unpublishedFor(ctx),
    unlocked: (target) => mayBypassPassword(ctx, target),
    withPassword: false
  })
  if (!page || !mayOnPage(ctx, 'read:pages', page)) {
    throw new ToolError(NOT_READABLE)
  }
  return page
}

/** `resolvePageId` then `loadReadablePage`: the usual first two lines of a tool about one page. */
export async function loadPageRef(
  ctx: McpContext,
  ref: PageRef,
  options: { withContent?: boolean } = {}
): Promise<Page> {
  return loadReadablePage(ctx, await resolvePageId(ctx, ref), options)
}

/** How every tool names a page: enough to cite it, and to open it again. */
export function pageFields(
  ctx: McpContext,
  page: {
    id: string
    title: string
    locale: string
    path: string
    description?: string | null
    tags?: string[]
    updatedAt?: Date | string
  }
) {
  return {
    id: page.id,
    title: page.title,
    url: pageUrl(ctx, page.locale, page.path),
    locale: page.locale,
    path: page.path,
    ...(page.description ? { description: page.description } : {}),
    ...(page.tags && page.tags.length > 0 ? { tags: page.tags } : {}),
    ...(page.updatedAt ? { updatedAt: toIso(page.updatedAt) } : {})
  }
}

export function toIso(value: Date | string): string {
  return value instanceof Date
    ? value.toTemporalInstant().toString({ smallestUnit: 'millisecond' })
    : value
}

/** A page's headings, flat and in order, as `section` can then be asked for. */
export function outlineOf(toc: TocNode[]): Array<{ level: number; title: string; anchor: string }> {
  const flat: Array<{ level: number; title: string; anchor: string }> = []
  const walk = (nodes: TocNode[]) => {
    for (const node of nodes) {
      flat.push({ level: node.level, title: node.label, anchor: node.key.replace(/^#/, '') })
      walk(node.children ?? [])
    }
  }
  walk(toc ?? [])
  return flat
}

/**
 * What an agent reads of a page.
 *
 * The source when the caller may read it and it is prose — what was written, links and all, which
 * is also what a later edit would be made against. Otherwise the stored render turned back into
 * markdown, which is what a reader sees. A drawing is its labels, the same text search indexes: its
 * source is a scene document and its render an SVG, and neither means anything to a model.
 */
export async function readableText(
  page: Page
): Promise<{ format: 'source' | 'rendered' | 'text'; syntax: string; text: string }> {
  if (page.editor === 'excalidraw') {
    return { format: 'text', syntax: 'plain', text: await WIKI.models.pages.searchTextOf(page.id) }
  }
  if (PROSE_EDITORS.has(page.editor) && typeof page.content === 'string') {
    return {
      format: 'source',
      syntax: page.contentType === 'adoc' ? 'asciidoc' : 'markdown',
      text: page.content
    }
  }
  return {
    format: 'rendered',
    syntax: 'markdown',
    text: page.render ? htmlToMarkdown(page.render) : ''
  }
}

/** A heading's text reduced to what two spellings of the same heading share. */
function headingKey(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/\s+#+\s*$/, '')
    .trim()
    .toLowerCase()
}

const HEADING = /^(#{1,6}|={1,6})\s+(.+?)\s*$/

/**
 * The part of a page's text under one heading, down to the next heading of the same or a higher
 * level. Asked by the heading's anchor (from the outline) or its text.
 *
 * Read off the text rather than cut out of the render, so that it works the same on the source and
 * on the render turned into markdown. A fenced code block is skipped over, so a `#` comment in a
 * shell snippet is not taken for a heading.
 *
 * @returns The section, or null when no heading matches
 */
export function sectionOf(text: string, section: string, toc: TocNode[]): string | null {
  const wanted = section.replace(/^#/, '')
  const fromOutline = outlineOf(toc).find((entry) => entry.anchor === wanted)
  const target = headingKey(fromOutline?.title ?? wanted)

  const lines = text.split('\n')
  let inFence = false
  let start = -1
  let level = 0
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) {
      continue
    }
    const match = HEADING.exec(line)
    if (!match) {
      continue
    }
    const lineLevel = match[1]!.length
    if (start < 0) {
      if (headingKey(match[2]!) === target) {
        start = index
        level = lineLevel
      }
    } else if (lineLevel <= level) {
      return lines.slice(start, index).join('\n').trimEnd()
    }
  }
  return start < 0 ? null : lines.slice(start).join('\n').trimEnd()
}

/**
 * A window of a long text, cut where the caller asked and no longer than the result cap.
 *
 * Says what it did — where it started, how much there is, where to carry on — so that an agent can
 * ask for the rest instead of answering from half a page without knowing it.
 */
export function windowOf(
  text: string,
  { offset = 0, length }: { offset?: number; length?: number }
): { text: string; offset: number; totalChars: number; nextOffset: number | null } {
  const cap = WIKI.models.mcp.getConfig().maxResultChars
  const start = Math.min(Math.max(0, offset), text.length)
  const size = Math.min(length ?? cap, cap)
  const end = Math.min(text.length, start + size)
  return {
    text: text.slice(start, end),
    offset: start,
    totalChars: text.length,
    nextOffset: end < text.length ? end : null
  }
}

/** A search excerpt for a model: postgres's emphasis as markdown bold, and plain text otherwise. */
export function snippetFrom(highlight: string | null): string | null {
  if (!highlight) {
    return null
  }
  return highlight
    .replaceAll('<b>', '**')
    .replaceAll('</b>', '**')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&')
}

/** The active locales of the site, which is what an agent may filter a listing by. */
export function activeLocales(ctx: McpContext): string[] {
  return WIKI.sites[ctx.siteId]?.config?.locales?.active ?? ['en']
}

/** The site's primary locale, the one a bare path is in. */
export function primaryLocale(ctx: McpContext): string {
  return WIKI.sites[ctx.siteId]?.config?.locales?.primary ?? 'en'
}
