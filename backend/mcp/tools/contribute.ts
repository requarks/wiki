import { callApi } from '../inject.ts'
import { loadPageRef, PAGE_REF_PROPERTIES, pageFields, toIso } from '../content.ts'
import { applyEdits } from './edit.ts'
import { jsonResult, ToolError } from '../tool.ts'
import type { McpContext } from '../context.ts'
import type { PageRef } from '../content.ts'
import type { McpTool } from '../tool.ts'

/**
 * The two ways an assistant contributes to a page its owner may not edit — suggest the change, or
 * point out the problem — and reading a page's discussion.
 *
 * All three go through the REST routes in-process (`mcp/inject.ts`), because what they enforce lives
 * there: which approval rule takes a suggestion, the posting cooldown, the spam check, the webhooks
 * and notifications a comment sends.
 */

/** The page's discussion is the built-in provider's, and only while the site has comments on. */
function commentsAvailable(ctx: McpContext): boolean {
  return (
    WIKI.sites[ctx.siteId]?.config?.features?.comments !== false &&
    WIKI.models.comments.usesBuiltIn(ctx.siteId)
  )
}

const suggestEdit: McpTool<
  PageRef & { edits?: { oldText: string; newText: string }[]; content?: string }
> = {
  name: 'suggest_edit',
  title: 'Suggest an edit',
  description:
    "Sends a change to a page's reviewers to accept or decline, instead of writing it — for a page you may not edit, or a change a person should look at first. Works on any page whose approval rules take suggestions from you. Give `edits` (exact find-and-replace on the source, as get_page shows it) or the whole new `content`. You have one open suggestion per page: suggesting again replaces it, and the edits apply to it. Say why in a comment (post_comment) when the reason is not obvious from the change.",
  group: 'suggest',
  category: 'approvals',
  readOnly: false,
  inputSchema: {
    type: 'object',
    properties: {
      ...PAGE_REF_PROPERTIES,
      edits: {
        type: 'array',
        minItems: 1,
        maxItems: 50,
        description:
          'Find-and-replace edits, applied in order. Each `oldText` must appear exactly once in the source you are suggesting against — your own open suggestion if you have one, otherwise the page as it stands.',
        items: {
          type: 'object',
          required: ['oldText', 'newText'],
          additionalProperties: false,
          properties: {
            oldText: { type: 'string', minLength: 1, maxLength: 100000 },
            newText: { type: 'string', maxLength: 100000 }
          }
        }
      },
      content: { type: 'string', minLength: 1, maxLength: 1000000 }
    },
    additionalProperties: false
  },
  async run(ctx, args) {
    if (Boolean(args.edits) === (args.content !== undefined)) {
      throw new ToolError('Send either `edits` or `content`.')
    }
    const page = await loadPageRef(ctx, args)
    const self = await callApi(
      ctx,
      'GET',
      `sites/${ctx.siteId}/pages/${page.id}/suggestions/self`,
      {
        query: { withContent: true }
      }
    )
    if (!self?.canSubmit) {
      throw new ToolError('This page does not accept edit suggestions from you.')
    }
    const content = args.content ?? applyEdits(self.content ?? '', args.edits!)
    const result = await callApi(
      ctx,
      'PUT',
      `sites/${ctx.siteId}/pages/${page.id}/suggestions/self`,
      {
        body: { content }
      }
    )
    return jsonResult({
      page: pageFields(ctx, page),
      submissionId: result?.submission?.id,
      replacedEarlier: Boolean(self.submission),
      note: "The suggestion is waiting for the page's reviewers. Nothing on the page changes until one of them accepts it."
    })
  }
}

const listComments: McpTool<PageRef> = {
  name: 'list_comments',
  title: "Read a page's discussion",
  description:
    'The comments on a page, oldest first, with replies under the comment they answer and the passages any of them annotate. Check here before flagging a problem — somebody may have already.',
  group: 'comments',
  category: 'comments',
  readOnly: true,
  idempotent: true,
  isAvailable: commentsAvailable,
  inputSchema: {
    type: 'object',
    properties: { ...PAGE_REF_PROPERTIES },
    additionalProperties: false
  },
  async run(ctx, args) {
    const page = await loadPageRef(ctx, args)
    const result = await callApi(ctx, 'GET', `sites/${ctx.siteId}/pages/${page.id}/comments`)
    const comments = (result?.comments ?? []) as any[]
    return jsonResult({
      page: pageFields(ctx, page),
      comments: comments.map((comment) => ({
        id: comment.id,
        ...(comment.parentId ? { parentId: comment.parentId } : {}),
        ...(comment.isDeleted
          ? { isDeleted: true }
          : { author: comment.authorName, content: comment.content }),
        createdAt: toIso(comment.createdAt),
        ...(comment.annotations?.length > 0
          ? {
              annotations: comment.annotations.map((annotation: any) => ({
                quote: annotation.anchor?.exact,
                note: annotation.note,
                ...(annotation.resolvedAt ? { resolved: true } : {})
              }))
            }
          : {})
      }))
    })
  }
}

/** How much of the article on either side of a passage is kept to tell its occurrences apart. */
const ANCHOR_CONTEXT = 32

/**
 * Describe a passage of the article the way the annotator does, from a quote of it.
 *
 * An agent reads a page as markdown and quotes it from there; an annotation is a description of the
 * article as DRAWN, with whitespace folded, so that the browser can find it again. The page's
 * extracted text (`searchContent`, what search indexes) is the drawn text without markup, which is
 * where the quote is looked for and the context around it taken from. The heading is left unset, and
 * the offset is the quote's position in that text: `prefix` and `suffix` are what the browser leans
 * on to tell repeats apart.
 */
async function anchorFor(pageId: string, quote: string) {
  const fold = (text: string) => text.replace(/\s+/g, ' ').trim()
  const text = fold(await WIKI.models.pages.searchTextOf(pageId))
  const exact = fold(quote)
  const at = text.indexOf(exact)
  if (!exact || at < 0) {
    throw new ToolError(
      `The quote "${quote.slice(0, 80)}" is not in the page as readers see it. Quote the text exactly as it reads, without markdown.`
    )
  }
  return {
    exact,
    prefix: text.slice(Math.max(0, at - ANCHOR_CONTEXT), at),
    suffix: text.slice(at + exact.length, at + exact.length + ANCHOR_CONTEXT),
    heading: null,
    offset: at
  }
}

const postComment: McpTool<
  PageRef & { content: string; parentId?: string; annotations?: { quote: string; note: string }[] }
> = {
  name: 'post_comment',
  title: 'Comment on a page',
  description:
    "Posts a comment in a page's discussion — to flag something wrong or out of date that you cannot or should not fix yourself, so the people who look after the page see it. Point at the passage with `annotations` (a quote of it as readers see it, and a note about it). Read list_comments first rather than repeating what is there. Mention people by @handle where it helps.",
  group: 'comments',
  category: 'comments',
  readOnly: false,
  isAvailable: commentsAvailable,
  inputSchema: {
    type: 'object',
    properties: {
      ...PAGE_REF_PROPERTIES,
      content: {
        type: 'string',
        maxLength: 10000,
        description: 'The comment, in basic markdown. May be empty when it has annotations.'
      },
      parentId: {
        type: 'string',
        format: 'uuid',
        description: 'The comment this answers, from list_comments. A reply cannot annotate.'
      },
      annotations: {
        type: 'array',
        maxItems: 10,
        items: {
          type: 'object',
          required: ['quote', 'note'],
          additionalProperties: false,
          properties: {
            quote: { type: 'string', minLength: 3, maxLength: 500 },
            note: { type: 'string', minLength: 1, maxLength: 2000 }
          }
        }
      }
    },
    required: ['content'],
    additionalProperties: false
  },
  async run(ctx, args) {
    const page = await loadPageRef(ctx, args)
    const annotations = await Promise.all(
      (args.annotations ?? []).map(async (annotation) => ({
        note: annotation.note,
        anchor: await anchorFor(page.id, annotation.quote)
      }))
    )
    const comment = await callApi(ctx, 'POST', `sites/${ctx.siteId}/pages/${page.id}/comments`, {
      body: {
        content: args.content,
        ...(args.parentId ? { parentId: args.parentId } : {}),
        ...(annotations.length > 0 ? { annotations } : {})
      }
    })
    return jsonResult({
      page: pageFields(ctx, page),
      commentId: comment?.id,
      ...(comment?.parentId ? { parentId: comment.parentId } : {})
    })
  }
}

export const suggestTools: McpTool[] = [suggestEdit]
export const commentTools: McpTool[] = [listComments, postComment]
