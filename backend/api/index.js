/**
 * API Routes
 */
async function routes(app) {
  // Register schemas
  await import('./schemas/site.js').then((m) => m.registerSchemas(app))
  await import('./schemas/user.js').then((m) => m.registerSchemas(app))

  // Register routes
  app.register(import('./authentication.js'))
  app.register(import('./locales.js'), { prefix: '/locales' })
  app.register(import('./pages.js'))
  app.register(import('./sites.js'), { prefix: '/sites' })
  app.register(import('./system.js'), { prefix: '/system' })
  app.register(import('./users.js'), { prefix: '/users' })
}

export default routes
