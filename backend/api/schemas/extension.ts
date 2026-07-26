import type { FastifyInstance } from 'fastify'

export async function registerSchemas(app: FastifyInstance): Promise<void> {
  /**
   * EXTENSION - Optional third-party tooling, with its state on this system
   */
  app.addSchema({
    $id: 'Extension',
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'Directory name under `modules/extensions`.'
      },
      title: {
        type: 'string'
      },
      description: {
        type: 'string'
      },
      website: {
        type: 'string',
        description: 'Where the extension itself is documented. Empty when not declared.'
      },
      isInstalled: {
        type: 'boolean',
        description: 'Whether it was found on this system. Always false when incompatible.'
      },
      isInstallable: {
        type: 'boolean',
        description:
          'Whether the admin area can install it, rather than it being installed by hand.'
      },
      isCompatible: {
        type: 'boolean',
        description: 'Whether this platform and architecture can run it at all.'
      }
    }
  })
}
