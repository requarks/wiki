import { getCurrentInstance, markRaw, nextTick, onMounted, reactive, ref } from 'vue'

import WConfirmDialog from '@/components/shared/WConfirmDialog.vue'

/**
 * Programmatic dialogs.
 *
 * Two halves:
 *   - `dialog({ component, componentProps })` -- opens a dialog from anywhere, returning a
 *     chainable `.onOk() / .onCancel() / .onDismiss()` handle.
 *   - `useDialogComponent()` -- called *inside* the dialog component to drive its own lifecycle.
 *
 * Only the `component` + `componentProps` form is supported. The library this replaces also offered
 * built-in title/message/prompt dialogs, but the app never used them: every one of the 51 call
 * sites passes a component.
 */

/** @type {Array<{ id: number, component: object, props: object, handlers: object }>} */
export const openDialogs = reactive([])

let seq = 0

/**
 * Open a dialog.
 *
 * @param {object} opts
 * @param {object} opts.component The dialog component to mount.
 * @param {object} [opts.componentProps] Props passed through to it.
 * @returns {{ onOk: Function, onCancel: Function, onDismiss: Function }} Chainable handle.
 */
export function dialog({ component, componentProps = {} }) {
  const id = ++seq
  const handlers = { ok: [], cancel: [], dismiss: [] }

  openDialogs.push({
    id,
    // -> A component definition is deeply-nested config, never reactive data; markRaw keeps Vue
    //    from walking it and avoids the "component was made reactive" warning
    component: markRaw(component),
    props: componentProps,
    handlers
  })

  const chain = {
    onOk(cb) {
      handlers.ok.push(cb)
      return chain
    },
    onCancel(cb) {
      handlers.cancel.push(cb)
      return chain
    },
    onDismiss(cb) {
      handlers.dismiss.push(cb)
      return chain
    }
  }
  return chain
}

/**
 * Resolve a dialog and unmount it. Called by `<w-dialog-host>`.
 *
 * @param {number} id
 * @param {boolean} okFired Whether the dialog emitted `ok` before closing.
 * @param {*} payload Value passed to `onDialogOK()`.
 */
export function closeDialog(id, okFired, payload) {
  const idx = openDialogs.findIndex((d) => d.id === id)
  if (idx < 0) {
    return
  }
  const { handlers } = openDialogs[idx]
  openDialogs.splice(idx, 1)

  // -> `cancel` fires only when the dialog closed without confirming, matching the previous
  //    behaviour where dismissing via backdrop/escape counted as a cancel
  if (okFired) {
    handlers.ok.forEach((cb) => cb(payload))
  } else {
    handlers.cancel.forEach((cb) => cb())
  }
  handlers.dismiss.forEach((cb) => cb())
}

/**
 * Open a confirmation (or a small radio prompt), without the caller writing a component for it.
 *
 * Same chainable handle as `dialog()`. `onOk` receives `true` for a plain confirmation, or the
 * chosen value when `options` is given.
 *
 * @param {object} opts `{ title, message, cancel, okLabel, cancelLabel, color, persistent, options }`
 * @returns {{ onOk: Function, onCancel: Function, onDismiss: Function }}
 */
export function confirm(opts = {}) {
  return dialog({ component: WConfirmDialog, componentProps: opts })
}

/** Events a dialog component must declare. Spread into `defineEmits()`. */
export const dialogComponentEmits = ['ok', 'hide']

/**
 * Drives a dialog component's own lifecycle. Use as the root of a component opened via `dialog()`:
 *
 *   const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent()
 *
 * and bind `v-model` / `@hide` on the root `<w-dialog>`.
 */
export function useDialogComponent() {
  const { emit } = getCurrentInstance()
  const dialogVisible = ref(false)

  // -> Mount hidden then flip on the next tick, so the open transition actually runs; mounting with
  //    `true` would snap the dialog into place with no animation
  onMounted(() =>
    nextTick(() => {
      dialogVisible.value = true
    })
  )

  return {
    dialogVisible,

    /** Confirm: notifies `.onOk()` subscribers, then closes. */
    onDialogOK(payload) {
      emit('ok', payload)
      dialogVisible.value = false
    },

    /** Dismiss without confirming. */
    onDialogCancel() {
      dialogVisible.value = false
    },

    /** Bind to the root dialog's `@hide`; fires once the close transition has finished. */
    onDialogHide() {
      emit('hide')
    }
  }
}

/** Composable-style accessor, for symmetry with the other `use*` helpers. */
export function useDialog() {
  return dialog
}
