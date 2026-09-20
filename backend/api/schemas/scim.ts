import { SCIM_DELETE_ACTIONS, SCIM_EMAIL_SOURCES } from '../../models/scim.ts'
import type { FastifyInstance } from 'fastify'

export async function registerSchemas(app: FastifyInstance): Promise<void> {
  /**
   * SCIM CONFIG - Used both ways: as the response, and as a partial update body
   */
  app.addSchema({
    $id: 'ScimConfig',
    type: 'object',
    properties: {
      isEnabled: {
        type: 'boolean',
        description:
          'Whether the SCIM 2.0 endpoint is served at `/_scim/v2`. Off, every path under it answers 404 whatever credential is presented.'
      },
      deleteAction: {
        type: 'string',
        enum: [...SCIM_DELETE_ACTIONS],
        description:
          "`deactivate` (the default) answers `DELETE /Users/:id` by clearing the account's sessions and group memberships while keeping the row, so authorship on pages and history survives. `delete` removes the row outright."
      },
      emailSource: {
        type: 'string',
        enum: [...SCIM_EMAIL_SOURCES],
        description:
          "Where a provisioned account's email address is read from. `userName` is what every connector sends and is right wherever the login name is the mailbox; `emails` reads the primary entry of `emails[]` instead."
      },
      allowGroupCreate: {
        type: 'boolean',
        description:
          'Whether `POST /Groups` may create a wiki group. A group created this way holds the same starting permissions as one created in the admin area and grants nothing beyond them. Off, a directory may only manage the membership of groups that already exist here.'
      },
      rateLimitEnabled: {
        type: 'boolean',
        description:
          'Whether requests to `/_scim/v2` are rate limited per client address. Counted against the same postgres-backed counter the login limit uses, so instances behind a load balancer share one budget.'
      },
      rateLimitMax: {
        type: 'integer',
        minimum: 1,
        description:
          "Requests one address may make within the window. Set well above what a sync costs: a directory's first run is every user it has, back to back."
      },
      rateLimitWindow: {
        type: 'string',
        maxLength: 16,
        description: 'Length of the window, as a number and a unit — `30s`, `1m`, `1h`.'
      },
      rateLimitBan: {
        type: 'string',
        maxLength: 16,
        description:
          'How long an address is refused once it goes over, in the same notation. Short by default, so a connector that trips the limit recovers on its next cycle instead of leaving provisioning broken.'
      },
      ipAllowList: {
        type: 'array',
        items: { type: 'string', maxLength: 64 },
        description:
          'Addresses allowed to reach `/_scim/v2`, as single addresses or CIDR subnets (`203.0.113.4`, `203.0.113.0/24`, `2001:db8::/32`). EMPTY means no restriction, leaving the bearer token as the only thing in front of the endpoint. What an address means depends on `security.trustProxy`.'
      }
    }
  })

  /**
   * SCIM STATUS - What the admin screen shows beside the settings
   */
  app.addSchema({
    $id: 'ScimStatus',
    type: 'object',
    properties: {
      users: {
        type: 'integer',
        description: 'How many user accounts a directory currently owns.'
      },
      groups: {
        type: 'integer',
        description: 'How many groups a directory currently owns.'
      },
      lastRequest: {
        type: ['object', 'null'],
        description:
          'The last SCIM request THIS instance answered. Held in memory, so it is empty after a restart and, in a high-availability set, says nothing about what the other instances have served.',
        properties: {
          at: { type: 'string' },
          method: { type: 'string' },
          path: { type: 'string' },
          status: { type: 'integer' },
          message: { type: ['string', 'null'] }
        }
      }
    }
  })
}
