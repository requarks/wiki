import { approvalMatchModes } from '../../models/approvals.ts'
import type { FastifyInstance } from 'fastify'

export async function registerSchemas(app: FastifyInstance): Promise<void> {
  /**
   * APPROVAL RULE - Which pages accept edit suggestions, from whom, and who reviews them
   */
  app.addSchema({
    $id: 'ApprovalRule',
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid'
      },
      name: {
        type: 'string',
        description: 'What the rule is called in the admin list.'
      },
      isEnabled: {
        type: 'boolean',
        description: 'A disabled rule keeps its configuration but covers nothing.'
      },
      match: {
        type: 'string',
        enum: [...approvalMatchModes],
        description:
          'How `path` is compared: the same modes group page rules use. `TAG` matches a page carrying any of the listed tags, `TAGALL` one carrying all of them.'
      },
      path: {
        type: 'string',
        description:
          'The pattern, without a leading slash. A comma-separated list of tags for the tag modes.'
      },
      submitterGroups: {
        type: 'array',
        description: 'IDs of the groups whose members may submit edit suggestions.',
        items: {
          type: 'string',
          format: 'uuid'
        }
      },
      reviewerGroups: {
        type: 'array',
        description:
          'IDs of the groups that review those submissions, and are notified when one comes in.',
        items: {
          type: 'string',
          format: 'uuid'
        }
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'RFC 3339 Date Time'
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'RFC 3339 Date Time'
      }
    }
  })

  /**
   * APPROVAL RULE INPUT - The fields a rule is written with
   */
  app.addSchema({
    $id: 'ApprovalRuleInput',
    type: 'object',
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 255
      },
      isEnabled: {
        type: 'boolean'
      },
      match: {
        type: 'string',
        enum: [...approvalMatchModes]
      },
      path: {
        type: 'string',
        maxLength: 2048
      },
      submitterGroups: {
        type: 'array',
        items: {
          type: 'string',
          format: 'uuid'
        }
      },
      reviewerGroups: {
        type: 'array',
        items: {
          type: 'string',
          format: 'uuid'
        }
      }
    }
  })
}
