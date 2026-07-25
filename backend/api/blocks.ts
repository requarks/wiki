import type { FastifyInstance } from 'fastify'

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
      config: {
        permissions: ['read:sites', 'manage:sites']
      },
      schema: {
        summary: 'List the blocks available to a site',
        description:
          'Built-in blocks are registered from the compiled block manifest, so the list reflects what is actually installed.',
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
