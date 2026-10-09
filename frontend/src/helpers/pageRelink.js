import { notify } from '@/composables/notify'

/**
 * Tell the mover what became of the pages linking to a page they just moved.
 *
 * Shared by the two places a page is moved from (the page view's action rail and the file manager),
 * which open the same dialog and get the same `relinked` back from `pageStore.pageMove`.
 *
 * A move that fixed everything says so in one line; one that could not fix every page says which,
 * and stays on screen until dismissed, because those pages are now links to nowhere that somebody
 * has to go and repair by hand.
 *
 * The glossary terms the page documented are reported on the same terms: following it is good news,
 * and losing it (a move to another locale) is something to go and fix, so that one stays.
 *
 * @param {{ updated: number, skippedCount: number, skipped: { title: string }[], glossary?: { updated: number, cleared: number } } | null} relinked
 * @param {Function} t The caller's `t` from `useI18n`
 */
export function notifyRelinked(relinked, t) {
  if (!relinked) {
    return
  }
  if (relinked.updated > 0) {
    notify({
      type: 'positive',
      message: t('pageRenameDialog.updateLinksDone', { count: relinked.updated })
    })
  }
  if (relinked.skippedCount > 0) {
    notify({
      type: 'warning',
      message: t('pageRenameDialog.updateLinksSkipped', {
        count: relinked.skippedCount,
        // -> Only the pages the server would name to this reader; the count covers the rest
        pages: relinked.skipped.map((page) => page.title).join(', ') || '—'
      }),
      timeout: 0
    })
  }
  if (relinked.glossary?.updated > 0) {
    notify({
      type: 'positive',
      message: t('pageRenameDialog.updateLinksGlossary', { count: relinked.glossary.updated })
    })
  }
  if (relinked.glossary?.cleared > 0) {
    notify({
      type: 'warning',
      message: t('pageRenameDialog.updateLinksGlossaryCleared', {
        count: relinked.glossary.cleared
      }),
      timeout: 0
    })
  }
}
