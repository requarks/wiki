import type { FastifyInstance } from 'fastify'

/**
 * Permissions for looking icons up and storing them.
 *
 * Anyone who can put an icon somewhere — a page, a navigation item, a page relation — needs to be able
 * to search for one and have it stored, which is what makes it servable from this instance afterwards.
 */
const PICKER_PERMISSIONS = ['write:pages', 'manage:pages', 'manage:sites', 'manage:system']

/**
 * Icons API Routes
 *
 * Administration of the icon sets, plus the search and materialize calls the icon picker makes. The
 * icons themselves are served outside `/_api`, under `/_icons` — see `controllers/icons.ts`.
 */
async function routes(app: FastifyInstance) {
  /**
   * LIST ADDED ICON SETS
   */
  app.get(
    '/sets',
    {
      config: {
        permissions: PICKER_PERMISSIONS
      },
      schema: {
        summary: 'List the icon sets added to this wiki',
        description:
          'Alphabetical. `iconCount` is how many icons of the set are stored in the database, which is what this instance can serve on its own — the disk cache is derived from those rows and may be empty.',
        tags: ['Icons'],
        response: {
          200: {
            description: 'List of icon sets',
            type: 'array',
            items: { $ref: 'IconSet#' }
          }
        }
      }
    },
    async () => {
      return WIKI.models.icons.getSets()
    }
  )

  /**
   * ADD ICON SET
   */
  app.post<{ Body: { prefix: string } }>(
    '/sets',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Add an icon set',
        description:
          'The set must exist upstream, and its name and metadata are taken from there — so this call needs outbound access to the Iconify API. Nothing is downloaded beyond the metadata: icons are stored the first time something references them.',
        tags: ['Icons'],
        body: {
          type: 'object',
          required: ['prefix'],
          properties: {
            prefix: {
              type: 'string',
              maxLength: 64,
              description: 'Iconify prefix of the set, e.g. `tabler`.'
            }
          }
        },
        response: {
          200: {
            description: 'Icon set added successfully',
            type: 'object',
            properties: {
              ok: {
                type: 'boolean'
              },
              message: {
                type: 'string'
              },
              set: { $ref: 'IconSet#' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      try {
        const set = await WIKI.models.icons.addSet(req.body.prefix.toLowerCase())
        return {
          ok: true,
          message: `The ${set.name} icon set has been added.`,
          set
        }
      } catch (err: any) {
        WIKI.logger.warn(err.message)
        return reply.badRequest(err.message)
      }
    }
  )

  /**
   * ENABLE / DISABLE ICON SET
   */
  app.put<{ Params: { prefix: string }; Body: { isEnabled: boolean } }>(
    '/sets/:prefix',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Enable or disable an icon set',
        description:
          'A disabled set disappears from the picker and stops taking on new icons. Icons already stored for it keep being served, since content referencing them is already published.',
        tags: ['Icons'],
        params: {
          type: 'object',
          properties: {
            prefix: {
              type: 'string',
              maxLength: 64
            }
          },
          required: ['prefix']
        },
        body: {
          type: 'object',
          required: ['isEnabled'],
          properties: {
            isEnabled: {
              type: 'boolean'
            }
          }
        },
        response: {
          200: {
            description: 'Icon set updated successfully',
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
      const prefix = req.params.prefix.toLowerCase()
      if (!(await WIKI.models.icons.getSet(prefix))) {
        return reply.notFound('Icon set has not been added.')
      }
      await WIKI.models.icons.setSetState(prefix, req.body.isEnabled)
      return {
        ok: true,
        message: `The ${prefix} icon set has been ${req.body.isEnabled ? 'enabled' : 'disabled'}.`
      }
    }
  )

  /**
   * DELETE ICON SET
   */
  app.delete<{ Params: { prefix: string } }>(
    '/sets/:prefix',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Delete an icon set',
        description:
          'Deletes the set and every icon stored for it, and drops its disk cache. Content still referencing those icons stops rendering them — disable the set instead to keep serving what is already in use.',
        tags: ['Icons'],
        params: {
          type: 'object',
          properties: {
            prefix: {
              type: 'string',
              maxLength: 64
            }
          },
          required: ['prefix']
        },
        response: {
          200: {
            description: 'Icon set deleted successfully',
            type: 'object',
            properties: {
              ok: {
                type: 'boolean'
              },
              message: {
                type: 'string'
              },
              deletedIcons: {
                type: 'integer'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const prefix = req.params.prefix.toLowerCase()
      if (!(await WIKI.models.icons.getSet(prefix))) {
        return reply.notFound('Icon set has not been added.')
      }
      const deletedIcons = await WIKI.models.icons.deleteSet(prefix)
      return {
        ok: true,
        message: `The ${prefix} icon set has been deleted.`,
        deletedIcons
      }
    }
  )

  /**
   * LIST ICON SETS AVAILABLE UPSTREAM
   */
  app.get(
    '/available-sets',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'List the icon sets offered by the Iconify API',
        description:
          'The catalog an administrator picks from, marking the sets already added. Fetched from upstream and memoized for an hour, so it needs outbound access.',
        tags: ['Icons'],
        response: {
          200: {
            description: 'List of available icon sets',
            type: 'array',
            items: { $ref: 'AvailableIconSet#' }
          }
        }
      }
    },
    async (_req, reply) => {
      try {
        return await WIKI.models.icons.getAvailableSets()
      } catch (err: any) {
        WIKI.logger.warn(err.message)
        return reply.badGateway(`Could not reach the Iconify API: ${err.message}`)
      }
    }
  )

  /**
   * REFRESH ICON SET METADATA
   */
  app.post(
    '/sets/refresh',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Refresh the metadata of every added icon set',
        description:
          'Re-reads names, totals and licenses from upstream. Stored icons are untouched.',
        tags: ['Icons'],
        response: {
          200: {
            description: 'Icon sets refreshed successfully',
            type: 'object',
            properties: {
              ok: {
                type: 'boolean'
              },
              message: {
                type: 'string'
              },
              refreshed: {
                type: 'integer'
              }
            }
          }
        }
      }
    },
    async (_req, reply) => {
      try {
        const refreshed = await WIKI.models.icons.refreshSets()
        return {
          ok: true,
          message: `Refreshed ${refreshed} icon sets.`,
          refreshed
        }
      } catch (err: any) {
        WIKI.logger.warn(err.message)
        return reply.badGateway(`Could not reach the Iconify API: ${err.message}`)
      }
    }
  )

  /**
   * SEARCH ICONS
   */
  app.get<{ Querystring: { query: string; prefixes?: string; limit?: number } }>(
    '/search',
    {
      config: {
        permissions: PICKER_PERMISSIONS
      },
      schema: {
        summary: 'Search icons across the enabled icon sets',
        description:
          'Searched upstream, then narrowed to the sets enabled here — so results are always icons that can actually be used. Returns references shaped `prefix:name`, which is what content stores.',
        tags: ['Icons'],
        querystring: {
          type: 'object',
          required: ['query'],
          properties: {
            query: {
              type: 'string',
              minLength: 2,
              maxLength: 128
            },
            prefixes: {
              type: 'string',
              description:
                'Comma-separated set prefixes to search in. Defaults to every enabled set.'
            },
            limit: {
              type: 'integer',
              minimum: 32,
              maximum: 999,
              default: 96
            }
          }
        },
        response: {
          200: {
            description: 'Matching icon references',
            type: 'object',
            properties: {
              icons: {
                type: 'array',
                items: {
                  type: 'string'
                }
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      try {
        const icons = await WIKI.models.icons.searchIcons({
          query: req.query.query,
          prefixes: req.query.prefixes?.split(',').filter(Boolean),
          limit: req.query.limit
        })
        return { icons }
      } catch (err: any) {
        WIKI.logger.warn(err.message)
        return reply.badGateway(`Could not reach the Iconify API: ${err.message}`)
      }
    }
  )

  /**
   * LIST THE ICONS OF ONE SET
   */
  app.get<{ Params: { prefix: string } }>(
    '/sets/:prefix/icons',
    {
      config: {
        permissions: PICKER_PERMISSIONS
      },
      schema: {
        summary: 'List every icon name in an enabled set',
        description:
          'For browsing a set with no search term. Deprecated icons are left out. Fetched from upstream and memoized for an hour.',
        tags: ['Icons'],
        params: {
          type: 'object',
          properties: {
            prefix: {
              type: 'string',
              maxLength: 64
            }
          },
          required: ['prefix']
        },
        response: {
          200: {
            description: 'Icon names, without the set prefix',
            type: 'object',
            properties: {
              prefix: {
                type: 'string'
              },
              icons: {
                type: 'array',
                items: {
                  type: 'string'
                }
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const prefix = req.params.prefix.toLowerCase()
      try {
        return { prefix, icons: await WIKI.models.icons.listSetIcons(prefix) }
      } catch (err: any) {
        WIKI.logger.warn(err.message)
        return reply.badRequest(err.message)
      }
    }
  )

  /**
   * MATERIALIZE ICONS
   */
  app.post<{ Body: { icons: string[] } }>(
    '/materialize',
    {
      config: {
        permissions: PICKER_PERMISSIONS
      },
      schema: {
        summary: 'Store icons so this instance can serve them',
        description:
          'Called when an icon is chosen, while the author is online: it fetches the icon from upstream and writes it to the database, after which the wiki serves it forever without the Iconify API. Icons already stored are a no-op.',
        tags: ['Icons'],
        body: {
          type: 'object',
          required: ['icons'],
          properties: {
            icons: {
              type: 'array',
              minItems: 1,
              maxItems: 128,
              items: {
                type: 'string',
                maxLength: 320,
                description: 'An icon reference shaped `prefix:name`.'
              }
            }
          }
        },
        response: {
          200: {
            description: 'Icons materialized',
            type: 'object',
            properties: {
              ok: {
                type: 'boolean'
              },
              message: {
                type: 'string'
              },
              failed: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description:
                  'References that could not be stored: malformed, from a set that is not enabled, or unknown upstream.'
              }
            }
          }
        }
      }
    },
    async (req) => {
      const failed = await WIKI.models.icons.materializeIcons(req.body.icons)
      return {
        ok: failed.length < 1,
        message:
          failed.length < 1
            ? 'Icons are stored and ready to be served.'
            : `${failed.length} of ${req.body.icons.length} icons could not be stored.`,
        failed
      }
    }
  )

  /**
   * ICON CACHE STATE
   */
  app.get(
    '/cache',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Report what this instance holds and has cached',
        description:
          '`iconCount` is permanent (database), the rest is this instance’s cache and can be discarded at any time.',
        tags: ['Icons'],
        response: {
          200: {
            description: 'Icon storage and cache state',
            type: 'object',
            properties: {
              setCount: {
                type: 'integer'
              },
              enabledSetCount: {
                type: 'integer'
              },
              iconCount: {
                type: 'integer'
              },
              memoryCount: {
                type: 'integer'
              },
              diskCount: {
                type: 'integer'
              },
              diskSize: {
                type: 'integer',
                description: 'Bytes held by the SVG files in the disk cache.'
              }
            }
          }
        }
      }
    },
    async () => {
      return WIKI.models.icons.getStats()
    }
  )

  /**
   * PURGE ICON CACHE
   */
  app.delete(
    '/cache',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Purge the icon cache of this instance',
        description:
          'Empties the memory and disk caches. Nothing is lost — both are rebuilt from the database as icons are requested again.',
        tags: ['Icons'],
        response: {
          200: {
            description: 'Cache purged successfully',
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
    async () => {
      await WIKI.models.icons.purgeCache()
      return {
        ok: true,
        message: 'The icon cache has been purged.'
      }
    }
  )
}

export default routes
