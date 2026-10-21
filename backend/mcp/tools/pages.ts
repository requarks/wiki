import { mayOnPage, pageUrl } from '../context.ts'
import {
  loadPageRef,
  loadReadablePage,
  outlineOf,
  PAGE_REF_PROPERTIES,
  pageFields,
  readableText,
  resolvePageId,
  sectionOf,
  toIso,
  windowOf
} from '../content.ts'
import { blocksResult, jsonResult, ToolError } from '../tool.ts'
import type { McpContext } from '../context.ts'
import type { PageRef } from '../content.ts'
import type { McpTool } from '../tool.ts'
import type { Page } from '../../models/pages.ts'

/**
 * The page a redirection sends a reader to, when it is a page of this site.
 *
 * Followed once, and only within the site: a URL target is reported rather than fetched, and a
 * redirection to another redirection stops there rather than chasing a loop.
 */
async function followRedirect(
  ctx: McpContext,
  page: Page
): Promise<{ page: Page | null; target: string } | null> {
  if (page.editor !== 'redirect' || !page.content) {
    return null
  }
  let target: { kind?: string; target?: string }
  try {
    target = JSON.parse(page.content)
  } catch {
    return null
  }
  if (target.kind !== 'page' || typeof target.target !== 'string') {
    return { page: null, target: target.target ?? '' }
  }
  try {
    const id = await resolvePageId(ctx, { url: target.target })
    return { page: await loadReadablePage(ctx, id, { withContent: true }), target: target.target }
  } catch {
    return { page: null, target: target.target }
  }
}

/** Everything `get_page` says about a page before its text. */
async function describe(ctx: McpContext, page: Page) {
  return {
    ...pageFields(ctx, page),
    versionId: await WIKI.models.pageHistory.latestVersionId(ctx.siteId, page.id),
    ...(page.showLastEditedBy && page.authorName ? { lastEditedBy: page.authorName } : {}),
    createdAt: toIso(page.createdAt),
    publishState: page.publishState,
    editor: page.editor,
    ...(page.isLocked ? { isLocked: true } : {}),
    ...(page.localeRelations.length > 0
      ? {
          translations: page.localeRelations.map((relation) => ({
            locale: relation.locale,
            title: relation.title,
            url: pageUrl(ctx, relation.locale, relation.path)
          }))
        }
      : {}),
    outline: outlineOf(page.toc)
  }
}

const getPage: McpTool<PageRef & { section?: string; offset: number; length?: number }> = {
  name: 'get_page',
  title: 'Read a page',
  description:
    "Reads one wiki page: its metadata (title, URL, last update, version, translations), its outline of headings, and its content as markdown. Name the page by `url` (a link somebody gave you), by `id` (from a search result), or by `path` and `locale`. For a long page, read the `outline` first and ask for one `section` by its anchor or heading text, or page through with `offset`. The content is the page's source when you may read it, otherwise what readers see. Say how current it is (`updatedAt`) when that matters, and cite the page by its `url`.",
  group: 'pages',
  category: 'pages',
  readOnly: true,
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      ...PAGE_REF_PROPERTIES,
      section: {
        type: 'string',
        maxLength: 500,
        description:
          'Only the part under this heading — its `anchor` from the outline, or its text.'
      },
      offset: {
        type: 'integer',
        minimum: 0,
        default: 0,
        description:
          'Where in the content to start, in characters. From `nextOffset` of a previous call.'
      },
      length: {
        type: 'integer',
        minimum: 100,
        description: 'How many characters to return at most. Capped by the server.'
      }
    },
    additionalProperties: false
  },
  async run(ctx, args) {
    let page = await loadPageRef(ctx, args, { withContent: true })
    let redirectedFrom: string | undefined
    const redirect = await followRedirect(ctx, page)
    if (redirect) {
      if (!redirect.page) {
        return jsonResult({
          ...pageFields(ctx, page),
          redirect: redirect.target,
          note: 'This page is a redirection, to a target outside this wiki or one you may not read.'
        })
      }
      redirectedFrom = pageUrl(ctx, page.locale, page.path)
      page = redirect.page
    }

    const meta: Record<string, any> = {
      ...(await describe(ctx, page)),
      ...(redirectedFrom ? { redirectedFrom } : {})
    }
    if (page.isLocked) {
      meta.note =
        'This page is password protected. Its content is withheld, and an assistant cannot unlock it.'
      return jsonResult(meta)
    }

    const { format, syntax, text: fullText } = await readableText(page)
    let text = fullText
    if (args.section) {
      const section = sectionOf(fullText, args.section, page.toc)
      if (section === null) {
        throw new ToolError(
          `No heading "${args.section}" on this page. Its outline lists the headings there are.`
        )
      }
      text = section
      meta.section = args.section
    }
    if (!text && format === 'rendered') {
      meta.note =
        'This page has no rendered content yet. It may have just been written and be waiting for the renderer.'
    }
    const window = windowOf(text, { offset: args.offset, length: args.length })
    meta.content = {
      format,
      syntax,
      offset: window.offset,
      totalChars: window.totalChars,
      ...(window.nextOffset === null ? {} : { nextOffset: window.nextOffset, truncated: true })
    }
    return blocksResult(meta, window.text)
  }
}

const getPageLinks: McpTool<PageRef> = {
  name: 'get_page_links',
  title: "List a page's links",
  description:
    "The links written on a page that point elsewhere in this wiki, each with the page it reaches. A link whose `exists` is false points at nothing you may read — a red link, or a page you are not allowed to see. Use it to follow a topic to its neighbours, or to find a page's broken links.",
  group: 'pages',
  category: 'pages',
  readOnly: true,
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: { ...PAGE_REF_PROPERTIES },
    additionalProperties: false
  },
  async run(ctx, args) {
    const page = await loadPageRef(ctx, args)
    // -> These come out of the page's own body, which is the half a password withholds
    if (page.isLocked) {
      throw new ToolError('This page is password protected.')
    }
    const links = await WIKI.models.pageLinks.outboundFor(page.id)
    return jsonResult({
      page: pageFields(ctx, page),
      links: links.map((link) => {
        // -> As the REST route does: a page the caller may not read reads as no page at all
        const readable =
          Boolean(link.targetPageId) &&
          mayOnPage(ctx, 'read:pages', {
            siteId: link.targetSiteId,
            locale: link.targetPageLocale ?? undefined,
            path: link.targetPagePath ?? '',
            tags: link.targetPageTags ?? []
          })
        return {
          href: link.href,
          exists: readable,
          ...(readable && link.targetSiteId === ctx.siteId
            ? {
                title: link.targetTitle,
                url: pageUrl(ctx, link.targetPageLocale!, link.targetPagePath!)
              }
            : {})
        }
      })
    })
  }
}

const getBacklinks: McpTool<PageRef> = {
  name: 'get_backlinks',
  title: 'List what links to a page',
  description:
    'The pages you may read that link to a given page. Use it to see how a page is referred to, or to find every page that will need updating when this one changes.',
  group: 'pages',
  category: 'pages',
  readOnly: true,
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: { ...PAGE_REF_PROPERTIES },
    additionalProperties: false
  },
  async run(ctx, args) {
    if (!WIKI.models.pageLinks.isAllowed(ctx.siteId)) {
      throw new ToolError('This site does not show what links to a page.')
    }
    const page = await loadPageRef(ctx, args)
    if (page.isLocked) {
      throw new ToolError('This page is password protected.')
    }
    const backlinks = await WIKI.models.pageLinks.backlinksFor(
      { siteId: ctx.siteId, locale: page.locale, path: page.path },
      { pageId: page.id, alias: page.alias }
    )
    return jsonResult({
      page: pageFields(ctx, page),
      backlinks: backlinks
        .filter(
          (link) =>
            link.siteId === ctx.siteId &&
            mayOnPage(ctx, 'read:pages', {
              siteId: link.siteId,
              locale: link.locale,
              path: link.path,
              tags: link.tags
            })
        )
        .map((link) => ({
          ...pageFields(ctx, {
            id: link.pageId,
            title: link.title,
            locale: link.locale,
            path: link.path,
            description: link.description
          }),
          href: link.href
        }))
    })
  }
}

export const pageTools: McpTool[] = [getPage, getPageLinks, getBacklinks]
