import { createTwoFilesPatch } from 'diff'
import { mayOnPage } from '../context.ts'
import {
  loadPageRef,
  loadReadablePage,
  PAGE_REF_PROPERTIES,
  pageFields,
  toIso,
  windowOf
} from '../content.ts'
import { blocksResult, jsonResult, ToolError } from '../tool.ts'
import type { McpContext } from '../context.ts'
import type { PageRef } from '../content.ts'
import type { McpTool } from '../tool.ts'
import type { Page } from '../../models/pages.ts'
import type { PageHistoryEntry } from '../../models/pageHistory.ts'

const VERSIONS_MAX_LIMIT = 100

/** The history route's checks: `read:history` on the page as it stands, and not past its password. */
function assertHistoryReadable(ctx: McpContext, page: Page): void {
  if (!mayOnPage(ctx, 'read:history', page)) {
    throw new ToolError("You may not read this page's history.")
  }
  if (page.isLocked) {
    throw new ToolError('This page is password protected.')
  }
}

/**
 * A version and the page it belongs to, readable by this caller.
 *
 * A version carries no access of its own, so it is turned back into its page — as it stands now,
 * wherever it has moved to — and the page decides. A version of a page in the recycle bin answers as
 * not found: the bin is the file manager's, and is no part of what an agent reads.
 */
async function loadVersion(ctx: McpContext, versionId: string) {
  const version = await WIKI.models.pageHistory.getVersionById(ctx.siteId, versionId)
  if (!version) {
    throw new ToolError('There is no such version that you may read.')
  }
  let page: Page
  try {
    page = await loadReadablePage(ctx, version.pageId)
  } catch {
    throw new ToolError('There is no such version that you may read.')
  }
  assertHistoryReadable(ctx, page)
  return { version, page }
}

function entryFields(entry: PageHistoryEntry) {
  return {
    versionId: entry.id,
    action: entry.action,
    date: toIso(entry.versionDate),
    ...(entry.author.name ? { author: entry.author.name } : {}),
    ...(entry.reason ? { reason: entry.reason } : {}),
    ...(entry.changedFields.length > 0 ? { changedFields: entry.changedFields } : {}),
    title: entry.title,
    path: entry.path
  }
}

const listVersions: McpTool<PageRef & { limit: number }> = {
  name: 'list_versions',
  title: "List a page's versions",
  description:
    "A page's history, newest first: each version's id, when it was made, by whom, what changed and — where the author gave one — why. The newest version is the page as it stands. Use it to answer when and why a page changed, and with `diff_versions` to see how.",
  group: 'history',
  category: 'pages',
  readOnly: true,
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      ...PAGE_REF_PROPERTIES,
      limit: { type: 'integer', minimum: 1, maximum: VERSIONS_MAX_LIMIT, default: 20 }
    },
    additionalProperties: false
  },
  async run(ctx, args) {
    const page = await loadPageRef(ctx, args)
    assertHistoryReadable(ctx, page)
    const entries = await WIKI.models.pageHistory.list(ctx.siteId, page.id)
    return jsonResult({
      page: pageFields(ctx, page),
      totalVersions: entries.length,
      versions: entries.slice(0, args.limit).map(entryFields)
    })
  }
}

const getVersion: McpTool<{ versionId: string; offset: number; length?: number }> = {
  name: 'get_version',
  title: 'Read a page version',
  description:
    'One version of a page from its history, with the source it held. Use it to see what a page said before a change.',
  group: 'history',
  category: 'pages',
  readOnly: true,
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      versionId: { type: 'string', format: 'uuid', description: 'From `list_versions`.' },
      offset: { type: 'integer', minimum: 0, default: 0 },
      length: { type: 'integer', minimum: 100 }
    },
    required: ['versionId'],
    additionalProperties: false
  },
  async run(ctx, args) {
    const { version, page } = await loadVersion(ctx, args.versionId)
    const window = windowOf(version.content ?? '', { offset: args.offset, length: args.length })
    return blocksResult(
      {
        page: pageFields(ctx, page),
        ...entryFields(version),
        content: {
          offset: window.offset,
          totalChars: window.totalChars,
          ...(window.nextOffset === null ? {} : { nextOffset: window.nextOffset, truncated: true })
        }
      },
      window.text
    )
  }
}

const diffVersions: McpTool<{ fromVersionId: string; toVersionId?: string }> = {
  name: 'diff_versions',
  title: 'Compare two page versions',
  description:
    'A unified diff of the source between two versions of the same page. Leave out `toVersionId` to compare against the page as it stands now.',
  group: 'history',
  category: 'pages',
  readOnly: true,
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      fromVersionId: { type: 'string', format: 'uuid', description: 'The older version.' },
      toVersionId: {
        type: 'string',
        format: 'uuid',
        description: 'The newer version. The current version when absent.'
      }
    },
    required: ['fromVersionId'],
    additionalProperties: false
  },
  async run(ctx, args) {
    const from = await loadVersion(ctx, args.fromVersionId)
    const toVersionId =
      args.toVersionId ?? (await WIKI.models.pageHistory.latestVersionId(ctx.siteId, from.page.id))
    if (!toVersionId) {
      throw new ToolError('This page has no other version to compare with.')
    }
    const to = await loadVersion(ctx, toVersionId)
    if (to.page.id !== from.page.id) {
      throw new ToolError('The two versions belong to different pages.')
    }
    const patch = createTwoFilesPatch(
      from.version.path,
      to.version.path,
      from.version.content ?? '',
      to.version.content ?? '',
      toIso(from.version.versionDate),
      toIso(to.version.versionDate)
    )
    const window = windowOf(patch, {})
    return blocksResult(
      {
        page: pageFields(ctx, from.page),
        from: entryFields(from.version),
        to: entryFields(to.version),
        ...(window.nextOffset === null ? {} : { truncated: true, totalChars: window.totalChars })
      },
      window.text
    )
  }
}

export const historyTools: McpTool[] = [listVersions, getVersion, diffVersions]
