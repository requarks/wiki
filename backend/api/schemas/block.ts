import type { FastifyInstance } from 'fastify'

export async function registerSchemas(app: FastifyInstance): Promise<void> {
  /**
   * BLOCK CONFIG
   */
  app.addSchema({
    $id: 'BlockConfig',
    type: 'object',
    description:
      "A site administrator's settings for the block's props, by prop name. Only the props that were changed or locked have an entry: `{}` is a block used exactly as its component declares it.",
    additionalProperties: {
      type: 'object',
      required: ['value', 'locked'],
      properties: {
        /*
          No `type`, deliberately. A list of three makes Ajv's strict mode warn at every boot, and
          `anyOf` is worse: type coercion and the serializer both take its first branch, so `600` and
          `false` came back as strings. The value is checked against its prop's own type by the model
          (`normalizeConfig`), which is the only place that knows which of the three it should be.
        */
        value: {
          description:
            "A string, number or boolean, as the prop's type: what the editor starts the prop on when the block is inserted — or, when locked, the only value it may have. Empty stands for the block's own default."
        },
        locked: {
          type: 'boolean',
          description:
            'Whether authors may change it. A locked value is written onto every element of the block when a page is rendered, replacing whatever the source gave it.'
        }
      }
    }
  })

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
      version: {
        type: 'string',
        description:
          "The block's version, `MAJOR.MINOR.PATCH`, as the installed code declares it: from the compiled manifest for a built-in block, which is always `1.0.0` since it ships with the wiki, and from the imported package for a custom one."
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
        description:
          'False for blocks registered from the compiled block manifest. True for one imported as a `.wkblock` package, which is stored in the database and may be deleted.'
      },
      isChild: {
        type: 'boolean',
        description:
          'True for a block that only ever appears inside another one — `block-tab` inside `block-tabs`. It has no row of its own and nothing to switch on or off, since it is available wherever its parent is, and `isEnabled` is therefore always true for one. It is listed so that an editor can build a parameters form from the props it declares; a caller offering blocks to INSERT should leave it out.'
      },
      inline: {
        type: 'boolean',
        description:
          "True for a block that sits in a line of text rather than on a line of its own — `:block-color[#ff6600]{…}` in markdown, `block-color:[#ff6600, …]` in AsciiDoc. What goes between the brackets is its value, kept as the element's text so a reader without the component still sees it; `template` is the value an editor starts it with."
      },
      config: { $ref: 'BlockConfig#' },
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
      attributes: {
        type: 'array',
        description:
          "Every attribute the block's component reads, the ones the wiki writes itself (a math block's `inline`) as well as the authorable ones in `props`. What a sanitizer lets through on the element, server and browser alike; not something to build a form from.",
        items: { type: 'string' }
      },
      urlAttributes: {
        type: 'array',
        description:
          'Those of `attributes` that hold an address. A sanitizer refuses one whose scheme a link may not have, as it does for `href` and `src`.',
        items: { type: 'string' }
      },
      props: {
        type: 'array',
        description:
          "The block's authorable attributes, as its component declares them — what the editor's block picker turns into a form. Describes the code that is installed rather than a copy of it made when the block was registered: read from the compiled manifest for a built-in block, and from the definition stored with its package for an imported one.",
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
