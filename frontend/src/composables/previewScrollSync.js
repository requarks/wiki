import * as monaco from 'monaco-editor'
import { debounce } from 'es-toolkit/function'
import { watch } from 'vue'

import { isVisible } from '@/helpers/anchors'
import { scrollBehavior } from '@/helpers/motion'

/*
  How close to an edge of the preview the caret's line may be drawn before the preview moves to keep it
  in view: enough to show a line of what comes before or after it, and never more than a tenth of a
  short pane.
*/
const CARET_MARGIN = 40

/** How long the caret has to rest before the preview is checked for it. */
const CARET_SETTLE_MS = 100

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

/** `clamp`, for a pair of bounds that may arrive either way round. */
function clampBetween(value, a, b) {
  return a <= b ? clamp(value, a, b) : clamp(value, b, a)
}

/**
 * A point on a piecewise-linear map, from two strictly increasing arrays of equal length. Past either
 * end the map carries on at one to one, which is what an editor scrolled past its last anchor needs.
 * Swapping the arrays is the inverse.
 */
function interpolate(from, to, value) {
  const last = from.length - 1
  if (value <= from[0]) {
    return to[0] + (value - from[0])
  }
  if (value >= from[last]) {
    return to[last] + (value - from[last])
  }
  let lo = 0
  let hi = last
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (from[mid] <= value) {
      lo = mid
    } else {
      hi = mid
    }
  }
  return to[lo] + ((value - from[lo]) * (to[hi] - to[lo])) / (from[hi] - from[lo])
}

/**
 * The longest run of points increasing strictly in both coordinates, in order.
 *
 * What makes the anchors usable as a map: an element drawn somewhere other than where it was written --
 * a footnote, which renders at the foot of the page -- would otherwise fold the map back on itself, and
 * two elements opening on the same line (a list and its first item) would give one source position two
 * places in the preview. The longest chain keeps the most anchors, so one stray element costs only
 * itself rather than everything after it.
 *
 * Patience sorting, after ordering by `x` with ties highest `y` first: no two points of one `x` can
 * then both be in a chain that strictly increases in `y`.
 */
function monotoneChain(points) {
  points.sort((a, b) => a.x - b.x || b.y - a.y)
  const tails = []
  const previous = []
  for (const [index, point] of points.entries()) {
    let lo = 0
    let hi = tails.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (points[tails[mid]].y < point.y) {
        lo = mid + 1
      } else {
        hi = mid
      }
    }
    previous[index] = lo > 0 ? tails[lo - 1] : -1
    tails[lo] = index
  }
  const chain = []
  for (let index = tails.at(-1) ?? -1; index >= 0; index = previous[index]) {
    chain.push(points[index])
  }
  return chain.reverse()
}

/**
 * Scroll sync between a source editor and its render preview, for the Markdown and AsciiDoc editors.
 *
 * **It follows the scroll, not the caret.** Whichever pane is being scrolled leads, and the other is
 * brought to the matching place in its own content -- worked out from the source lines the renderer
 * stamps on what it draws (`data-line`, `data-line-end`), interpolated between them. Moving the caret
 * moves nothing as long as what it is on can be seen; this replaces a sync that scrolled the preview to
 * the caret's paragraph on every move, which jumped about constantly and put a long list at its first
 * line however far down it the caret was.
 *
 * **Which point of each pane lines up slides with how far the editor is scrolled**: the tops at the top
 * of the document, the bottoms at its end, and the matching fraction of each pane in between -- so
 * either pane reaching an end takes the other to the same end, where aligning tops alone (HedgeDoc's
 * choice) leaves the end of the preview out of reach whenever the source is the longer of the two.
 *
 * **The caret's line is always in view in the preview**, while it is in view in the editor. That is a
 * bound on the position above, not a position of its own: the preview is moved only as far as it takes
 * to draw the line inside the pane -- so a caret on the editor's last row is answered by the preview's
 * last row, and one on its first by the first. Once the caret is scrolled out of the editor the bound
 * loosens by as much as it went, rather than letting go at once, which would be a jump.
 *
 * **A pane that was moved for any other reason keeps its place.** The caret bound, an anchor that moved
 * under a re-render, the other pane having led: the offset each leaves is carried along and given up
 * gradually as the pane is scrolled -- all of it within one screen, and all of it by either end of the
 * document -- rather than snapped away on the first scroll after it.
 *
 * Which pane leads is the one last touched -- wheel, pointer, touch or key -- so a pane being scrolled by
 * the other never answers back. Not the one under the pointer: an author typing with the mouse resting
 * over the preview is still writing in the editor.
 *
 * Call it during `setup`. Then `register()` once the editor exists, `rendered()` each time a render has
 * landed in the preview and settled, and `dispose()` with the editor.
 *
 * @param {object} opts
 * @param {() => object} opts.getEditor The Monaco editor, once there is one.
 * @param {import('vue').Ref<HTMLElement>} opts.previewRef The preview's scroll container, while open.
 * @param {() => boolean} opts.isEnabled Whether the preview is open and following.
 * @param {() => Promise} [opts.beforeReveal] Anything to settle before the caret is looked for -- the
 *        tab panel it is written in opened, say. Awaited.
 */
export function usePreviewScrollSync({ getEditor, previewRef, isEnabled, beforeReveal }) {
  let disposables = []
  let leader = 'editor'
  /** Each pane's position as of its last scroll event: where a scroll that has just happened started. */
  let lastEditorTop = 0
  let lastPreviewTop = 0
  /** Whether the source has changed since the preview last drew it, so the preview is behind. */
  let renderPending = false
  let map = null
  let mapKey = ''

  const leadFromEditor = () => {
    leader = 'editor'
  }
  const leadFromPreview = () => {
    leader = 'preview'
  }
  const passive = { passive: true }
  const capturePassive = { capture: true, passive: true }

  /**
   * Source position against preview position, both in pixels from the top of their content.
   *
   * Read off the DOM rather than collected during the render, because what matters is what was drawn
   * and where it ended up -- a block that has since loaded, an image that has since taken its height, a
   * tab panel that is closed and so has no box at all and is skipped. Built once and kept while nothing
   * it was read from has changed size or version, since a scroll asks for it once a frame.
   */
  function currentMap(editor, container) {
    const model = editor.getModel()
    const key = [
      model.getVersionId(),
      editor.getContentHeight(),
      container.scrollHeight,
      container.clientWidth
    ].join()
    if (map && key === mapKey) {
      return map
    }
    const lineCount = model.getLineCount()
    const editorEnd = editor.getContentHeight()
    const previewEnd = container.scrollHeight
    const origin = container.getBoundingClientRect().top - container.scrollTop
    const points = []
    const add = (x, y) => {
      // -> Strictly inside, so that the two ends stay the ends
      if (x > 0 && y > 0 && x < editorEnd && y < previewEnd) {
        points.push({ x, y })
      }
    }
    for (const el of container.querySelectorAll('[data-line]')) {
      // -> A render lags the source it was made from, so a line may be past the end of it by now
      const first = Number(el.dataset.line)
      if (!(first >= 1 && first <= lineCount) || !isVisible(el)) {
        continue
      }
      const rect = el.getBoundingClientRect()
      add(editor.getTopForLineNumber(first), rect.top - origin)
      const last = Math.min(Number(el.dataset.lineEnd), lineCount)
      if (last >= first) {
        add(editor.getBottomForLineNumber(last), rect.bottom - origin)
      }
    }
    const chain = monotoneChain(points)
    map = {
      editor: [0, ...chain.map((p) => p.x), Math.max(editorEnd, 1)],
      preview: [0, ...chain.map((p) => p.y), Math.max(previewEnd, 1)]
    }
    mapKey = key
    return map
  }

  function invalidate() {
    map = null
  }

  /** Everything a position is worked out from, read once per event. */
  function measure(editor, container) {
    const editorHeight = editor.getLayoutInfo().height
    const previewHeight = container.clientHeight
    return {
      map: currentMap(editor, container),
      editorHeight,
      editorMax: Math.max(0, editor.getScrollHeight() - editorHeight),
      previewHeight,
      previewMax: Math.max(0, container.scrollHeight - previewHeight)
    }
  }

  /**
   * Where the preview goes for an editor scrolled to `editorTop`, the caret aside: the point that far
   * down the editor's pane matched to the point as far down the preview's, sliding from the top at the
   * start to the bottom at the end.
   */
  function previewTopFor(m, editorTop) {
    const progress = m.editorMax > 0 ? clamp(editorTop / m.editorMax, 0, 1) : 0
    const at = interpolate(m.map.editor, m.map.preview, editorTop + progress * m.editorHeight)
    return at - progress * m.previewHeight
  }

  /**
   * The inverse of `previewTopFor`, found by bisection: the slide makes it no plain map lookup, and it
   * only ever needs to be close to the pixel.
   */
  function editorTopFor(m, previewTop) {
    // -> Exactly, at either end: bisection only ever gets within half a pixel of them
    if (previewTop <= previewTopFor(m, 0)) {
      return 0
    }
    if (previewTop >= previewTopFor(m, m.editorMax)) {
      return m.editorMax
    }
    let lo = 0
    let hi = m.editorMax
    for (let step = 0; step < 32 && hi - lo > 0.5; step++) {
      const mid = (lo + hi) / 2
      if (previewTopFor(m, mid) < previewTop) {
        lo = mid
      } else {
        hi = mid
      }
    }
    return (lo + hi) / 2
  }

  /**
   * The range the preview's scroll position must stay within for the caret's line to be drawn inside
   * the pane, with the editor at `editorTop`. Wider by as far as the caret is out of the editor's own
   * view, so that scrolling it away lets go gradually. `inView` is whether it is in view at all.
   */
  function caretBounds(editor, m, editorTop) {
    const position = editor.getPosition()
    const top = editor.getTopForPosition(position.lineNumber, position.column)
    const bottom = top + editor.getOption(monaco.editor.EditorOption.lineHeight)
    const above = Math.max(0, editorTop - top)
    const below = Math.max(0, bottom - (editorTop + m.editorHeight))
    const margin = Math.min(CARET_MARGIN, m.previewHeight / 10)
    return {
      inView: above === 0 && below === 0,
      lo: interpolate(m.map.editor, m.map.preview, bottom) + margin - m.previewHeight - below,
      hi: interpolate(m.map.editor, m.map.preview, top) - margin + above
    }
  }

  /**
   * How much of an offset survives a scroll: less the further it went, none past a screen, and none at
   * either end of the document, so that the ends of the two panes always meet.
   */
  function carried(offset, travel, position, max, height) {
    return (
      offset *
      clamp(1 - travel / height, 0, 1) *
      clamp(Math.min(position, max - position) / height, 0, 1)
    )
  }

  function followEditor(editor, container, editorTop) {
    const m = measure(editor, container)
    const offset = carried(
      container.scrollTop - previewTopFor(m, lastEditorTop),
      Math.abs(editorTop - lastEditorTop),
      editorTop,
      m.editorMax,
      m.editorHeight
    )
    const bounds = caretBounds(editor, m, editorTop)
    const target = clampBetween(previewTopFor(m, editorTop) + offset, bounds.lo, bounds.hi)
    setPreviewTop(container, clamp(target, 0, m.previewMax))
  }

  function followPreview(editor, container) {
    const m = measure(editor, container)
    const previewTop = container.scrollTop
    const offset = carried(
      editor.getScrollTop() - editorTopFor(m, lastPreviewTop),
      Math.abs(previewTop - lastPreviewTop),
      previewTop,
      m.previewMax,
      m.previewHeight
    )
    const target = clamp(editorTopFor(m, previewTop) + offset, 0, m.editorMax)
    if (Math.abs(target - editor.getScrollTop()) >= 0.5) {
      editor.setScrollTop(target, monaco.editor.ScrollType.Immediate)
    }
  }

  function setPreviewTop(container, top) {
    if (Math.abs(top - container.scrollTop) >= 0.5) {
      container.scrollTop = top
    }
  }

  /**
   * Bring the caret's line into the preview if it is not already there, moving no further than that.
   * Nothing at all while the editor's caret is out of its own view -- whoever scrolled it away is not
   * looking at it -- nor while the preview is still drawing the source as it was, nor while the
   * preview is the pane being scrolled.
   */
  async function revealCaret() {
    if (!isEnabled() || leader !== 'editor' || renderPending) {
      return
    }
    await beforeReveal?.()
    const editor = getEditor()
    const container = previewRef.value
    if (!editor || !container || !isEnabled() || leader !== 'editor') {
      return
    }
    // -> Rebuilt regardless: a tab panel that just opened moves anchors without changing any size
    invalidate()
    const m = measure(editor, container)
    const bounds = caretBounds(editor, m, editor.getScrollTop())
    if (!bounds.inView) {
      return
    }
    const target = clamp(clampBetween(container.scrollTop, bounds.lo, bounds.hi), 0, m.previewMax)
    if (Math.abs(target - container.scrollTop) >= 1) {
      container.scrollTo({ top: target, behavior: scrollBehavior() })
    }
  }

  const revealCaretSoon = debounce(revealCaret, CARET_SETTLE_MS)

  /** Line the preview up with the editor from scratch, for a preview that has just opened or started following. */
  function align() {
    const editor = getEditor()
    const container = previewRef.value
    if (!editor || !container || !isEnabled()) {
      return
    }
    invalidate()
    const m = measure(editor, container)
    const editorTop = editor.getScrollTop()
    const bounds = caretBounds(editor, m, editorTop)
    const target = clampBetween(previewTopFor(m, editorTop), bounds.lo, bounds.hi)
    setPreviewTop(container, clamp(target, 0, m.previewMax))
    lastEditorTop = editorTop
    lastPreviewTop = container.scrollTop
  }

  function onPreviewScroll() {
    const editor = getEditor()
    const container = previewRef.value
    if (editor && container && isEnabled() && leader === 'preview') {
      followPreview(editor, container)
    }
    lastPreviewTop = container?.scrollTop ?? 0
  }

  // -> An image arriving changes the height of everything below it
  function onPreviewLoad() {
    invalidate()
    revealCaretSoon()
  }

  function attachPreview(container) {
    container.addEventListener('scroll', onPreviewScroll, passive)
    container.addEventListener('load', onPreviewLoad, capturePassive)
    for (const type of ['wheel', 'pointerdown', 'touchstart', 'keydown']) {
      container.addEventListener(type, leadFromPreview, passive)
    }
  }

  function detachPreview(container) {
    container.removeEventListener('scroll', onPreviewScroll, passive)
    container.removeEventListener('load', onPreviewLoad, capturePassive)
    for (const type of ['wheel', 'pointerdown', 'touchstart', 'keydown']) {
      container.removeEventListener(type, leadFromPreview, passive)
    }
  }

  /*
    The preview is created and destroyed as it is opened and closed, so its listeners go with whichever
    element is there. A freshly opened one has the render already in it -- `v-html` puts it there -- so
    nothing is pending any more, and it starts lined up rather than at the top.
  */
  watch(previewRef, (container, previous) => {
    if (previous) {
      detachPreview(previous)
    }
    invalidate()
    if (container) {
      attachPreview(container)
      renderPending = false
      requestAnimationFrame(align)
    }
  })

  watch(isEnabled, (enabled) => {
    if (enabled) {
      requestAnimationFrame(align)
    }
  })

  function register() {
    const editor = getEditor()
    const node = editor.getDomNode()
    lastEditorTop = editor.getScrollTop()
    // -> Captured: Monaco stops the wheel events it scrolls by from going any further
    for (const type of ['wheel', 'pointerdown', 'touchstart']) {
      node.addEventListener(type, leadFromEditor, capturePassive)
    }
    disposables = [
      editor.onKeyDown(leadFromEditor),
      editor.onDidFocusEditorText(leadFromEditor),
      editor.onDidScrollChange((ev) => {
        if (!ev.scrollTopChanged) {
          return
        }
        const container = previewRef.value
        if (container && isEnabled() && leader === 'editor') {
          followEditor(editor, container, ev.scrollTop)
        }
        lastEditorTop = ev.scrollTop
      }),
      editor.onDidChangeModelContent(() => {
        renderPending = true
      }),
      editor.onDidChangeCursorPosition(revealCaretSoon),
      {
        dispose: () => {
          for (const type of ['wheel', 'pointerdown', 'touchstart']) {
            node.removeEventListener(type, leadFromEditor, capturePassive)
          }
        }
      }
    ]
    if (previewRef.value) {
      attachPreview(previewRef.value)
    }
  }

  /** A render has landed in the preview and its blocks have settled: the anchors are new. */
  function rendered() {
    renderPending = false
    invalidate()
    revealCaret()
  }

  function dispose() {
    revealCaretSoon.cancel()
    for (const disposable of disposables.splice(0)) {
      disposable.dispose()
    }
    if (previewRef.value) {
      detachPreview(previewRef.value)
    }
  }

  return { register, rendered, dispose }
}
