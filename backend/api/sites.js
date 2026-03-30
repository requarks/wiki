import { validate as uuidValidate } from 'uuid'
import { CustomError } from '../helpers/common.js'

/**
 * Sites API Routes
 */
async function routes(app) {
  app.addSchema({
    $id: 'siteSchema',
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid'
      },
      hostname: {
        type: 'string',
        format: 'hostname'
      },
      isEnabled: {
        type: 'boolean'
      },
      title: {
        type: 'string'
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
          type: 'string'
        }
      },
      pageCasing: {
        type: 'boolean'
      },
      discoverable: {
        type: 'boolean'
      },
      defaults: {
        type: 'object',
        properties: {
          tocDepth: {
            type: 'object',
            properties: {
              min: {
                type: 'number'
              },
              max: {
                type: 'number'
              }
            }
          }
        }
      },
      features: {
        type: 'object',
        properties: {
          browse: {
            type: 'boolean'
          },
          ratings: {
            type: 'boolean'
          },
          ratingsMode: {
            type: 'string',
            enum: ['off', 'stars', 'thumbs']
          },
          comments: {
            type: 'boolean'
          },
          contributions: {
            type: 'boolean'
          },
          profile: {
            type: 'boolean'
          },
          search: {
            type: 'boolean'
          }
        }
      },
      logoUrl: {
        type: 'string'
      },
      logoText: {
        type: 'boolean'
      },
      sitemap: {
        type: 'boolean'
      },
      robots: {
        type: 'object',
        properties: {
          index: {
            type: 'boolean'
          },
          follow: {
            type: 'boolean'
          }
        }
      },
      locales: {
        type: 'object',
        properties: {
          primary: {
            type: 'string'
          },
          active: {
            type: 'array',
            items: {
              type: 'string'
            }
          }
        }
      },
      assets: {
        type: 'object',
        properties: {
          logo: {
            type: 'boolean'
          },
          logoExt: {
            type: 'string'
          },
          favicon: {
            type: 'boolean'
          },
          faviconExt: {
            type: 'string'
          },
          loginBg: {
            type: 'boolean'
          }
        }
      },
      editors: {
        type: 'object',
        properties: {
          asciidoc: {
            type: 'boolean'
          },
          markdown: {
            type: 'boolean'
          },
          wysiwyg: {
            type: 'boolean'
          }
        }
      },
      theme: {
        type: 'object',
        properties: {
          dark: {
            type: 'boolean'
          },
          codeBlocksTheme: {
            type: 'string',
            format: 'hexcolor'
          },
          colorPrimary: {
            type: 'string',
            format: 'hexcolor'
          },
          colorSecondary: {
            type: 'string',
            format: 'hexcolor'
          },
          colorAccent: {
            type: 'string',
            format: 'hexcolor'
          },
          colorHeader: {
            type: 'string',
            format: 'hexcolor'
          },
          colorSidebar: {
            type: 'string',
            format: 'hexcolor'
          },
          injectCSS: {
            type: 'string'
          },
          injectHead: {
            type: 'string'
          },
          injectBody: {
            type: 'string'
          },
          contentWidth: {
            type: 'string',
            enum: ['centered', 'full']
          },
          sidebarPosition: {
            type: 'string',
            enum: ['off', 'left', 'right']
          },
          tocPosition: {
            type: 'string',
            enum: ['off', 'left', 'right']
          },
          showSharingMenu: {
            type: 'boolean'
          },
          showPrintBtn: {
            type: 'boolean'
          },
          baseFont: {
            type: 'string'
          },
          contentFont: {
            type: 'string'
          }
        }
      }
    }
  })
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
            items: { $ref: 'siteSchema#' }
          }
        }
      }
    },
    async () => {
      const sites = await WIKI.models.sites.getAllSites()
      return sites.map((s) => ({
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

  app.get(
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
            $ref: 'siteSchema#'
          }
        }
      }
    },
    async (req, reply) => {
      let site
      if (req.params.siteIdorHostname === 'current' && req.hostname) {
        site = await WIKI.models.sites.getSiteByHostname({
          hostname: req.hostname,
          strict: req.querystring?.strict ?? false
        })
      } else if (uuidValidate(req.params.siteIdorHostname)) {
        site = await WIKI.models.sites.getSiteById({ id: req.params.siteIdorHostname })
      } else {
        site = await WIKI.models.sites.getSiteByHostname({
          hostname: req.params.siteIdorHostname,
          strict: req.querystring?.strict ?? false
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
  app.post(
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
      } catch (err) {
        WIKI.logger.warn(err)
        return reply.internalServerError()
      }
    }
  )

  /**
   * UPDATE SITE
   */
  app.put(
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
    async (req, reply) => {
      return { hello: 'world' }
    }
  )

  /**
   * DELETE SITE
   */
  app.delete(
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
      } catch (err) {
        reply.send(err)
      }
    }
  )
}

export default routes
