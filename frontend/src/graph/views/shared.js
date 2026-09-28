/**
 * Geometry the views have in common.
 */

/** Roughly how wide a character of a label is, in world units at the size the views draw them. */
const CHAR_WIDTH = 6.5

/** Where a node sits in polar coordinates, as the two radial views keep it. Angle 0 is twelve o'clock. */
export function polarToXY(pos) {
  return { x: pos.r * Math.sin(pos.a), y: -pos.r * Math.cos(pos.a) }
}

/**
 * How a label runs out from a node on a radial layout: along the radius, turned over on the left half
 * so that it never reads upside down.
 */
export function radialLabel(pos, isCenter) {
  if (isCenter) {
    return { rotate: 0, side: 0, anchor: 'middle' }
  }
  const degrees = (pos.a * 180) / Math.PI - 90
  // -> Normalised first, since an angle being interpolated between two layouts can leave [0, 2π)
  const turn = ((pos.a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
  return turn > Math.PI
    ? { rotate: degrees + 180, side: -1, anchor: 'end' }
    : { rotate: degrees, side: 1, anchor: 'start' }
}

/**
 * The box everything is drawn in, labels included, for fitting the view to the screen.
 *
 * Labels are measured by character count rather than by the DOM: the layout runs before anything is
 * drawn, and a fit that is out by a few pixels is not worth a synchronous reflow per label.
 *
 * @param {Function} labelEnd Where a label of a given width, run out from a node, ends.
 */
export function boundsOf(root, positions, place, { chars, labelEnd }) {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  const take = ({ x, y }) => {
    x0 = Math.min(x0, x)
    x1 = Math.max(x1, x)
    y0 = Math.min(y0, y)
    y1 = Math.max(y1, y)
  }
  for (const node of root.descendants()) {
    const pos = positions.get(node.data.id)
    const width = Math.min(node.data.title?.length ?? 0, chars) * CHAR_WIDTH + 16
    const at = place(pos)
    take({ x: at.x - 16, y: at.y - 16 })
    take({ x: at.x + 16, y: at.y + 16 })
    take(labelEnd(pos, width, node))
  }
  if (!Number.isFinite(x0)) {
    return { x0: -100, y0: -100, x1: 100, y1: 100 }
  }
  return { x0, y0, x1, y1 }
}

/** `labelEnd` for the radial layouts: out along the radius, or under the node at the centre. */
export function radialLabelEnd(pos, width, node) {
  if (node.depth === 0) {
    return { x: 0, y: 30 }
  }
  return polarToXY({ a: pos.a, r: pos.r + width })
}
