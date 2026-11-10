import { Plugin } from 'prosemirror-state'

/**
 * Keeping the selection when focus is handed back to the editor.
 *
 * Every dialog and overlay opened from the editor gives focus back to it on closing (`WDialog`'s
 * `restoreFocus`), by calling `focus()` on the editable. The browser's selection is in the dialog's
 * fields by then, and Chrome answers a `focus()` from outside by putting the caret at the start of the
 * editable -- which ProseMirror then reads back as where the author put it.
 *
 * ProseMirror does undo that reset, but only when the caret lands exactly on `Selection.near(0)`. A
 * page that opens on a node no caret can stand before -- a block such as an infobox, or a table --
 * puts it somewhere else, and the reset went through: the image the Image Properties dialog was over
 * was no longer selected, so Apply wrote nothing (requarks/wiki#8239), and anything else answered at
 * the selection -- the file manager's pick, the link picker's -- went in at the top of the page.
 *
 * So focus arriving from outside writes the editor's own selection back into the DOM. On a microtask:
 * the browser's `selectionchange` is a task, so this lands first and ProseMirror finds the DOM already
 * agreeing with it. Not for focus that comes with a pointer -- the author clicking into the page means
 * the caret to go where they clicked.
 */
export function keepSelectionOnFocus() {
  /** When the author last pressed on the editor, which is what makes a focus their click. */
  let pointerAt = 0

  return new Plugin({
    view(editorView) {
      /*
        On the document rather than on the editable: a click beside or below the text lands on the
        pane around it -- or on `<html>`, below a short page -- and Chrome still puts the caret in the
        page and focuses it. So a press counts if it is in the surface the editor is mounted into, or on
        something the editor is inside. A dialog's buttons and its backdrop are neither, which is what
        keeps the press on Apply from counting as the author's click.
      */
      const onPointer = (ev) => {
        const surface = editorView.dom.parentNode
        if (surface?.contains(ev.target) || ev.target?.contains?.(editorView.dom)) {
          pointerAt = Date.now()
        }
      }
      document.addEventListener('pointerdown', onPointer, true)
      document.addEventListener('pointerup', onPointer, true)
      return {
        destroy() {
          document.removeEventListener('pointerdown', onPointer, true)
          document.removeEventListener('pointerup', onPointer, true)
        }
      }
    },
    props: {
      handleDOMEvents: {
        focus(view) {
          if (Date.now() - pointerAt > 500) {
            queueMicrotask(() => {
              if (!view.isDestroyed && view.hasFocus()) {
                view.focus()
              }
            })
          }
          return false
        }
      }
    }
  })
}
