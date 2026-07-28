/**
 * Shared positioning for the floating elements (`WMenu`, `WTooltip`).
 *
 * Placement is expressed the way the existing markup already writes it -- an `anchor` point on the
 * trigger and a `self` point on the floating element, each `"<vertical> <horizontal>"`, e.g.
 * `anchor="bottom right" self="top right"`.
 */

const V = { top: 0, center: 0.5, middle: 0.5, bottom: 1 }
const H = { left: 0, middle: 0.5, center: 0.5, right: 1 }

/**
 * @param {string} spec e.g. `bottom right`
 * @param {string} fallback Used when `spec` is empty or malformed.
 */
function parse(spec, fallback) {
  const [v, h] = String(spec || fallback)
    .trim()
    .split(/\s+/)
  return {
    v: V[v] ?? V[fallback.split(' ')[0]],
    h: H[h] ?? H[fallback.split(' ')[1]]
  }
}

/**
 * Compute fixed-position coordinates for a floating element.
 *
 * @param {DOMRect} anchorRect Trigger bounding box, in viewport coordinates.
 * @param {{ width: number, height: number }} floatSize Measured size of the floating element.
 * @param {object} opts
 * @param {string} [opts.anchor='bottom left']
 * @param {string} [opts.self='top left']
 * @param {[number, number]} [opts.offset=[0, 0]] Extra `[x, y]` displacement in px.
 * @returns {{ left: number, top: number }} Viewport coordinates, clamped on screen.
 */
export function anchoredPosition(anchorRect, floatSize, { anchor, self, offset = [0, 0] } = {}) {
  const a = parse(anchor, 'bottom left')
  const s = parse(self, 'top left')

  let left = anchorRect.left + anchorRect.width * a.h - floatSize.width * s.h + offset[0]
  let top = anchorRect.top + anchorRect.height * a.v - floatSize.height * s.v + offset[1]

  /*
    Keep the element on screen. Clamping beats flipping here: every current placement opens against
    an edge that has room, so a flip would only ever fire on a near-miss and would move the element
    much further than nudging it does.
  */
  const margin = 8
  const maxLeft = window.innerWidth - floatSize.width - margin
  const maxTop = window.innerHeight - floatSize.height - margin
  left = Math.min(Math.max(margin, left), Math.max(margin, maxLeft))
  top = Math.min(Math.max(margin, top), Math.max(margin, maxTop))

  return { left, top }
}
