import { CONTENT_TYPES } from '../../models/storage.ts'
import type { FastifyInstance } from 'fastify'

export async function registerSchemas(app: FastifyInstance): Promise<void> {
  /**
   * STORAGE TARGET - A storage module as configured for a site
   */
  app.addSchema({
    $id: 'StorageTarget',
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid'
      },
      module: {
        type: 'string',
        description: 'Directory name under `modules/storage`.'
      },
      isEnabled: {
        type: 'boolean'
      },
      title: {
        type: 'string'
      },
      description: {
        type: 'string'
      },
      icon: {
        type: 'string'
      },
      banner: {
        type: 'string'
      },
      vendor: {
        type: 'string'
      },
      website: {
        type: 'string'
      },
      contentTypes: {
        type: 'object',
        description: 'Which kinds of content this target holds.',
        properties: {
          activeTypes: {
            type: 'array',
            items: {
              type: 'string',
              enum: [...CONTENT_TYPES]
            }
          },
          largeThreshold: {
            type: 'string',
            description: 'Size above which an asset counts as a large file, e.g. `5MB`.'
          }
        }
      },
      assetDelivery: {
        type: 'object',
        description:
          'How assets reach the user. The `is*Supported` flags come from the module and are read-only.',
        properties: {
          isStreamingSupported: {
            type: 'boolean'
          },
          isDirectAccessSupported: {
            type: 'boolean'
          },
          streaming: {
            type: 'boolean'
          },
          directAccess: {
            type: 'boolean'
          }
        }
      },
      versioning: {
        type: 'object',
        description:
          'Whether past versions are kept. `isForceEnabled` marks a module where versioning is inherent, such as git.',
        properties: {
          isSupported: {
            type: 'boolean'
          },
          isForceEnabled: {
            type: 'boolean'
          },
          enabled: {
            type: 'boolean'
          }
        }
      },
      setup: {
        type: 'object',
        description:
          'Only present for a module that has a setup process and an implementation to run it.',
        properties: {
          handler: {
            type: 'string',
            description: 'Which setup flow the admin area should walk through, e.g. `github`.'
          },
          state: {
            type: 'string',
            enum: ['notconfigured', 'pendinginstall', 'configured']
          },
          values: {
            type: 'object',
            additionalProperties: true,
            description: 'Values the setup form starts from.'
          }
        }
      },
      props: {
        type: 'object',
        additionalProperties: true,
        description:
          'The module configuration, declared in its `definition.yml`: each entry carries a `type`, `title`, `hint`, `default` and the display hints the admin area renders a control from. A `readOnly` prop is shown but cannot be changed, and is silently kept at its stored value when written to.'
      },
      config: {
        type: 'object',
        additionalProperties: true,
        description:
          'Values for the module props, completed with the module defaults for any prop that has none stored yet.'
      },
      actions: {
        type: 'array',
        description:
          'Operations that can be run on demand. Empty for a module without an implementation, since there would be nothing to run.',
        items: {
          type: 'object',
          properties: {
            handler: {
              type: 'string'
            },
            label: {
              type: 'string'
            },
            hint: {
              type: 'string'
            },
            warn: {
              type: 'string',
              description: 'Present when the action destroys data.'
            },
            icon: {
              type: 'string'
            }
          }
        }
      }
    }
  })

  /**
   * STORAGE TARGET INPUT - A partial update of one target
   */
  app.addSchema({
    $id: 'StorageTargetInput',
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        format: 'uuid'
      },
      isEnabled: {
        type: 'boolean',
        description:
          'The database target cannot be disabled, and a target with a pending setup cannot be enabled.'
      },
      contentTypes: {
        type: 'object',
        properties: {
          activeTypes: {
            type: 'array',
            items: {
              type: 'string',
              enum: [...CONTENT_TYPES]
            }
          },
          largeThreshold: {
            type: 'string',
            maxLength: 32
          }
        }
      },
      assetDelivery: {
        type: 'object',
        description: 'A delivery mode the module does not support is stored as off.',
        properties: {
          streaming: {
            type: 'boolean'
          },
          directAccess: {
            type: 'boolean'
          }
        }
      },
      versioning: {
        type: 'object',
        description:
          'Ignored by a module that does not support versioning or that forces it on — the module decides, not the client.',
        properties: {
          enabled: {
            type: 'boolean'
          }
        }
      },
      config: {
        type: 'object',
        additionalProperties: true,
        description:
          'Values for the module props. Validated against what the module declares: an unknown key is dropped, a wrong type is refused, and a read-only prop keeps its stored value.'
      }
    }
  })
}
