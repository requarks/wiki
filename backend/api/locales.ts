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
        tags: ['Locales']
      }
    },
    async () => {
      return WIKI.models.locales.getLocales()
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
