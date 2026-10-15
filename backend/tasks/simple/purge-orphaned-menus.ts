export async function task(): Promise<void> {
  WIKI.logger.info('Purging orphaned navigation menus...')

  try {
    const purged = await WIKI.models.navigationAutomation.purgeOrphanedMenus()

    WIKI.logger.info(`Purged ${purged} orphaned navigation menus: [ COMPLETED ]`)
  } catch (err: any) {
    WIKI.logger.error('Purging orphaned navigation menus: [ FAILED ]')
    WIKI.logger.error(err.message)
    throw err
  }
}
