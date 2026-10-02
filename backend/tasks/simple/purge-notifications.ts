import type { TaskContext } from '../../core/scheduler.ts'

export async function task(_payload: unknown, { signal }: TaskContext): Promise<void> {
  WIKI.logger.info('Purging expired notifications...')

  try {
    const { notifications, events } = await WIKI.models.notifications.purge(signal)

    WIKI.logger.info(
      `Purged ${notifications} expired notification(s) and ${events} processed event(s): [ COMPLETED ]`
    )
  } catch (err: any) {
    WIKI.logger.error('Purging expired notifications: [ FAILED ]')
    WIKI.logger.error(err.message)
    throw err
  }
}
