/**
 * API Routes
 */
async function routes (app, options) {
  app.register(import('./sites.mjs'), { prefix: '/sites' })
  app.register(import('./system.mjs'), { prefix: '/system' })
  app.register(import('./users.mjs'), { prefix: '/users' })

  app.get('/', async (req, reply) => {
    return { ok: true }
  })
}

export default routes
