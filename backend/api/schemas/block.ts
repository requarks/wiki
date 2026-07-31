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
      },
      template: {
        type: 'string',
        description:
          'Body the editor writes between the opening and closing lines when inserting the block, for a block whose content is other blocks. Empty for a block that takes none.'
      },
      props: {
        type: 'array',
        description:
          "The block's authorable attributes, as its component declares them — what the editor's block picker turns into a form. Read from the compiled manifest rather than the database, so it describes the code that is installed. Empty for a custom block, which has no manifest entry.",
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Attribute name, as written on the element.'
            },
            type: {
              type: 'string',
              enum: ['string', 'number', 'boolean', 'select'],
              description: 'What kind of field to offer for it.'
            },
            label: {
              type: 'string'
            },
            hint: {
              type: 'string'
            },
            required: {
              type: 'boolean'
            },
            options: {
              type: 'array',
              description: 'Allowed values, for `select`.',
              items: { type: 'string' }
            },
            default: {
              description: 'Value the field starts on, and the one worth leaving out of the markup.'
            }
          }
        }
      }
    }
  })
}
