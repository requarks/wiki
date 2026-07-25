import type { FastifyInstance } from 'fastify'
import { JOB_STATES, type JobState } from '../models/jobs.ts'

/**
 * Scheduler API Routes
 */
async function routes(app: FastifyInstance) {
  /**
   * LIST SCHEDULED TASKS
   */
  app.get(
    '/schedule',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'List the cron schedule',
        description:
          'The tasks the scheduler runs automatically. These are definitions, not executions — the jobs they produce show up under upcoming and then in the history.',
        tags: ['Scheduler'],
        response: {
          200: {
            description: 'List of scheduled tasks',
            type: 'array',
            items: { $ref: 'SchedulerTask#' }
          }
        }
      }
    },
    async () => {
      return WIKI.models.jobs.getSchedule()
    }
  )

  /**
   * RUN A SCHEDULED TASK NOW
   */
  app.post<{ Params: { scheduleId: string } }>(
    '/schedule/:scheduleId/run',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Run a scheduled task now',
        description:
          'Queues the task immediately, without waiting for its cron expression and without disturbing the planned iterations. The run is recorded in the history like any other job.',
        tags: ['Scheduler'],
        params: {
          type: 'object',
          properties: {
            scheduleId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['scheduleId']
        },
        response: {
          200: {
            description: 'Task queued successfully',
            type: 'object',
            properties: {
              ok: {
                type: 'boolean'
              },
              message: {
                type: 'string'
              },
              id: {
                type: 'string',
                format: 'uuid',
                description: 'The ID of the queued job.'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const entry = await WIKI.models.jobs.getScheduleEntry(req.params.scheduleId)
      if (!entry) {
        return reply.notFound('Scheduled task does not exist.')
      }

      const id = await WIKI.models.jobs.runScheduledTask(entry)
      if (!id) {
        return reply.internalServerError('The scheduler could not queue the job.')
      }

      return {
        ok: true,
        message: 'Task queued successfully.',
        id
      }
    }
  )

  /**
   * LIST UPCOMING JOBS
   */
  app.get(
    '/upcoming',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'List the pending job queue',
        description:
          'Jobs waiting to be picked up, soonest first. A job with no `waitUntil` is eligible immediately.',
        tags: ['Scheduler'],
        response: {
          200: {
            description: 'List of upcoming jobs',
            type: 'array',
            items: { $ref: 'SchedulerUpcomingJob#' }
          }
        }
      }
    },
    async () => {
      return WIKI.models.jobs.getUpcoming()
    }
  )

  /**
   * CANCEL UPCOMING JOB
   */
  app.delete<{ Params: { jobId: string } }>(
    '/upcoming/:jobId',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Cancel a pending job',
        description:
          'Removes the job from the queue. A job that an instance has already picked up cannot be cancelled and answers 404, as it is no longer pending.',
        tags: ['Scheduler'],
        params: {
          type: 'object',
          properties: {
            jobId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['jobId']
        },
        response: {
          204: {
            description: 'Job cancelled successfully'
          }
        }
      }
    },
    async (req, reply) => {
      const cancelled = await WIKI.models.jobs.cancelUpcoming(req.params.jobId)
      if (!cancelled) {
        return reply.notFound('No pending job with this ID.')
      }
      return reply.code(204).send()
    }
  )

  /**
   * LIST JOB HISTORY
   */
  app.get<{ Querystring: { states?: JobState[]; limit?: number } }>(
    '/jobs',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'List job execution history',
        description:
          'Past and running jobs, most recently started first. Older entries are purged by the `cleanJobHistory` task.',
        tags: ['Scheduler'],
        querystring: {
          type: 'object',
          properties: {
            states: {
              type: 'array',
              description: 'Keep only jobs in these states. All states when omitted.',
              items: {
                type: 'string',
                enum: JOB_STATES
              }
            },
            limit: { type: 'integer', minimum: 1, maximum: 500, default: 100 }
          }
        },
        response: {
          200: {
            description: 'List of jobs',
            type: 'object',
            properties: {
              total: {
                type: 'integer',
                description:
                  'How many jobs match the requested states, which can exceed the number returned.'
              },
              limit: {
                type: 'integer'
              },
              jobs: {
                type: 'array',
                items: { $ref: 'SchedulerJob#' }
              }
            }
          }
        }
      }
    },
    async (req) => {
      const limit = req.query.limit ?? 100
      const { total, jobs } = await WIKI.models.jobs.getHistory({
        states: req.query.states ?? [],
        limit
      })
      return { total, limit, jobs }
    }
  )

  /**
   * RETRY JOB
   */
  app.post<{ Params: { jobId: string } }>(
    '/jobs/:jobId/retry',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Run a past job again',
        description:
          'Queues a new job with the same task and payload. The original history entry is left as it is, and the new run is recorded separately with a full retry budget.',
        tags: ['Scheduler'],
        params: {
          type: 'object',
          properties: {
            jobId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['jobId']
        },
        response: {
          200: {
            description: 'Job queued successfully',
            type: 'object',
            properties: {
              ok: {
                type: 'boolean'
              },
              message: {
                type: 'string'
              },
              id: {
                type: 'string',
                format: 'uuid',
                description: 'The ID of the newly queued job, not the one it was created from.'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const entry = await WIKI.models.jobs.getHistoryEntry(req.params.jobId)
      if (!entry) {
        return reply.notFound('Job does not exist.')
      }
      if (entry.state === 'active') {
        return reply.conflict('This job is still running.')
      }

      const id = await WIKI.models.jobs.retryJob(entry)
      if (!id) {
        return reply.internalServerError('The scheduler could not queue the job.')
      }

      return {
        ok: true,
        message: 'Job queued successfully.',
        id
      }
    }
  )
}

export default routes
