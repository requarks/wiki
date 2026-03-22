/**
 * Locales API Routes
 */
async function routes (app, options) {
  app.get('/', {
    schema: {
      summary: 'List all locales',
      tags: ['Locales']
    }
  }, async (req, reply) => {
    return WIKI.models.locales.getLocales()
  })

  app.get('/:code/strings', {
    schema: {
      summary: 'Get locale strings',
      tags: ['Locales']
    }
  }, async (req, reply) => {
    return WIKI.models.locales.getStrings(req.params.code)
  })
}

export default routes
