import { audit } from '../helpers/audit.ts'
import { LIST_GROUPS_PERMISSIONS, LIST_USERS_PERMISSIONS } from '../models/groups.ts'
import { MAX_PAGE_OWNERS, OWNERSHIP_MODES } from '../models/pageOwners.ts'
import { actorFrom, mayOnPage, userRequired } from './pages.ts'
import type { FastifyInstance } from 'fastify'
import type { OwnershipMode } from '../models/pageOwners.ts'

const pageParams = {
  type: 'object',
  properties: {
    siteId: { type: 'string', format: 'uuid' },
    pageId: { type: 'string', format: 'uuid' }
  },
  required: ['siteId', 'pageId']
}

/**
 * Page Ownership API Routes
 *
 * Who answers for a page. Read with the page itself (`ownership` on its payload); written here, and
 * only here, because it is not page content: a page save never carries it and no version records it.
 */
async function routes(app: FastifyInstance) {
  /**
   * SET PAGE OWNERSHIP
   */
  app.put<{
    Params: { siteId: string; pageId: string }
    Body: { mode: OwnershipMode; ids?: string[] }
  }>(
    '/sites/:siteId/pages/:pageId/ownership',
    {
      config: {
        scope: 'pages'
      },
      /*
        No route-level `permissions`: who may change a page's owners is whoever may write the page,
        which is a page rule and not something the group-wide list that hook reads can answer.
      */
      schema: {
        summary: "Set a page's owners",
        description:
          'Replaces the owners of a page with some users or some groups, or with nobody — `creator`, which is what a page with no owners is: owned by the user who created it.\n\nNeeds `write:pages` on the page. Naming users needs `list:users` (or `read:users`, `write:users`, `manage:users`) as well, and naming groups `list:groups` (or `read:groups`, `write:groups`, `manage:groups`) — the permissions that let the caller find them in the first place. Sending back the owners the page already has needs neither, and neither does going back to `creator`.\n\nAn owner must be an active user, or a group other than Guests. Records no page version.',
        tags: ['Pages'],
        params: pageParams,
        body: {
          type: 'object',
          required: ['mode'],
          properties: {
            mode: { type: 'string', enum: [...OWNERSHIP_MODES] },
            ids: {
              type: 'array',
              maxItems: MAX_PAGE_OWNERS,
              items: { type: 'string', format: 'uuid' },
              description:
                'The users or the groups, as `mode` says. Ignored for `creator`; empty means `creator`.'
            }
          }
        },
        response: {
          200: {
            description: "The page's owners as they now stand",
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              ownership: { $ref: 'PageOwnership#' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const actor = actorFrom(req)
      if (!actor) {
        return reply.unauthorized(userRequired(req, "Changing a page's owners"))
      }
      const page = await WIKI.models.pages.getPage({
        siteId: req.params.siteId,
        id: req.params.pageId
      })
      if (!page) {
        return reply.notFound('This page does not exist.')
      }
      if (!mayOnPage(req, 'write:pages', page)) {
        return reply.forbidden('You are not allowed to edit this page.')
      }

      const { mode } = req.body
      const ids = mode === 'creator' ? [] : [...new Set(req.body.ids ?? [])]
      /*
        Naming somebody takes being able to find them. Compared against the owners the page has, so
        that somebody who cannot look users up can still save a page whose owners they did not touch
        -- and can always hand a page back to its creator, which names nobody.
      */
      if (ids.length > 0) {
        const current = await WIKI.models.pageOwners.ownershipOf(page.id)
        const held = new Set(
          (mode === 'users' ? current.users : current.groups).map((owner) => owner.id)
        )
        const isUnchanged =
          current.mode === mode && held.size === ids.length && ids.every((id) => held.has(id))
        const needed = mode === 'users' ? LIST_USERS_PERMISSIONS : LIST_GROUPS_PERMISSIONS
        const mayList = ['manage:system', ...needed].some((permission) =>
          actor.permissions.includes(permission)
        )
        if (!isUnchanged && !mayList) {
          return reply.forbidden(
            mode === 'users'
              ? 'You are not allowed to look up users, so you cannot name them as owners.'
              : 'You are not allowed to look up groups, so you cannot name them as owners.'
          )
        }
      }

      const ownership = await WIKI.models.pageOwners.setOwnership(page.id, mode, ids)

      await audit(req, 'page', 'updatePageOwnership', {
        pageId: page.id,
        siteId: req.params.siteId,
        locale: page.locale,
        path: page.path,
        mode: ownership.mode
      })

      return { ok: true, ownership }
    }
  )
}

export default routes
