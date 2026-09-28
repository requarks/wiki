/**
 * The page graph as a tree of nodes, built once per fetch.
 *
 * `GET /sites/:siteId/tree/graph` answers with flat lists -- pages, the folders above them, links by
 * index -- and every view draws a hierarchy, so this is where one becomes the other. It is the whole
 * of the wiki's structure for one locale and is never drawn as it stands: `scene.js` cuts out what
 * fits on a screen, which is what lets a locale of fifty thousand pages cost no more to draw than one
 * of fifty.
 *
 * A node is a PATH, not a page: `guides` can be a page, the folder of pages under it, or both at
 * once, and in a tree those are one place with one name. `node.page` is set when there is a page
 * there, and `node.children` when there is anything under it.
 */

export const ROOT_ID = 'root'

/**
 * The hues given to top-level sections that nobody has coloured, in order.
 *
 * Spread round the wheel so neighbours differ, and skipping the yellows, which have too little
 * contrast against a light background to carry a label beside them.
 */
const SECTION_HUES = [210, 155, 25, 275, 340, 190, 95, 250, 5, 125]

/**
 * The hue a folder colour actually renders as.
 *
 * `folderColors.js` stores a ROTATION of a yellow folder icon, so the colour a reader has seen on the
 * folder is that yellow turned by the stored angle -- 45 degrees being where the icon starts.
 */
const FOLDER_ICON_HUE = 45

function makeNode(fields) {
  return {
    id: fields.id,
    path: fields.path ?? '',
    title: fields.title ?? '',
    parent: fields.parent ?? null,
    children: [],
    depth: fields.parent ? fields.parent.depth + 1 : 0,
    /** The page at this path, when there is one: `{ locale, path, isPublished, isRedirect }`. */
    page: null,
    /** The folder colour set on this very folder, in rendered degrees. */
    ownHue: fields.ownHue ?? null,
    /** The colour it is drawn in: its own, or its section's. Null draws it neutral. */
    hue: null,
    /** How many pages are at or under this path. */
    size: 0,
    linksIn: 0,
    linksOut: 0,
    isExternal: false
  }
}

/**
 * @param {object} reply What the graph endpoint answered.
 * @param {object} opts
 * @param {string} opts.rootTitle What the node standing for the whole site is called.
 * @returns {object} The model: `root`, `nodes` (by id), `links`, `externals`, `truncated`.
 */
export function buildModel(reply, { rootTitle }) {
  const locale = reply.locale
  const nodes = new Map()
  const root = makeNode({ id: ROOT_ID, title: rootTitle })
  nodes.set(ROOT_ID, root)

  const folders = new Map(reply.folders.map((folder) => [folder.path, folder]))

  /** The node at a path of this locale, creating every folder above it on the way. */
  function nodeAt(path) {
    if (!path) {
      return root
    }
    const id = `n:${path}`
    let node = nodes.get(id)
    if (node) {
      return node
    }
    const slash = path.lastIndexOf('/')
    const parent = nodeAt(slash < 0 ? '' : path.slice(0, slash))
    const folder = folders.get(path)
    node = makeNode({
      id,
      path,
      // -> A path segment with no folder row of its own is named after the segment, which is what the
      //    file manager's tree shows for it too
      title: folder?.title || path.slice(slash + 1),
      parent,
      ownHue: folder?.hue ? (FOLDER_ICON_HUE + folder.hue) % 360 : null
    })
    parent.children.push(node)
    nodes.set(id, node)
    return node
  }

  // -> Index into `reply.pages` to the node it became, which is how links address pages
  const byIndex = []
  const externals = []
  reply.pages.forEach((page, index) => {
    const info = {
      id: page.id,
      locale: page.locale,
      path: page.path,
      isPublished: page.isPublished,
      isRedirect: page.isRedirect
    }
    if (page.locale === locale) {
      const node = nodeAt(page.path)
      node.page = info
      // -> The page's title wins over its folder's: one name for the one place, and the page is what
      //    a reader would search for
      node.title = page.title || node.title
      byIndex[index] = node
    } else {
      // -> Another locale's page, here only because something in this one links to it. Not placed in
      //    the tree: it has no folder of this locale to sit in
      const node = makeNode({ id: `x:${page.id}`, path: page.path, title: page.title })
      node.page = info
      node.isExternal = true
      node.locale = page.locale
      externals.push(node)
      nodes.set(node.id, node)
      byIndex[index] = node
    }
  })

  const links = []
  for (const link of reply.links) {
    const source = byIndex[link.source]
    const target = byIndex[link.target]
    if (!source || !target) {
      continue
    }
    source.linksOut++
    target.linksIn++
    links.push({ source, target, kind: link.kind, weight: link.weight })
  }

  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
  let sectionIndex = 0
  ;(function finish(node, hue) {
    node.children.sort((a, b) => collator.compare(a.title, b.title))
    if (node.depth === 1 && node.ownHue === null) {
      // -> Only a section with something in it takes a colour from the rotation, so a root full of
      //    single pages does not use the palette up before the first real section
      hue = node.children.length > 0 ? SECTION_HUES[sectionIndex++ % SECTION_HUES.length] : null
    }
    node.hue = node.ownHue ?? hue
    node.size = node.page ? 1 : 0
    for (const child of node.children) {
      finish(child, node.hue)
      node.size += child.size
    }
  })(root, null)

  return {
    locale,
    root,
    nodes,
    links,
    externals,
    pageCount: root.size,
    truncated: reply.truncated
  }
}

/**
 * The ids of every node whose title or path contains the query, case and accents aside.
 *
 * A substring rather than a fuzzy match: this highlights, it does not rank, and a fuzzy matcher lights
 * up half a wiki on a three-letter query.
 */
export function searchModel(model, query) {
  const needle = fold(query.trim())
  const hits = new Set()
  if (!needle) {
    return hits
  }
  for (const node of model.nodes.values()) {
    if (node.id === ROOT_ID) {
      continue
    }
    if (fold(node.title).includes(needle) || fold(node.path).includes(needle)) {
      hits.add(node.id)
    }
  }
  return hits
}

function fold(str) {
  return str
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}
