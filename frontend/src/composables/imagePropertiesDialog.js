import { defineAsyncComponent, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { dialog } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { FILES_PREFIX, assetPath } from '@/helpers/assets'
import { fileSrc } from '@/renderers/shared'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

/**
 * The Image Properties dialog, and the trip to the file manager and back that its browse button
 * makes -- for any editor that offers it, whatever "an image" means to that editor.
 *
 * `found` is the editor's own handle on the image the dialog is over, carried through untouched and
 * handed to `apply` along with the answer: a source range in the Markdown and AsciiDoc editors, a node
 * position in the Visual one.
 *
 * Call it during `setup`, since it watches the overlay. Then `open()` the dialog, and call
 * `takePick()` first thing in the editor's `insertAsset` handler.
 *
 * @param {object} opts
 * @param {(found: any, values: object) => void} opts.apply Write the dialog's answer over the image.
 */
export function useImagePropertiesDialog({ apply }) {
  const { t } = useI18n()
  const pageStore = usePageStore()
  const siteStore = useSiteStore()

  /**
   * A dialog that handed off to the file manager, waiting to be opened again: the image it was over,
   * and what had been filled in. See `browse`.
   */
  let pending = null

  /**
   * @param {any} found The editor's handle on the image.
   * @param {object} values What the dialog opens on -- see `ImagePropertiesDialog`'s props.
   */
  function open(found, values) {
    dialog({
      component: defineAsyncComponent(() => import('@/components/ImagePropertiesDialog.vue')),
      componentProps: { ...values, pagePath: pageStore.path }
    }).onOk(({ browse: wantsBrowse, ...answer }) => {
      if (wantsBrowse) {
        browse(found, { ...values, ...answer })
      } else {
        apply(found, answer)
      }
    })
  }

  /**
   * The dialog's browse button: the file manager, with the dialog put aside until it closes.
   *
   * A hand-off rather than the overlay opening over the dialog. Both are `w-dialog`s, and a dialog
   * left open underneath keeps its Escape listener -- one press in the file manager would dismiss the
   * dialog the author was coming back to. So the dialog has already closed, handing over what was
   * filled in, and the overlay watcher below opens it again with whatever the file manager answered.
   */
  function browse(found, values) {
    pending = { found, values }
    siteStore.openFileManager({ insertMode: true, folderPath: folderOf(values.src) })
  }

  /**
   * The folder an image's address points into, for the file manager to open on -- so that picking a
   * different picture starts beside the one being replaced.
   *
   * Resolved the way the renderer resolves it (`fileSrc`), so an address relative to the page, one
   * from the site root and a `/_files/` URL all land on the same folder. Null for anything that is not
   * one of this wiki's files -- an external URL, an empty field -- which leaves the manager on its own
   * default; empty for a file at the site root, which is a folder like any other.
   */
  function folderOf(src) {
    const resolved = fileSrc(String(src ?? '').trim(), pageStore.path)
    if (!resolved?.startsWith(FILES_PREFIX)) {
      return null
    }
    const path = resolved.slice(FILES_PREFIX.length).split(/[?#]/)[0]
    try {
      return decodeURIComponent(path).split('/').slice(0, -1).join('/')
    } catch {
      // -> A stray `%` that is not an escape: not a path this can say anything about
      return null
    }
  }

  /**
   * The file manager's answer, if a dialog is waiting on one -- in which case it is the dialog's and
   * not the cursor's, and the editor must not insert it. Answers whether it was taken.
   *
   * Anything but a picture is refused, as the Visual editor's Replace does: an image pointed at a PDF
   * is a broken image. The alt text follows the file only where the author had not written one.
   */
  function takePick(opts) {
    if (!pending) {
      return false
    }
    if (opts.type !== 'asset' || !opts.mimeType?.startsWith('image/')) {
      notify({ type: 'warning', message: t('editor.visual.image.replaceNotImage') })
      return true
    }
    pending.values.src = assetPath(opts.folderPath, opts.fileName)
    pending.values.alt ||= opts.title ?? ''
    return true
  }

  /*
    The file manager closing, picked or not, is what brings the dialog back. Waiting for it rather than
    reopening from the pick is what keeps the dialog from opening underneath an overlay still on its way
    out.
  */
  watch(
    () => siteStore.overlay,
    (overlay) => {
      if (!overlay && pending) {
        const { found, values } = pending
        pending = null
        open(found, values)
      }
    }
  )

  return { open, takePick }
}
