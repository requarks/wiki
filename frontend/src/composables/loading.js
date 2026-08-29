import { reactive, ref } from 'vue'

/**
 * Full-screen blocking loading overlay.
 *
 * Module singleton, rendered by `<w-loading-overlay>` in App.vue. Only `show()` / `hide()` are
 * provided, which is all the app ever called.
 */

/** Whether the overlay is on screen. Note this goes true only after the delay, not on `show()`. */
export const isActive = ref(false)

/**
 * What the overlay says under its spinner. Every call site already passes a message -- "Signing
 * in...", "Installing extension...", "Login Successful! Redirecting..." -- and for a step that ends
 * in a redirect rather than in a screen, that line IS the confirmation the reader gets.
 *
 * Deliberately not cleared by `hide()`: the overlay fades out over 200ms, and blanking the text as
 * the fade starts empties the box before it goes. `show()` overwrites both fields anyway.
 */
export const content = reactive({
  message: '',
  caption: ''
})

/**
 * Matches the `loading: { delay: 500 }` the app previously configured. Operations that finish
 * inside the window show nothing at all -- without the delay, every fast request would produce a
 * visible spinner flash where there used to be none.
 */
const DELAY = 500

let timer = null

export const loading = {
  /**
   * Show the overlay, or -- when it is already showing or pending -- change what it says.
   *
   * The second case is not a corner: a login shows "Signing in...", and the answer to it turns the
   * same overlay into "Login Successful! Redirecting...". So a repeat call updates the text rather
   * than being dropped, and it does not re-arm a pending timer either, since the wait belongs to the
   * operation that started it and not to the latest thing said about it.
   *
   * @param message The line under the spinner
   * @param caption A second, quieter line under that
   * @param delay How long to wait before appearing, in ms. Zero is for a message that is the whole
   *   point of the overlay rather than an apology for a slow request -- there is nothing to avoid
   *   flashing when the text is the answer.
   */
  show({ message = '', caption = '', delay = DELAY } = {}) {
    content.message = message
    content.caption = caption
    if (isActive.value) {
      return
    }
    if (delay > 0 && timer !== null) {
      return
    }
    if (delay > 0) {
      timer = setTimeout(() => {
        timer = null
        isActive.value = true
      }, delay)
      return
    }
    // -> Cancels the pending wait as well: asked for immediately, it appears immediately
    clearTimeout(timer)
    timer = null
    isActive.value = true
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
