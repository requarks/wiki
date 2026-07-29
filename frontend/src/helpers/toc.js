/**
 * Flatten a page's contents tree to the rows a contents list draws.
 *
 * Shared rather than living inside `PageToc`, because which rows survive the depth settings is also
 * what decides whether the sidebar has a contents section at all — the heading above the list and the
 * separators between the sidebar's sections are the caller's markup, so the caller has to be able to
 * ask the same question and get the same answer.
 *
 * `minDepth` and `maxDepth` are levels counting from 1, matching how the page properties panel labels
 * them (`H{min} → H{max}`). A row's `depth` is rebased on `minDepth`, so skipped levels give up their
 * indentation with them and the list opens at its own top tier; skipped headings are still walked
 * through, since it is their subheadings that are being asked for.
 *
 * @param {Array<{ key: string, label: string, children?: Array }>} nodes The contents tree.
 * @param {object} [opts]
 * @param {number} [opts.minDepth] Shallowest level to include, from 1.
 * @param {number} [opts.maxDepth] Deepest level to include, from 1.
 * @returns {Array<{ key: string, label: string, depth: number }>} Rows, in document order.
 */
export function flattenToc(nodes, { minDepth = 1, maxDepth = 2 } = {}) {
  const rows = []
  const skipped = Math.max(minDepth - 1, 0)

  const walk = (level, depth) => {
    if (depth >= maxDepth) {
      return
    }
    for (const node of level) {
      if (depth >= skipped) {
        rows.push({ key: node.key, label: node.label, depth: depth - skipped })
      }
      if (node.children?.length) {
        walk(node.children, depth + 1)
      }
    }
  }

  walk(nodes ?? [], 0)
  return rows
}
