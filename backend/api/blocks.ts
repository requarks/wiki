import { audit } from '../helpers/audit.ts'
import { MAX_PACKAGE_SIZE } from '../helpers/wkblock.ts'
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
  /*
    A block package is the raw file rather than a multipart form: one file, no fields. The catch-all
    only claims content types nothing else parses, so the JSON routes below are unaffected.

    The limit is the format's own (`MAX_PACKAGE_SIZE`) rather than the site's upload limit: that one
    is about what readers may attach to pages and is usually turned down, while a block carrying a PDF
    engine and its character maps is legitimately a couple of dozen megabytes.
  */
  app.addContentTypeParser(
    '*',
    { parseAs: 'buffer', bodyLimit: MAX_PACKAGE_SIZE },
    (req, body, done) => {
      done(null, body)
    }
  )

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
          'Built-in blocks are registered from the compiled block manifest, so the list reflects what is actually installed. Ordered by name, built-in and imported blocks together, with the child blocks last. This is what the editor builds its block picker from, so it is available to page authors and to anyone an approval rule lets suggest an edit — guests included, where a site takes public suggestions — as well as to site administrators.',
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

        await audit(req, 'admin', 'updateBlock', {
          siteId: req.params.siteId,
          states: req.body.states
        })

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
   * IMPORT A CUSTOM BLOCK
   */
  app.post<{ Params: { siteId: string } }>(
    '/sites/:siteId/blocks/import',
    {
      config: {
        /*
          The same permission that already governs this screen, and deliberately not a stricter one.

          A block is code that runs in every reader's browser on this site — which is exactly what the
          raw head and body fields under Administration → Theme already are, and those are `manage:theme`.
          `manage:sites` is where the trust boundary for markup and script injected into a site's pages
          sits; a block is not a new kind of power, it is a tidier way to exercise that one.
        */
        permissions: ['manage:sites']
      },
      schema: {
        summary: 'Import a packaged block',
        description:
          "The body is the `.wkblock` file itself, not a multipart form — send the bytes with `Content-Type: application/octet-stream`. A package is built by cloning this repository, writing a block under `blocks/block-<key>/` and running `npm run package -- block-<key>` in `blocks/`.\n\nThe key inside the package is the identity: importing a package whose key this site already has REPLACES that block, which is how one is upgraded — what the site had switched on and configured on it is kept. A key that a built-in block already uses is refused, since both would be served from the same address.\n\nThe block is registered enabled and is available to authors immediately. Its compiled files are served from `/_blocks/` like a built-in one, unpacked from the stored package into the instance's cache the first time a browser asks for one.",
        tags: ['Blocks'],
        consumes: ['application/octet-stream'],
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
            description: 'Block imported successfully',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              message: { type: 'string' },
              id: {
                type: 'string',
                format: 'uuid',
                description: 'The block row, which is the existing one when a block was replaced.'
              },
              block: {
                type: 'string',
                description: 'The key it registered under — it renders as `<block-{block}>`.'
              },
              name: { type: 'string' },
              isNew: {
                type: 'boolean',
                description: 'False when the package replaced a block this site already had.'
              },
              fileCount: {
                type: 'integer',
                description: 'How many compiled files the package brought.'
              },
              packagedAt: {
                type: 'string',
                description: 'When the package was built, or empty if it did not say.'
              },
              packagedWith: {
                type: 'string',
                description: 'The version of Wiki.js that built it, or empty if it did not say.'
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

      const data = req.body
      if (!Buffer.isBuffer(data) || data.length < 1) {
        return reply.badRequest('No block package was sent.')
      }

      // -> Everything `importPackage` refuses is a `CustomError` carrying its own status and a message
      //    the administrator who chose the file can act on, so it is left to the error handler
      const result = await WIKI.models.blocks.importPackage(req.params.siteId, data)

      await audit(req, 'admin', 'importBlock', {
        siteId: req.params.siteId,
        blockId: result.id,
        block: result.block,
        name: result.name,
        isNew: result.isNew,
        packagedWith: result.packagedWith
      })

      return {
        ok: true,
        message: result.isNew ? 'Block imported successfully.' : 'Block updated successfully.',
        ...result
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

      await audit(req, 'admin', 'deleteBlock', {
        siteId: req.params.siteId,
        blockId: req.params.blockId,
        name: block.name
      })

      return reply.code(204).send()
    }
  )
}

export default routes
