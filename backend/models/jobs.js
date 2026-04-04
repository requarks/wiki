import { DateTime } from 'luxon'
import {
  jobSchedule as jobScheduleTable,
  jobLock as jobLockTable,
  jobHistory as jobHistoryTable
} from '../db/schema.js'
import { and, eq, lte, not } from 'drizzle-orm'

/**
 * Jobs model
 */
class Jobs {
  /**
   * Initialize jobs table
   */
  async init() {
    WIKI.logger.info('Inserting scheduled jobs...')

    await WIKI.db.insert(jobScheduleTable).values([
      {
        task: 'checkVersion',
        cron: '0 0 * * *',
        type: 'system'
      },
      {
        task: 'cleanJobHistory',
        cron: '5 0 * * *',
        type: 'system'
      },
      // {
      //   task: 'refreshAutocomplete',
      //   cron: '0 */6 * * *',
      //   type: 'system'
      // },
      {
        task: 'updateLocales',
        cron: '0 0 * * *',
        type: 'system'
      }
    ])

    await WIKI.db.insert(jobLockTable).values({
      key: 'cron',
      lastCheckedBy: 'init',
      lastCheckedAt: DateTime.utc().minus({ hours: 1 }).toISO()
    })
  }

  /**
   * Purge old job history
   */
  async cleanHistory() {
    await WIKI.db
      .delete(jobHistoryTable)
      .where(
        and(
          not(eq(jobHistoryTable.state, 'active')),
          lte(
            jobHistoryTable.startedAt,
            DateTime.utc().minus({ seconds: WIKI.config.scheduler.historyExpiration }).toJSDate()
          )
        )
      )
  }
}

export const jobs = new Jobs()
