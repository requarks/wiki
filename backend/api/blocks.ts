import type { FastifyInstance, FastifyRequest } from 'fastify'

/**
 * Group-wide permissions that carry the block list on their own.
 *
 * Only the ones a group really is granted as a blanket. Writing a page is NOT among them, however much
 * it sounds like it belongs: page permissions come from a group's rules, and are read below.
 */
const LIST_PERMISSIONS = ['read:sites', 'manage:sites', 'manage:system']

/** The page rules that make somebody an author, i.e. able to put a block into a page directly. */
const AUTHOR_ROLES = ['write:pages', 'manage:pages']

/**
 * Whether this caller has any business seeing which blocks a site has.
 *
 * The list is what the editor's block picker is built from, so it belongs to whoever may put a block
 * into a page. Three ways of being that person:
 *
 *   - an administrator, from the group-wide list above;
 *   - an author, from a page rule that lets them write somewhere on this site;
 *   - anyone an enabled approval rule lets SUGGEST an edit — the guests group included, when a wiki
 *     has opened suggestions to the public. A suggestion is written in the same editor, with the same
 *     picker in it, and refusing the list there leaves the button throwing an error at a reader who
 *     was invited to use it.
 *
 * Asked of the site rather than of a page, because that is what the answer is about: which blocks
 * exist here. Nothing in the reply is page-specific, so a rule anywhere on the site settles it — what
 * may be written WHERE is decided by the page and suggestion routes, as it is for everything else.
 *
 * The route-level permission hook cannot answer any of this: it reads the group-wide list alone, and
 * both writing a page and suggesting an edit are granted by rules instead.
 */
async function mayListBlocks(req: FastifyRequest, siteId: string): Promise<boolean> {
  const actor = WIKI.models.groups.actorForRequest(req)
  if (LIST_PERMISSIONS.some((permission) => actor.permissions.includes(permission))) {
    return true
  }
  // -> Both of these read cached group rules; only the last resort goes to the database
  if (
    WIKI.models.groups
      .rulesForGroups(actor.groupIds)
      .some(
        (rule) => rule.mode !== 'DENY' && AUTHOR_ROLES.some((role) => rule.roles?.includes(role))
      )
  ) {
    return true
  }
  const groupIds = WIKI.models.approvals.getActorGroupIds(req)
  const rules = await WIKI.models.approvals.getRules(siteId)
  return rules.some(
    (rule) => rule.isEnabled && rule.submitterGroups.some((id) => groupIds.includes(id))
  )
}

/**
 * Blocks API Routes
 */
async function routes(app: FastifyInstance) {
  /**
   * LIST SITE BLOCKS
   */
  app.get<{ Params: { siteId: string } }>(
    '/sites/:siteId/blocks',
    {
      /*
        No route-level `permissions`: who may see this list comes down to a group's rules, which that
        hook does not read — and it would refuse an anonymous reader outright, when a wiki that takes
        public suggestions has invited exactly that reader to use the picker. See `mayListBlocks`.
      */
      schema: {
        summary: 'List the blocks available to a site',
        description:
          'Built-in blocks are registered from the compiled block manifest, so the list reflects what is actually installed. This is what the editor builds its block picker from, so it is available to page authors and to anyone an approval rule lets suggest an edit — guests included, where a site takes public suggestions — as well as to site administrators.',
        tags: ['Blocks'],
        params: {
          type: 'object',
          properties: {
            siteId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['siteId']
        },
        response: {
          200: {
            description: 'List of site blocks',
            type: 'array',
            items: { $ref: 'Block#' }
          }
        }
      }
    },
    async (req, reply) => {
      const site = await WIKI.models.sites.getSiteById({ id: req.params.siteId })
      if (!site) {
        return reply.notFound('Site does not exist.')
      }
      if (!(await mayListBlocks(req, req.params.siteId))) {
        return reply.forbidden('You are not allowed to list the blocks of this site.')
      }
      return WIKI.models.blocks.getSiteBlocks(req.params.siteId)
    }
  )

  /**
   * SET SITE BLOCKS STATE
   */
  app.put<{
    Params: { siteId: string }
    Body: { states: { id: string; isEnabled: boolean }[] }
  }>(
    '/sites/:siteId/blocks',
    {
      config: {
        permissions: ['manage:sites']
      },
      schema: {
        summary: 'Enable or disable site blocks',
        description: 'Only the blocks listed are affected; any others keep their current state.',
        tags: ['Blocks'],
        params: {
          type: 'object',
          properties: {
            siteId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['siteId']
        },
        body: {
          type: 'object',
          required: ['states'],
          properties: {
            states: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'isEnabled'],
                properties: {
                  id: {
                    type: 'string',
                    format: 'uuid'
                  },
                  isEnabled: {
                    type: 'boolean'
                  }
                }
              }
            }
          }
        },
        response: {
          200: {
            description: 'Blocks state updated successfully',
            type: 'object',
            properties: {
              ok: {
                type: 'boolean'
              },
              message: {
                type: 'string'
              },
              updated: {
                type: 'integer',
                description:
                  'How many block rows were written. A block already in the requested state still counts.'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const site = await WIKI.models.sites.getSiteById({ id: req.params.siteId })
      if (!site) {
        return reply.notFound('Site does not exist.')
      }

      try {
        const updated = await WIKI.models.blocks.setBlocksState(req.params.siteId, req.body.states)
        return {
          ok: true,
          message: 'Blocks state updated successfully.',
          updated
        }
      } catch (err: any) {
        WIKI.logger.warn(err)
        return reply.internalServerError()
      }
    }
  )

  /**
   * DELETE CUSTOM BLOCK
   */
  app.delete<{ Params: { siteId: string; blockId: string } }>(
    '/sites/:siteId/blocks/:blockId',
    {
      config: {
        permissions: ['manage:sites']
      },
      schema: {
        summary: 'Delete a custom block',
        description:
          'Only custom blocks can be deleted. Built-in blocks are registered from disk and would reappear on the next sync.',
        tags: ['Blocks'],
        params: {
          type: 'object',
          properties: {
            siteId: {
              type: 'string',
              format: 'uuid'
            },
            blockId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['siteId', 'blockId']
        },
        response: {
          204: {
            description: 'Block deleted successfully'
          }
        }
      }
    },
    async (req, reply) => {
      const site = await WIKI.models.sites.getSiteById({ id: req.params.siteId })
      if (!site) {
        return reply.notFound('Site does not exist.')
      }

      const siteBlocks = await WIKI.models.blocks.getSiteBlocks(req.params.siteId)
      const block = siteBlocks.find((b) => b.id === req.params.blockId)
      if (!block) {
        return reply.notFound('Block does not exist.')
      }
      if (!block.isCustom) {
        return reply.conflict('Cannot delete a built-in block.')
      }

      await WIKI.models.blocks.deleteCustomBlock(req.params.siteId, req.params.blockId)
      return reply.code(204).send()
    }
  )
}

export default routes
