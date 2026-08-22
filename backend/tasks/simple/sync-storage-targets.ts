/**
 * Sync every storage target that has a remote to keep in step with, and whose site is due.
 *
 * The git target's schedule, and what makes it a synchronized store rather than a local repository
 * that happens to get committed to. A change is committed the moment it is made — that happens on the
 * request, not here — and this is what pushes those commits and brings back what other people pushed.
 *
 * **This runs every minute; the site's `syncInterval` decides what actually happens.** The interval is
 * a per-site setting, so one schedule cannot express it — the tick is therefore as fine as the
 * shortest interval anybody can ask for, and each site is skipped on the ticks that are not its own.
 *
 * Due-ness is read off the clock rather than off a record of when each target last synced. A site with
 * a five-minute interval syncs on every fifth minute of the epoch, which needs nothing stored, means
 * two instances agree without coordinating, survives a restart, and cannot drift. What it gives up is
 * catching up on a missed tick: an instance that was down at the moment simply waits for the next one,
 * which for something that runs all day is the right trade.
 *
 * Every target is attempted whatever the ones before it did: a site whose credentials have expired
 * must not stop the rest of them syncing. `executeAction` records the outcome on the target itself,
 * so a failure shows up on its Status card in the admin area rather than only in this log.
 *
 * **One instance at a time.** The scheduler hands a job to a single instance, which is the one whose
 * working copy is synced. Every instance in a high-availability set keeps its own, so they each fall
 * in step at their own turn rather than fighting over one repository.
 */
export async function task(): Promise<void> {
  const syncable = await WIKI.models.storage.syncableTargets()
  if (syncable.length < 1) {
    return
  }

  const minute = Math.floor(Temporal.Now.instant().epochMilliseconds / 60_000)
  const targets = syncable.filter((target) => {
    const interval = WIKI.models.storage.syncIntervalFor(target.siteId)
    // -> An interval nothing can be made of is a site that is never synced on a schedule, rather than
    //    one synced every minute. `validateSiteConfig` refuses to store such a value in the first
    //    place, so this is the belt to that braces.
    return interval > 0 && minute % interval === 0
  })
  if (targets.length < 1) {
    return
  }

  // -> A pull creates content, and content records who authored it. There is nobody behind a
  //    scheduled run, so it is recorded against the wiki's own administrator.
  const actorId = await WIKI.models.users.getSystemActorId()
  if (!actorId) {
    WIKI.logger.warn(
      'Syncing storage targets: no active administrator to attribute incoming content to [ SKIPPED ]'
    )
    return
  }

  WIKI.logger.info(`Syncing ${targets.length} storage target(s)...`)
  let failed = 0
  for (const target of targets) {
    try {
      const message = await WIKI.models.storage.executeAction(target, 'sync', actorId)
      WIKI.logger.info(`Synced ${target.title} for site ${target.siteId}: ${message ?? 'done'}`)
    } catch (err: any) {
      failed++
      WIKI.logger.warn(`Could not sync ${target.title} for site ${target.siteId} [ FAILED ]`)
      WIKI.logger.warn(err.message)
    }
  }
  WIKI.logger.info(
    `Syncing storage targets: ${targets.length - failed} of ${targets.length} succeeded [ COMPLETED ]`
  )
}
