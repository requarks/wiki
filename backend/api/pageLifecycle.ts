import { audit } from '../helpers/audit.ts'
import { MAX_LIFECYCLE_RULES } from '../models/pageLifecycle.ts'
import { actorFrom, mayOnPage, retagRefusal, unpublishedFor, userRequired } from './pages.ts'
import type { FastifyInstance } from 'fastify'
import type { LifecycleRuleInput } from '../models/pageLifecycle.ts'

const pageParams = {
  type: 'object',
  properties: {
    siteId: { type: 'string', format: 'uuid' },
    pageId: { type: 'string', format: 'uuid' }
  },
  required: ['siteId', 'pageId']
}

/**
 * Page Lifecycle API Routes
 *
 * The rules a page carries about growing old, and the review that answers the banner one of them puts
 * up. Rules are read with the page itself (`lifecycleRules` on its payload) and written here, because
 * they are not page content: a page save never carries them and no version records them.
 */
async function routes(app: FastifyInstance) {
  /**
   * SET LIFECYCLE RULES
   */
  app.put<{
    Params: { siteId: string; pageId: string }
    Body: { rules: LifecycleRuleInput[] }
  }>(
    '/sites/:siteId/pages/:pageId/lifecycle-rules',
    {
      config: {
        scope: 'pages'
      },
      /*
        No route-level `permissions`: everything here is decided by page rules, which the group-wide
        list that hook reads cannot answer.
      */
      schema: {
        summary: "Set a page's lifecycle rules",
        description:
          'Replaces the page’s lifecycle rules with these. A rule sent with its `id` and unchanged is left exactly as it was — its author, and when it last fired. A rule that is new or says something different is written with the caller as its author, and its actions are later carried out as them.\n\nNeeds `write:pages` on the page. A new or changed rule that moves the page also needs `manage:pages` on it and at where it would go; one that applies tags needs `write:tags` on the page as it stands and as the tags leave it. Only one rule may show a banner. Records no page version.',
        tags: ['Pages'],
        params: pageParams,
        body: {
          type: 'object',
          required: ['rules'],
          properties: {
            rules: {
              type: 'array',
              maxItems: MAX_LIFECYCLE_RULES,
              items: { $ref: 'LifecycleRuleInput#' }
            }
          }
        },
        response: {
          200: {
            description: "The page's lifecycle rules as they now stand",
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              rules: { type: 'array', items: { $ref: 'LifecycleRule#' } }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const actor = actorFrom(req)
      if (!actor) {
        return reply.unauthorized(userRequired(req, "Changing a page's lifecycle rules"))
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

      const rules = req.body.rules.map((rule) =>
        WIKI.models.pageLifecycle.normalize(rule, page.path)
      )
      /*
        A rule acts later, as whoever wrote it, so writing one must not let anybody schedule what they
        could not do themselves. Asked of the rules this save writes, not of the ones it keeps: those
        were checked against whoever wrote them, who is still their author.
      */
      for (const rule of await WIKI.models.pageLifecycle.changedRules(page.id, rules)) {
        for (const action of rule.actions) {
          if (action.kind === 'move') {
            const destination = {
              siteId: req.params.siteId,
              path: WIKI.models.pageLifecycle.destinationOf(action.path, page.path),
              locale: page.locale,
              tags: page.tags ?? []
            }
            if (
              !mayOnPage(req, 'manage:pages', page) ||
              !mayOnPage(req, 'manage:pages', destination)
            ) {
              return reply.forbidden(
                `"${rule.name}" moves the page, and you are not allowed to move it there.`
              )
            }
          } else if (action.kind === 'tags') {
            const refused = retagRefusal(req, page, [
              ...new Set([...(page.tags ?? []), ...action.tags])
            ])
            if (refused) {
              return reply.forbidden(`"${rule.name}" applies tags. ${refused}`)
            }
          }
        }
      }

      const saved = await WIKI.models.pageLifecycle.replaceRules(page, rules, actor.id)

      await audit(req, 'page', 'updateLifecycleRules', {
        pageId: page.id,
        siteId: req.params.siteId,
        locale: page.locale,
        path: page.path,
        rules: saved.length
      })

      return { ok: true, rules: saved }
    }
  )

  /**
   * MARK PAGE REVIEWED
   */
  app.put<{ Params: { siteId: string; pageId: string } }>(
    '/sites/:siteId/pages/:pageId/reviewed',
    {
      config: {
        scope: 'pages'
      },
      // -> No route-level `permissions`: being one of the page's owners is not a permission at all
      schema: {
        summary: 'Mark a page as reviewed',
        description:
          'Says the page has been looked over and is accurate — as it stood, or after the edits that made it so. Takes down the lifecycle banner and restarts the count of every rule counting days since the content changed or since the last comment.\n\nFor one of the page’s owners, or anybody holding `write:pages` or `manage:pages` on it.',
        tags: ['Pages'],
        params: pageParams,
        response: {
          200: {
            description: 'The page is marked reviewed',
            type: 'object',
            properties: {
              ok: { type: 'boolean' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const actor = actorFrom(req)
      if (!actor) {
        return reply.unauthorized(userRequired(req, 'Marking a page reviewed'))
      }
      const page = await WIKI.models.pages.getPage({
        siteId: req.params.siteId,
        id: req.params.pageId,
        unpublished: unpublishedFor(req)
      })
      if (!page || !mayOnPage(req, 'read:pages', page)) {
        return reply.notFound('This page does not exist.')
      }
      const allowed =
        mayOnPage(req, 'write:pages', page) ||
        mayOnPage(req, 'manage:pages', page) ||
        (await WIKI.models.pageOwners.isOwner(page, actor.id))
      if (!allowed) {
        return reply.forbidden(
          'Only an owner of this page, or somebody who may edit it, can do this.'
        )
      }

      await WIKI.models.pageLifecycle.markReviewed(page.id)

      await audit(req, 'page', 'markPageReviewed', {
        pageId: page.id,
        siteId: req.params.siteId,
        locale: page.locale,
        path: page.path
      })

      return { ok: true }
    }
  )
}

export default routes
