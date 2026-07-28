import { computed, reactive, ref } from 'vue'

/**
 * Dark mode.
 *
 * The single source of truth is the `body--dark` / `body--light` class on <body>, which is what
 * `css/tailwind.css` keys the `dark:` variant off. A module-level ref mirrors it so Vue can react:
 * a class on an element outside the app is not reactive by itself, and every caller has to see the
 * same value.
 *
 * `reactive` rather than a plain object holding a ref, so `dark.isActive` is the BOOLEAN in a
 * template as well as in script. Vue only auto-unwraps refs bound at the top level of `setup`; a
 * ref reached through a property stays a ref object -- and a ref object is always truthy, so
 * `dark.isActive ? a : b` in a template silently took the same branch for ever.
 */

/** Seeded from the DOM, so a class set before the app booted is not lost. */
const active = ref(
  typeof document !== 'undefined' && document.body.classList.contains('body--dark')
)

function apply(value) {
  active.value = value === true
  document.body.classList.toggle('body--dark', active.value)
  document.body.classList.toggle('body--light', !active.value)
}

export function useDark() {
  const isActive = computed(() => active.value)

  return reactive({
    /** @type {boolean} */
    isActive,

    /** @param {boolean} value */
    set(value) {
      apply(value)
    },

    toggle() {
      apply(!active.value)
    }
  })
}
