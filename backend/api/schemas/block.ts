import type { FastifyInstance } from 'fastify'

export async function registerSchemas(app: FastifyInstance): Promise<void> {
  /**
   * BLOCK
   */
  app.addSchema({
    $id: 'Block',
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid'
      },
      block: {
        type: 'string',
        description: 'Element suffix — the block renders as `<block-{block}>`.'
      },
      name: {
        type: 'string'
      },
      description: {
        type: 'string'
      },
      icon: {
        type: 'string',
        description: 'Blueprint icon name, resolved as `/_assets/icons/ultraviolet-{icon}.svg`.'
      },
      isEnabled: {
        type: 'boolean'
      },
      isCustom: {
        type: 'boolean',
        description: 'False for blocks registered from the compiled block manifest.'
      },
      config: {
        type: 'object',
        additionalProperties: true
      }
    }
  })
}
