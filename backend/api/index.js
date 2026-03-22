/**
 * API Routes
 */
async function routes(app, options) {
  app.register(import('./authentication.js'))
  app.register(import('./locales.js'), { prefix: '/locales' })
  app.register(import('./pages.js'))
  app.register(import('./sites.js'), { prefix: '/sites' })
  app.register(import('./system.js'), { prefix: '/system' })
  app.register(import('./users.js'), { prefix: '/users' })

  app.get('/', async (req, reply) => {
    return { ok: true }
  })
}

export default routes
