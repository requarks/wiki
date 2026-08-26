import { validate as uuidValidate } from 'uuid'
import { CustomError, normalizePastedDestination } from '../helpers/common.ts'
import { detectImageMime, detectSvg, imageMimeTypes, svgMimeType } from '../helpers/images.ts'
import { siteAssetKinds } from '../models/sites.ts'
import type { SiteAssetKind } from '../models/sites.ts'
import type { FastifyInstance } from 'fastify'

/** How large one of a site's own images may be uploaded, before it is re-encoded. */
const imageUploadLimit = 10 * 1024 * 1024

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
  'banner',
  'pageExtensions',
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
  // -> An image upload is the raw file rather than a multipart form: one file, no fields, and no
  //    dependency to add. Registered inside this plugin, so every other route keeps rejecting an
  //    image body outright.
  app.addContentTypeParser(
    [...imageMimeTypes, svgMimeType],
    { parseAs: 'buffer', bodyLimit: imageUploadLimit },
    (req, body, done) => {
      done(null, body)
    }
  )

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
      banner?: { isEnabled?: boolean; title?: string; content?: string }
      pageExtensions?: string[]
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
            banner: {
              $ref: 'Site#/properties/banner'
            },
            pageExtensions: {
              type: 'array',
              items: {
                type: 'string',
                pattern: '^[a-z0-9]+$'
              }
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
        const installedCodes = (await WIKI.models.locales.getInstalledLocales()).map(
          (lc: any) => lc.code
        )
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

      /*
        The pasted-uploads destination is stored in one form, so that what the admin area reads back is
        what an upload will do with it -- `assets/`, `./assets` and `assets` are the same folder, and
        the editor should not have to know that.
      */
      if (config.uploads?.pastedDestination !== undefined) {
        config.uploads.pastedDestination = normalizePastedDestination(
          config.uploads.pastedDestination
        )
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
   * UPLOAD SITE IMAGE
   */
  app.put<{ Params: { siteId: string; kind: SiteAssetKind } }>(
    '/:siteId/images/:kind',
    {
      config: {
        permissions: ['manage:sites']
      },
      schema: {
        summary: "Replace one of a site's images",
        description: `The body is the raw image, not a multipart form — send the file itself with its \`Content-Type\`. At most ${imageUploadLimit / 1024 / 1024} MB, and it must really be one of the accepted formats: the bytes are checked, not the declared type.\n\nA raster upload is re-encoded to the size and format the image is served at — 512x512 WebP for a logo, 180x180 PNG for a favicon, 1920x1080 WebP for a login background — when the Sharp extension is installed, and stored as uploaded when it is not. An SVG is always stored as uploaded.\n\nServed afterwards from \`/_site/<siteId>/<kind>\`, which falls back to the built-in default until something is uploaded.`,
        tags: ['Sites'],
        consumes: [...imageMimeTypes, svgMimeType],
        params: {
          type: 'object',
          properties: {
            siteId: {
              type: 'string',
              format: 'uuid'
            },
            kind: {
              type: 'string',
              description: 'Which of the site images to replace.',
              enum: [...siteAssetKinds]
            }
          },
          required: ['siteId', 'kind']
        },
        response: {
          200: {
            description: 'Image uploaded successfully',
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
      const site = await WIKI.models.sites.getSiteById({ id: req.params.siteId })
      if (!site) {
        return reply.notFound('Site does not exist.')
      }

      const data = req.body
      if (!Buffer.isBuffer(data) || data.length < 1) {
        throw new CustomError('siteImageEmpty', 'No image was sent.')
      }
      // -> The declared content type got the request this far; what the bytes actually are is what
      //    decides, since they are what gets stored and served back
      if (!detectImageMime(data) && !detectSvg(data)) {
        throw new CustomError(
          'siteImageInvalidImage',
          'Not an SVG, PNG, JPEG, WebP or GIF image, whatever the request said it was.'
        )
      }

      await WIKI.models.sites.setAsset(req.params.siteId, req.params.kind, data)

      return {
        ok: true,
        message: 'Image uploaded successfully.'
      }
    }
  )

  /**
   * CLEAR SITE IMAGE
   */
  app.delete<{ Params: { siteId: string; kind: SiteAssetKind } }>(
    '/:siteId/images/:kind',
    {
      config: {
        permissions: ['manage:sites']
      },
      schema: {
        summary: "Remove one of a site's images",
        description:
          'Leaves the built-in default to be served in its place again. Succeeds even if there was no image to remove.',
        tags: ['Sites'],
        params: {
          type: 'object',
          properties: {
            siteId: {
              type: 'string',
              format: 'uuid'
            },
            kind: {
              type: 'string',
              description: 'Which of the site images to remove.',
              enum: [...siteAssetKinds]
            }
          },
          required: ['siteId', 'kind']
        },
        response: {
          200: {
            description: 'Image cleared successfully',
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
      const site = await WIKI.models.sites.getSiteById({ id: req.params.siteId })
      if (!site) {
        return reply.notFound('Site does not exist.')
      }

      await WIKI.models.sites.clearAsset(req.params.siteId, req.params.kind)

      return {
        ok: true,
        message: 'Image cleared successfully.'
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
