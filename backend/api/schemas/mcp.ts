import { MCP_LIMITS, MCP_PUBLISH_STATES, MCP_TOOL_GROUPS } from '../../models/mcp.ts'
import type { FastifyInstance } from 'fastify'

export async function registerSchemas(app: FastifyInstance): Promise<void> {
  /**
   * MCP CONFIG - Used both ways: as the response, and as a partial update body
   */
  app.addSchema({
    $id: 'McpConfig',
    type: 'object',
    properties: {
      isEnabled: {
        type: 'boolean',
        description:
          'Whether the Model Context Protocol server is served at `/_mcp`. Off, it answers 404 whatever credential is presented.'
      },
      allowAnonymous: {
        type: 'boolean',
        description:
          "Whether `/_mcp` answers a request carrying no token at all, as the guests group: read-only tools, under the guests group's page rules. Rate limited per address."
      },
      tools: {
        type: 'object',
        description:
          "Which groups of tools exist. A group that is off is listed to nobody, whatever a token's scopes say. `destructive` (moving and deleting pages) is reached by `pages:write` as soon as it is on.",
        properties: Object.fromEntries(
          MCP_TOOL_GROUPS.map((group) => [group, { type: 'boolean' }])
        ),
        additionalProperties: false
      },
      newPagePublishState: {
        type: 'string',
        enum: [...MCP_PUBLISH_STATES],
        description:
          'The publish state of a page an agent creates. `published` by default: a draft is visible only to those who may edit it, so no other reader — nor their agent — would find it.'
      },
      maxResultChars: {
        type: 'integer',
        minimum: MCP_LIMITS.maxResultChars.min,
        maximum: MCP_LIMITS.maxResultChars.max,
        description:
          'The most characters one tool result may carry. A longer one is cut and says how to ask for the rest.'
      },
      rateLimitBurst: {
        type: 'integer',
        minimum: MCP_LIMITS.rateLimitBurst.min,
        maximum: MCP_LIMITS.rateLimitBurst.max,
        description:
          'How many calls one owner (one address, for anonymous callers) may make at once. Counted in memory per instance.'
      },
      rateLimitPerMinute: {
        type: 'integer',
        minimum: MCP_LIMITS.rateLimitPerMinute.min,
        maximum: MCP_LIMITS.rateLimitPerMinute.max,
        description: 'How fast that budget refills, in calls per minute.'
      },
      showAiBadge: {
        type: 'boolean',
        description:
          'Whether a version written through MCP carries an AI badge in page history and on the page. Which versions an agent wrote is recorded either way.'
      }
    }
  })
}
