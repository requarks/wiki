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
