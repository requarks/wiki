/**
 * The maintenance actions of the admin area's utilities view.
 *
 * Both of them act on things that are an instance's own: the websockets it is holding, the memory it
 * has filled and the cache directory it has written. Nothing about either is stored anywhere, so
 * neither can be carried out on another instance's behalf — which is why each is published on the
 * event bus and every instance runs the same function when it hears it.
 *
 * That makes the acknowledgement local by nature. The route that starts one answers for the instance
 * that ran it and says that the others were told; an instance acting on the event has nobody to
 * report back to. There is no registry of instances either (see `api/system.ts`), so there is nothing
 * to wait for a complete answer from in the first place.
 */
export default {
  /**
   * Close every websocket this instance is holding.
   *
   * Whichever controller opened it: live collaborative editing (`controllers/collab.ts`) and the admin
   * terminal's log stream (`controllers/terminal.ts`) both take their sockets from the same upgrade
   * handler, and this is deliberately "all of them" rather than "the ones a given feature knows
   * about".
   *
   * Closing is not a refusal. Both controllers turn a session away with a code in the private 4000
   * range, which is how their clients know not to try again; this uses 1012, an ordinary drop, so an
   * editor reconnects on its own and rejoins the room it was in. Unsaved text survives that for as
   * long as somebody else is still in the room — and a room whose last participant is on their way
   * back is the same race a network blip already produces, which the seeding in `core/collab.ts` is
   * built to survive.
   *
   * @returns How many open connections were closed.
   */
  disconnectWebsockets(): number {
    let count = 0
    for (const client of WIKI.app.websocketServer.clients) {
      if (client.readyState !== client.OPEN) {
        continue
      }
      client.close(1012, 'Disconnected by an administrator')
      count++
    }
    WIKI.logger.info(`Closed ${count} websocket connection(s) [ OK ]`)
    return count
  },

  /**
   * Throw away everything this instance holds that the database is the real copy of.
   *
   * The file and icon caches, in memory and on disk, and the site, group, page rule and locale state
   * that answers every request. Nothing is lost and nothing is turned off: what the caches held is
   * read back from the database as it is asked for again, and the four reloaded here are refilled
   * before this returns rather than left for the next visitor to pay for.
   */
  async flushCaches(): Promise<void> {
    WIKI.cache.flushAll()
    await WIKI.models.assets.purgeCache()
    await WIKI.models.icons.purgeCache()

    await WIKI.models.locales.reloadCache()
    await WIKI.models.sites.reloadCache()
    await WIKI.models.groups.reloadCache()
    await WIKI.models.approvals.reloadCache()

    WIKI.logger.info('Flushed all caches [ OK ]')
  },

  /**
   * Subscribe to HA propagation events
   */
  subscribeToEvents(): void {
    WIKI.events.inbound.on('disconnectWebsockets', () => {
      this.disconnectWebsockets()
    })
    WIKI.events.inbound.on('flushCaches', async () => {
      await this.flushCaches()
    })
    // -> The locale list is cached per instance, so an install or an update on one of them is only
    //    visible everywhere once the others read it back
    WIKI.events.inbound.on('reloadLocales', async () => {
      await WIKI.models.locales.reloadCache()
    })
  }
}
