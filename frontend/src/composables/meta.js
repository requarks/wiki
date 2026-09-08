import { onScopeDispose, watchEffect } from 'vue'

/**
 * Document title management.
 *
 * Replaces the meta plugin with just the part the app used: a `title` set by pages, and a
 * `titleTemplate` set by layouts that wraps it (e.g. `title => \`${title} - Wiki.js\``).
 *
 * Registrations form a stack in mount order. The effective title is the most recently registered
 * `title`, and the effective template the most recently registered `titleTemplate` -- so a layout
 * mounting first and a page mounting second combine the way the component tree implies, without
 * needing to model provide/inject.
 *
 * The full meta plugin also handled arbitrary <meta>/<link>/<script> tags. Nothing in the app used
 * those, so they are deliberately not reimplemented.
 */

/** @type {Array<{ title?: string, titleTemplate?: (t: string) => string }>} */
const stack = []

function apply() {
  let title
  let template
  for (const entry of stack) {
    if (entry.title !== undefined) {
      title = entry.title
    }
    if (entry.titleTemplate !== undefined) {
      template = entry.titleTemplate
    }
  }
  if (title === undefined) {
    return
  }
  document.title = template ? template(title) : title
}

/**
 * @param {() => object} source A getter returning `{ title }` / `{ titleTemplate }`, re-read
 *   whenever anything it touched changes.
 *
 *   A getter and not a plain object, because every caller reads reactive state that is not
 *   necessarily there yet: the locale strings are fetched after the app mounts (`App.vue` ->
 *   `applyLocale`) and the site config with them, so a `t()` or a `siteStore.title` evaluated once
 *   during `setup()` resolves to a raw translation key on a page loaded directly, and nothing would
 *   ever come back to correct it. Read inside the effect, the tab title fixes itself the moment
 *   `setLocaleMessage` fills the strings in.
 */
export function useMeta(source) {
  const entry = {}
  stack.push(entry)

  watchEffect(() => {
    Object.assign(entry, source())
    apply()
  })

  onScopeDispose(() => {
    const idx = stack.indexOf(entry)
    if (idx >= 0) {
      stack.splice(idx, 1)
    }
    apply()
  })
}
