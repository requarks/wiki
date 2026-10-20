/**
 * Flatten a page's contents tree to the rows a contents list draws.
 *
 * Shared rather than living inside `PageToc`, because which rows survive the depth settings is also
 * what decides whether the sidebar has a contents section at all — the heading above the list and the
 * separators between the sidebar's sections are the caller's markup, so the caller has to be able to
 * ask the same question and get the same answer.
 *
 * `minDepth` and `maxDepth` are heading levels, matching how the page properties panel labels them
 * (`H{min} → H{max}`) and what that plainly says: `H1 → H2` shows `h1` and `h2` and nothing else. A
 * heading's own level decides that, never its place in the tree — an `h3` written straight under an
 * `h1` is still an `h3`, and an author reaching for a smaller heading to get smaller text is not
 * asking for a row in the contents.
 *
 * Indentation is rebased on the shallowest level that survived, so a page whose headings start at
 * `h2` opens at the list's own top tier rather than spending one on a level it never uses.
 *
 * @param {Array<{ key: string, label: string, level: number, children?: Array }>} nodes The tree.
 * @param {object} [opts]
 * @param {number} [opts.minDepth] Shallowest heading level to include, from 1.
 * @param {number} [opts.maxDepth] Deepest heading level to include, from 1.
 * @returns {Array<{ key: string, label: string, depth: number }>} Rows, in document order.
 */
export function flattenToc(nodes, { minDepth = 1, maxDepth = 2 } = {}) {
  const included = []

  // -> Every node is walked, shown or not: a heading outside the range can still hold the ones that
  //    are, which is all the nesting is used for here
  const walk = (level) => {
    for (const node of level) {
      if (node.level >= minDepth && node.level <= maxDepth) {
        included.push(node)
      }
      if (node.children?.length) {
        walk(node.children)
      }
    }
  }

  walk(nodes ?? [])
  if (included.length < 1) {
    return []
  }

  const base = Math.min(...included.map((node) => node.level))
  return included.map((node) => ({
    key: node.key,
    label: node.label,
    depth: node.level - base
  }))
}

/**
 * A heading as an anchor fragment: lowercase, words joined by hyphens.
 *
 * One rule on both sides of the wire. The server gives every heading of a saved page its id with
 * `slugifyHeading` in `backend/models/rendering.ts`, and this is its copy for the two places the
 * browser has to spell the same id -- a `[[Page#Some Heading]]` wikilink (`markdown-it-wikilinks.js`),
 * and a render that never goes through the server at all (`anchorHeadings` below). The two have to
 * agree.
 *
 * @param {string} text The heading as a reader sees it.
 * @returns {string}
 */
export function slugifyHeading(text) {
  return (
    text
      .toLowerCase()
      .trim()
      .replaceAll(/[^\p{L}\p{N}\s-]/gu, '')
      .replaceAll(/\s+/g, '-')
      .replaceAll(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100) || 'section'
  )
}

/**
 * The heading level a tab asked to be listed at, or null for one that is not a heading. Mirrors
 * `tabHeadingLevel` in `backend/models/rendering.ts`.
 */
function tabHeadingLevel(value) {
  return /^[1-6]$/.test((value ?? '').trim()) ? Number.parseInt(value.trim(), 10) : null
}

/**
 * Give every heading in a render an id, and build the contents tree out of them.
 *
 * What the server does to a page as it is saved (`anchorHeadings` in `backend/models/rendering.ts`),
 * done in the browser for a render that is never saved anywhere -- a live note's, drawn by
 * `LiveNoteReader.vue`. Same ids, same tree, tabs asking to be headings included, so that the
 * contents list and a `#fragment` link behave exactly as they do on a page.
 *
 * Mutates `root` in place.
 *
 * @param {ParentNode} root What holds the render: an element, or a template's content.
 * @returns {Array<{ key: string, label: string, level: number, children: Array }>} The tree `PageToc`
 *   draws, the shape a page's `toc` has.
 */
export function anchorHeadings(root) {
  const used = new Map()
  const flat = []

  for (const el of root.querySelectorAll('h1, h2, h3, h4, h5, h6, block-tab[header]')) {
    const isTab = el.localName === 'block-tab'
    const level = isTab ? tabHeadingLevel(el.getAttribute('header')) : Number(el.localName.slice(1))
    const label = ((isTab ? el.getAttribute('label') : el.textContent) ?? '').trim()
    if (!level || (isTab && !label)) {
      continue
    }
    let key = el.getAttribute('id') || slugifyHeading(label)
    const seen = used.get(key) ?? 0
    used.set(key, seen + 1)
    if (seen > 0) {
      key = `${key}-${seen}`
    }
    el.setAttribute('id', key)
    flat.push({ level, node: { key: `#${key}`, label, level, children: [] } })
  }

  // -> Nested by relative level, so a render starting at `h2`, or skipping one, still has a top tier
  const tree = []
  const stack = []
  for (const entry of flat) {
    while (stack.length > 0 && stack.at(-1).level >= entry.level) {
      stack.pop()
    }
    if (stack.length > 0) {
      stack.at(-1).node.children.push(entry.node)
    } else {
      tree.push(entry.node)
    }
    stack.push(entry)
  }
  return tree
}
