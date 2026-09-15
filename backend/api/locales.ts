import { audit } from '../helpers/audit.ts'
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
          'Reads the published locale metadata and records any locale not seen before as available. An installed locale is re-downloaded only when its published hash differs from the one stored, so a run that finds nothing new costs a single request.\n\n`en` is never fetched: it is the locale the interface is written in and ships with the wiki, loaded from `locales/en.json` on every boot. It counts as unchanged.',
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
    async (req) => {
      const result = await WIKI.models.locales.updateFromRemote()

      await audit(req, 'admin', 'fetchLocales', result)

      return { ok: true, ...result }
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
          'Downloads the published strings file for a locale that has a row but no strings, making it installable on a site. Fetch the locale list first: a locale nobody has heard of yet has no row to install.\n\nRefused for `en`, which ships with the wiki and is always installed.',
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
      await audit(req, 'admin', 'installLocale', { code: req.params.code })

      return { ok: true, message: 'Locale installed successfully.' }
    }
  )

  /**
   * INSTALL A LOCALE FROM AN UPLOADED FILE
   *
   * The way in for a wiki that cannot reach github at all: the same published package, carried in by
   * hand instead of downloaded. The body is the strings document itself rather than a multipart form
   * — one file, no fields — and the file name arrives in the query string because it is what says
   * which locale this is.
   */
  app.post<{ Querystring: { fileName: string } }>(
    '/upload',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Install a locale from an uploaded strings file',
        description:
          'The body is the locale package itself — one of the `<tag>.json` files published at `requarks/wiki-locales` — sent as `application/json` rather than as a multipart form. For an installation that cannot reach the internet, where `/locales/fetch` has nothing to read and a locale has no row to be installed from; this creates the row as well as filling it.\n\nThe file name is the identity, exactly as it is upstream: `fr-FR.json` installs `fr-FR`, so a renamed file installs the wrong locale and a name that is not a language tag is refused. So is a body that is not one flat object of strings, and so is `en`, which ships with the wiki.\n\nNo hash is recorded, since nothing was downloaded — a later run of `/locales/fetch` on an instance that does reach upstream will therefore re-download the locale.',
        tags: ['Locales'],
        consumes: ['application/json'],
        querystring: {
          type: 'object',
          properties: {
            fileName: {
              type: 'string',
              minLength: 1,
              maxLength: 255,
              description: 'The name of the uploaded file, e.g. `fr-FR.json`.'
            }
          },
          required: ['fileName']
        },
        response: {
          200: {
            description: 'Locale installed successfully',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              code: {
                type: 'string',
                description: 'The locale the file was installed as, read off its name.'
              },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      let code: string
      try {
        code = await WIKI.models.locales.installFromFile(req.query.fileName, req.body)
      } catch (err: any) {
        return reply.badRequest(err.message)
      }
      await audit(req, 'admin', 'uploadLocale', { code, fileName: req.query.fileName })

      return { ok: true, code, message: 'Locale installed successfully.' }
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
      await audit(req, 'admin', 'updateLocale', {
        code: req.params.code,
        customName: req.body?.customName ?? null,
        customCode: req.body?.customCode ?? null
      })

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
