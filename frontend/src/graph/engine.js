import { easeCubicInOut, easeCubicOut } from 'd3-ease'
import { select } from 'd3-selection'
import 'd3-transition'
import { zoom, zoomIdentity } from 'd3-zoom'

import { searchModel } from './model.js'
import { buildScene } from './scene.js'

/**
 * The page graph's renderer: one SVG, any view.
 *
 * Plain JavaScript over d3 rather than a Vue component, because what it draws is up to a few thousand
 * elements moved every frame of an animation, and a virtual DOM diffing them sixty times a second
 * would be the whole cost of the view. `PageGraph.vue` owns the chrome around it -- the toolbar, the
 * hover card, the breadcrumbs -- and talks to this through the object `createGraph` returns and the
 * callbacks it is given.
 *
 * What happens on each redraw, whichever view it is:
 *
 *  - **Nodes move, they are not redrawn.** Every node is keyed by its scene id, so one that is in
 *    both the old drawing and the new one travels from where it was. One that is new grows out of
 *    the nearest ancestor that was already there -- which on the first draw is the root, so the tree
 *    visibly branches outward, a level at a time.
 *  - **Edges follow their nodes** while a layout of the same view changes, recomputed every frame from
 *    where both ends are at that moment. Between two views they have no common form, so they fade,
 *    the nodes glide, and they grow back in from each parent.
 *  - **Links draw in last**, once everything has settled, swept round in the order they start.
 *
 * Reduced motion -- the operating system's or the reader's own setting -- skips every one of those to
 * its last frame. Nothing about what is drawn depends on having watched it arrive.
 */

/** How long nodes take to reach a new layout, and how much later each level of a first draw starts. */
const MOVE_DURATION = 700
const LEVEL_STAGGER = 160
/** Edges growing back in after a change of view. */
const GROW_DURATION = 420
const GROW_STAGGER = 70
/** The longest a link waits for its turn to draw in; see `linkPhase`. */
const LINK_SWEEP = 650
const LINK_DRAW = 900
/** Nothing is drawn smaller than this on screen, however far out the view is zoomed. */
const SCALE_EXTENT = [0.02, 6]

let instanceCount = 0

/**
 * @param {HTMLElement} container Filled by the SVG, and measured for fitting.
 * @param {object} options
 * @param {object} options.labels Strings the engine draws: `graph`, `elsewhere`, `more(n)`, `locale(code)`.
 * @param {Function} options.reduceMotion Asked before every animation, so the setting applies at once.
 * @param {Function} options.onOpen Called with `{ locale, path }` for a page the reader chose.
 * @param {Function} options.onChange Called with the trail, the view and the counts whenever they change.
 * @param {Function} options.onHover Called with what is under the pointer or keyboard, or null.
 */
export function createGraph(container, options) {
  const uid = ++instanceCount
  const { labels } = options

  const state = {
    model: null,
    view: null,
    focus: null,
    scene: null,
    layout: null,
    /** Folders whose "more" has been opened, and how many of their entries that shows. */
    allowance: new Map(),
    matches: new Set(),
    containsMatch: new Set(),
    /** Where each drawn node is -- in its view's own terms, and as a point -- and which view that is. */
    current: new Map(),
    currentView: null,
    animation: null,
    linkTimer: null,
    transform: zoomIdentity,
    activeId: null,
    highlightId: null,
    /** Short DOM ids for `aria-activedescendant`, since a scene id is a path. */
    domIds: new Map()
  }

  // SVG ------------------------------------------------------------------

  const svg = select(container)
    .append('svg')
    .attr('class', 'pg-svg')
    .attr('role', 'tree')
    .attr('tabindex', 0)
    .attr('aria-label', labels.graph)
  const viewport = svg.append('g').attr('class', 'pg-viewport')
  const edgesLayer = viewport.append('g').attr('class', 'pg-edges')
  const linksLayer = viewport.append('g').attr('class', 'pg-links')
  const nodesLayer = viewport.append('g').attr('class', 'pg-nodes')

  const zoomer = zoom()
    .scaleExtent(SCALE_EXTENT)
    .on('zoom', (ev) => {
      state.transform = ev.transform
      viewport.attr('transform', ev.transform)
      applyZoomClasses()
      // -> A card left where a node used to be is worse than none; only for a gesture, since a fit
      //    the engine runs itself is not the reader moving away
      if (ev.sourceEvent) {
        options.onHover(null)
      }
    })
  svg.call(zoomer).on('dblclick.zoom', null)

  function applyZoomClasses() {
    const px = state.transform.k * (state.view?.fontSize ?? 11)
    svg.classed('is-far', px < 7).classed('is-farther', px < 3.5)
  }

  // SCENE ----------------------------------------------------------------

  function rebuild({ fit = true } = {}) {
    const view = state.view
    state.scene = buildScene(state.model, {
      focus: state.focus,
      budget: view.budget,
      maxChildren: view.maxChildren,
      allowance: state.allowance,
      withLinks: view.links,
      labels
    })
    state.layout = view.layout(state.scene)
    svg.attr('class', `pg-svg is-${view.key}`)
    applyZoomClasses()
    if (state.activeId && !state.scene.nodesById.has(state.activeId)) {
      state.activeId = null
    }
    if (state.highlightId && !state.scene.nodesById.has(state.highlightId)) {
      state.highlightId = null
    }
    const isFirst = state.current.size === 0
    draw()
    if (fit) {
      fitToScreen({ instant: isFirst })
    }
    emitChange()
  }

  function emitChange() {
    const trail = []
    for (let node = state.focus; node; node = node.parent) {
      trail.unshift({ id: node.id, title: node.title })
    }
    options.onChange({
      trail,
      view: state.view.key,
      matchCount: state.matches.size,
      drawnCount: state.scene.nodesById.size
    })
  }

  // DRAWING --------------------------------------------------------------

  function radiusOf(d) {
    switch (d.kind) {
      case 'more':
        return 6
      case 'group':
        return 3
      case 'stub':
        return d.stub === 'locale' ? 7 : 3.5
    }
    if (d.collapsed) {
      return 7 + Math.min(9, Math.sqrt(d.hidden) * 1.2)
    }
    if (d.node === state.focus) {
      return 7
    }
    return d.node.children.length > 0 ? 5 : 4
  }

  function labelOf(d) {
    let text
    switch (d.kind) {
      case 'more':
        return labels.more(d.hidden)
      case 'stub':
        text = d.stub === 'locale' ? `${d.title} (${d.hidden})` : `↗ ${d.title}`
        break
      default:
        text = d.title
    }
    const max = state.view.labelChars
    return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
  }

  function countOf(d) {
    const n = d.kind === 'more' || d.collapsed ? d.hidden : 0
    if (!n) {
      return ''
    }
    return n > 999 ? `${Math.floor(n / 1000)}k` : String(n)
  }

  function domIdOf(id) {
    let domId = state.domIds.get(id)
    if (!domId) {
      domId = `pg-${uid}-${state.domIds.size}`
      state.domIds.set(id, domId)
    }
    return domId
  }

  /** Classes, glyph, label and accessible name: everything about a node but where it is. */
  function dressNode(el, hnode) {
    const d = hnode.data
    const page = d.node?.page
    const g = select(el)
    const isFolder = d.kind === 'node' && d.node.children.length > 0
    g.attr('id', domIdOf(d.id))
      .attr('class', 'pg-node')
      .classed(`pg-node--${d.kind}`, true)
      .classed('is-page', Boolean(page))
      .classed('is-folder', isFolder)
      .classed('is-collapsed', Boolean(d.collapsed))
      .classed('is-focus', d.node === state.focus && d.kind === 'node')
      .classed('is-draft', Boolean(page && !page.isPublished))
      .classed('is-actionable', defaultAction(d) !== null)
      .attr('role', 'treeitem')
      .attr('aria-level', hnode.depth + 1)
      .attr('aria-label', accessibleName(d))
      .attr('aria-expanded', isFolder ? String(!d.collapsed) : null)
      .style('--h', d.hue ?? 0)
      .style('--s', d.hue === null || d.hue === undefined ? '0%' : '62%')

    const r = radiusOf(d)
    el.__radius = r
    g.select('.pg-hit').attr('r', Math.max(r + 5, 10))
    g.select('.pg-dot').attr('r', r)
    g.select('.pg-count').text(countOf(d))
    g.select('.pg-label').text(labelOf(d))
  }

  function accessibleName(d) {
    const parts = [d.kind === 'more' ? labels.more(d.hidden) : d.title]
    if (d.collapsed || d.stub === 'locale') {
      parts.push(labels.pages(d.hidden))
    }
    if (d.node?.page && !d.node.page.isPublished) {
      parts.push(labels.unpublished)
    }
    return parts.join(', ')
  }

  function applyLabel(el, spec, r) {
    el.setAttribute('transform', spec.rotate ? `rotate(${spec.rotate})` : '')
    el.setAttribute('text-anchor', spec.anchor)
    el.setAttribute('x', spec.side * (r + 5))
    el.setAttribute('y', spec.side === 0 ? r + 13 : 0)
  }

  function lerp(from, to, t) {
    const out = {}
    for (const key in to) {
      const a = from[key] ?? to[key]
      out[key] = a + (to[key] - a) * t
    }
    return out
  }

  const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t)

  function stopAnimation() {
    state.animation?.cancel()
    state.animation = null
    clearTimeout(state.linkTimer)
  }

  /**
   * Drive `frame(elapsed)` until `duration` has passed, then call `done`.
   *
   * requestAnimationFrame rather than d3-transition: a transition tweens one attribute of one element,
   * and a frame here is every node and every edge computed together from the same moment.
   */
  function run(duration, frame, done) {
    if (options.reduceMotion()) {
      frame(Infinity)
      done()
      return
    }
    const start = performance.now()
    let raf = null
    const tick = (now) => {
      const elapsed = now - start
      frame(elapsed)
      if (elapsed >= duration) {
        state.animation = null
        done()
      } else {
        raf = requestAnimationFrame(tick)
      }
    }
    raf = requestAnimationFrame(tick)
    state.animation = { cancel: () => cancelAnimationFrame(raf) }
  }

  function draw() {
    stopAnimation()
    const { scene, layout, view } = state
    const sameSpace = state.currentView === null || state.currentView === view.key
    const isFirst = state.current.size === 0
    const prev = state.current
    const hnodes = scene.root.descendants()
    const rootPos = layout.positions.get(scene.root.data.id)

    // -> NODES
    const joined = nodesLayer.selectAll('g.pg-node').data(hnodes, (d) => d.data.id)
    joined.exit().each(function () {
      // -> Faded rather than removed, and only removed if it is still gone once the fade is over:
      //    a node can come straight back in the next redraw
      this.classList.add('is-exiting')
      clearTimeout(this.__exitTimer)
      this.__exitTimer = setTimeout(() => this.remove(), 320)
    })
    const entered = joined.enter().append('g')
    entered.append('circle').attr('class', 'pg-hit')
    entered.append('circle').attr('class', 'pg-dot')
    entered
      .append('text')
      .attr('class', 'pg-count')
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
    entered.append('text').attr('class', 'pg-label').attr('dy', '0.32em')
    const nodes = entered.merge(joined)

    const entries = []
    const entryById = new Map()
    nodes.each(function (hnode) {
      clearTimeout(this.__exitTimer)
      dressNode(this, hnode)
      const id = hnode.data.id
      const finalPos = layout.positions.get(id)
      const was = prev.get(id)
      let from = was ? (sameSpace ? was.pos : was.xy) : null
      if (!from) {
        // -> New: out of the nearest ancestor that was drawn before, or out of the root
        let ancestor = hnode.parent
        while (ancestor && !prev.has(ancestor.data.id)) {
          ancestor = ancestor.parent
        }
        const origin = ancestor ? prev.get(ancestor.data.id) : null
        if (origin) {
          from = sameSpace ? origin.pos : origin.xy
        } else {
          from = sameSpace ? rootPos : layout.place(rootPos)
        }
      }
      const entry = {
        id,
        el: this,
        label: this.querySelector('.pg-label'),
        hnode,
        finalPos,
        from,
        to: sameSpace ? finalPos : layout.place(finalPos),
        cur: from,
        entering: !was,
        delay: isFirst ? hnode.depth * LEVEL_STAGGER : 0,
        // -> On a first draw a node leaves from wherever its parent has got to, so each level
        //    branches out of the one before it rather than every node flying out of the root
        parent: isFirst && hnode.parent ? entryById.get(hnode.parent.data.id) : null
      }
      entries.push(entry)
      entryById.set(id, entry)
      if (!sameSpace) {
        applyLabel(entry.label, layout.label(finalPos, hnode), this.__radius)
      }
    })

    // -> EDGES
    const edgeSel = edgesLayer
      .selectAll('path.pg-edge')
      .data(layout.edges, (d) => d.id)
      .join('path')
      .attr('class', 'pg-edge')
      .each(function (edge) {
        const child = scene.nodesById.get(edge.child).data
        const page = child.node?.page
        this.classList.toggle('is-draft', Boolean(page && !page.isPublished))
        this.classList.toggle('is-stub', child.kind === 'stub' || child.kind === 'group')
        this.style.setProperty('--h', child.hue ?? 0)
        this.style.setProperty('--s', child.hue === null || child.hue === undefined ? '0%' : '62%')
      })
    const edges = []
    edgeSel.each(function (edge) {
      edges.push({
        el: this,
        parent: entryById.get(edge.parent),
        child: entryById.get(edge.child),
        depth: edge.depth
      })
      // -> Hidden until they grow back in after a change of view, and never left hidden by one that
      //    was interrupted
      this.style.opacity = sameSpace ? '' : '0'
    })

    // -> LINKS are drawn once everything has settled; what was there goes now
    linksLayer.selectAll('path.pg-link').classed('is-stale', true)

    const maxDelay = isFirst ? scene.root.height * LEVEL_STAGGER : 0
    const live = new Map()
    const frame = (elapsed) => {
      for (const e of entries) {
        const t = easeCubicInOut(clamp01((elapsed - e.delay) / MOVE_DURATION))
        // -> Entries are breadth first, so a parent's position for this frame is already in hand
        e.cur = lerp(e.parent ? e.parent.cur : e.from, e.to, t)
        const xy = sameSpace ? layout.place(e.cur) : e.cur
        e.el.setAttribute('transform', `translate(${xy.x},${xy.y})`)
        if (sameSpace) {
          applyLabel(e.label, layout.label(e.cur, e.hnode), e.el.__radius)
        } else {
          e.label.style.opacity = String(clamp01((t - 0.65) / 0.35))
        }
        if (e.entering) {
          e.el.style.opacity = String(t)
        } else {
          e.el.style.opacity = ''
        }
        live.set(e.id, { pos: sameSpace ? e.cur : e.finalPos, xy })
      }
      if (sameSpace) {
        for (const edge of edges) {
          if (edge.parent && edge.child) {
            edge.el.setAttribute('d', layout.edgePath(edge.parent.cur, edge.child.cur))
          }
        }
      }
      state.current = live
    }

    state.currentView = view.key
    run(MOVE_DURATION + maxDelay, frame, () => {
      for (const e of entries) {
        e.label.style.opacity = ''
      }
      if (sameSpace) {
        drawLinks()
      } else {
        growEdges(edges, () => drawLinks())
      }
    })
    applyHighlight()
    applySearch()
  }

  /** After a change of view: every edge grows from its parent out to its child, a level at a time. */
  function growEdges(edges, done) {
    const { layout, scene } = state
    run(
      GROW_DURATION + scene.root.height * GROW_STAGGER,
      (elapsed) => {
        for (const edge of edges) {
          if (!edge.parent || !edge.child) {
            continue
          }
          const t = easeCubicOut(
            clamp01((elapsed - (edge.depth - 1) * GROW_STAGGER) / GROW_DURATION)
          )
          const from = edge.parent.finalPos
          edge.el.setAttribute('d', layout.edgePath(from, lerp(from, edge.child.finalPos, t)))
          edge.el.style.opacity = t > 0 ? '' : '0'
        }
      },
      done
    )
  }

  function drawLinks() {
    const { layout, scene } = state
    linksLayer.selectAll('path.pg-link.is-stale').remove()
    if (!layout.linkPath) {
      return
    }
    const sel = linksLayer
      .selectAll('path.pg-link')
      .data(scene.links, (d) => d.id)
      .join('path')
      .attr('class', (d) => `pg-link pg-link--${d.kind}`)
      .attr('d', (d) => layout.linkPath(d))
      .style('stroke-width', (d) => (0.7 + Math.log2(d.weight) * 0.45).toFixed(2))
      .each(function (d) {
        const hue = scene.nodesById.get(d.source)?.data.hue
        this.style.setProperty('--h', hue ?? 0)
        this.style.setProperty('--s', hue === null || hue === undefined ? '0%' : '62%')
      })
    if (!options.reduceMotion()) {
      // -> `pathLength` normalises every path to one unit, so a single dash the length of the path can
      //    be slid along it without measuring any of them. Taken off again once they have drawn, since
      //    it would stretch the flowing dashes of a highlighted link to the length of the link
      sel
        .attr('pathLength', 1)
        .classed('is-drawing', true)
        .style(
          'animation-delay',
          (d) => `${Math.round((layout.linkPhase?.(d) ?? 0) * LINK_SWEEP)}ms`
        )
      state.linkTimer = setTimeout(
        () => {
          sel.attr('pathLength', null).classed('is-drawing', false).style('animation-delay', null)
        },
        LINK_SWEEP + LINK_DRAW + 50
      )
    }
    applyHighlight()
  }

  // FITTING --------------------------------------------------------------

  function fitToScreen({ instant = false } = {}) {
    const { layout, view } = state
    const { width, height } = container.getBoundingClientRect()
    if (!width || !height) {
      return
    }
    const b = layout.bounds
    const bw = Math.max(b.x1 - b.x0, 1)
    const bh = Math.max(b.y1 - b.y0, 1)
    const k = Math.max(
      Math.min((width * 0.92) / bw, (height * 0.92) / bh, 1.4),
      view.minFitScale ?? 0
    )
    // -> Centred along an axis it fits on. Along one it does not -- a view that stops shrinking at
    //    `minFitScale` -- the ROOT is centred instead, which is where it is read from, but never so
    //    far that blank space opens up before the first node or after the last
    const root = layout.place(layout.positions.get(state.scene.root.data.id))
    const place = (size, from, span, at) => {
      if (k * span <= size * 0.92) {
        return size / 2 - k * (from + span / 2)
      }
      const margin = 24
      const centred = size / 2 - k * at
      return Math.min(margin - k * from, Math.max(size - margin - k * (from + span), centred))
    }
    const tx = place(width, b.x0, bw, root.x)
    const ty = place(height, b.y0, bh, root.y)
    const target = zoomIdentity.translate(tx, ty).scale(k)
    if (instant || options.reduceMotion()) {
      svg.interrupt().call(zoomer.transform, target)
    } else {
      svg.transition().duration(MOVE_DURATION).ease(easeCubicInOut).call(zoomer.transform, target)
    }
  }

  function zoomBy(factor) {
    const duration = options.reduceMotion() ? 0 : 250
    svg.transition().duration(duration).call(zoomer.scaleBy, factor)
  }

  // HIGHLIGHT AND SEARCH -------------------------------------------------

  /**
   * Light up one node and everything it is connected to: its links in and out, which flow toward and
   * away from it, the nodes at their far ends, and its line back to the focus.
   */
  function applyHighlight() {
    const id = state.highlightId ?? state.activeId
    const connected = new Set()
    if (id) {
      connected.add(id)
      for (let hnode = state.scene.nodesById.get(id); hnode; hnode = hnode.parent) {
        connected.add(hnode.data.id)
      }
    }
    linksLayer.selectAll('path.pg-link').each(function (d) {
      const isOut = d.source === id
      const isIn = d.target === id
      this.classList.toggle('is-out', isOut)
      this.classList.toggle('is-in', isIn)
      if (isOut) {
        connected.add(d.target)
      } else if (isIn) {
        connected.add(d.source)
      }
      if (isOut || isIn) {
        // -> On top of the others, so a highlighted strand is not drawn under a hundred faded ones
        this.parentNode.appendChild(this)
      }
    })
    edgesLayer.selectAll('path.pg-edge').each(function (d) {
      this.classList.toggle(
        'is-trail',
        Boolean(id) && connected.has(d.child) && connected.has(d.parent)
      )
    })
    nodesLayer.selectAll('g.pg-node').each(function (hnode) {
      this.classList.toggle('is-linked', connected.has(hnode.data.id))
      this.classList.toggle('is-highlighted', hnode.data.id === id)
      this.classList.toggle('is-active', hnode.data.id === state.activeId)
    })
    svg.classed('is-highlighting', Boolean(id))
    svg.attr('aria-activedescendant', state.activeId ? domIdOf(state.activeId) : null)
  }

  function applySearch() {
    const { matches, containsMatch } = state
    svg.classed('has-search', matches.size > 0)
    nodesLayer.selectAll('g.pg-node').each(function (hnode) {
      const d = hnode.data
      const id = d.kind === 'stub' || d.kind === 'more' ? d.node?.id : d.id
      this.classList.toggle('is-match', Boolean(id) && matches.has(id))
      this.classList.toggle(
        'is-contains-match',
        Boolean(d.collapsed || d.kind === 'more') && Boolean(d.node) && containsMatch.has(d.node.id)
      )
    })
  }

  // ACTIONS --------------------------------------------------------------

  /** What choosing a node does when nothing more specific is asked for. */
  function defaultAction(d) {
    switch (d.kind) {
      case 'node':
        if (d.node.page) {
          return 'open'
        }
        if (d.node === state.focus) {
          return d.node.parent ? 'up' : null
        }
        return 'zoom'
      case 'more':
        return 'more'
      case 'stub':
        if (d.stub === 'outside') {
          return d.node.children.length > 0 ? 'zoom' : 'open'
        }
        return d.stub === 'external' ? 'open' : null
    }
    return null
  }

  /** Everything choosing a node could do, for the hover card to offer. */
  function actionsFor(d) {
    const actions = []
    if (d.node?.page && d.kind !== 'more' && d.stub !== 'locale') {
      actions.push('open')
    }
    if (
      (d.kind === 'node' || d.stub === 'outside') &&
      d.node.children.length > 0 &&
      d.node !== state.focus
    ) {
      actions.push('zoom')
    }
    if (d.kind === 'node' && d.node === state.focus && d.node.parent) {
      actions.push('up')
    }
    if (d.kind === 'more') {
      actions.push('more')
    }
    return actions
  }

  function activate(id, action) {
    const hnode = state.scene?.nodesById.get(id)
    if (!hnode) {
      return
    }
    const d = hnode.data
    switch (action ?? defaultAction(d)) {
      case 'open': {
        const page = d.node?.page
        if (page) {
          options.onOpen({ locale: page.locale, path: page.path })
        }
        break
      }
      case 'zoom':
        focusOn(d.node)
        break
      case 'up':
        if (state.focus.parent) {
          focusOn(state.focus.parent)
        }
        break
      case 'more': {
        const view = state.view
        state.allowance.set(
          d.node.id,
          (state.allowance.get(d.node.id) ?? view.maxChildren) + view.maxChildren
        )
        options.onHover(null)
        rebuild({ fit: false })
        break
      }
    }
  }

  function focusOn(node) {
    if (!node || node === state.focus) {
      return
    }
    // -> The node zoomed out of stays the one the keyboard is on, so arrowing on continues from it
    const from = state.focus
    state.focus = node
    state.highlightId = null
    options.onHover(null)
    rebuild()
    const stayOn = state.scene.nodesById.has(from.id) ? from.id : node.id
    if (document.activeElement === svg.node()) {
      // -> Once the view has settled: a card placed now would be placed against a zoom still moving
      clearTimeout(state.activeTimer)
      state.activeTimer = setTimeout(
        () => setActive(stayOn),
        options.reduceMotion() ? 0 : MOVE_DURATION + 50
      )
    }
  }

  // POINTER --------------------------------------------------------------

  /** Where a node ends up, which is where a card about it belongs even while it is still moving. */
  function finalXY(id) {
    const pos = state.layout?.positions.get(id)
    return pos ? state.layout.place(pos) : null
  }

  function hoverInfo(id) {
    const hnode = state.scene.nodesById.get(id)
    const xy = finalXY(id)
    if (!hnode || !xy) {
      return null
    }
    const d = hnode.data
    const t = state.transform
    const r = (nodeElement(id)?.__radius ?? 4) * t.k
    let linksIn = 0
    let linksOut = 0
    for (const link of state.scene.links) {
      if (link.source === id) {
        linksOut += link.count
      } else if (link.target === id) {
        linksIn += link.count
      }
    }
    return {
      id,
      kind: d.kind,
      stub: d.stub ?? null,
      title: d.kind === 'more' ? labels.more(d.hidden) : d.title,
      locale: d.node?.page?.locale ?? d.locale ?? null,
      path: d.node?.page?.path ?? d.node?.path ?? '',
      isPage: Boolean(d.node?.page),
      isPublished: d.node?.page?.isPublished ?? true,
      isRedirect: d.node?.page?.isRedirect ?? false,
      pages:
        d.collapsed || d.kind === 'more' || d.stub === 'locale' ? d.hidden : (d.node?.size ?? 0),
      isCollapsed: Boolean(d.collapsed),
      hasLinks: state.view.links,
      linksIn,
      linksOut,
      actions: actionsFor(d),
      defaultAction: defaultAction(d),
      // -> In the container's own pixels, so the card can be placed without knowing about the zoom
      x: t.applyX(xy.x),
      y: t.applyY(xy.y),
      r
    }
  }

  function nodeElement(id) {
    return document.getElementById(domIdOf(id))
  }

  function nodeIdOf(ev) {
    const el = ev.target.closest?.('g.pg-node')
    return el && !el.classList.contains('is-exiting') ? el.__data__?.data.id : null
  }

  nodesLayer.on('click', (ev) => {
    const id = nodeIdOf(ev)
    if (id) {
      activate(id)
    }
  })
  nodesLayer.on('pointerover', (ev) => {
    const id = nodeIdOf(ev)
    if (!id || id === state.highlightId || state.animation) {
      return
    }
    state.highlightId = id
    applyHighlight()
    options.onHover(hoverInfo(id))
  })
  nodesLayer.on('pointerout', (ev) => {
    const id = nodeIdOf(ev)
    const to = ev.relatedTarget?.closest?.('g.pg-node')
    if (id && to?.__data__?.data.id !== id) {
      // -> The card decides when the highlight goes, since the pointer may be on its way into it
      options.onHover(null)
    }
  })

  // KEYBOARD -------------------------------------------------------------

  function setActive(id) {
    state.activeId = id
    state.highlightId = null
    applyHighlight()
    if (!id) {
      options.onHover(null)
      return
    }
    keepInView(id)
    options.onHover({ ...hoverInfo(id), fromKeyboard: true })
  }

  /** Pan just enough to bring a node the keyboard moved to back on screen. */
  function keepInView(id) {
    const xy = finalXY(id)
    if (!xy) {
      return
    }
    const { width, height } = container.getBoundingClientRect()
    const x = state.transform.applyX(xy.x)
    const y = state.transform.applyY(xy.y)
    const margin = 60
    if (x < margin || x > width - margin || y < margin || y > height - margin) {
      const duration = options.reduceMotion() ? 0 : 300
      svg.transition().duration(duration).call(zoomer.translateTo, xy.x, xy.y)
    }
  }

  svg.on('focus', () => {
    // -> A click focuses the SVG as well, and a mouse reader has not asked to be walked from the root
    if (!state.activeId && state.scene && svg.node().matches(':focus-visible')) {
      setActive(state.scene.root.data.id)
    }
  })
  svg.on('blur', () => {
    state.activeId = null
    applyHighlight()
    options.onHover(null)
  })
  svg.on('keydown', (ev) => {
    if (!state.scene) {
      return
    }
    const hnode = state.scene.nodesById.get(state.activeId) ?? state.scene.root
    const siblings = hnode.parent?.children ?? [hnode]
    const index = siblings.indexOf(hnode)
    let next = null
    switch (ev.key) {
      case 'ArrowDown':
        next = siblings[index + 1]
        break
      case 'ArrowUp':
        next = siblings[index - 1]
        break
      case 'ArrowRight':
        next = hnode.children?.[0]
        break
      case 'ArrowLeft':
        next = hnode.parent
        break
      case 'Home':
        next = state.scene.root
        break
      case 'Enter':
      case ' ':
        activate(hnode.data.id)
        break
      case '+':
      case '=':
        if (actionsFor(hnode.data).includes('zoom')) {
          activate(hnode.data.id, 'zoom')
        }
        break
      case '-':
      case 'Backspace':
        activate(state.scene.root.data.id, 'up')
        break
      case 'Escape':
        // -> Only swallowed when there is something to let go of: otherwise it is the overlay's
        if (!state.activeId) {
          return
        }
        setActive(null)
        break
      default:
        return
    }
    ev.preventDefault()
    ev.stopPropagation()
    if (next) {
      setActive(next.data.id)
    }
  })

  // API ------------------------------------------------------------------

  return {
    setData(model, view) {
      stopAnimation()
      state.model = model
      state.view = view
      state.focus = model.root
      state.allowance = new Map()
      state.current = new Map()
      state.currentView = null
      state.activeId = null
      state.highlightId = null
      nodesLayer.selectAll('*').remove()
      edgesLayer.selectAll('*').remove()
      linksLayer.selectAll('*').remove()
      this.setSearch(state.query ?? '', { silent: true })
      rebuild()
    },
    setView(view) {
      if (view === state.view) {
        return
      }
      state.view = view
      options.onHover(null)
      if (state.model) {
        rebuild()
      }
    },
    focusOn(id) {
      const node = state.model?.nodes.get(id)
      if (node) {
        focusOn(node)
      }
    },
    activate,
    /** Let go of the highlight the pointer left behind, unless the keyboard has one of its own. */
    clearHover() {
      state.highlightId = null
      applyHighlight()
    },
    setSearch(query, { silent = false } = {}) {
      state.query = query
      if (!state.model) {
        return
      }
      state.matches = searchModel(state.model, query)
      state.containsMatch = new Set()
      for (const id of state.matches) {
        for (let node = state.model.nodes.get(id)?.parent; node; node = node.parent) {
          state.containsMatch.add(node.id)
        }
      }
      if (!silent && state.scene) {
        applySearch()
        emitChange()
      }
    },
    fit: () => fitToScreen(),
    zoomIn: () => zoomBy(1.4),
    zoomOut: () => zoomBy(1 / 1.4),
    destroy() {
      stopAnimation()
      clearTimeout(state.activeTimer)
      svg.interrupt()
      svg.remove()
    }
  }
}
