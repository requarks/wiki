import { validate as uuidValidate } from 'uuid'
import { CustomError } from '../helpers/common.ts'
import type { FastifyInstance } from 'fastify'

/**
 * Site properties stored in the `config` JSONB column rather than as their own table column.
 * Anything listed here is merged into the existing config on update.
 */
const SITE_CONFIG_KEYS = [
  'title',
  'description',
  'company',
  'contentLicense',
  'footerExtra',
  'pageExtensions',
  'pageCasing',
  'logoText',
  'sitemap',
  'discoverable',
  'auth',
  'authStrategies',
  'defaults',
  'editors',
  'features',
  'locales',
  'robots',
  'theme',
  'uploads'
] as const

/**
 * Sites API Routes
 */
async function routes(app: FastifyInstance) {
  app.get(
    '/',
    {
      config: {
        permissions: ['read:sites', 'access:admin']
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
        isEnabled: s.isEnabled
      }))
    }
  )

  app.get<{ Params: { siteIdorHostname: string }; Querystring: { strict?: boolean } }>(
    '/:siteIdorHostname',
    {
      config: {
        publicAccess: true
      },
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
          isEnabled: site.isEnabled
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
    Body: {
      isEnabled?: boolean
      hostname?: string
      title?: string
      description?: string
      company?: string
      contentLicense?: string
      footerExtra?: string
      pageExtensions?: string[]
      pageCasing?: boolean
      logoText?: boolean
      sitemap?: boolean
      discoverable?: boolean
      auth?: Record<string, any>
      authStrategies?: Array<{ id: string; order?: number; isVisible?: boolean }>
      defaults?: Record<string, any>
      editors?: Record<string, { isActive?: boolean; config?: Record<string, any> }>
      features?: Record<string, any>
      locales?: {
        primary?: string
        active?: string[]
        forcePrefix?: boolean
        showMenu?: boolean
      }
      robots?: Record<string, any>
      theme?: Record<string, any>
      uploads?: Record<string, any>
    }
  }>(
    '/:siteId',
    {
      config: {
        permissions: ['manage:sites']
      },
      schema: {
        summary: 'Update a site',
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
            },
            description: {
              type: 'string'
            },
            company: {
              type: 'string'
            },
            contentLicense: {
              type: 'string'
            },
            footerExtra: {
              type: 'string'
            },
            pageExtensions: {
              type: 'array',
              items: {
                type: 'string',
                pattern: '^[a-z0-9]+$'
              }
            },
            pageCasing: {
              type: 'boolean'
            },
            logoText: {
              type: 'boolean'
            },
            sitemap: {
              type: 'boolean'
            },
            discoverable: {
              type: 'boolean'
            },
            auth: {
              $ref: 'Site#/properties/auth'
            },
            authStrategies: {
              $ref: 'Site#/properties/authStrategies'
            },
            defaults: {
              $ref: 'Site#/properties/defaults'
            },
            editors: {
              $ref: 'Site#/properties/editors'
            },
            features: {
              $ref: 'Site#/properties/features'
            },
            locales: {
              $ref: 'Site#/properties/locales'
            },
            robots: {
              $ref: 'Site#/properties/robots'
            },
            theme: {
              $ref: 'Site#/properties/theme'
            },
            uploads: {
              $ref: 'Site#/properties/uploads'
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
            description: 'Site updated successfully',
            type: 'object',
            properties: {
              ok: {
                type: 'boolean'
              },
              message: {
                type: 'string'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      // -> Validate inputs
      if (req.body.title !== undefined && !/^[^<>"]+$/.test(req.body.title)) {
        throw new CustomError('siteUpdateInvalidTitle', 'Invalid Site Title')
      }

      const site = await WIKI.models.sites.getSiteById({ id: req.params.siteId })
      if (!site) {
        return reply.notFound('Site does not exist.')
      }

      // -> Check for duplicate hostname
      if (
        req.body.hostname !== undefined &&
        req.body.hostname !== site.hostname &&
        !(await WIKI.models.sites.isHostnameUnique(req.body.hostname))
      ) {
        if (req.body.hostname === '*') {
          throw new CustomError(
            'siteUpdateDuplicateCatchAll',
            'A site with a catch-all hostname already exists! Cannot have 2 catch-all hostnames.'
          )
        } else {
          throw new CustomError(
            'siteUpdateDuplicateHostname',
            'A site with a this hostname already exists! Cannot have duplicate hostnames.'
          )
        }
      }

      // -> Validate locales against the installed ones, and against what the site ends up with once
      //    the patch is merged, so that a partial update cannot leave the primary locale inactive
      if (req.body.locales) {
        const installedCodes = (await WIKI.models.locales.getLocales()).map((lc: any) => lc.code)
        const active = req.body.locales.active ?? site.config.locales?.active ?? []
        const primary = req.body.locales.primary ?? site.config.locales?.primary

        if (active.length < 1) {
          throw new CustomError(
            'siteUpdateNoActiveLocale',
            'At least one active locale is required.'
          )
        }
        const unknownCodes = [...active, primary].filter(
          (code) => code && !installedCodes.includes(code)
        )
        if (unknownCodes.length > 0) {
          throw new CustomError(
            'siteUpdateUnknownLocale',
            `Locale is not installed: ${[...new Set(unknownCodes)].join(', ')}`
          )
        }
        if (!active.includes(primary)) {
          throw new CustomError(
            'siteUpdatePrimaryLocaleNotActive',
            'The primary locale must be one of the active locales.'
          )
        }
      }

      // -> Split the patch between real columns and the config JSONB blob
      const config: Record<string, any> = {}
      for (const key of SITE_CONFIG_KEYS) {
        if (req.body[key] !== undefined) {
          config[key] = req.body[key]
        }
      }

      // -> Keep the legacy `features.ratings` flag in sync with the ratings mode
      if (config.features?.ratingsMode !== undefined) {
        config.features.ratings = config.features.ratingsMode !== 'off'
      }

      // -> Update site
      try {
        await WIKI.models.sites.updateSite(req.params.siteId, {
          hostname: req.body.hostname,
          isEnabled: req.body.isEnabled,
          ...(Object.keys(config).length < 1 ? {} : { config })
        })
        return {
          ok: true,
          message: 'Site updated successfully.'
        }
      } catch (err: any) {
        WIKI.logger.warn(err)
        return reply.internalServerError()
      }
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
        // -> Pages, assets, navigation, tags and the page tree all reference the site without a
        //    cascade, so a site still holding content cannot be removed. That is a conflict to
        //    report, not a server fault.
        if (err.cause?.code === '23503' || err.code === '23503') {
          return reply.conflict(
            'Cannot delete a site that still holds content. Delete its pages and assets first.'
          )
        }
        reply.send(err)
      }
    }
  )
}

export default routes
