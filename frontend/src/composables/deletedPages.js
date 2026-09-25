import { defineAsyncComponent } from 'vue'
import { useI18n } from 'vue-i18n'

import { confirm, dialog } from '@/composables/dialog'
import { loading } from '@/composables/loading'
import { notify } from '@/composables/notify'
import { apiErrorMessage } from '@/helpers/apiError'
import { renderVersionSource } from '@/helpers/pageVersions'

import { useEditorStore } from '@/stores/editor'
import { useSiteStore } from '@/stores/site'

/**
 * Bringing a page back out of the recycle bin.
 *
 * Shared by the two places that offer it -- the file manager's Recycle Bin, and the version view a
 * bin entry opens in -- because the flow is the same from both and has more to it than a request: the
 * page's HTML has to be rendered here first (a version records the source and never the render), and
 * a path that has been taken since the page went has to become a question about where else to put it.
 *
 * Call it during `setup()`, like any composable: it reads the i18n catalogue and the stores.
 *
 * @returns {{ restoreDeletedPage: (version: object) => Promise<object | null> }}
 */
export function useDeletedPages() {
  const { t } = useI18n()
  const editorStore = useEditorStore()
  const siteStore = useSiteStore()

  async function renderFor(version, pagePath) {
    // -> Configured per site, and the configuration arrives with the editor configs
    if (!editorStore.configIsLoaded) {
      await editorStore.fetchConfigs()
    }
    return renderVersionSource(version, {
      markdownConfig: editorStore.editors.markdown,
      asciidocConfig: editorStore.editors.asciidoc,
      pagePath
    })
  }

  function deletedOn(version) {
    return version.versionDate
      ? Temporal.Instant.from(version.versionDate).toLocaleString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })
      : ''
  }

  /**
   * Ask where the page should go instead, in the same tree picker a duplicate or a move uses.
   *
   * @returns {Promise<{ path: string, title: string, locale: string } | null>} Null when dismissed.
   */
  function pickDestination(version, path, locale) {
    return new Promise((resolve) => {
      dialog({
        component: defineAsyncComponent(() => import('@/components/TreeBrowserDialog.vue')),
        componentProps: {
          mode: 'restorePage',
          itemId: version.pageId,
          itemTitle: version.title,
          itemFileName: path,
          locale
        }
      })
        .onOk(resolve)
        .onCancel(() => resolve(null))
    })
  }

  /**
   * One attempt at the request, somewhere in particular.
   *
   * @returns {Promise<{ page?: object, conflict?: string }>} `conflict` is the server's error name for
   *   the two refusals the caller has an answer to; anything else is thrown.
   */
  async function attempt(version, { path, locale, title }) {
    loading.show()
    try {
      const resp = await API_CLIENT.post(`sites/${siteStore.id}/pages/${version.pageId}/restore`, {
        json: {
          versionId: version.id,
          // -> Rendered for where it is going: a relative link or image resolves against that path
          render: await renderFor(version, path),
          path,
          locale,
          ...(title ? { title } : {})
        }
      }).json()
      // -> The API client does not throw on 400, so a refused path comes back as a parsed error
      if (resp?.ok === false || !resp?.page?.id) {
        throw new Error(resp?.message || 'An unexpected error occured.')
      }
      return { page: resp.page }
    } catch (err) {
      if (['pageDuplicatePath', 'pageRestoreStale'].includes(err?.data?.error)) {
        return { conflict: err.data.error }
      }
      throw err
    } finally {
      loading.hide()
    }
  }

  /**
   * Restore a deleted page: confirm, then put it back where it was -- or, when another page has taken
   * that path since, wherever the reader picks instead.
   *
   * @param {object} version The version recording the deletion, WITH its `content`, as
   *   `GET /sites/:siteId/versions/:versionId` answers for a page in the bin: `pagePath` and
   *   `pageLocale` are where it was.
   * @returns {Promise<object | null | 'stale'>} The restored page; null when the reader backed out or
   *   it failed (already reported); `stale` when the bin changed underneath, which the caller answers
   *   by reloading whatever it listed.
   */
  function restoreDeletedPage(version) {
    return new Promise((resolve) => {
      confirm({
        title: t('history.restore'),
        message: [
          t('history.restoreDeletedConfirm', {
            path: version.pagePath,
            date: deletedOn(version)
          }),
          t('history.restoreDeletedConfirmHint')
        ],
        cancel: true,
        okLabel: t('history.restore')
      })
        .onOk(async () => {
          let target = { path: version.pagePath, locale: version.pageLocale }
          try {
            for (;;) {
              const result = await attempt(version, target)
              if (result.page) {
                notify({ type: 'positive', message: t('fileman.restoreSuccess') })
                resolve(result.page)
                return
              }
              if (result.conflict === 'pageRestoreStale') {
                notify({ type: 'warning', message: t('fileman.restoreStale') })
                resolve('stale')
                return
              }
              // -> The path is taken. Asked again for as long as the answer is a taken path too
              notify({
                type: 'warning',
                message: t('fileman.restorePathTaken', { path: target.path })
              })
              const picked = await pickDestination(version, target.path, target.locale)
              if (!picked) {
                resolve(null)
                return
              }
              target = picked
            }
          } catch (err) {
            notify({
              type: 'negative',
              message: t('fileman.restoreFailed'),
              caption: apiErrorMessage(err)
            })
            resolve(null)
          }
        })
        .onCancel(() => resolve(null))
    })
  }

  return { restoreDeletedPage }
}
