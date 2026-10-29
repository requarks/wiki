import { audit } from '../helpers/audit.ts'
import { actorFrom, mayOnPage, unlockedFor, unpublishedFor, userRequired } from './pages.ts'
import { takesVotes } from '../models/feedback.ts'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { RatingMode } from '../models/pageRatings.ts'
import type { Page } from '../models/pages.ts'

const pageParams = {
  type: 'object',
  properties: {
    siteId: { type: 'string', format: 'uuid' },
    pageId: { type: 'string', format: 'uuid' }
  },
  required: ['siteId', 'pageId']
}

const ratingResponse = {
  description: 'How the page is rated now, and what the caller gave it',
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    rating: { $ref: 'PageRatingSummary#' },
    value: {
      type: 'integer',
      description: 'The caller’s own rating, 0 once withdrawn.'
    }
  }
}

/**
 * The page being rated and the scale it is rated on, or a refusal.
 *
 * Rating belongs to an account — one opinion per person needs a person to hang it on — so an
 * anonymous request never gets as far as the page. Beyond that it is the same gate as reading: a page
 * somebody may not read is answered as though it were not there. Both switches have to be on, the
 * site's ratings mode and the page's own `allowRatings`.
 *
 * An idea on a feedback board is voted for rather than rated: always on thumbs, regardless of the
 * site's ratings mode, with the board's `voting` switch standing in for that mode. `isIdea` tells the
 * caller so, since a vote against an idea is not something a board records.
 */
async function loadRateable(
  req: FastifyRequest<{ Params: { siteId: string; pageId: string } }>,
  reply: FastifyReply
): Promise<{ userId: string; mode: RatingMode; page: Page; isIdea: boolean } | null> {
  const actor = actorFrom(req)
  if (!actor) {
    reply.unauthorized(userRequired(req, 'Rating a page'))
    return null
  }
  const page = await WIKI.models.pages.getPage({
    siteId: req.params.siteId,
    id: req.params.pageId,
    unpublished: unpublishedFor(req),
    unlocked: (target) => unlockedFor(req, target)
  })
  if (!page || !mayOnPage(req, 'read:pages', page)) {
    reply.notFound('This page does not exist.')
    return null
  }
  const board = WIKI.models.feedback.boardOfIdea(
    req.params.siteId,
    page.locale,
    page.path,
    page.editor
  )
  const mode: RatingMode | null = board
    ? board.settings.voting
      ? 'thumbs'
      : null
    : WIKI.models.pageRatings.modeFor(req.params.siteId)
  if (!mode) {
    reply.forbidden(
      board ? 'Voting is turned off on this board.' : 'Ratings are turned off for this site.'
    )
    return null
  }
  if (!page.allowRatings) {
    reply.forbidden('Ratings are turned off for this page.')
    return null
  }
  // -> A settled idea keeps the count it was settled at: see `takesVotes`
  if (board) {
    const { status } = await WIKI.models.feedback.statusOf(page.id)
    if (!takesVotes(status)) {
      reply.forbidden('This idea is no longer taking votes.')
      return null
    }
  }
  return { userId: actor.id, mode, page, isIdea: Boolean(board) }
}

/**
 * Page Ratings API Routes
 *
 * A reader's thumbs or stars for a page. How a page is rated so far comes with the page itself
 * (`rating`, and the reader's own under `viewer.rating`), so there is no read route here.
 *
 * No route-level `permissions` on either: the test is `read:pages` on the page, which a group's page
 * rules decide and the hook in `index.ts` cannot see.
 */
async function routes(app: FastifyInstance) {
  /**
   * RATE A PAGE
   */
  app.put<{ Params: { siteId: string; pageId: string }; Body: { value: number } }>(
    '/sites/:siteId/pages/:pageId/rating',
    {
      config: {
        scope: 'pages'
      },
      schema: {
        summary: 'Rate a page',
        description:
          'Records the caller’s rating of the page, replacing any they gave it before. The scale is the site’s ratings mode: `1` or `-1` for thumbs, `1` to `5` for stars.\n\nAn idea on a feedback board is voted for instead: always thumbs, regardless of the site’s mode, and only `1` — an upvote. The board’s own voting switch stands in for the site’s ratings mode there, and an idea that is Completed or Closed takes no more votes.\n\nNeeds a logged in user who may read the page, with ratings on for both the site and the page.',
        tags: ['Pages'],
        params: pageParams,
        body: {
          type: 'object',
          required: ['value'],
          properties: {
            value: { type: 'integer', minimum: -1, maximum: 5 }
          }
        },
        response: { 200: ratingResponse }
      }
    },
    async (req, reply) => {
      const target = await loadRateable(req, reply)
      if (!target) {
        return reply
      }
      const { userId, mode, page, isIdea } = target
      if (isIdea && req.body.value !== 1) {
        return reply.badRequest('An idea can only be voted for: the value is 1.')
      }
      if (!WIKI.models.pageRatings.isValid(mode, req.body.value)) {
        return reply.badRequest(
          mode === 'thumbs'
            ? 'A thumbs rating is 1 or -1.'
            : 'A star rating is a whole number from 1 to 5.'
        )
      }
      const totals = await WIKI.models.pageRatings.rate({
        pageId: page.id,
        userId,
        mode,
        value: req.body.value
      })

      await audit(req, 'page', 'ratePage', {
        pageId: page.id,
        siteId: req.params.siteId,
        locale: page.locale,
        path: page.path,
        mode,
        value: req.body.value
      })

      return {
        ok: true,
        rating: WIKI.models.pageRatings.summaryFromCache(totals, mode),
        value: req.body.value
      }
    }
  )

  /**
   * WITHDRAW A RATING
   */
  app.delete<{ Params: { siteId: string; pageId: string } }>(
    '/sites/:siteId/pages/:pageId/rating',
    {
      config: {
        scope: 'pages'
      },
      schema: {
        summary: 'Withdraw a rating',
        description:
          'Forgets the caller’s rating of the page. A page they had not rated answers the same way, since the outcome asked for already holds.\n\nRefused on an idea that is Completed or Closed, whose count is kept as it was settled.',
        tags: ['Pages'],
        params: pageParams,
        response: { 200: ratingResponse }
      }
    },
    async (req, reply) => {
      const target = await loadRateable(req, reply)
      if (!target) {
        return reply
      }
      const { userId, mode, page } = target
      const totals = await WIKI.models.pageRatings.unrate({ pageId: page.id, userId })

      await audit(req, 'page', 'unratePage', {
        pageId: page.id,
        siteId: req.params.siteId,
        locale: page.locale,
        path: page.path
      })

      return {
        ok: true,
        rating: WIKI.models.pageRatings.summaryFromCache(totals, mode),
        value: 0
      }
    }
  )
}

export default routes
