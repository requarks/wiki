import type { FastifyInstance } from 'fastify'

/**
 * Locales API Routes
 */
async function routes(app: FastifyInstance) {
  app.get(
    '/',
    {
      config: {
        publicAccess: true
      },
      schema: {
        summary: 'List all locales',
        description:
          'Every locale this wiki knows of, installed or merely published upstream, named and coded as this wiki refers to them.',
        tags: ['Locales'],
        response: {
          200: {
            description: 'The locale list',
            type: 'array',
            items: { $ref: 'Locale#' }
          }
        }
      }
    },
    async () => {
      return WIKI.models.locales.getLocales()
    }
  )

  /**
   * FETCH LOCALES FROM UPSTREAM
   *
   * Runs the update to completion rather than queueing it, because the caller is a dialog waiting
   * for a count to show. It is the same work the nightly `updateLocales` job does, and cheap for the
   * same reason: the metadata is one small document, and only an installed locale whose hash moved
   * is actually downloaded.
   */
  app.post(
    '/fetch',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Fetch the latest locales from the Wiki.js repository',
        description:
          'Reads the published locale metadata and records any locale not seen before as available. An installed locale is re-downloaded only when its published hash differs from the one stored, so a run that finds nothing new costs a single request.',
        tags: ['Locales'],
        response: {
          200: {
            description: 'Locales fetched successfully',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              added: {
                type: 'integer',
                description: 'Locales newly available, whose strings were not downloaded.'
              },
              updated: {
                type: 'integer',
                description: 'Installed locales whose strings changed upstream and were refreshed.'
              },
              unchanged: { type: 'integer' },
              failed: { type: 'integer' }
            }
          }
        }
      }
    },
    async () => {
      return { ok: true, ...(await WIKI.models.locales.updateFromRemote()) }
    }
  )

  /**
   * INSTALL A LOCALE
   */
  app.post<{ Params: { code: string } }>(
    '/:code/install',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Download the strings of an available locale',
        description:
          'Downloads the published strings file for a locale that has a row but no strings, making it installable on a site. Fetch the locale list first: a locale nobody has heard of yet has no row to install.',
        tags: ['Locales'],
        params: {
          type: 'object',
          properties: {
            code: { type: 'string', description: 'The locale code, e.g. `fr-FR`.' }
          }
        },
        response: {
          200: {
            description: 'Locale installed successfully',
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
      try {
        await WIKI.models.locales.install(req.params.code)
      } catch (err: any) {
        return reply.badRequest(err.message)
      }
      return { ok: true, message: 'Locale installed successfully.' }
    }
  )

  /**
   * SET A LOCALE'S ALIASES
   */
  app.put<{
    Params: { code: string }
    Body: { customName?: string | null; customCode?: string | null }
  }>(
    '/:code/aliases',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Set what a locale is called and addressed as',
        description:
          'Overrides the name and the short code derived from the language tag — `zh` for `zh-CN`. The locale is still identified everywhere by its `code`, so nothing already recorded against it moves. An empty value puts the derived form back, and so does the derived form itself.',
        tags: ['Locales'],
        params: {
          type: 'object',
          properties: {
            code: { type: 'string', description: 'The locale code, e.g. `zh-CN`.' }
          }
        },
        body: {
          type: 'object',
          properties: {
            customName: {
              type: ['string', 'null'],
              maxLength: 255,
              description: 'The name to show, or empty to go back to the derived one.'
            },
            customCode: {
              type: ['string', 'null'],
              maxLength: 255,
              description: 'The short code to show, or empty to go back to the derived one.'
            }
          }
        },
        response: {
          200: {
            description: 'Aliases updated successfully',
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
      try {
        await WIKI.models.locales.setAliases(req.params.code, {
          customName: req.body?.customName ?? null,
          customCode: req.body?.customCode ?? null
        })
      } catch (err: any) {
        return reply.badRequest(err.message)
      }
      return { ok: true, message: 'Aliases updated successfully.' }
    }
  )

  app.get<{ Params: { code: string } }>(
    '/:code/strings',
    {
      config: {
        publicAccess: true
      },
      schema: {
        summary: 'Get locale strings',
        tags: ['Locales']
      }
    },
    async (req) => {
      return WIKI.models.locales.getStrings(req.params.code)
    }
  )
}

export default routes
