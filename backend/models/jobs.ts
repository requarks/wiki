import {
  jobSchedule as jobScheduleTable,
  jobLock as jobLockTable,
  jobHistory as jobHistoryTable
} from '../db/schema.ts'
import { and, eq, lte, not } from 'drizzle-orm'

/**
 * Jobs model
 */
class Jobs {
  /**
   * Initialize jobs table
   */
  async init(): Promise<void> {
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
      // NOTE: an ISO string, not a Date, is passed deliberately — pg sends it verbatim and
      // postgres parses it as UTC, whereas a JS Date would be serialized in the process's local
      // timezone. Kept as-is; the cast only silences the column's `Date` type.
      lastCheckedAt: Temporal.Now.instant()
        .subtract({ hours: 1 })
        .toString({ smallestUnit: 'millisecond' }) as any
    })
  }

  /**
   * Purge old job history
   */
  async cleanHistory(): Promise<void> {
    await WIKI.db.delete(jobHistoryTable).where(
      and(
        not(eq(jobHistoryTable.state, 'active')),
        lte(
          jobHistoryTable.startedAt,
          new Date(
            Temporal.Now.instant().subtract({
              seconds: WIKI.config.scheduler.historyExpiration
            }).epochMilliseconds
          )
        )
      )
    )
  }
}

export const jobs = new Jobs()
