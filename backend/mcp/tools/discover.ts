import { normalizePagePath } from '../../helpers/common.ts'
import { mayOnPage, pageUrl, unpublishedFor } from '../context.ts'
import { activeLocales, pageFields, primaryLocale, snippetFrom } from '../content.ts'
import { jsonResult, ToolError } from '../tool.ts'
import type { McpContext } from '../context.ts'
import type { McpTool } from '../tool.ts'
import type { BrowseItem } from '../../models/tree.ts'

/** Below what the REST API allows: every result lands in a context window. */
const SEARCH_MAX_LIMIT = 25
const RECENT_MAX_LIMIT = 50
const BROWSE_MAX_DEPTH = 3
/** Entries across every level of one `browse_tree` call, so that a deep listing cannot run away. */
const BROWSE_MAX_ENTRIES = 300

/** The locales asked for, kept to the ones the site offers. An empty answer means all of them. */
function localesFilter(ctx: McpContext, locales?: string[]): string[] {
  if (!locales || locales.length < 1) {
    return []
  }
  const active = activeLocales(ctx)
  const kept = locales.filter((locale) => active.includes(locale))
  if (kept.length < 1) {
    throw new ToolError(
      `None of these locales is active on this site. Active: ${active.join(', ')}.`
    )
  }
  return kept
}

/** The search model's own rule filtering and paging, asked as this caller, as the search route does. */
function searchAsCaller(ctx: McpContext) {
  return {
    siteId: ctx.siteId,
    actor: ctx.actor,
    unpublished: Boolean(ctx.user)
  }
}

const searchPages: McpTool<{
  query?: string
  path?: string
  tags?: string[]
  tagsMatch?: 'all' | 'any'
  locales?: string[]
  limit: number
  offset: number
}> = {
  name: 'search_pages',
  title: 'Search pages',
  description:
    "Full-text search over the wiki's pages, ranked by relevance, returning only pages you may read. Use it first whenever a question might be answered by the wiki — its documentation is the authority on this organisation's own systems, conventions and decisions. Searches every locale unless `locales` narrows it. Each result has a `snippet` showing why it matched (matched words in **bold**); open the promising ones with `get_page` rather than answering from snippets. Cite pages by their `url`. Without `query`, lists the pages matching the filters, most recently updated first.",
  group: 'discover',
  category: 'pages',
  readOnly: true,
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 500,
        description:
          'Words to look for. Supports "quoted phrases", OR, and -excluded words, as a web search does.'
      },
      path: {
        type: 'string',
        maxLength: 2048,
        description: 'Only pages under this path prefix, e.g. `guides/` (no locale prefix).'
      },
      tags: {
        type: 'array',
        items: { type: 'string', maxLength: 255 },
        maxItems: 20,
        description: 'Only pages carrying these tags.'
      },
      tagsMatch: {
        type: 'string',
        enum: ['all', 'any'],
        default: 'all',
        description: 'Whether a page must carry every tag in `tags` or any one of them.'
      },
      locales: {
        type: 'array',
        items: { type: 'string', maxLength: 10 },
        maxItems: 20,
        description: 'Only pages in these locales. Every active locale when absent.'
      },
      limit: { type: 'integer', minimum: 1, maximum: SEARCH_MAX_LIMIT, default: 10 },
      offset: { type: 'integer', minimum: 0, maximum: 10000, default: 0 }
    },
    additionalProperties: false
  },
  async run(ctx, args) {
    const { results, totalHits } = await WIKI.models.search.searchPages({
      ...searchAsCaller(ctx),
      query: args.query ?? '',
      path: args.path ? normalizePagePath(args.path) : '',
      tags: args.tags ?? [],
      tagsMatch: args.tagsMatch,
      locales: localesFilter(ctx, args.locales),
      limit: args.limit,
      offset: args.offset
    })
    const nextOffset = args.offset + results.length
    return jsonResult({
      totalHits,
      results: results.map((result) => ({
        ...pageFields(ctx, result),
        snippet: snippetFrom(result.highlight)
      })),
      ...(nextOffset < totalHits ? { nextOffset } : {})
    })
  }
}

const browseTree: McpTool<{ path?: string; locale?: string; depth: number }> = {
  name: 'browse_tree',
  title: 'Browse the page tree',
  description:
    'Lists what a folder of the wiki holds — its pages and sub-folders, with titles — to see how a section is organised, or to find where a new page belongs. A path can be a page and a folder at once (`isPage` and `isFolder` both true). Lists the site root when `path` is absent. Use `search_pages` to find something by what it says; use this to find it by where it is.',
  group: 'discover',
  category: 'pages',
  readOnly: true,
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        maxLength: 2048,
        description: 'The folder to list, e.g. `guides/setup`. The site root when absent.'
      },
      locale: {
        type: 'string',
        maxLength: 10,
        description: "The locale to browse. The site's primary locale when absent."
      },
      depth: {
        type: 'integer',
        minimum: 1,
        maximum: BROWSE_MAX_DEPTH,
        default: 1,
        description: 'How many levels of sub-folders to expand.'
      }
    },
    additionalProperties: false
  },
  async run(ctx, args) {
    const features = WIKI.sites[ctx.siteId]?.config?.features
    // -> The switch the browse route enforces: with browsing off, the tree is not handed out at all
    if (!features?.browse && !features?.listFolderChildren) {
      throw new ToolError('Browsing the page tree is turned off on this site. Use search_pages.')
    }
    const locale = args.locale || primaryLocale(ctx)
    if (!activeLocales(ctx).includes(locale)) {
      throw new ToolError(`${locale} is not an active locale on this site.`)
    }
    const unpublished = unpublishedFor(ctx)
    let budget = BROWSE_MAX_ENTRIES
    let truncated = false

    const list = async (path: string, depth: number): Promise<any[] | null> => {
      const level = await WIKI.models.tree.browse({ siteId: ctx.siteId, path, locale, unpublished })
      if (!level) {
        return null
      }
      truncated ||= level.truncated
      const readable = level.items.filter((item: BrowseItem) =>
        mayOnPage(ctx, 'read:pages', {
          siteId: ctx.siteId,
          path: item.path,
          locale,
          tags: item.tags
        })
      )
      const entries = []
      for (const item of readable) {
        if (budget < 1) {
          truncated = true
          break
        }
        budget--
        const entry: Record<string, any> = {
          path: item.path,
          title: item.title,
          isPage: item.isPage,
          isFolder: item.isFolder
        }
        if (item.isPage) {
          entry.url = pageUrl(ctx, locale, item.path)
        }
        if (item.isFolder && depth > 1) {
          entry.children = (await list(item.path, depth - 1)) ?? []
        }
        entries.push(entry)
      }
      return entries
    }

    const path = normalizePagePath(args.path)
    const items = await list(path, args.depth)
    if (!items) {
      throw new ToolError(`There is no folder at ${path} in ${locale}.`)
    }
    return jsonResult({ locale, path, items, ...(truncated ? { truncated: true } : {}) })
  }
}

const listTags: McpTool<{ limit: number }> = {
  name: 'list_tags',
  title: 'List tags',
  description:
    'The tags used on pages you may read, most used first, with how many pages carry each. Useful to learn how the wiki is organised, and as filters for `search_pages`.',
  group: 'discover',
  category: 'pages',
  readOnly: true,
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'integer', minimum: 1, maximum: 500, default: 100 }
    },
    additionalProperties: false
  },
  async run(ctx, args) {
    const tags = await WIKI.models.tags.getTags(ctx.siteId, { limit: args.limit, actor: ctx.actor })
    return jsonResult({ tags })
  }
}

const recentChanges: McpTool<{ path?: string; locales?: string[]; limit: number; offset: number }> =
  {
    name: 'recent_changes',
    title: 'Recent changes',
    description:
      'The pages you may read, most recently updated first, optionally under a path. Use it to answer "what changed lately", or to check whether a page you read earlier has moved on. Pages excluded from search are not listed.',
    group: 'discover',
    category: 'pages',
    readOnly: true,
    idempotent: true,
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          maxLength: 2048,
          description: 'Only pages under this path prefix (no locale prefix).'
        },
        locales: {
          type: 'array',
          items: { type: 'string', maxLength: 10 },
          maxItems: 20,
          description: 'Only pages in these locales. Every active locale when absent.'
        },
        limit: { type: 'integer', minimum: 1, maximum: RECENT_MAX_LIMIT, default: 20 },
        offset: { type: 'integer', minimum: 0, maximum: 10000, default: 0 }
      },
      additionalProperties: false
    },
    async run(ctx, args) {
      const { results, totalHits } = await WIKI.models.search.searchPages({
        ...searchAsCaller(ctx),
        path: args.path ? normalizePagePath(args.path) : '',
        locales: localesFilter(ctx, args.locales),
        orderBy: 'updatedAt',
        orderByDirection: 'desc',
        limit: args.limit,
        offset: args.offset
      })
      const nextOffset = args.offset + results.length
      return jsonResult({
        results: results.map((result) => pageFields(ctx, result)),
        ...(nextOffset < totalHits ? { nextOffset } : {})
      })
    }
  }

export const discoverTools: McpTool[] = [searchPages, browseTree, listTags, recentChanges]
