import type { FastifyInstance } from 'fastify'

/**
 * A date that may not be set.
 *
 * An empty string counts as unset alongside null, because that is how the editor holds a date nobody
 * has filled in — rejecting it would fail every save of a page that is not scheduled.
 */
const optionalDateTime = {
  anyOf: [
    { type: 'string', format: 'date-time' },
    { type: 'string', maxLength: 0 },
    { type: 'null' }
  ],
  description: 'Empty or null when there is no date.'
}

export async function registerSchemas(app: FastifyInstance): Promise<void> {
  /**
   * PAGE INPUT - The writable fields, used for both create and update
   */
  app.addSchema({
    $id: 'PageInput',
    type: 'object',
    properties: {
      path: {
        type: 'string',
        maxLength: 255,
        pattern: '^/?[a-zA-Z0-9-_/]*$',
        description: 'Where the page lives, without a leading slash. Lowercased when stored.'
      },
      title: {
        type: 'string',
        minLength: 1,
        maxLength: 255
      },
      description: {
        type: 'string',
        maxLength: 255
      },
      icon: {
        type: 'string',
        maxLength: 255
      },
      alias: {
        type: 'string',
        maxLength: 255,
        pattern: '^[a-zA-Z0-9-_]*$'
      },
      locale: {
        type: 'string',
        maxLength: 10,
        description: "The site's primary locale when absent."
      },
      editor: {
        type: 'string',
        maxLength: 255,
        description: 'Which editor authored the content, e.g. `markdown`.'
      },
      content: {
        type: 'string',
        description: 'The source, in whatever the editor writes.'
      },
      render: {
        type: 'string',
        description:
          "The HTML the editor produced. Sanitized against the author's permissions before it is stored, and the table of contents and search text are derived from the result — so what comes back may differ from what was sent."
      },
      publishState: {
        type: 'string',
        enum: ['draft', 'published', 'scheduled']
      },
      publishStartDate: optionalDateTime,
      publishEndDate: optionalDateTime,
      isBrowsable: {
        type: 'boolean'
      },
      isSearchable: {
        type: 'boolean'
      },
      password: {
        type: 'string',
        maxLength: 255
      },
      relations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: true
        }
      },
      tags: {
        type: 'array',
        items: {
          type: 'string'
        }
      },
      allowComments: { type: 'boolean' },
      allowContributions: { type: 'boolean' },
      allowRatings: { type: 'boolean' },
      showSidebar: { type: 'boolean' },
      showTags: { type: 'boolean' },
      showToc: { type: 'boolean' },
      tocDepth: {
        type: 'object',
        properties: {
          min: { type: 'integer', minimum: 1, maximum: 6 },
          max: { type: 'integer', minimum: 1, maximum: 6 }
        }
      },
      scriptJsLoad: {
        type: 'string',
        description: 'Requires the `write:scripts` permission. Ignored without it.'
      },
      scriptJsUnload: {
        type: 'string',
        description: 'Requires the `write:scripts` permission. Ignored without it.'
      },
      scriptCss: {
        type: 'string',
        description: 'Requires the `write:styles` permission. Ignored without it.'
      }
    }
  })

  /**
   * PAGE - A page as it is served back
   */
  app.addSchema({
    $id: 'Page',
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      path: { type: 'string' },
      hash: {
        type: 'string',
        description: 'Hash of the path, which is how a page is addressed by URL.'
      },
      alias: { type: ['string', 'null'] },
      title: { type: 'string' },
      description: { type: ['string', 'null'] },
      icon: { type: ['string', 'null'] },
      locale: { type: 'string' },
      editor: { type: 'string' },
      contentType: { type: 'string' },
      publishState: { type: 'string', enum: ['draft', 'published', 'scheduled'] },
      publishStartDate: { type: ['string', 'null'], format: 'date-time' },
      publishEndDate: { type: ['string', 'null'], format: 'date-time' },
      isBrowsable: { type: 'boolean' },
      isSearchable: { type: 'boolean' },
      password: {
        type: ['string', 'null'],
        description:
          'Only present for a requester who may edit the page — whoever can take the password off it. Absent otherwise, protected page or not.'
      },
      isLocked: {
        type: 'boolean',
        description:
          'The page is password protected and this requester has not entered it, so `content`, `render` and `toc` were withheld. Unlock it with `POST …/unlock`.'
      },
      relations: {
        type: 'array',
        items: { type: 'object', additionalProperties: true }
      },
      tags: { type: 'array', items: { type: 'string' } },
      toc: {
        type: 'array',
        description: 'Nested headings, derived from the stored render.',
        items: { type: 'object', additionalProperties: true }
      },
      render: { type: 'string' },
      content: {
        type: 'string',
        description: 'Only present when the request asked for it.'
      },
      allowComments: { type: 'boolean' },
      allowContributions: { type: 'boolean' },
      allowRatings: { type: 'boolean' },
      showSidebar: { type: 'boolean' },
      showTags: { type: 'boolean' },
      showToc: { type: 'boolean' },
      tocDepth: {
        type: 'object',
        properties: {
          min: { type: 'integer' },
          max: { type: 'integer' }
        }
      },
      scriptJsLoad: { type: 'string' },
      scriptJsUnload: { type: 'string' },
      scriptCss: { type: 'string' },
      navigationId: { type: ['string', 'null'] },
      navigationMode: { type: 'string' },
      authorId: { type: 'string', format: 'uuid' },
      authorName: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' }
    }
  })
}
