import { audit } from '../helpers/audit.ts'
import type { FastifyInstance } from 'fastify'

/**
 * MCP Settings Routes
 *
 * The configuration of the Model Context Protocol server: the instance-wide settings under `/system`,
 * beside the endpoints they resemble (SCIM, metrics), and the one setting a site has of its own under
 * that site. The endpoint itself is `controllers/mcp.ts`; tokens are personal access tokens, managed
 * by `api/personalTokens.ts`.
 */
const siteParams = {
  type: 'object',
  properties: { siteId: { type: 'string', format: 'uuid' } },
  required: ['siteId']
}

async function routes(app: FastifyInstance) {
  /**
   * GET MCP CONFIGURATION
   */
  app.get(
    '/system/mcp',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Get the MCP server configuration',
        description:
          'Whether the Model Context Protocol server at `/_mcp` is turned on, which groups of tools it offers, and its limits. Instance-wide: a token belongs to a user, and users are not per site.',
        tags: ['System'],
        response: {
          200: { $ref: 'McpConfig#' }
        }
      }
    },
    async () => {
      return WIKI.models.mcp.getConfig()
    }
  )

  /**
   * UPDATE MCP CONFIGURATION
   */
  app.put<{ Body: Record<string, any> }>(
    '/system/mcp',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Update the MCP server configuration',
        description:
          'Accepts any subset of the fields — `tools` too, any subset of its groups — and applies at once on every instance. Turning the endpoint on does not by itself let anybody in: a client also needs a personal access token holding the `mcp` scope, belonging to somebody who holds `use:mcp`.',
        tags: ['System'],
        body: { $ref: 'McpConfig#' },
        response: {
          200: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const patch = WIKI.models.mcp.pickFields(req.body)
      if (Object.keys(patch).length < 1) {
        return reply.badRequest('No valid MCP setting was provided.')
      }

      const invalid = WIKI.models.mcp.validate(patch)
      if (invalid) {
        return reply.badRequest(invalid)
      }

      if (!(await WIKI.models.mcp.updateConfig(patch))) {
        return reply.internalServerError('Failed to save the MCP configuration.')
      }

      // -> Fields rather than values, with the switches that change who may reach the wiki spelled out,
      //    since those are what gets asked about afterwards
      await audit(req, 'admin', 'updateMcp', {
        fields: Object.keys(patch).sort(),
        ...(patch.isEnabled === undefined ? {} : { isEnabled: patch.isEnabled }),
        ...(patch.allowAnonymous === undefined ? {} : { allowAnonymous: patch.allowAnonymous })
      })

      return {
        ok: true,
        message: 'MCP configuration saved successfully.'
      }
    }
  )

  /**
   * GET MCP STATUS
   */
  app.get(
    '/system/mcp/status',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Get what the MCP server depends on',
        description:
          'The settings elsewhere that decide whether a token can be answered at all: the API switch (every bearer token is refused while it is off) and the personal access token switch. And whether the page renderer extension is installed, without which the tools that write a page answer that they are unavailable.',
        tags: ['System'],
        response: {
          200: {
            type: 'object',
            properties: {
              isApiEnabled: { type: 'boolean' },
              arePersonalTokensAllowed: { type: 'boolean' },
              isRendererAvailable: { type: 'boolean' }
            }
          }
        }
      }
    },
    async () => {
      return {
        isApiEnabled: WIKI.config.api.isEnabled === true,
        arePersonalTokensAllowed: WIKI.models.authentication.arePersonalTokensAllowed(),
        isRendererAvailable: await WIKI.models.rendering.isAvailable()
      }
    }
  )

  /**
   * LIST RECENT CONTRIBUTIONS
   */
  app.get(
    '/system/mcp/contributions',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'List what AI assistants have written lately',
        description:
          "The page versions made through the MCP server on every site in the last seven days, newest first, at most 50: which site, who the assistant acted for, what it did and why. `url` is the page's address on its site and `hostname` the host to reach it on (null for a site bound to the catch-all, which is whatever host the caller is already on). Read off page history, so it is the same on every instance. `manage:system`, as the rest of the MCP screen is: it names pages without asking each one's page rules.",
        tags: ['System'],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                siteId: { type: 'string', format: 'uuid' },
                pageId: { type: 'string', format: 'uuid' },
                action: { type: 'string' },
                locale: { type: 'string' },
                path: { type: 'string' },
                url: { type: 'string' },
                hostname: { type: 'string', nullable: true },
                title: { type: 'string' },
                reason: { type: 'string' },
                versionDate: { type: 'string', format: 'date-time' },
                authorName: { type: 'string' }
              }
            }
          }
        }
      }
    },
    async () => {
      return WIKI.models.pageHistory.listByVia(
        'mcp',
        Temporal.Now.instant().subtract({ hours: 24 * 7 })
      )
    }
  )

  /**
   * GET A SITE'S MCP SETTINGS
   */
  app.get<{ Params: { siteId: string } }>(
    '/sites/:siteId/mcp',
    {
      config: {
        permissions: ['manage:sites']
      },
      schema: {
        summary: "Get a site's MCP settings",
        description:
          "The MCP setting that belongs to a site rather than to the instance: the path of its agent guidelines page, whose text an AI assistant is handed when it connects to this site's hostname. `exists` says whether a page is there yet, in the site's primary locale.",
        tags: ['Sites'],
        params: siteParams,
        response: {
          200: {
            type: 'object',
            properties: {
              guidelinesPath: { type: 'string' },
              exists: { type: 'boolean' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const site = WIKI.sites[req.params.siteId]
      if (!site) {
        return reply.notFound('This site does not exist.')
      }
      const guidelinesPath = WIKI.models.mcp.guidelinesPathFor(req.params.siteId)
      const exists = guidelinesPath
        ? Boolean(
            await WIKI.models.pages.idAtPath(
              req.params.siteId,
              site.config?.locales?.primary ?? 'en',
              guidelinesPath
            )
          )
        : false
      return { guidelinesPath, exists }
    }
  )

  /**
   * UPDATE A SITE'S MCP SETTINGS
   */
  app.put<{ Params: { siteId: string }; Body: { guidelinesPath: string } }>(
    '/sites/:siteId/mcp',
    {
      config: {
        permissions: ['manage:sites']
      },
      schema: {
        summary: "Update a site's MCP settings",
        description:
          "Name the agent guidelines page — where new pages go, how they are named, the house style — or clear it with an empty string. A path, not a page: the page need not exist yet. It is read as the assistant may read it, so a page the assistant's owner may not read is simply not handed over.",
        tags: ['Sites'],
        params: siteParams,
        body: {
          type: 'object',
          required: ['guidelinesPath'],
          properties: {
            guidelinesPath: { type: 'string', maxLength: 2048 }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      if (!WIKI.sites[req.params.siteId]) {
        return reply.notFound('This site does not exist.')
      }
      const refusal = await WIKI.models.mcp.setGuidelinesPath(
        req.params.siteId,
        req.body.guidelinesPath
      )
      if (refusal) {
        return reply.badRequest(refusal)
      }
      await audit(req, 'admin', 'updateMcp', {
        siteId: req.params.siteId,
        fields: ['guidelinesPath']
      })
      return { ok: true, message: 'MCP site settings saved successfully.' }
    }
  )
}

export default routes
