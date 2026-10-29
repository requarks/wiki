import { audit } from '../helpers/audit.ts'
import {
  CustomError,
  markdownToPlainText,
  normalizePagePath,
  normalizeNewPagePath
} from '../helpers/common.ts'
import { requestUser } from '../helpers/requester.ts'
import { actorFrom, mayOnPage, unlockedFor, unpublishedFor, userRequired } from './pages.ts'
import { COMMENT_MAX_LENGTH } from '../models/comments.ts'
import { FEEDBACK_STATUSES, IDEA_ICON, isFeedbackStatus } from '../models/feedback.ts'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { BoardRef, FeedbackStatus } from '../models/feedback.ts'
import type { FeedbackSort } from '../models/pages.ts'

const siteIdParam = {
  type: 'object',
  properties: {
    siteId: { type: 'string', format: 'uuid' }
  },
  required: ['siteId']
}

const ideaParams = {
  type: 'object',
  properties: {
    siteId: { type: 'string', format: 'uuid' },
    pageId: { type: 'string', format: 'uuid' }
  },
  required: ['siteId', 'pageId']
}

/** The longest title an idea may have, which is what the `pages.title` column holds. */
const IDEA_TITLE_MAX_LENGTH = 255

/** The longest description an idea may be submitted with, the same as a comment. */
const IDEA_CONTENT_MAX_LENGTH = COMMENT_MAX_LENGTH

/** How much of an idea's text becomes its `description`, the line a listing shows under it. */
const IDEA_EXCERPT_LENGTH = 200

/** What a submission or an author's edit carries, as a route body schema's properties. */
const ideaInputProperties = {
  title: { type: 'string', minLength: 1, maxLength: IDEA_TITLE_MAX_LENGTH },
  content: {
    type: 'string',
    maxLength: IDEA_CONTENT_MAX_LENGTH,
    description: 'The description, as basic markdown.'
  },
  render: {
    type: 'string',
    description:
      'The HTML the browser rendered `content` to. Sanitized on the way in like every page save, with no script or style permission regardless of what the submitter holds.'
  },
  categories: {
    type: 'array',
    maxItems: 50,
    items: { type: 'string', maxLength: 100 },
    description:
      'Category tags, each one of the board’s own. Must be empty on a board that does not let submitters pick categories, unless the caller holds `review:pages` or `manage:pages` on it.'
  }
}

/** The locale a request that named none is answered in. */
function defaultLocale(siteId: string): string {
  return WIKI.sites[siteId]?.config?.locales?.primary ?? 'en'
}

/**
 * The board at a path, as this reader may see it, or a 404.
 *
 * Refused as not-found rather than forbidden, the same answer the page itself gives: whether a board
 * exists at a path the reader may not read is not something to tell them. `read:pages` at the board
 * is the whole question, since it is asked at the board for every idea in it too.
 */
function loadBoard(
  req: FastifyRequest<{ Params: { siteId: string } }>,
  reply: FastifyReply,
  query: { path: string; locale?: string }
): BoardRef | null {
  if (!WIKI.sites[req.params.siteId]) {
    reply.notFound('This site does not exist.')
    return null
  }
  const locale = query.locale ?? defaultLocale(req.params.siteId)
  const board = WIKI.models.feedback.boardAt(
    req.params.siteId,
    locale,
    normalizePagePath(query.path)
  )
  if (!board || !mayOnPage(req, 'read:pages', board)) {
    reply.notFound('There is no feedback board at this path.')
    return null
  }
  return board
}

/**
 * Whether this reader may see a board's ideas while they are not live.
 *
 * One answer for the whole board, because the page rules are resolved at the board for every idea in
 * it (`feedback.ruleRefFor`) — which is what lets the listing put it in its `WHERE` instead of asking
 * per idea.
 */
function seesUnpublished(req: FastifyRequest, board: BoardRef): boolean {
  const unpublished = unpublishedFor(req)
  return unpublished ? unpublished(board) : false
}

/**
 * An idea, with the board it is on, or a refusal.
 *
 * Read the way a reader reads it — not there when it is not live and they may not see it, not there
 * when they may not read it — so that a route acting on an idea cannot be used to find out about one.
 */
async function loadIdea(
  req: FastifyRequest<{ Params: { siteId: string; pageId: string } }>,
  reply: FastifyReply
) {
  const page = await WIKI.models.pages.getPage({
    siteId: req.params.siteId,
    id: req.params.pageId,
    withContent: true,
    unpublished: unpublishedFor(req),
    unlocked: (target) => unlockedFor(req, target)
  })
  if (!page || !mayOnPage(req, 'read:pages', page)) {
    reply.notFound('This idea does not exist.')
    return null
  }
  const board = WIKI.models.feedback.boardOfIdea(
    req.params.siteId,
    page.locale,
    page.path,
    page.editor
  )
  if (!board) {
    reply.notFound('This page is not an idea on a feedback board.')
    return null
  }
  return { page, board }
}

/**
 * The categories a submission asks for, checked against the board: each must be one of the board's
 * own, and none may be asked for where the board files ideas itself -- unless it is a moderator of the
 * board asking, who is who files them there.
 */
function checkCategories(
  board: BoardRef,
  categories: string[] | undefined,
  moderator: boolean
): string[] {
  const asked = [...new Set((categories ?? []).map((tag) => tag.trim().toLowerCase()))]
  if (asked.length < 1) {
    return []
  }
  if (!board.settings.submitterCategories && !moderator) {
    throw new CustomError(
      'feedbackCategoriesNotAllowed',
      'This board files ideas into categories itself.'
    )
  }
  const offered = new Set(board.settings.categories.map((category) => category.tag))
  if (asked.some((tag) => !offered.has(tag))) {
    throw new CustomError('feedbackUnknownCategory', 'That is not one of this board’s categories.')
  }
  return asked
}

/**
 * The short description a listing shows under an idea, from the start of what was written: the
 * markdown with its punctuation taken out, so that a row reads as a sentence rather than as syntax.
 */
function excerptOf(content: string): string {
  const text = markdownToPlainText(content).replace(/\s+/g, ' ').trim()
  return text.length > IDEA_EXCERPT_LENGTH
    ? `${text.slice(0, IDEA_EXCERPT_LENGTH - 1).trimEnd()}…`
    : text
}

/**
 * Feedback Boards API
 *
 * The board's listing, the duplicate check, an idea's status, and the submission form's routes. An
 * idea is an ordinary page, so reading one, voting (`api/ratings.ts`) and discussing it
 * (`api/comments.ts`) go through the routes every page uses.
 *
 * No route-level permissions on any of them: everything here is a page rule, asked at the board in
 * the handler (`config.permissions` reads only the group-wide list, and would refuse the anonymous
 * reader a public board exists for). See `dev/specs/feedback-boards.md`.
 */
async function routes(app: FastifyInstance) {
  /**
   * LIST A BOARD'S IDEAS
   */
  app.get<{
    Params: { siteId: string }
    Querystring: {
      path: string
      locale?: string
      q?: string
      sort?: FeedbackSort
      status?: string
      category?: string
      page?: number
    }
  }>(
    '/sites/:siteId/feedback/ideas',
    {
      config: {
        scope: 'pages'
      },
      schema: {
        summary: "List a feedback board's ideas",
        description:
          "One page of a board's listing, with the status and category facets beside it.\n\nAn idea is a page directly in the board's folder with a body of its own. Everything on a board is ruled by the board's own page rules, so a reader who may read the board may read every idea in it, and the listing is filtered, counted and paged by the database: `total` and every facet count are exact.\n\nThe facets are counted over every idea matching `q`, before the status and category filters, so that picking a filter never removes the control that undoes it. Without a `status` the listing shows the default for its sort: never Closed, and not Completed either under `top` and `trending`.",
        tags: ['Pages'],
        params: siteIdParam,
        querystring: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              maxLength: 2048,
              description: "The board's own path, without a leading slash."
            },
            locale: {
              type: 'string',
              maxLength: 10,
              description: "The site's primary locale when absent."
            },
            q: {
              type: 'string',
              maxLength: 255,
              description:
                'Words to search the ideas for. A password-protected idea is matched on its title and description only.'
            },
            sort: { $ref: 'FeedbackSort#' },
            status: {
              type: 'string',
              maxLength: 255,
              description:
                'Comma-separated statuses, or `all`. The default for the sort when absent.'
            },
            category: {
              type: 'string',
              maxLength: 100,
              description: 'One category tag, or `none` for ideas filed under none of them.'
            },
            page: {
              type: 'integer',
              minimum: 1,
              default: 1,
              description:
                'Which page of the listing to answer with. Clamped to the last one that exists.'
            }
          },
          required: ['path']
        },
        response: {
          200: {
            description: 'The ideas, and what the sidebar should offer',
            type: 'object',
            properties: {
              ideas: { type: 'array', items: { $ref: 'FeedbackIdea#' } },
              total: {
                type: 'integer',
                description: 'How many ideas match, ignoring which page was asked for.'
              },
              page: { type: 'integer' },
              pageCount: { type: 'integer' },
              sort: { $ref: 'FeedbackSort#' },
              statuses: {
                type: 'array',
                items: { $ref: 'FeedbackStatus#' },
                description: 'The statuses the listing was narrowed to.'
              },
              facets: {
                type: 'object',
                properties: {
                  statuses: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        status: { $ref: 'FeedbackStatus#' },
                        count: { type: 'integer' }
                      }
                    }
                  },
                  categories: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        tag: { type: 'string' },
                        label: { type: 'string' },
                        count: { type: 'integer' }
                      }
                    }
                  },
                  uncategorized: { type: 'integer' }
                }
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const board = loadBoard(req, reply, req.query)
      if (!board) {
        return reply
      }
      const statusParam = req.query.status?.trim()
      let statuses: FeedbackStatus[] | null = null
      if (statusParam === 'all') {
        statuses = [...FEEDBACK_STATUSES]
      } else if (statusParam) {
        const asked = statusParam.split(',').map((status) => status.trim())
        if (!asked.every(isFeedbackStatus)) {
          return reply.badRequest(`A status is one of: ${FEEDBACK_STATUSES.join(', ')}.`)
        }
        statuses = asked
      }
      return WIKI.models.feedback.listing({
        board,
        viewerId: requestUser(req)?.id ?? null,
        seeUnpublished: seesUnpublished(req, board),
        filter: {
          q: req.query.q,
          sort: req.query.sort,
          statuses,
          category: req.query.category?.trim().toLowerCase() || null,
          page: req.query.page
        }
      })
    }
  )

  /**
   * FIND IDEAS LIKE A TITLE
   */
  app.get<{
    Params: { siteId: string }
    Querystring: { path: string; locale?: string; title: string }
  }>(
    '/sites/:siteId/feedback/similar',
    {
      config: {
        scope: 'pages'
      },
      schema: {
        summary: 'Find ideas like the one about to be submitted',
        description:
          'Up to five ideas on the board whose title or description shares words with `title`, best match first — the duplicate check the submission form runs as a title is typed. Every status is included, since an idea that was already completed or declined is as worth knowing about as an open one.\n\nNeeds `write:feedback` on the board: only somebody about to submit has a reason to ask.',
        tags: ['Pages'],
        params: siteIdParam,
        querystring: {
          type: 'object',
          properties: {
            path: { type: 'string', maxLength: 2048, description: "The board's own path." },
            locale: { type: 'string', maxLength: 10 },
            title: { type: 'string', maxLength: IDEA_TITLE_MAX_LENGTH }
          },
          required: ['path', 'title']
        },
        response: {
          200: {
            description: 'The ideas most like it',
            type: 'object',
            properties: {
              ideas: { type: 'array', items: { $ref: 'FeedbackIdea#' } }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const board = loadBoard(req, reply, req.query)
      if (!board) {
        return reply
      }
      const user = requestUser(req)
      if (!user || !mayOnPage(req, 'write:feedback', board)) {
        return reply.forbidden('You are not allowed to submit ideas to this board.')
      }
      return {
        ideas: await WIKI.models.feedback.similar({
          board,
          viewerId: user.id,
          seeUnpublished: seesUnpublished(req, board),
          title: req.query.title
        })
      }
    }
  )

  /**
   * SUBMIT AN IDEA
   */
  app.post<{
    Params: { siteId: string }
    Body: {
      path: string
      locale?: string
      title: string
      content: string
      render: string
      categories?: string[]
    }
  }>(
    '/sites/:siteId/feedback/ideas',
    {
      config: {
        scope: 'pages'
      },
      schema: {
        summary: 'Submit an idea to a feedback board',
        description:
          "Creates a page in the board's folder, named after the title (with `-2`, `-3`… on a collision), as the caller — so it has history, is indexed, copied to storage targets and announced like any page — and upvotes it on the caller's behalf, unless the board has voting off.\n\nNeeds an account and `write:feedback` on the board, on a board that accepts ideas. The render is sanitized with no script or style permission regardless of what the caller holds. Limited to one submission per account per the site's submission interval (Admin → Editors → Feedback Board Editor, a minute by default), answering 429 with `Retry-After` past that.",
        tags: ['Pages'],
        params: siteIdParam,
        body: {
          type: 'object',
          required: ['path', 'title', 'content', 'render'],
          additionalProperties: false,
          properties: {
            path: { type: 'string', maxLength: 2048, description: "The board's own path." },
            locale: { type: 'string', maxLength: 10 },
            ...ideaInputProperties
          }
        },
        response: {
          201: {
            description: 'The idea was created',
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              path: { type: 'string' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const actor = actorFrom(req)
      const user = requestUser(req)
      if (!actor || !user) {
        return reply.unauthorized(userRequired(req, 'Submitting an idea'))
      }
      const board = loadBoard(req, reply, req.body)
      if (!board) {
        return reply
      }
      if (!mayOnPage(req, 'write:feedback', board)) {
        return reply.forbidden('You are not allowed to submit ideas to this board.')
      }
      if (!board.settings.acceptsIdeas) {
        return reply.forbidden('This board is not accepting new ideas.')
      }
      const title = req.body.title.trim()
      if (title.length < 1) {
        return reply.badRequest('An idea needs a title.')
      }
      if (req.body.content.trim().length < 1) {
        return reply.badRequest('An idea needs a description.')
      }
      const categories = checkCategories(
        board,
        req.body.categories,
        WIKI.models.feedback.mayModerate((permission) => mayOnPage(req, permission, board))
      )
      const name = normalizeNewPagePath(title).split('/').join('-')
      if (!name) {
        return reply.badRequest('The title has nothing in it a page could be named after.')
      }

      const cooldown = await WIKI.models.feedback.consumeCooldown(req.params.siteId, user.id)
      if (cooldown > 0) {
        reply.header('Retry-After', String(cooldown))
        return reply.tooManyRequests(
          `You are submitting too quickly. Try again in ${cooldown} second(s).`
        )
      }

      // -> Stored before the page that uses it, as the icon picker does, so that the wiki serves it
      //    without the Iconify API. Best effort: an offline instance costs a missing picture, not the idea
      try {
        await WIKI.models.icons.materializeIcons([IDEA_ICON])
      } catch (err: any) {
        WIKI.logger.warn(`Could not store the idea icon ${IDEA_ICON}: ${err.message}`)
      }

      const path = await WIKI.models.feedback.freePath(board, name)
      const { page, versionId } = await WIKI.models.pages.createPage(
        req.params.siteId,
        {
          path,
          locale: board.locale,
          title,
          description: excerptOf(req.body.content),
          icon: IDEA_ICON,
          editor: 'markdown',
          content: req.body.content,
          render: req.body.render,
          tags: categories,
          publishState: 'published',
          allowComments: true,
          allowRatings: true,
          // -> An idea is read in the board's measure with its discussion under it, and has no
          //    headings to list: the contents column would be a strip of nothing beside it
          showSidebar: false
        },
        // -> Sanitized as nobody's: a submission form is not where scripts and styles are written,
        //    whoever is filling it in
        { id: actor.id, permissions: [] }
      )
      if (board.settings.voting) {
        await WIKI.models.pageRatings.rate({
          pageId: page.id,
          userId: actor.id,
          mode: 'thumbs',
          value: 1
        })
      }

      await audit(req, 'page', 'createPage', {
        pageId: page.id,
        siteId: req.params.siteId,
        locale: page.locale,
        path: page.path,
        title: page.title,
        versionId
      })
      reply.code(201)
      return { id: page.id, path: page.path }
    }
  )

  /**
   * GET AN IDEA, TO EDIT IT
   */
  app.get<{ Params: { siteId: string; pageId: string } }>(
    '/sites/:siteId/feedback/ideas/:pageId',
    {
      config: {
        scope: 'pages'
      },
      schema: {
        summary: 'Get an idea to edit it',
        description:
          "Its title, its markdown source and its categories, for the submission form opened on it. The page route gives the source only to whoever holds `read:source` or may write the page, which the author of an idea usually does not — this is the same text, for whoever the form edits it for.\n\nFor the idea's author while it is still open, with `write:feedback` on the board; and for whoever holds `review:pages` or `manage:pages` on the board, at any status.",
        tags: ['Pages'],
        params: ideaParams,
        response: {
          200: {
            description: 'The idea as the form edits it',
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              title: { type: 'string' },
              content: { type: 'string' },
              categories: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const actor = actorFrom(req)
      if (!actor) {
        return reply.unauthorized(userRequired(req, 'Editing an idea'))
      }
      const idea = await loadIdea(req, reply)
      if (!idea) {
        return reply
      }
      const { page, board } = idea
      const { status } = await WIKI.models.feedback.statusOf(page.id)
      if (
        !WIKI.models.feedback.mayEdit(actor.id, page, status, (permission) =>
          mayOnPage(req, permission, page)
        )
      ) {
        return reply.forbidden(
          'Only its author may edit an idea this way, and only while it is open, unless they moderate the board.'
        )
      }
      const boardTags = new Set(board.settings.categories.map((category) => category.tag))
      return {
        id: page.id,
        title: page.title,
        content: page.content ?? '',
        categories: page.tags.filter((tag) => boardTags.has(tag))
      }
    }
  )

  /**
   * EDIT AN IDEA
   */
  app.patch<{
    Params: { siteId: string; pageId: string }
    Body: { title?: string; content?: string; render?: string; categories?: string[] }
  }>(
    '/sites/:siteId/feedback/ideas/:pageId',
    {
      config: {
        scope: 'pages'
      },
      schema: {
        summary: 'Edit an idea through the submission form',
        description:
          "Its title, description and categories, through the submission form. A change of title does not move the page — its URL is what was shared. Categories are replaced among the board's own tags only; any other tag on the page is kept.\n\nFor the idea's creator while it is still open, with `write:feedback` on the board; and for whoever holds `review:pages` or `manage:pages` on the board, at any status — who may also set categories on a board whose submitters do not pick them. Anybody who may write the page can also edit it in the editor.",
        tags: ['Pages'],
        params: ideaParams,
        body: {
          type: 'object',
          additionalProperties: false,
          properties: ideaInputProperties
        },
        response: {
          200: {
            description: 'The idea was updated',
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              path: { type: 'string' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const actor = actorFrom(req)
      if (!actor) {
        return reply.unauthorized(userRequired(req, 'Editing an idea'))
      }
      const idea = await loadIdea(req, reply)
      if (!idea) {
        return reply
      }
      const { page, board } = idea
      const { status } = await WIKI.models.feedback.statusOf(page.id)
      if (
        !WIKI.models.feedback.mayEdit(actor.id, page, status, (permission) =>
          mayOnPage(req, permission, page)
        )
      ) {
        return reply.forbidden(
          'Only its author may edit an idea this way, and only while it is open, unless they moderate the board.'
        )
      }
      const title = req.body.title?.trim()
      if (title !== undefined && title.length < 1) {
        return reply.badRequest('An idea needs a title.')
      }
      if (req.body.content !== undefined && req.body.content.trim().length < 1) {
        return reply.badRequest('An idea needs a description.')
      }
      if (req.body.content !== undefined && req.body.render === undefined) {
        return reply.badRequest('A new description needs the render that goes with it.')
      }
      const boardTags = new Set(board.settings.categories.map((category) => category.tag))
      const tags =
        req.body.categories === undefined
          ? undefined
          : [
              ...page.tags.filter((tag) => !boardTags.has(tag)),
              ...checkCategories(
                board,
                req.body.categories,
                WIKI.models.feedback.mayModerate((permission) => mayOnPage(req, permission, page))
              )
            ]
      const change = await WIKI.models.pages.updatePage(
        req.params.siteId,
        page.id,
        {
          ...(title !== undefined && { title }),
          ...(req.body.content !== undefined && {
            content: req.body.content,
            render: req.body.render,
            description: excerptOf(req.body.content)
          }),
          ...(tags !== undefined && { tags })
        },
        { id: actor.id, permissions: [] }
      )
      if (!change) {
        return reply.notFound('This idea does not exist.')
      }
      await audit(req, 'page', 'updatePage', {
        pageId: change.page.id,
        siteId: req.params.siteId,
        locale: change.page.locale,
        path: change.page.path,
        title: change.page.title,
        versionId: change.versionId
      })
      WIKI.collab.pageSaved(change.page.id, {
        versionDate: change.page.updatedAt
          .toTemporalInstant()
          .toString({ smallestUnit: 'millisecond' }),
        authorId: actor.id,
        authorName: change.page.authorName ?? ''
      })
      return { id: change.page.id, path: change.page.path }
    }
  )

  /**
   * WITHDRAW ONE'S OWN IDEA
   */
  app.delete<{ Params: { siteId: string; pageId: string } }>(
    '/sites/:siteId/feedback/ideas/:pageId',
    {
      config: {
        scope: 'pages'
      },
      schema: {
        summary: 'Withdraw an idea you submitted',
        description:
          "Deletes the idea's page, the way the file manager deletes one: its history records the deletion and it can be recovered from the recycle bin by whoever may delete pages there. For the idea's author while it is still open; needs `write:feedback` on the board. Anybody who may delete pages there deletes it like any other page.",
        tags: ['Pages'],
        params: ideaParams,
        response: {
          204: { description: 'The idea was withdrawn' }
        }
      }
    },
    async (req, reply) => {
      const actor = actorFrom(req)
      if (!actor) {
        return reply.unauthorized(userRequired(req, 'Withdrawing an idea'))
      }
      const idea = await loadIdea(req, reply)
      if (!idea) {
        return reply
      }
      const { page } = idea
      const { status } = await WIKI.models.feedback.statusOf(page.id)
      if (
        !WIKI.models.feedback.mayEditOwn(actor.id, page, status, (permission) =>
          mayOnPage(req, permission, page)
        )
      ) {
        return reply.forbidden(
          'Only its author may withdraw an idea this way, and only while it is open.'
        )
      }
      const deleted = await WIKI.models.pages.deletePage(req.params.siteId, page.id, actor)
      if (!deleted) {
        return reply.notFound('This idea does not exist.')
      }
      await audit(req, 'page', 'deletePage', {
        pageId: page.id,
        siteId: req.params.siteId,
        locale: page.locale,
        path: page.path,
        title: page.title,
        versionId: deleted.versionId
      })
      return reply.code(204).send()
    }
  )

  /**
   * CHANGE AN IDEA'S STATUS
   */
  app.put<{
    Params: { siteId: string; pageId: string }
    Body: { status: FeedbackStatus; comment?: string }
  }>(
    '/sites/:siteId/feedback/ideas/:pageId/status',
    {
      config: {
        scope: 'pages'
      },
      schema: {
        summary: "Change an idea's status",
        description:
          "Moves the idea to another status, optionally posting `comment` to its discussion as the explanation — in the same transaction, so neither happens without the other. The comment is a real comment by the caller, marked with the change it was posted with, and is offered only where the discussion is shown: the site uses the built-in comments provider with comments on, and the idea takes comments. Without a comment nothing appears in the discussion. Every change is recorded in the audit log either way.\n\nNeeds `review:pages` or `manage:pages` on the board. Answers 409 when the idea already has that status: to say something without changing it, post a comment.\n\nTells the idea's author and everybody who voted for it, and — when there is a comment — whoever watches the idea or is mentioned in it.",
        tags: ['Pages'],
        params: ideaParams,
        body: {
          type: 'object',
          required: ['status'],
          additionalProperties: false,
          properties: {
            status: { $ref: 'FeedbackStatus#' },
            comment: {
              type: 'string',
              maxLength: COMMENT_MAX_LENGTH,
              description: 'Markdown, as a comment is written. Empty or absent for none.'
            }
          }
        },
        response: {
          200: {
            description: 'Where the idea stands now',
            type: 'object',
            properties: {
              status: { $ref: 'FeedbackIdeaStatus#' },
              comment: {
                anyOf: [{ type: 'null' }, { $ref: 'Comment#' }],
                description: 'The comment that was posted with the change, if one was.'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const user = requestUser(req)
      if (!user) {
        return reply.unauthorized(userRequired(req, "Changing an idea's status"))
      }
      const idea = await loadIdea(req, reply)
      if (!idea) {
        return reply
      }
      const { page } = idea
      if (!mayOnPage(req, 'review:pages', page) && !mayOnPage(req, 'manage:pages', page)) {
        return reply.forbidden('You are not allowed to change the status of ideas on this board.')
      }
      const comment = req.body.comment?.trim() || null
      if (
        comment &&
        (!WIKI.models.comments.usesBuiltIn(req.params.siteId) || !page.allowComments)
      ) {
        return reply.badRequest(
          'This idea has no discussion to post a comment in. Change the status without one.'
        )
      }

      const result = await WIKI.models.feedback.setStatus({
        pageId: page.id,
        status: req.body.status,
        comment,
        actor: { id: user.id, name: user.name, ip: req.ip }
      })

      await audit(req, 'page', 'setFeedbackStatus', {
        pageId: page.id,
        siteId: req.params.siteId,
        locale: page.locale,
        path: page.path,
        from: result.from,
        to: req.body.status,
        commentId: result.comment?.id ?? null
      })
      if (result.comment) {
        await audit(req, 'comment', 'createComment', {
          commentId: result.comment.id,
          pageId: page.id,
          path: page.path,
          locale: page.locale,
          isReply: false,
          isGuest: false,
          annotations: 0
        })
        await WIKI.models.hooks.emit('comment:new', {
          id: result.comment.id,
          parentId: null,
          pageId: page.id,
          path: page.path,
          locale: page.locale,
          siteId: req.params.siteId,
          authorId: user.id,
          metadata: {
            authorName: result.comment.authorName,
            authorEmail: null,
            authorIP: req.ip,
            isGuest: false,
            pageTitle: page.title
          },
          content: result.comment.content
        })
      }
      /*
        One event for the change and its comment together, not a `comment:new` beside it: the fan-out
        deduplicates within an event, so the author who also watches the idea is told once, by the
        category that says what happened (`feedbackStatus`).
      */
      await WIKI.models.notifications.emit('feedback:status', {
        siteId: req.params.siteId,
        actorId: user.id,
        data: {
          variant: 'new',
          page: WIKI.models.notifications.pageSnapshot(page),
          statusFrom: result.from,
          statusTo: req.body.status,
          ...(result.comment && {
            commentId: result.comment.id,
            excerpt: WIKI.models.comments.excerptOf(result.comment.content),
            mentionHandles: WIKI.models.comments.mentionedHandles(result.comment.content)
          })
        }
      })
      return result
    }
  )

  /**
   * LIST EVERY FEEDBACK BOARD
   */
  app.get(
    '/feedback/boards',
    {
      config: {
        permissions: ['read:groups', 'write:groups', 'manage:groups']
      },
      schema: {
        summary: 'List every feedback board',
        description:
          "Where each board on the instance is, for the group editor: everything at or under a board is ruled by the board's own page rules, so a rule written for a path underneath one is never consulted, and the editor says so beside it.",
        tags: ['Groups'],
        response: {
          200: {
            description: 'Every board, by site',
            type: 'array',
            items: {
              type: 'object',
              properties: {
                siteId: { type: 'string', format: 'uuid' },
                locale: { type: 'string' },
                path: { type: 'string' },
                title: { type: 'string' }
              }
            }
          }
        }
      }
    },
    async () => {
      return Object.keys(WIKI.sites).flatMap((siteId) =>
        WIKI.models.feedback.boardPaths(siteId).map((board) => ({ siteId, ...board }))
      )
    }
  )
}

export default routes
