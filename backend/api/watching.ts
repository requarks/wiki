import { actorFrom, mayOnPage, unlockedFor } from './pages.ts'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

/**
 * The page being watched, as this requester is allowed to see it.
 *
 * Watching a page is a thing done TO a page, so it goes through the same gate as reading one: an
 * anonymous requester never gets here at all, and a page somebody may not read is answered as though
 * it were not there. A password is not part of it — the watcher is asking to be told when the page
 * changes, not to read what it says.
 */
async function loadWatchablePage(req: FastifyRequest, siteId: string, pageId: string) {
  const page = await WIKI.models.pages.getPage({
    siteId,
    id: pageId,
    unlocked: (id: string) => unlockedFor(req, id)
  })
  if (!page || !mayOnPage(req, 'read:pages', page)) {
    return null
  }
  return page
}

/**
 * The user doing the watching, or a refusal.
 *
 * Watching belongs to an account: it is a list somebody comes back to, and a row has to point at a
 * person for a notification to ever have a recipient. There is no permission for it beyond being
 * logged in — anybody who may read a page may ask to hear about it.
 */
function watcherOf(req: FastifyRequest, reply: FastifyReply): string | null {
  const actor = actorFrom(req)
  if (!actor) {
    reply.unauthorized('Watching a page requires a logged in user.')
    return null
  }
  return actor.id
}

const pageParams = {
  type: 'object',
  properties: {
    siteId: { type: 'string', format: 'uuid' },
    pageId: { type: 'string', format: 'uuid' }
  },
  required: ['siteId', 'pageId']
}

/**
 * Page Watching API Routes
 *
 * Who has asked to be told when a page changes. Nothing is sent yet — notifications are not built —
 * so these keep the list: the bell on a page writes to it, and the inbox reads it back.
 */
async function routes(app: FastifyInstance) {
  /**
   * WATCH A PAGE
   */
  app.put<{ Params: { siteId: string; pageId: string } }>(
    '/sites/:siteId/pages/:pageId/watch',
    {
      /*
        No route-level `permissions`: this is decided per page, by whether the caller may read it —
        which comes from a group's rules and not from the group-wide list that hook consults.
      */
      schema: {
        summary: 'Watch a page',
        description:
          'Records that the caller wants to hear about changes to this page. Watching a page already watched changes nothing and still answers 200, so the button can be pressed twice without it meaning anything different.',
        tags: ['Pages'],
        params: pageParams,
        response: {
          200: {
            description: 'The page is being watched',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              isWatching: { type: 'boolean' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const userId = watcherOf(req, reply)
      if (!userId) {
        return reply
      }
      const page = await loadWatchablePage(req, req.params.siteId, req.params.pageId)
      if (!page) {
        return reply.notFound('This page does not exist.')
      }
      await WIKI.models.pageWatching.watch({
        siteId: req.params.siteId,
        pageId: page.id,
        userId
      })
      return { ok: true, isWatching: true }
    }
  )

  /**
   * UNWATCH A PAGE
   */
  app.delete<{ Params: { siteId: string; pageId: string } }>(
    '/sites/:siteId/pages/:pageId/watch',
    {
      // -> Same as above: readable is the test, and it is per page
      schema: {
        summary: 'Stop watching a page',
        description:
          'Forgets that the caller wanted to hear about this page. A page that was not being watched answers the same way, since the outcome asked for — no longer watching it — already holds.',
        tags: ['Pages'],
        params: pageParams,
        response: {
          200: {
            description: 'The page is no longer being watched',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              isWatching: { type: 'boolean' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const userId = watcherOf(req, reply)
      if (!userId) {
        return reply
      }
      /*
        The page is NOT loaded first. Unwatching has to keep working for a page that has since been
        made unreadable, or the row would be stuck there with nothing in the interface able to remove
        it — and there is nothing to protect anyway: this only ever deletes the caller's own row.
      */
      await WIKI.models.pageWatching.unwatch({ pageId: req.params.pageId, userId })
      return { ok: true, isWatching: false }
    }
  )

  /**
   * LIST WATCHED PAGES
   */
  app.get<{ Params: { siteId: string } }>(
    '/sites/:siteId/watching',
    {
      // -> Everything it returns is the caller's own, so being logged in is the whole of the check
      schema: {
        summary: 'List the pages the caller is watching',
        description:
          'The watch list of the caller on this site, most recently watched first. Titles and paths come from the pages themselves, so a page that has been renamed or moved is listed where it is now.',
        tags: ['Pages'],
        params: {
          type: 'object',
          properties: {
            siteId: { type: 'string', format: 'uuid' }
          },
          required: ['siteId']
        },
        response: {
          200: {
            description: 'Watched pages',
            type: 'array',
            items: { $ref: 'WatchedPage#' }
          }
        }
      }
    },
    async (req, reply) => {
      const userId = watcherOf(req, reply)
      if (!userId) {
        return reply
      }
      return WIKI.models.pageWatching.listForUser(req.params.siteId, userId)
    }
  )
}

export default routes
