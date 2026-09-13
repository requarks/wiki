import type { FastifyInstance } from 'fastify'

export async function registerSchemas(app: FastifyInstance): Promise<void> {
  /**
   * ANALYTICS PROVIDER - An analytics module as configured for a site
   */
  app.addSchema({
    $id: 'AnalyticsProvider',
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'Directory name under `modules/analytics`.'
      },
      title: {
        type: 'string'
      },
      description: {
        type: 'string'
      },
      website: {
        type: 'string',
        description: "The provider's own site."
      },
      icon: {
        type: 'string'
      },
      isEnabled: {
        type: 'boolean',
        description:
          'Whether this provider contributes markup to the documents the site serves. Several providers may be on at once; each contributes its own tag.'
      },
      requires: {
        type: 'array',
        items: { type: 'string' },
        description:
          'The config keys that must hold a value before the provider renders anything. An enabled provider missing one of these is skipped rather than served with an empty tracking ID in it.'
      },
      props: {
        type: 'object',
        additionalProperties: true,
        description:
          'The configuration fields the module declares, as the admin area renders them. Read-only: what a module needs configured is a property of the module, not of the site.'
      },
      config: {
        type: 'object',
        additionalProperties: true,
        description:
          "The stored value of each prop, completed from the module's defaults. Never masked - every value here is rendered into a document served to the public, so a secret could not be one of them."
      }
    }
  })

  /**
   * ANALYTICS PROVIDER INPUT - What a client may change about one provider
   */
  app.addSchema({
    $id: 'AnalyticsProviderInput',
    type: 'object',
    properties: {
      key: {
        type: 'string'
      },
      isEnabled: {
        type: 'boolean'
      },
      config: {
        type: 'object',
        additionalProperties: true,
        description:
          'Values for the props the module declares. Unknown keys are dropped and read-only props are ignored.'
      }
    },
    required: ['key']
  })
}
