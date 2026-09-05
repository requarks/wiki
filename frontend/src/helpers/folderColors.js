/**
 * The colours a folder can be given in the file manager.
 *
 * Stored and applied as a HUE ROTATION rather than as a colour: the folder icon is a single yellow
 * image that every tree and listing draws, and turning it around the colour wheel is what recolours
 * it — so the set below is a set of angles, and zero is the icon left alone. That also means a wiki
 * that swaps the icon for one of its own keeps every folder's choice meaningful, where a stored
 * `#e6a817` would not.
 *
 * Ten of them, one every 36 degrees: an even sweep of the wheel that is also two full rows of five.
 *
 * The names are what each angle actually renders as, which is not quite what the arithmetic suggests:
 * the CSS filter is a matrix approximation over RGB rather than a rotation in HSL.
 */
export const FOLDER_COLORS = [
  { hue: 0, name: 'Yellow' },
  { hue: 36, name: 'Lime' },
  { hue: 72, name: 'Green' },
  { hue: 108, name: 'Turquoise' },
  { hue: 144, name: 'Cyan' },
  { hue: 180, name: 'Blue' },
  { hue: 216, name: 'Violet' },
  { hue: 252, name: 'Magenta' },
  { hue: 288, name: 'Pink' },
  { hue: 324, name: 'Orange' }
]

/**
 * The CSS filter that paints a folder icon its colour.
 *
 * @param {number} [hue] Degrees around the colour wheel. Absent or zero for the colour every folder
 *                       starts out, which is no filter at all rather than a rotation of nothing —
 *                       `filter` creates a containing block and a compositing layer, and a listing
 *                       of a hundred untouched folders should pay for neither.
 * @returns {string|undefined} A `filter` value, or undefined to leave the icon alone.
 */
export function folderHueFilter(hue) {
  return hue ? `hue-rotate(${hue}deg)` : undefined
}

/**
 * The same thing as a style binding, which is how every tree and listing applies it.
 *
 * @param {number} [hue] Degrees around the colour wheel.
 * @returns {object|undefined} A style object, or undefined to bind nothing at all.
 */
export function folderIconStyle(hue) {
  const filter = folderHueFilter(hue)
  return filter ? { filter } : undefined
}
