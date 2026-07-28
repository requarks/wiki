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
 * @param {object|(() => object)} source Either a plain `{ title }` / `{ titleTemplate }` object, or
 *   a getter returning one -- pass a getter when the title depends on reactive state, since a plain
 *   object is read once at call time.
 */
export function useMeta(source) {
  const entry = {}
  stack.push(entry)

  if (typeof source === 'function') {
    watchEffect(() => {
      Object.assign(entry, source())
      apply()
    })
  } else {
    Object.assign(entry, source)
    apply()
  }

  onScopeDispose(() => {
    const idx = stack.indexOf(entry)
    if (idx >= 0) {
      stack.splice(idx, 1)
    }
    apply()
  })
}
