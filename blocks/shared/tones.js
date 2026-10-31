/**
 * The colours a block may be tinted with, by name, as the CSS that paints them.
 *
 * The theme's own palette rather than fixed values: `--q-*` are rewritten at runtime for each site's
 * theme (see `css/tailwind.css`), so a `positive` badge is that site's positive. `grey` is the one
 * with no theme counterpart, for a label that should not draw the eye.
 *
 * A block declares the names as a `select` prop and hands the value here; anything else -- a typo, a
 * value from a newer version of the block -- falls back to the primary colour rather than to nothing.
 */
const TONES = {
  primary: 'var(--q-primary, #1976d2)',
  positive: 'var(--q-positive, #02c39a)',
  negative: 'var(--q-negative, #f03a47)',
  warning: 'var(--q-warning, #f99d4d)',
  info: 'var(--q-info, #3e6990)',
  grey: '#78909c'
}

/**
 * @param {string} name A tone's name, as an author wrote it.
 * @returns {string} A CSS colour.
 */
export function toneColor(name) {
  return TONES[name] ?? TONES.primary
}
