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
      isChild: {
        type: 'boolean',
        description:
          'True for a block that only ever appears inside another one — `block-tab` inside `block-tabs`. It has no row of its own and nothing to switch on or off, since it is available wherever its parent is, and `isEnabled` is therefore always true for one. It is listed so that an editor can build a parameters form from the props it declares; a caller offering blocks to INSERT should leave it out.'
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
      asciidocTemplate: {
        type: 'string',
        description:
          'The same starter body written in AsciiDoc, for a block whose template spells structure that syntax writes differently — nested blocks, or a list with paragraphs attached to its items. Empty for almost every block: a body that is one fenced source is rewritten mechanically, and one that is plain prose reads the same in both syntaxes.'
      },
      contentEditor: {
        type: 'string',
        description:
          'Names an editor for the block\'s body, which the markdown editor offers as an "Edit Content" lens above the block alongside "Edit Block Parameters". A key the frontend resolves to a component, for a block whose body is a fenced source the props form cannot describe. Empty for a block that names none, which is most of them.'
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
              enum: ['string', 'number', 'boolean', 'select', 'icon'],
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
              description:
                'The choices a `select` offers. A plain string where the value IS the wording; an object where they differ — a tab\'s header level is offered as "Heading 3" and written as `3`.',
              items: {
                anyOf: [
                  { type: 'string' },
                  {
                    type: 'object',
                    properties: {
                      label: { type: 'string' },
                      value: { type: 'string' }
                    }
                  }
                ]
              }
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
