import { audit } from '../helpers/audit.ts'
import { actorFrom, mayOnPage, unlockedFor } from './pages.ts'
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
 */
async function loadRateable(
  req: FastifyRequest<{ Params: { siteId: string; pageId: string } }>,
  reply: FastifyReply
): Promise<{ userId: string; mode: RatingMode; page: Page } | null> {
  const actor = actorFrom(req)
  if (!actor) {
    reply.unauthorized('Rating a page requires a logged in user.')
    return null
  }
  const mode = WIKI.models.pageRatings.modeFor(req.params.siteId)
  if (!mode) {
    reply.forbidden('Ratings are turned off for this site.')
    return null
  }
  const page = await WIKI.models.pages.getPage({
    siteId: req.params.siteId,
    id: req.params.pageId,
    unlocked: (id: string) => unlockedFor(req, id)
  })
  if (!page || !mayOnPage(req, 'read:pages', page)) {
    reply.notFound('This page does not exist.')
    return null
  }
  if (!page.allowRatings) {
    reply.forbidden('Ratings are turned off for this page.')
    return null
  }
  return { userId: actor.id, mode, page }
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
      schema: {
        summary: 'Rate a page',
        description:
          'Records the caller’s rating of the page, replacing any they gave it before. The scale is the site’s ratings mode: `1` or `-1` for thumbs, `1` to `5` for stars.\n\nNeeds a logged in user who may read the page, with ratings on for both the site and the page.',
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
      const { userId, mode, page } = target
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
      schema: {
        summary: 'Withdraw a rating',
        description:
          'Forgets the caller’s rating of the page. A page they had not rated answers the same way, since the outcome asked for already holds.',
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
