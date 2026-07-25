import type { FastifyInstance } from 'fastify'

/**
 * API Routes
 */
async function routes(app: FastifyInstance) {
  // Register schemas
  await import('./schemas/block.ts').then((m) => m.registerSchemas(app))
  await import('./schemas/group.ts').then((m) => m.registerSchemas(app))
  await import('./schemas/mail.ts').then((m) => m.registerSchemas(app))
  await import('./schemas/site.ts').then((m) => m.registerSchemas(app))
  await import('./schemas/user.ts').then((m) => m.registerSchemas(app))

  // Register routes
  app.register(import('./authentication.ts'))
  app.register(import('./blocks.ts'))
  app.register(import('./groups.ts'), { prefix: '/groups' })
  app.register(import('./locales.ts'), { prefix: '/locales' })
  app.register(import('./mail.ts'), { prefix: '/mail' })
  app.register(import('./pages.ts'))
  app.register(import('./sites.ts'), { prefix: '/sites' })
  app.register(import('./system.ts'), { prefix: '/system' })
  app.register(import('./users.ts'), { prefix: '/users' })
}

export default routes
