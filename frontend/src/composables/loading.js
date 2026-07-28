import { ref } from 'vue'

/**
 * Full-screen blocking loading overlay.
 *
 * Module singleton, rendered by `<w-loading-overlay>` in App.vue. Only `show()` / `hide()` are
 * provided, which is all the app ever called.
 */

/** Whether the overlay is on screen. Note this goes true only after DELAY, not on `show()`. */
export const isActive = ref(false)

/**
 * Matches the `loading: { delay: 500 }` the app previously configured. Operations that finish
 * inside the window show nothing at all -- without the delay, every fast request would produce a
 * visible spinner flash where there used to be none.
 */
const DELAY = 500

let timer = null

export const loading = {
  show() {
    if (timer !== null || isActive.value) {
      return
    }
    timer = setTimeout(() => {
      timer = null
      isActive.value = true
    }, DELAY)
  },

  hide() {
    // -> Cancels a pending show as well as dismissing a visible overlay
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    isActive.value = false
  }
}

/** Composable-style accessor, for symmetry with the other `use*` helpers. */
export function useLoading() {
  return loading
}
