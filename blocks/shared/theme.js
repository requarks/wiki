/**
 * Dark mode, for blocks.
 *
 * The app keeps one source of truth for the theme: a `body--dark` / `body--light` class on <body>,
 * set by `frontend/src/composables/dark.js`. CSS inside a shadow root cannot see it. `:host-context()`
 * is exactly the selector for that job and every block here used to key its dark mode off it -- but
 * only Chromium ever shipped it. MDN has it deprecated, Firefox and Safari have never implemented it,
 * and in an unsupported browser the rule simply never matches, so a block stayed light on a dark page
 * with nothing to show that anything had gone wrong.
 *
 * So the class is read in JS instead and pushed into the blocks that ask for it. One observer serves
 * the whole page however many blocks are on it, and stops again once the last of them has gone.
 */

/** @type {Set<(dark: boolean) => void>} */
const watchers = new Set()
let observer = null

/**
 * Whether the app is in dark mode at this moment.
 */
export function isDark() {
  return document.body.classList.contains('body--dark')
}

/**
 * Call `onChange` with the new value whenever the theme changes, until the returned function is
 * called.
 *
 * @param {(dark: boolean) => void} onChange
 * @returns {() => void} stops the watching
 */
export function watchTheme(onChange) {
  watchers.add(onChange)
  if (!observer) {
    observer = new MutationObserver(() => {
      const dark = isDark()
      for (const watcher of watchers) {
        watcher(dark)
      }
    })
    // -> `body--light` is set in the same breath as `body--dark`, so one attribute is all to watch
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
  }
  return () => {
    watchers.delete(onChange)
    // -> Nothing left to tell, so nothing left to listen for
    if (watchers.size < 1) {
      observer?.disconnect()
      observer = null
    }
  }
}

/**
 * A Lit reactive controller that keeps a `dark` attribute on its host in step with the app's theme.
 *
 * A block that only changes colour needs no more than to construct one -- `:host([dark])` in its
 * styles then says everything `:host-context(body.body--dark)` used to, at a specificity one class
 * lower, which is still above the `:host` rule holding the light values. One that has to act on the
 * change rather than restyle for it -- redrawing in a library's own dark theme, say -- passes
 * `onChange`, or reads `isDark` off the controller at the moment it needs it.
 *
 * The attribute is on the host and not on an element inside the shadow root because the host is the
 * one element a block always has. Where the shadow tree is a library's to arrange, an attribute
 * bound in `render()` risks being written over -- see the `data-theme` note in `block-map`.
 */
export class DarkMode {
  /**
   * @param {import('lit').ReactiveElement} host
   * @param {{ attribute?: boolean, onChange?: (dark: boolean) => void }} [options]
   *   `attribute: false` for a block that resolves the theme itself and would find a second answer
   *   sitting on the host misleading. `onChange` is called after the host has been told to update.
   */
  constructor(host, { attribute = true, onChange = null } = {}) {
    this.host = host
    this.isDark = isDark()
    this._attribute = attribute
    this._onChange = onChange
    this._unwatch = null
    host.addController(this)
  }

  hostConnected() {
    this._apply(isDark())
    this._unwatch = watchTheme((dark) => this._apply(dark))
  }

  hostDisconnected() {
    this._unwatch?.()
    this._unwatch = null
  }

  _apply(dark) {
    this.isDark = dark
    if (this._attribute) {
      this.host.toggleAttribute('dark', dark)
    }
    this.host.requestUpdate()
    this._onChange?.(dark)
  }
}
