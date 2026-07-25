import { validate as uuidValidate } from 'uuid'
import { CustomError } from '../helpers/common.ts'
import type { FastifyInstance } from 'fastify'

/**
 * Sites API Routes
 */
async function routes(app: FastifyInstance) {
  app.get(
    '/',
    {
      config: {
        permissions: ['read:sites', 'read:dashboard']
      },
      schema: {
        summary: 'List all sites',
        tags: ['Sites'],
        response: {
          200: {
            description: 'List of all sites',
            type: 'array',
            items: { $ref: 'Site#' }
          }
        }
      }
    },
    async () => {
      const sites = await WIKI.models.sites.getAllSites()
      return sites.map((s: any) => ({
        ...s.config,
        id: s.id,
        hostname: s.hostname,
        isEnabled: s.isEnabled,
        editors: {
          asciidoc: s.config.editors?.asciidoc?.isActive ?? false,
          markdown: s.config.editors?.markdown?.isActive ?? false,
          wysiwyg: s.config.editors?.wysiwyg?.isActive ?? false
        }
      }))
    }
  )

  app.get<{ Params: { siteIdorHostname: string }; Querystring: { strict?: boolean } }>(
    '/:siteIdorHostname',
    {
      schema: {
        summary: 'Get site info',
        tags: ['Sites'],
        params: {
          type: 'object',
          properties: {
            siteIdorHostname: {
              type: 'string',
              description: 'Either a site ID, hostname or "current" to use the request hostname.',
              anyOf: [{ format: 'uuid' }, { enum: ['current'] }, { pattern: '^[a-z0-9.-]+$' }]
            }
          },
          required: ['siteIdorHostname']
        },
        querystring: {
          type: 'object',
          properties: {
            strict: {
              type: 'boolean',
              description:
                'Whether to only return a site that exactly matches the hostname. Wildcard sites will not be matched.',
              default: false
            }
          }
        },
        response: {
          200: {
            description: 'Site info',
            type: 'object',
            $ref: 'Site#'
          }
        }
      }
    },
    async (req, reply) => {
      let site: any
      if (req.params.siteIdorHostname === 'current' && req.hostname) {
        site = await WIKI.models.sites.getSiteByHostname({
          hostname: req.hostname,
          // FIXME: see the note below — `req.querystring` is not a Fastify property.
          strict: (req as any).querystring?.strict ?? false
        })
      } else if (uuidValidate(req.params.siteIdorHostname)) {
        site = await WIKI.models.sites.getSiteById({ id: req.params.siteIdorHostname })
      } else {
        site = await WIKI.models.sites.getSiteByHostname({
          hostname: req.params.siteIdorHostname,
          // FIXME: pre-existing bug — Fastify exposes the parsed query string as `req.query`, not
          // `req.querystring`, so `strict` is always undefined here and the lookup is never strict.
          // Preserved as-is to keep the migration behavior-neutral; the fix is `req.query.strict`.
          strict: (req as any).querystring?.strict ?? false
        })
      }
      if (site) {
        return {
          ...site.config,
          id: site.id,
          hostname: site.hostname,
          isEnabled: site.isEnabled,
          editors: {
            asciidoc: site.config.editors?.asciidoc?.isActive ?? false,
            markdown: site.config.editors?.markdown?.isActive ?? false,
            wysiwyg: site.config.editors?.wysiwyg?.isActive ?? false
          }
        }
      } else {
        return reply.notFound('Site does not exist.')
      }
    }
  )

  /**
   * CREATE SITE
   */
  app.post<{ Body: { hostname: string; title: string } }>(
    '/',
    {
      config: {
        permissions: ['create:sites', 'manage:sites']
      },
      schema: {
        summary: 'Create a new site',
        tags: ['Sites'],
        body: {
          type: 'object',
          required: ['hostname', 'title'],
          properties: {
            hostname: {
              type: 'string',
              minLength: 1,
              maxLength: 255,
              pattern: '^(\\*|[a-z0-9.-]+)$'
            },
            title: {
              type: 'string',
              minLength: 1,
              maxLength: 255
            }
          },
          examples: [
            {
              hostname: 'wiki.example.org',
              title: 'My Wiki Site'
            }
          ]
        },
        response: {
          200: {
            description: 'Site created successfully',
            type: 'object',
            properties: {
              ok: {
                type: 'boolean'
              },
              message: {
                type: 'string'
              },
              id: {
                type: 'string',
                format: 'uuid'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      // -> Validate inputs
      if (
        !req.body.hostname ||
        req.body.hostname.length < 1 ||
        !/^(\\*)|([a-z0-9\-.:]+)$/.test(req.body.hostname)
      ) {
        throw new CustomError('siteCreateInvalidHostname', 'Invalid Site Hostname')
      }
      if (!req.body.title || req.body.title.length < 1 || !/^[^<>"]+$/.test(req.body.title)) {
        throw new CustomError('siteCreateInvalidTitle', 'Invalid Site Title')
      }

      // -> Check for duplicate hostname
      if (!(await WIKI.models.sites.isHostnameUnique(req.body.hostname))) {
        if (req.body.hostname === '*') {
          throw new CustomError(
            'siteCreateDuplicateCatchAll',
            'A site with a catch-all hostname already exists! Cannot have 2 catch-all hostnames.'
          )
        } else {
          throw new CustomError(
            'siteCreateDuplicateHostname',
            'A site with a this hostname already exists! Cannot have duplicate hostnames.'
          )
        }
      }

      // -> Create site
      try {
        const result = await WIKI.models.sites.createSite(req.body.hostname, {
          title: req.body.title
        })
        return {
          ok: true,
          message: 'Site created successfully.',
          id: result.id
        }
      } catch (err: any) {
        WIKI.logger.warn(err)
        return reply.internalServerError()
      }
    }
  )

  /**
   * UPDATE SITE
   */
  app.put<{
    Params: { siteId: string }
    Body: { isEnabled?: boolean; hostname?: string; title?: string }
  }>(
    '/:siteId',
    {
      config: {
        permissions: ['manage:sites']
      },
      schema: {
        summary: 'Update a site',
        tags: ['Sites'],
        body: {
          type: 'object',
          properties: {
            isEnabled: {
              type: 'boolean'
            },
            hostname: {
              type: 'string',
              minLength: 1,
              maxLength: 255,
              pattern: '^(\\*|[a-z0-9.-]+)$'
            },
            title: {
              type: 'string',
              minLength: 1,
              maxLength: 255
            }
          },
          examples: [
            {
              hostname: 'wiki.example.org',
              title: 'My Wiki Site'
            }
          ]
        }
      }
    },
    async () => {
      return { hello: 'world' }
    }
  )

  /**
   * DELETE SITE
   */
  app.delete<{ Params: { siteId: string } }>(
    '/:siteId',
    {
      config: {
        permissions: ['manage:sites']
      },
      schema: {
        summary: 'Delete a site',
        tags: ['Sites'],
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
          204: {
            description: 'Site deleted successfully'
          }
        }
      }
    },
    async (req, reply) => {
      try {
        if ((await WIKI.models.sites.countSites()) <= 1) {
          reply.conflict('Cannot delete the last site. At least 1 site must exist at all times.')
        } else if (await WIKI.models.sites.deleteSite(req.params.siteId)) {
          reply.code(204)
        } else {
          reply.badRequest('Site does not exist.')
        }
      } catch (err: any) {
        reply.send(err)
      }
    }
  )
}

export default routes
