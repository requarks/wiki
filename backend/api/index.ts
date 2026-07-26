import type { FastifyInstance } from 'fastify'

/**
 * API Routes
 */
async function routes(app: FastifyInstance) {
  // Register schemas
  await import('./schemas/apiKey.ts').then((m) => m.registerSchemas(app))
  await import('./schemas/asset.ts').then((m) => m.registerSchemas(app))
  await import('./schemas/authentication.ts').then((m) => m.registerSchemas(app))
  await import('./schemas/block.ts').then((m) => m.registerSchemas(app))
  await import('./schemas/extension.ts').then((m) => m.registerSchemas(app))
  await import('./schemas/flags.ts').then((m) => m.registerSchemas(app))
  await import('./schemas/group.ts').then((m) => m.registerSchemas(app))
  await import('./schemas/hook.ts').then((m) => m.registerSchemas(app))
  await import('./schemas/icon.ts').then((m) => m.registerSchemas(app))
  await import('./schemas/mail.ts').then((m) => m.registerSchemas(app))
  await import('./schemas/page.ts').then((m) => m.registerSchemas(app))
  await import('./schemas/scheduler.ts').then((m) => m.registerSchemas(app))
  await import('./schemas/security.ts').then((m) => m.registerSchemas(app))
  await import('./schemas/site.ts').then((m) => m.registerSchemas(app))
  await import('./schemas/storage.ts').then((m) => m.registerSchemas(app))
  await import('./schemas/tree.ts').then((m) => m.registerSchemas(app))
  await import('./schemas/user.ts').then((m) => m.registerSchemas(app))

  // Register routes
  app.register(import('./apiKeys.ts'), { prefix: '/api-keys' })
  app.register(import('./assets.ts'))
  app.register(import('./authentication.ts'))
  app.register(import('./blocks.ts'))
  app.register(import('./groups.ts'), { prefix: '/groups' })
  app.register(import('./hooks.ts'), { prefix: '/hooks' })
  app.register(import('./icons.ts'), { prefix: '/icons' })
  app.register(import('./locales.ts'), { prefix: '/locales' })
  app.register(import('./mail.ts'), { prefix: '/mail' })
  app.register(import('./navigation.ts'))
  app.register(import('./pages.ts'))
  app.register(import('./scheduler.ts'), { prefix: '/scheduler' })
  app.register(import('./sites.ts'), { prefix: '/sites' })
  app.register(import('./storage.ts'))
  app.register(import('./system.ts'), { prefix: '/system' })
  app.register(import('./tags.ts'))
  app.register(import('./tree.ts'))
  app.register(import('./users.ts'), { prefix: '/users' })
}

export default routes
