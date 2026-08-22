import {
  CONTENT_TYPES,
  STORAGE_DELIVERY_MODES,
  STORAGE_TARGET_STATUSES
} from '../../models/storage.ts'
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
        description:
          'Which kinds of content are written to this target. Not a choice between targets: a site may store the same kind in several places at once, and every one of them receives a copy.',
        properties: {
          activeTypes: {
            type: 'array',
            items: {
              type: 'string',
              enum: [...CONTENT_TYPES]
            }
          }
        }
      },
      assetDelivery: {
        type: 'object',
        description:
          'How assets reach the user. `isDirectAccessSupported` comes from the module and is read-only.',
        properties: {
          isDirectAccessSupported: {
            type: 'boolean',
            description:
              'Whether this module can sign a URL a reader fetches the file from directly. True for the object stores and nothing else.'
          },
          isDeliverySupported: {
            type: 'boolean',
            description:
              "Whether a site may nominate this target to answer readers' requests. False for SFTP, which is a place to keep a copy of the content rather than one to serve it from - it is still written to, exported to and imported from. A nomination on such a target is refused, and it answers a read only as a last resort, once every target that may serve has been asked and had nothing."
          },
          mode: {
            type: 'string',
            enum: [...STORAGE_DELIVERY_MODES],
            description:
              '`streaming` sends the bytes through the wiki; `direct` answers with a redirect to a URL the store signed. Only consulted on the target nominated for the content type being asked for. Stored as `streaming` on a module that cannot do the other.'
          },
          baseUrl: {
            type: 'string',
            description:
              "The origin a direct link is built on, in place of the store's own - a CDN or custom domain in front of the bucket. The signature is made for that host rather than moved onto it afterwards, so it must be a domain that actually fronts the bucket."
          },
          linkExpiration: {
            type: 'string',
            description:
              "How long a direct link stays valid, e.g. `5m` or `1h`. Capped at 7 days, which is as far as any of these providers will sign. Short by default: the link carries none of the wiki's page rules, so its lifetime is how long it can be passed on."
          },
          servedTypes: {
            type: 'array',
            description:
              'The content types a request for a file is answered from this target. A subset of `contentTypes.activeTypes`, since a target can only serve back what it was asked to store, and across a site each type names at most one target.',
            items: {
              type: 'string',
              enum: [...CONTENT_TYPES]
            }
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
      },
      state: {
        type: 'object',
        description:
          'How the target is behaving, as opposed to how it is configured. Read-only and absent from `StorageTargetInput`: it records the outcome of the last operation the wiki asked of this target, not anything an administrator sets. `warning` is an operation that failed without being refused - a page copy that could not be written - and `error` is one that was reported to whoever asked, such as a failed upload. A subsequent success clears either.',
        properties: {
          status: {
            type: 'string',
            enum: [...STORAGE_TARGET_STATUSES]
          },
          message: {
            type: 'string',
            description: 'What went wrong. Empty when healthy.'
          },
          updatedAt: {
            type: ['string', 'null'],
            description:
              'When the status was last written, or null for a target that has not been asked to do anything yet.'
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
          'The database target cannot be disabled, and a module without an implementation cannot be enabled.'
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
          }
        }
      },
      assetDelivery: {
        type: 'object',
        description: 'Direct access asked of a module that cannot do it is stored as streaming.',
        properties: {
          mode: {
            type: 'string',
            enum: [...STORAGE_DELIVERY_MODES]
          },
          baseUrl: {
            type: 'string',
            maxLength: 1024,
            description: "A full http or https origin, or empty for the store's own address."
          },
          linkExpiration: {
            type: 'string',
            maxLength: 32,
            description: 'A whole number of minutes or hours, at most 7 days.'
          },
          servedTypes: {
            type: 'array',
            description: 'Refused for a content type this target is not also configured to store.',
            items: {
              type: 'string',
              enum: [...CONTENT_TYPES]
            }
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
