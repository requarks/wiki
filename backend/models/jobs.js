import { DateTime } from 'luxon'
import { jobSchedule as jobScheduleTable, jobLock as jobLockTable } from '../db/schema.js'

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
}

export const jobs = new Jobs()
