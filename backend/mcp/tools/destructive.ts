import { normalizeNewPagePath } from '../../helpers/common.ts'
import { callApi } from '../inject.ts'
import { pageUrl } from '../context.ts'
import { loadPageRef, PAGE_REF_PROPERTIES, pageFields } from '../content.ts'
import { jsonResult, ToolError } from '../tool.ts'
import type { PageRef } from '../content.ts'
import type { McpTool } from '../tool.ts'

/**
 * Moving and deleting pages: a reorganisation of the wiki rather than knowledge added to it, so its
 * own group, off by default (`mcp.tools.destructive`) — no token, however it was scoped, reaches
 * these until an administrator turns them on.
 *
 * Through the REST routes in-process, which hold the checks — `manage:pages` at both ends of a move,
 * `delete:pages` for a deletion — and the work that follows: links rewritten on a move, the recycle
 * bin and the watchers' notification on a deletion.
 */

const movePage: McpTool<PageRef & { newPath: string; newLocale?: string; updateLinks: boolean }> = {
  name: 'move_page',
  title: 'Move a page',
  description:
    "Moves a page to a new path (and, with `newLocale`, to another locale). With `updateLinks` (the default), every page linking to the old address is edited to point at the new one; pages that could not be updated are listed. A reorganisation affects everybody's bookmarks and links — move a page only when the person you are working for asked for it.",
  group: 'destructive',
  category: 'pages',
  readOnly: false,
  destructive: true,
  inputSchema: {
    type: 'object',
    properties: {
      ...PAGE_REF_PROPERTIES,
      newPath: {
        type: 'string',
        minLength: 1,
        maxLength: 2048,
        description: 'Where the page goes, without a locale prefix.'
      },
      newLocale: { type: 'string', maxLength: 10 },
      updateLinks: { type: 'boolean', default: true }
    },
    required: ['newPath'],
    additionalProperties: false
  },
  async run(ctx, args) {
    const page = await loadPageRef(ctx, args)
    const result = await callApi(ctx, 'PUT', `sites/${ctx.siteId}/pages/${page.id}/path`, {
      body: {
        path: normalizeNewPagePath(args.newPath),
        ...(args.newLocale ? { locale: args.newLocale } : {}),
        updateLinks: args.updateLinks
      }
    })
    const moved = result?.page
    if (!moved) {
      throw new ToolError('The page was not moved.')
    }
    return jsonResult({
      ...pageFields(ctx, moved),
      previousUrl: pageUrl(ctx, page.locale, page.path),
      ...(result.relinked
        ? {
            linksUpdated: result.relinked.updated,
            ...(result.relinked.skippedCount > 0
              ? {
                  linksNotUpdatedCount: result.relinked.skippedCount,
                  // -> Named only where the caller may read the page, as the route names them
                  linksNotUpdated: (result.relinked.skipped ?? []).map((skip: any) => ({
                    title: skip.title,
                    url: pageUrl(ctx, skip.locale, skip.path),
                    reason: skip.reason
                  }))
                }
              : {})
          }
        : {})
    })
  }
}

const deletePage: McpTool<PageRef> = {
  name: 'delete_page',
  title: 'Delete a page',
  description:
    'Deletes a page, into the recycle bin, from which a person holding delete:pages can restore it. Its watchers are told. Delete a page only when the person you are working for asked for it; for a page that is merely out of date, update it or flag it with post_comment instead.',
  group: 'destructive',
  category: 'pages',
  readOnly: false,
  destructive: true,
  inputSchema: {
    type: 'object',
    properties: { ...PAGE_REF_PROPERTIES },
    additionalProperties: false
  },
  async run(ctx, args) {
    const page = await loadPageRef(ctx, args)
    await callApi(ctx, 'DELETE', `sites/${ctx.siteId}/pages/${page.id}`)
    return jsonResult({
      deleted: pageFields(ctx, page),
      note: 'The page is in the recycle bin. A person holding delete:pages there can restore it from the file manager.'
    })
  }
}

export const destructiveTools: McpTool[] = [movePage, deletePage]
