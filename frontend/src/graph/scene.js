import { hierarchy } from 'd3-hierarchy'

/**
 * What of the model is drawn right now.
 *
 * The model is the whole locale; a scene is one screenful of it, and this is the only place that
 * decides which. That is what makes the graph cost the same at any size: every view draws at most
 * its `budget` of nodes, whatever the wiki holds, and the rest is folded into the nodes above it.
 *
 * Three ways a part of the tree is kept out, each drawn as something that can be asked for:
 *
 *  - **A collapsed folder** is one node standing for everything under it, drawn with a count. Levels
 *    are opened breadth first, the smallest folders of a level first, until the next would not fit —
 *    so the shape of the whole tree is always visible, and detail fills in as far as the budget goes.
 *  - **A long folder** shows its first `maxChildren` entries and a "more" node for the rest, since
 *    one folder of three thousand pages would otherwise use the whole budget on one level.
 *  - **Outside the focus.** Zoomed into a section, the rest of the wiki is not drawn -- but a link
 *    crossing into it still is, to a stub naming the branch it goes to.
 *
 * Scene nodes wrap model nodes rather than being them: a collapsed folder and an expanded one are the
 * same model node and different scene nodes, and the stubs and "more" nodes have no model node at all.
 */

/** A ceiling on drawn links, strongest kept. Past it a view is a solid disc of ink anyway. */
const MAX_SCENE_LINKS = 4000

/** Past this many linked pages in one other locale, the locale is drawn as one stub for all of them. */
const MAX_STUBS_PER_LOCALE = 40

/**
 * @param {object} model From `buildModel`.
 * @param {object} opts
 * @param {object} opts.focus The model node the scene is rooted at.
 * @param {number} opts.budget How many nodes the view draws at most.
 * @param {number} opts.maxChildren How many entries of one folder are shown before "more".
 * @param {Map<string, number>} opts.allowance Folders whose "more" has been opened, with how many.
 * @param {boolean} opts.withLinks Whether to gather links, and the stubs their far ends need.
 * @param {object} opts.labels `elsewhere` (the group of stubs outside the focus) and `locale(code)`.
 */
export function buildScene(model, { focus, budget, maxChildren, allowance, withLinks, labels }) {
  // -> BREADTH FIRST: which folders are opened, and how many of each one's entries are shown
  const expanded = new Map()
  let count = 1
  let frontier = [focus]
  while (frontier.length > 0) {
    const next = []
    const candidates = frontier
      .filter((node) => node.children.length > 0)
      .sort((a, b) => a.children.length - b.children.length)
    for (const node of candidates) {
      const shown = Math.min(node.children.length, allowance.get(node.id) ?? maxChildren)
      const cost = shown + (shown < node.children.length ? 1 : 0)
      // -> The focus always opens: a section zoomed into and drawn as a single bubble would be a
      //    click that did nothing
      if (node !== focus && count + cost > budget) {
        // -> Sorted smallest first, so nothing after this one on the level fits either
        break
      }
      expanded.set(node, shown)
      count += cost
      next.push(...node.children.slice(0, shown))
    }
    frontier = next
  }

  const byId = new Map()
  function build(node) {
    const shown = expanded.get(node)
    const item = {
      id: node.id,
      kind: 'node',
      node,
      title: node.title,
      collapsed: shown === undefined && node.children.length > 0,
      // -> For a collapsed folder, the pages it stands for
      hidden: shown === undefined ? node.size - (node.page ? 1 : 0) : 0,
      hue: node.hue
    }
    byId.set(item.id, item)
    if (shown !== undefined) {
      item.children = node.children.slice(0, shown).map(build)
      if (shown < node.children.length) {
        const more = {
          id: `more:${node.id}`,
          kind: 'more',
          node,
          title: '',
          hidden: node.children.length - shown,
          hue: node.hue
        }
        byId.set(more.id, more)
        item.children.push(more)
      }
    }
    return item
  }
  const top = build(focus)

  const links = withLinks ? gatherLinks(model, { focus, top, byId, expanded, labels }) : []

  const root = hierarchy(top)
  const nodesById = new Map()
  for (const hnode of root.descendants()) {
    nodesById.set(hnode.data.id, hnode)
  }
  return { root, nodesById, links, focus }
}

/**
 * Every link of the model, folded onto what the scene draws.
 *
 * Each end is moved to the nearest thing drawn for it: the page itself, the collapsed folder or the
 * "more" node it is hidden in, or -- outside the focus -- a stub for the branch it is in. Two links
 * landing on the same pair become one, weighted by both, which is what keeps a collapsed section's
 * links from being a hundred lines on top of one another.
 */
function gatherLinks(model, { focus, top, byId, expanded, labels }) {
  const aboveFocus = new Set()
  for (let node = focus.parent; node; node = node.parent) {
    aboveFocus.add(node.id)
  }

  const outside = new Map()
  const external = new Map()

  /** Where one end of a link is drawn, or null for a branch-outside stub not yet made. */
  function drawnAt(node) {
    if (node.isExternal) {
      return { external: node }
    }
    let current = node
    let below = null
    while (current) {
      const item = byId.get(current.id)
      if (item) {
        // -> Arrived at an expanded folder from an entry it does not show: that entry is under "more"
        if (below && expanded.has(current)) {
          return { item: byId.get(`more:${current.id}`) ?? item }
        }
        return { item }
      }
      if (aboveFocus.has(current.id)) {
        // -> Outside the focus: named after the branch leading to it from where the two meet, or
        //    after the node itself when it is one of the focus's own ancestors
        return { outside: below ?? current }
      }
      below = current
      current = current.parent
    }
    return null
  }

  const pending = []
  for (const link of model.links) {
    const from = drawnAt(link.source)
    const to = drawnAt(link.target)
    if (!from || !to || (!from.item && !to.item)) {
      // -> Neither end in the section: nothing to draw it between
      continue
    }
    for (const end of [from, to]) {
      if (end.outside) {
        outside.set(end.outside.id, end.outside)
      } else if (end.external) {
        const perLocale = external.get(end.external.locale) ?? new Map()
        perLocale.set(end.external.id, end.external)
        external.set(end.external.locale, perLocale)
      }
    }
    pending.push({ from, to, link })
  }

  // -> The stubs, each group appended to the focus's own entries so that it takes an arc of its own at
  //    the rim rather than landing among the section's pages
  const groups = []
  if (outside.size > 0) {
    const group = { id: 'group:outside', kind: 'group', title: labels.elsewhere, hue: null }
    group.children = [...outside.values()].map((node) => {
      const stub = {
        id: `out:${node.id}`,
        kind: 'stub',
        stub: 'outside',
        node,
        title: node.title,
        hue: node.hue
      }
      byId.set(stub.id, stub)
      return stub
    })
    byId.set(group.id, group)
    groups.push(group)
  }
  for (const [locale, pages] of [...external.entries()].sort()) {
    const group = {
      id: `group:locale:${locale}`,
      kind: 'group',
      locale,
      title: labels.locale(locale),
      hue: null
    }
    if (pages.size > MAX_STUBS_PER_LOCALE) {
      // -> One stub for the whole locale: forty names round the rim already reads as a wall
      group.kind = 'stub'
      group.stub = 'locale'
      group.hidden = pages.size
    } else {
      group.children = [...pages.values()].map((node) => {
        const stub = {
          id: `ext:${node.id}`,
          kind: 'stub',
          stub: 'external',
          node,
          locale,
          title: node.title,
          hue: null
        }
        byId.set(stub.id, stub)
        return stub
      })
    }
    byId.set(group.id, group)
    groups.push(group)
  }
  if (groups.length > 0) {
    top.children = [...(top.children ?? []), ...groups]
  }

  const resolveEnd = (end) => {
    if (end.item) {
      return end.item
    }
    if (end.outside) {
      return byId.get(`out:${end.outside.id}`)
    }
    return byId.get(`ext:${end.external.id}`) ?? byId.get(`group:locale:${end.external.locale}`)
  }

  const merged = new Map()
  const KIND_RANK = { link: 0, relation: 1, redirect: 2 }
  for (const { from, to, link } of pending) {
    const source = resolveEnd(from)
    const target = resolveEnd(to)
    if (!source || !target || source === target) {
      continue
    }
    const id = `${source.id}>${target.id}`
    const edge = merged.get(id)
    if (edge) {
      edge.weight += link.weight
      edge.count++
      if (KIND_RANK[link.kind] > KIND_RANK[edge.kind]) {
        edge.kind = link.kind
      }
    } else {
      merged.set(id, {
        id,
        source: source.id,
        target: target.id,
        kind: link.kind,
        weight: link.weight,
        count: 1
      })
    }
  }
  const links = [...merged.values()]
  if (links.length > MAX_SCENE_LINKS) {
    links.sort((a, b) => b.weight - a.weight)
    links.length = MAX_SCENE_LINKS
  }
  return links
}
