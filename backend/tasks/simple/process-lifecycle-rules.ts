import type { TaskContext } from '../../core/scheduler.ts'

/*
  In-process rather than in a worker thread: what a rule does is move pages, retag them and notify
  people, which needs the models a worker's minimal `WIKI` does not have — and none of it is CPU work.
*/
export async function task(_payload: unknown, { signal }: TaskContext): Promise<void> {
  WIKI.logger.info('Processing page lifecycle rules...')

  try {
    const { checked, fired } = await WIKI.models.pageLifecycle.runDue({ signal })

    WIKI.logger.info(`Checked ${checked} lifecycle rule(s), ${fired} fired: [ COMPLETED ]`)
  } catch (err: any) {
    WIKI.logger.error('Processing page lifecycle rules: [ FAILED ]')
    WIKI.logger.error(err.message)
    throw err
  }
}
