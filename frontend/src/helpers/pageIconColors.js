/**
 * The colors a page icon may be drawn in, keyed by the Tailwind palette name stored on the page
 * (`iconColor`, mirrored by `PAGE_ICON_COLORS` in `backend/models/pages.ts`). Of the greys only
 * `slate` and `gray` are offered.
 *
 * The class names are written out in full rather than assembled from the key, because Tailwind only
 * emits a utility it can find as literal text in a source file — `text-${color}-500` would build and
 * then draw nothing. `text` is for the icon itself, a step lighter on a dark surface; `swatch` is the
 * dot the picker shows beside each name.
 */
export const PAGE_ICON_COLORS = {
  red: { text: 'text-red-500 dark:text-red-400', swatch: 'bg-red-500' },
  orange: { text: 'text-orange-500 dark:text-orange-400', swatch: 'bg-orange-500' },
  amber: { text: 'text-amber-500 dark:text-amber-400', swatch: 'bg-amber-500' },
  yellow: { text: 'text-yellow-500 dark:text-yellow-400', swatch: 'bg-yellow-500' },
  lime: { text: 'text-lime-500 dark:text-lime-400', swatch: 'bg-lime-500' },
  green: { text: 'text-green-500 dark:text-green-400', swatch: 'bg-green-500' },
  emerald: { text: 'text-emerald-500 dark:text-emerald-400', swatch: 'bg-emerald-500' },
  teal: { text: 'text-teal-500 dark:text-teal-400', swatch: 'bg-teal-500' },
  cyan: { text: 'text-cyan-500 dark:text-cyan-400', swatch: 'bg-cyan-500' },
  sky: { text: 'text-sky-500 dark:text-sky-400', swatch: 'bg-sky-500' },
  blue: { text: 'text-blue-500 dark:text-blue-400', swatch: 'bg-blue-500' },
  indigo: { text: 'text-indigo-500 dark:text-indigo-400', swatch: 'bg-indigo-500' },
  violet: { text: 'text-violet-500 dark:text-violet-400', swatch: 'bg-violet-500' },
  purple: { text: 'text-purple-500 dark:text-purple-400', swatch: 'bg-purple-500' },
  fuchsia: { text: 'text-fuchsia-500 dark:text-fuchsia-400', swatch: 'bg-fuchsia-500' },
  pink: { text: 'text-pink-500 dark:text-pink-400', swatch: 'bg-pink-500' },
  rose: { text: 'text-rose-500 dark:text-rose-400', swatch: 'bg-rose-500' },
  slate: { text: 'text-slate-500 dark:text-slate-400', swatch: 'bg-slate-500' },
  gray: { text: 'text-gray-500 dark:text-gray-400', swatch: 'bg-gray-500' }
}

/**
 * The class a page icon is drawn with: its own color, or the site's primary color when it has none.
 *
 * Only an icon that paints with `currentColor` takes it — a multicolor Iconify icon keeps its own
 * colors, and an `img:` icon is a picture.
 *
 * @param {string} color The page's `iconColor`.
 * @returns {string}
 */
export function pageIconColorClass(color) {
  return PAGE_ICON_COLORS[color]?.text ?? 'text-primary'
}

/**
 * The page's color as a CSS value, for what is drawn in it other than through a class — the tint in
 * the page header (`--page-header-tint` in `css/_page-chrome.scss`). Null for a page with none.
 *
 * A variable reference may be assembled where a class name may not: Tailwind emits the theme variable
 * `--color-<name>-500` because the `text-<name>-500` utility above uses it.
 *
 * @param {string} color The page's `iconColor`.
 * @returns {string|null}
 */
export function pageIconColorValue(color) {
  return PAGE_ICON_COLORS[color] ? `var(--color-${color}-500)` : null
}

/**
 * The page's color as a palette token, for a component that fills a surface with it through its
 * `color` prop (`w-avatar` behind a white icon): its own color, or the site's primary color when it
 * has none. The 500 step in both themes, since it is a background under white rather than ink on the
 * page.
 *
 * @param {string} color The page's `iconColor`.
 * @returns {string}
 */
export function pageIconColorToken(color) {
  return PAGE_ICON_COLORS[color] ? `${color}-500` : 'primary'
}
