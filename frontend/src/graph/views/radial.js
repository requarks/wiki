import { tree } from 'd3-hierarchy'
import { linkRadial } from 'd3-shape'
import { boundsOf, polarToXY, radialLabel, radialLabelEnd } from './shared.js'

/**
 * Hierarchical Radial: the same tree as the Hierarchical Tree, wrapped round its root.
 *
 * Positions are kept as an angle and a radius rather than as a point, so that a node moving between
 * two layouts of this view swings round the centre instead of cutting across it.
 */

/** Arc length each leaf is given on the outer ring, and the gap between rings. */
const LEAF_ARC = 16
const RING = 140

const edge = linkRadial()
  .angle((pos) => pos.a)
  .radius((pos) => pos.r)

export default {
  key: 'radial',
  icon: 'mdi:radar',
  labelKey: 'fileman.graph.viewRadial',
  budget: 700,
  maxChildren: 250,
  links: false,
  labelChars: 28,
  fontSize: 11,

  layout(scene) {
    const { root } = scene
    const leaves = root.leaves().length
    const radius = Math.max(RING * Math.max(root.height, 1), (leaves * LEAF_ARC) / (2 * Math.PI))

    tree()
      .size([2 * Math.PI, radius])
      .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth)(root)

    const positions = new Map()
    const edges = []
    for (const node of root.descendants()) {
      positions.set(node.data.id, { a: node.x, r: node.y })
      if (node.parent) {
        edges.push({
          id: node.data.id,
          parent: node.parent.data.id,
          child: node.data.id,
          depth: node.depth
        })
      }
    }

    return {
      positions,
      edges,
      place: polarToXY,
      label: (pos, node) => radialLabel(pos, node.depth === 0),
      edgePath: (s, t) => edge({ source: s, target: t }),
      bounds: boundsOf(root, positions, polarToXY, {
        chars: this.labelChars,
        labelEnd: radialLabelEnd
      })
    }
  }
}
