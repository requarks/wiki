/**
 * Finding a passage of an article again, after the page it was picked from has been edited.
 *
 * An annotation is stored as a DESCRIPTION of the passage rather than a pointer into the page: the
 * text itself, a little of what was either side of it, and the heading it sat under (`CommentAnchor`
 * in `backend/models/comments.ts`). A pointer -- an element path, an offset into the render -- is
 * right about exactly one version of the page; a description is found again in any version that
 * still says the same thing, which is what lets a section added above it leave it linkable.
 *
 * **Text is the article as drawn, with whitespace folded.** Every run of whitespace counts as one
 * space, so a re-render that wraps a paragraph differently, or a block that sits on its own line in
 * one version and inline in the next, changes nothing about where a passage is. The controls the
 * app adds to the render (a heading's pilcrow, a code block's copy button) are not text, and neither
 * is anything inside an `<svg>` or a `<script>` -- see `SKIPPED`.
 *
 * **Matching is tolerant.** A passage is found as long as its exact text is still in the page and
 * can be told apart from any other place the same text occurs. Where it occurs once, that is the
 * place, whatever has happened around it. Where it occurs more than once, the text either side and
 * the heading decide, and the distance into the section breaks a tie; a passage with no evidence for
 * any of its occurrences is ambiguous and is reported as lost, rather than shown somewhere it may
 * never have been.
 */

import { REVEAL_EVENT, scrollerOf } from './anchors'
import { scrollBehavior } from './motion'

/** How much text either side of a passage is kept to tell its occurrences apart. */
const CONTEXT_LENGTH = 32

/**
 * The longest passage that may be annotated. The server holds the same number
 * (`ANNOTATION_QUOTE_MAX_LENGTH`) and refuses anything longer.
 */
export const QUOTE_MAX_LENGTH = 1000

/** How many occurrences of a passage are weighed before giving up on telling them apart. */
const MAX_CANDIDATES = 200

/** What a shared heading is worth against characters of matching context. */
const HEADING_WEIGHT = 16

/** Elements whose contents are not the article's text. */
const SKIPPED = new Set(['button', 'script', 'style', 'template', 'textarea', 'noscript', 'svg'])

const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

/**
 * The names the passages are painted under, through the CSS Custom Highlight API -- which colours a
 * range without putting a single element into the article, so nothing an annotation does can change
 * the text the next one is matched against. Styled in `_page-contents.scss`.
 */
export const HIGHLIGHTS = {
  /** Picked and noted, waiting to be posted. */
  pending: 'wiki-annotation-pending',
  /** Picked, with its note still being written. */
  draft: 'wiki-annotation-draft',
  /** The one whose note is open, with View All Annotations on. */
  focus: 'wiki-annotation-focus',
  /** Every open annotation on the page, with View All Annotations on. */
  shown: 'wiki-annotation-shown',
  /** Every resolved one, likewise -- still there to be found, and drawn as done. */
  resolved: 'wiki-annotation-resolved'
}

/** The width of a card drawn beside a passage, which decides whether it fits beside it at all. */
export const CARD_WIDTH = 300

/** Clear space between such a card and its passage, and between the card and the window's edge. */
const CARD_GAP = 12
const CARD_MARGIN = 16

const canHighlight = typeof CSS !== 'undefined' && 'highlights' in CSS && 'Highlight' in window

/**
 * The text of an article, folded, with a way back from every character of it to the DOM.
 *
 * @param {HTMLElement} root The element the render was written into.
 * @returns {{ text: string, nodes: Text[], nodeAt: number[], offsetAt: number[], headings: { id: string, start: number }[] }}
 *   `nodeAt[i]` and `offsetAt[i]` are where character `i` of `text` is; `headings` are in document
 *   order, each with where its section starts in `text`.
 */
export function indexText(root) {
  const nodes = []
  const chars = []
  const nodeAt = []
  const offsetAt = []
  const headings = []
  // -> True at the start, so leading whitespace is dropped rather than folded into a space
  let lastWasSpace = true

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return NodeFilter.FILTER_ACCEPT
      }
      if (SKIPPED.has(node.localName)) {
        return NodeFilter.FILTER_REJECT
      }
      // -> Elements are only of interest as section starts; their children are visited either way
      return HEADINGS.has(node.localName) && node.id
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP
    }
  })

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType !== Node.TEXT_NODE) {
      headings.push({ id: node.id, start: chars.length })
      continue
    }
    const data = node.data
    const nodeIdx = nodes.length
    nodes.push(node)
    for (let offset = 0; offset < data.length; offset++) {
      const isSpace = /\s/.test(data[offset])
      if (isSpace && lastWasSpace) {
        continue
      }
      chars.push(isSpace ? ' ' : data[offset])
      nodeAt.push(nodeIdx)
      offsetAt.push(offset)
      lastWasSpace = isSpace
    }
  }

  return { text: chars.join(''), nodes, nodeAt, offsetAt, headings }
}

/**
 * The first character of the index at or after a point in the DOM.
 *
 * A point may be in a text node the index holds, which is the usual case and a binary search; or
 * between the children of an element, or inside something the index skips, in which case it is the
 * first text node that starts after the point -- also found by halving, since the nodes are in
 * document order.
 */
function pointToIndex(index, container, offset) {
  let nodeIdx = index.nodes.indexOf(container)
  let nodeOffset = offset
  if (nodeIdx < 0) {
    const point = document.createRange()
    point.setStart(container, offset)
    let lo = 0
    let hi = index.nodes.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (point.comparePoint(index.nodes[mid], 0) >= 0) {
        hi = mid
      } else {
        lo = mid + 1
      }
    }
    nodeIdx = lo
    nodeOffset = 0
  }
  // -> The characters are in (node, offset) order, so this is a search on the pair
  let lo = 0
  let hi = index.text.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    const before =
      index.nodeAt[mid] < nodeIdx ||
      (index.nodeAt[mid] === nodeIdx && index.offsetAt[mid] < nodeOffset)
    if (before) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

/** The DOM range covering characters `start` up to `end` of the index. */
function rangeFor(index, start, end) {
  const range = document.createRange()
  range.setStart(index.nodes[index.nodeAt[start]], index.offsetAt[start])
  range.setEnd(index.nodes[index.nodeAt[end - 1]], index.offsetAt[end - 1] + 1)
  return range
}

/** The section a character is in: the last heading at or before it, or null above the first. */
function headingAt(index, at) {
  let found = null
  for (const heading of index.headings) {
    if (heading.start > at) {
      break
    }
    found = heading
  }
  return found
}

/**
 * Describe a selection, for storing.
 *
 * @param {ReturnType<typeof indexText>} index
 * @param {Range} range What the reader selected. Must be inside the indexed root.
 * @returns {{ anchor: object, range: Range } | null} The anchor to store, and the range trimmed to
 *   exactly the text it describes -- or null when the selection holds no text at all.
 */
export function describeRange(index, range) {
  let start = pointToIndex(index, range.startContainer, range.startOffset)
  let end = pointToIndex(index, range.endContainer, range.endOffset)
  // -> A drag usually catches a space at one end or the other, which is not part of the passage
  while (start < end && index.text[start] === ' ') {
    start++
  }
  while (end > start && index.text[end - 1] === ' ') {
    end--
  }
  if (end <= start) {
    return null
  }
  const heading = headingAt(index, start)
  return {
    anchor: {
      exact: index.text.slice(start, end),
      prefix: index.text.slice(Math.max(0, start - CONTEXT_LENGTH), start),
      suffix: index.text.slice(end, end + CONTEXT_LENGTH),
      heading: heading?.id ?? null,
      offset: start - (heading?.start ?? 0)
    },
    range: rangeFor(index, start, end)
  }
}

/** How many characters at the end of `a` match the end of `b`. */
function sharedEnd(a, b) {
  let n = 0
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) {
    n++
  }
  return n
}

/** How many characters at the start of `a` match the start of `b`. */
function sharedStart(a, b) {
  let n = 0
  while (n < a.length && n < b.length && a[n] === b[n]) {
    n++
  }
  return n
}

/**
 * Find a stored passage in the article as it stands now.
 *
 * @param {ReturnType<typeof indexText>} index
 * @param {object} anchor As `describeRange` made it.
 * @returns {Range | null} Where it is, or null when it is gone or cannot be told apart from another
 *   place the same text occurs. See the note at the top of this file.
 */
export function locateAnchor(index, anchor) {
  const { text } = index
  const exact = anchor?.exact ?? ''
  if (!exact) {
    return null
  }
  const hits = []
  for (let at = text.indexOf(exact); at >= 0 && hits.length < MAX_CANDIDATES;) {
    hits.push(at)
    at = text.indexOf(exact, at + 1)
  }
  if (hits.length < 1) {
    return null
  }
  if (hits.length === 1) {
    return rangeFor(index, hits[0], hits[0] + exact.length)
  }

  const prefix = anchor.prefix ?? ''
  const suffix = anchor.suffix ?? ''
  const scored = hits.map((at) => {
    const end = at + exact.length
    const context =
      sharedEnd(text.slice(Math.max(0, at - prefix.length), at), prefix) +
      sharedStart(text.slice(end, end + suffix.length), suffix)
    const heading = headingAt(index, at)
    const sameHeading = (heading?.id ?? null) === (anchor.heading ?? null)
    return {
      at,
      context,
      sameHeading,
      score: context + (sameHeading ? HEADING_WEIGHT : 0),
      // -> Only meaningful within the section it was picked in
      distance: sameHeading
        ? Math.abs(at - (heading?.start ?? 0) - (anchor.offset ?? 0))
        : Number.POSITIVE_INFINITY
    }
  })
  scored.sort((a, b) => b.score - a.score || a.distance - b.distance)
  const [best, runnerUp] = scored
  if (best.context < 1 && !best.sameHeading) {
    return null
  }
  if (runnerUp && runnerUp.score === best.score && runnerUp.distance === best.distance) {
    return null
  }
  return rangeFor(index, best.at, best.at + exact.length)
}

/**
 * Paint ranges under one of the `HIGHLIGHTS` names, replacing whatever was painted under it.
 *
 * @returns {boolean} Whether the browser can paint them at all. One that cannot still has every
 *   other part of annotating; it only loses the colour.
 */
export function paintHighlight(name, ranges) {
  if (!canHighlight) {
    return false
  }
  if (ranges.length < 1) {
    CSS.highlights.delete(name)
  } else {
    CSS.highlights.set(name, new Highlight(...ranges))
  }
  return true
}

/** Take every annotation highlight off the page. */
export function clearHighlights() {
  for (const name of Object.values(HIGHLIGHTS)) {
    paintHighlight(name, [])
  }
}

/**
 * Bring a passage into view, a third of the way down the article's scroller.
 *
 * Asked of whatever is above it to reveal it first, the way a heading in a closed tab is (see
 * `helpers/anchors.js`) -- and measured a frame later, since a block draws the panel it opened on its
 * own update cycle.
 */
export function scrollRangeIntoView(range) {
  const el =
    range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer
      : range.startContainer.parentElement
  if (!el) {
    return
  }
  el.dispatchEvent(new CustomEvent(REVEAL_EVENT, { bubbles: true, composed: true }))
  requestAnimationFrame(() => {
    const scroller = scrollerOf(el)
    const rect = range.getBoundingClientRect()
    const box = scroller.getBoundingClientRect()
    const top = scroller === document.scrollingElement ? 0 : box.top
    scroller.scrollBy({
      top: rect.top - top - scroller.clientHeight / 3,
      behavior: scrollBehavior()
    })
  })
}

/**
 * Where to draw a card about a passage: to the right of its last line, or under it where the window
 * has no room on the right -- a passage ending near the far edge of the column, or any passage on a
 * phone. Kept inside the window, and above `floor` (a panel along the bottom, say).
 *
 * @param {Range} range The passage.
 * @param {{ height?: number, floor?: number }} [opts] The card's height as drawn, and the lowest its
 *   bottom edge may sit.
 * @returns {{ left: string, top: string, width: string }} A style for a `position: fixed` card.
 */
export function placeBeside(range, { height = 150, floor = window.innerHeight } = {}) {
  const rects = range.getClientRects()
  const last = rects[rects.length - 1] ?? range.getBoundingClientRect()
  const width = Math.min(CARD_WIDTH, window.innerWidth - CARD_MARGIN * 2)

  let left = last.right + CARD_GAP
  let top = last.top - 8
  if (left + width > window.innerWidth - CARD_MARGIN) {
    left = Math.min(Math.max(last.left, CARD_MARGIN), window.innerWidth - width - CARD_MARGIN)
    top = last.bottom + CARD_GAP
  }
  top = Math.max(CARD_MARGIN, Math.min(top, floor - CARD_MARGIN - height))
  return { left: `${left}px`, top: `${top}px`, width: `${width}px` }
}

/**
 * Whether a point on screen falls on a passage.
 *
 * Asked of the passage's own boxes, one per line it runs over, because a highlight is not an element:
 * nothing about it can be clicked or hovered, and the browser has no way to say which one a pointer
 * is over.
 */
export function rangeContainsPoint(range, x, y) {
  for (const rect of range.getClientRects()) {
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return true
    }
  }
  return false
}
