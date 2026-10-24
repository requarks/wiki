import { FEEDBACK_STATUSES } from '../../models/feedback.ts'
import { FEEDBACK_SORTS } from '../../models/pages.ts'
import type { FastifyInstance } from 'fastify'

export async function registerSchemas(app: FastifyInstance): Promise<void> {
  /**
   * FEEDBACK STATUS - Where an idea on a feedback board stands
   */
  app.addSchema({
    $id: 'FeedbackStatus',
    type: 'string',
    enum: [...FEEDBACK_STATUSES],
    description:
      'Where an idea stands. `open` is also what an idea nobody has moved yet is: creating one writes no status.'
  })

  /**
   * FEEDBACK SORT - The orders a board's listing can be read in
   */
  app.addSchema({
    $id: 'FeedbackSort',
    type: 'string',
    enum: [...FEEDBACK_SORTS]
  })

  /**
   * FEEDBACK IDEA - One idea, as a board's listing draws it
   */
  app.addSchema({
    $id: 'FeedbackIdea',
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      path: { type: 'string' },
      title: { type: 'string' },
      description: { type: 'string' },
      status: { $ref: 'FeedbackStatus#' },
      categories: {
        type: 'array',
        items: { type: 'string' },
        description: 'The board’s category tags this idea carries, in the board’s order.'
      },
      tags: { type: 'array', items: { type: 'string' } },
      upvotes: { type: 'integer' },
      viewerVoted: {
        type: 'boolean',
        description: 'Whether the requester holds an upvote on it. Always false for a guest.'
      },
      commentsCount: {
        type: 'integer',
        description:
          'Comments in its discussion. 0 where the site does not use the built-in provider.'
      },
      authorId: {
        type: 'string',
        format: 'uuid',
        description: 'Who submitted it: the page’s creator, not its last editor.'
      },
      authorName: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
      lastActivityAt: {
        type: 'string',
        format: 'date-time',
        description: 'The latest of an edit, a status change and a comment.'
      }
    }
  })

  /**
   * FEEDBACK IDEA STATUS - Where one idea stands, and who put it there
   */
  app.addSchema({
    $id: 'FeedbackIdeaStatus',
    type: 'object',
    properties: {
      status: { $ref: 'FeedbackStatus#' },
      updatedAt: { type: ['string', 'null'], format: 'date-time' },
      updatedById: { type: ['string', 'null'], format: 'uuid' },
      updatedByName: { type: ['string', 'null'] },
      commentId: {
        type: ['string', 'null'],
        format: 'uuid',
        description: 'The comment posted with the latest change, while it exists.'
      }
    }
  })
}
