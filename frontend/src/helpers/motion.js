/**
 * Whether motion should be reduced: because the operating system says so, or because the reader
 * turned on Reduce Motion in their profile, which `App.vue` records as a class on <body>.
 *
 * For motion decided in JavaScript, which neither half of the stylesheet side reaches -- a scroll
 * asked for with `behavior: 'smooth'` animates whatever `prefers-reduced-motion` says.
 */
export function prefersReducedMotion() {
  return (
    document.body.classList.contains('body--reduce-motion') ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** The `behavior` for a `scrollTo()` / `scrollIntoView()` that would otherwise be smooth. */
export function scrollBehavior() {
  return prefersReducedMotion() ? 'auto' : 'smooth'
}
