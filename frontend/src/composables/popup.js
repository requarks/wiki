import { inject } from 'vue'

/**
 * Dismissing the popup you are inside.
 *
 * Replaces the `v-close-popup` directive, which found the nearest popup by walking up for a
 * framework instance. A component rendered inside a `WMenu` injects this instead; outside one it
 * resolves to a no-op, so a component usable in either place needs no guard of its own.
 */
export const POPUP_CLOSE = Symbol.for('w-popup-close')

/** @returns {() => void} Closes the enclosing popup, or does nothing when there is not one. */
export function useClosePopup() {
  return inject(POPUP_CLOSE, () => {})
}
