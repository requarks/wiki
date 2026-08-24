/**
 * Getting to a heading inside a rendered page.
 *
 * Three things make this more than `scrollIntoView`. The render arrives after the browser has already
 * tried the fragment in the URL, so an anchor a reader followed from elsewhere lands nowhere; a
 * heading can sit inside a block that is not showing it — a tab that is not the open one — where it
 * has no box to scroll to; and the page goes on changing height for a while after it is drawn, as
 * each block fetches its component and settles into its real size.
 */

/**
 * Asked of a block that might be hiding the element the event was dispatched on.
 *
 * Bubbles and crosses shadow boundaries, so the block that answers is whichever one happens to be
 * above the heading: the app does not need to know which kinds of block can hide things, and a new
 * one only has to listen. `block-tabs` answers it by opening the panel the heading is in.
 */
export const REVEAL_EVENT = 'block-reveal'

/** How often the heading's position is sampled while waiting for the page to stop moving. */
const SAMPLE_MS = 60

/** How many samples in a row must agree before the page counts as settled. */
const STABLE_SAMPLES = 3

/** How long to wait for a smooth scroll to finish, where the browser cannot say when it has. */
const SETTLE_MS = 1200

/** How far the heading may sit from where it was aimed before it is worth correcting, in pixels. */
const DRIFT_TOLERANCE = 4

/**
 * Left on whatever a fragment link landed on, for content styling to mark — a footnote does, since it
 * is one item among a list of near-identical ones and being sent to it says nothing about which.
 *
 * `:target` used to do this and cannot any more: an in-content fragment link is followed with
 * `router.push`, and a pushed hash does not set the document's target element. Doing it here instead
 * covers arriving with a `#fragment` in the URL by the same path, which `:target` handled differently
 * from a click. Styled in `_page-contents.scss` — the two have to be kept in step.
 */
export const LANDED_CLASS = 'is-anchor-landed'

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Mark where the reader has just been sent, and only there — the way `:target` behaved. */
function markLanded(el) {
  for (const previous of document.querySelectorAll(`.${LANDED_CLASS}`)) {
    previous.classList.remove(LANDED_CLASS)
  }
  el.classList.add(LANDED_CLASS)
}

/** The heading a `#slug` refers to, or null. */
export function anchorTarget(hash) {
  const id = decodeURIComponent(String(hash ?? '').replace(/^#/, ''))
  // -> `getElementById` rather than a selector, which would have to escape a slug that is not a
  //    valid CSS identifier
  return id ? document.getElementById(id) : null
}

/**
 * Whether an element has a box on the page — false while it sits in a panel that is not showing.
 *
 * Exported because the contents list asks the same question of a heading before measuring where it is:
 * one inside a closed tab measures nothing at all, which reads as the top of the page rather than as
 * an absence. See `PageToc`.
 */
export function isVisible(el) {
  return Boolean(el.offsetParent ?? el.getClientRects().length)
}

/** Ask whatever is above the element to bring it into view. */
function reveal(el) {
  el.dispatchEvent(new CustomEvent(REVEAL_EVENT, { bubbles: true, composed: true }))
}

/**
 * The box the element actually scrolls in.
 *
 * The article has its own scroller rather than the window — the shell stays put and the column moves
 * — so the position of the heading has to be read against that box, not the viewport.
 */
function scrollerOf(el) {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if (/(auto|scroll|overlay)/.test(overflowY) && node.scrollHeight > node.clientHeight + 1) {
      return node
    }
  }
  return document.scrollingElement ?? document.documentElement
}

/** Where the heading sits in the document, independent of how far the page is scrolled. */
function positionOf(el, scroller) {
  return Math.round(el.getBoundingClientRect().top + scroller.scrollTop)
}

/** How far the heading is from where a scroll aiming at it would put it. */
function driftOf(el, scroller) {
  const margin = Number.parseFloat(getComputedStyle(el).scrollMarginTop) || 0
  const wanted = scroller.getBoundingClientRect().top + margin
  return el.getBoundingClientRect().top - wanted
}

function scrollTo(el, smooth) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: smooth && !reduceMotion ? 'smooth' : 'auto', block: 'start' })
}

/**
 * Wait until the heading stops moving.
 *
 * Blocks land after the page is drawn and change its height as they do — a set of tabs is at its
 * tallest before its component arrives, with every panel stacked up, and collapses to one when it
 * does. Scrolling into that leaves the reader somewhere below the heading they asked for, so this
 * waits for the page to hold still before aiming at anything.
 */
async function whenStill(el, scroller, deadline) {
  let previous = null
  let agreed = 0
  while (performance.now() < deadline) {
    const position = positionOf(el, scroller)
    agreed = position === previous ? agreed + 1 : 0
    if (agreed >= STABLE_SAMPLES) {
      return
    }
    previous = position
    await delay(SAMPLE_MS)
  }
}

/** Wait for a scroll to come to rest, by the event where there is one and by the clock where not. */
function whenScrollEnded(scroller) {
  if (!('onscrollend' in window)) {
    return delay(SETTLE_MS)
  }
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer)
      scroller.removeEventListener('scrollend', done)
      resolve()
    }
    const timer = setTimeout(done, SETTLE_MS)
    scroller.addEventListener('scrollend', done, { once: true })
  })
}

/** Mark where the reader is being sent and take them there, if it is on the page to be taken to. */
function land(el, smooth) {
  if (!isVisible(el)) {
    return false
  }
  markLanded(el)
  scrollTo(el, smooth)
  return true
}

/**
 * Scroll a heading into view, asking whatever is above it to reveal it first.
 *
 * For a page that is already settled — a click on the contents list, say. See
 * `scrollToAnchorWhenReady` for one that has only just been rendered.
 *
 * A block asked to reveal something does not do it in this tick: `block-tabs` sets which panel is
 * open and Lit draws that on its own update cycle, so the target still has no box to scroll to by the
 * time the event handler returns. Hence the second attempt a frame later — by then the panel is
 * showing — and hence the answer being yes before it has happened: the caller is asking whether the
 * reader is being taken somewhere, which decides whether it claims the click, and a target that had
 * to be revealed is still somewhere to go.
 *
 * @returns Whether there was a heading to scroll to
 */
export function scrollToAnchor(hash, { smooth = false } = {}) {
  const target = anchorTarget(hash)
  if (!target) {
    return false
  }
  reveal(target)
  if (!land(target, smooth)) {
    requestAnimationFrame(() => land(target, smooth))
  }
  return true
}

/**
 * The same, for a page that has only just been rendered: wait for the heading, then for the page to
 * settle, then animate to it — and check afterwards, in case something arrived late enough to move
 * it while the scroll was under way.
 *
 * Animated rather than jumped, so a reader who followed a link into the middle of a long page sees
 * where they were taken instead of being asked to work out where the top went.
 */
export async function scrollToAnchorWhenReady(hash, { timeout = 5000 } = {}) {
  if (!hash) {
    return
  }
  const deadline = performance.now() + timeout

  // -> The heading itself may not exist yet: a block fetches its component, and an included page its
  //    content, after the page around them is drawn
  let target = anchorTarget(hash)
  while (performance.now() < deadline) {
    if (target) {
      reveal(target)
      if (isVisible(target)) {
        break
      }
    }
    await delay(SAMPLE_MS)
    target = anchorTarget(hash)
  }
  if (!target || !isVisible(target)) {
    return
  }
  markLanded(target)

  const scroller = scrollerOf(target)
  await whenStill(target, scroller, deadline)
  scrollTo(target, true)

  // -> One correction, without animation: the reader has already watched the page travel, and what
  //    is left is a few pixels of something that loaded on the way
  await whenScrollEnded(scroller)
  if (Math.abs(driftOf(target, scroller)) > DRIFT_TOLERANCE && isVisible(target)) {
    scrollTo(target, false)
  }
}
