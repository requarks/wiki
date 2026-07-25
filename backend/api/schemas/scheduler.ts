import type { FastifyInstance } from 'fastify'
import { JOB_STATES } from '../../models/jobs.ts'

export async function registerSchemas(app: FastifyInstance): Promise<void> {
  /**
   * SCHEDULER TASK - A cron entry, i.e. a task that runs automatically
   */
  app.addSchema({
    $id: 'SchedulerTask',
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid'
      },
      task: {
        type: 'string',
        description: 'Task name, matching a file under `tasks/simple/` or `tasks/workers/`.'
      },
      cron: {
        type: 'string',
        description: 'Cron expression, evaluated in UTC.'
      },
      type: {
        type: 'string',
        description: 'Where the entry comes from, e.g. `system`.'
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
   * SCHEDULER UPCOMING JOB - A job waiting in the queue
   */
  app.addSchema({
    $id: 'SchedulerUpcomingJob',
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid'
      },
      task: {
        type: 'string'
      },
      useWorker: {
        type: 'boolean',
        description: 'True when the task runs in a worker thread rather than in-process.'
      },
      retries: {
        type: 'integer',
        description: 'How many attempts have already failed. Zero on a first attempt.'
      },
      maxRetries: {
        type: 'integer'
      },
      waitUntil: {
        // -> Jobs meant to run as soon as a worker is free have no date at all
        type: 'string',
        nullable: true,
        format: 'date-time',
        description: 'RFC 3339 Date Time, or null to run at the next opportunity'
      },
      isScheduled: {
        type: 'boolean',
        description: 'True when the job was created from a cron entry rather than on demand.'
      },
      createdBy: {
        type: 'string',
        nullable: true,
        description: 'ID of the instance that queued the job.'
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
   * SCHEDULER JOB - One execution, as recorded in the job history
   */
  app.addSchema({
    $id: 'SchedulerJob',
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid'
      },
      task: {
        type: 'string'
      },
      state: {
        type: 'string',
        enum: JOB_STATES,
        description:
          '`active` while running, `interrupted` when the run was cut short rather than failing on its own.'
      },
      useWorker: {
        type: 'boolean'
      },
      wasScheduled: {
        type: 'boolean'
      },
      attempt: {
        type: 'integer',
        description: 'Which attempt this execution was, starting at 1.'
      },
      maxRetries: {
        type: 'integer'
      },
      lastErrorMessage: {
        type: 'string',
        nullable: true
      },
      executedBy: {
        type: 'string',
        nullable: true,
        description: 'ID of the instance that ran the job.'
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'RFC 3339 Date Time — when the job was queued'
      },
      startedAt: {
        type: 'string',
        format: 'date-time',
        description: 'RFC 3339 Date Time'
      },
      completedAt: {
        type: 'string',
        nullable: true,
        format: 'date-time',
        description: 'RFC 3339 Date Time, or null while the job has not finished'
      }
    }
  })
}
