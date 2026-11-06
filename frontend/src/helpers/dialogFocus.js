/**
 * Shared state and lookups for `WDialog`'s keyboard handling. Module-level because every dialog
 * instance has to see the same stack.
 */

/**
 * The dialogs open right now, bottom first, one token per `WDialog` instance. Lets a dialog tell
 * whether it is the one on top -- only that one answers Escape.
 */
export const openDialogStack = []

/** Whether `token` is the dialog on top. */
export function isTopDialog(token) {
  return openDialogStack.at(-1) === token
}

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]'
].join(',')

/** What Tab can land on inside `root`, in document order; controls not rendered are skipped. */
export function tabbableIn(root) {
  return [...root.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length > 0)
}
